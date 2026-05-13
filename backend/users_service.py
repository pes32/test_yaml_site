"""Операции с пользователями и ролями."""
from __future__ import annotations

from typing import Any

import psycopg2
import psycopg2.extras
from werkzeug.security import check_password_hash, generate_password_hash

from .database import get_db_manager

# pbkdf2:sha256 — без hashlib.scrypt (на части сборок Python/OpenSSL scrypt недоступен).
_PASSWORD_HASH_METHOD = "pbkdf2:sha256"


def _hash_plain_password(password: str) -> str:
    """Хеш для колонки password_hash; только pbkdf2 — дефолт werkzeug (scrypt) здесь не использовать."""

    try:
        return generate_password_hash(password, method=_PASSWORD_HASH_METHOD)
    except AttributeError as exc:
        raise UserServiceError(
            "Не удалось вычислить хеш пароля: в этой сборке Python нет нужных примитивов "
            "(часто из‑за вызова scrypt по умолчанию). Нужна версия приложения с явным pbkdf2 "
            "и перезапуск сервера после обновления кода."
        ) from exc


USER_PUBLIC_COLUMNS = """
    u.user_id,
    u.user_login,
    u.user_surname,
    u.user_name,
    u.user_patronymic,
    u.user_email,
    u.user_status,
    r.role_name
"""

OWN_PROFILE_PATCH_FIELDS = frozenset({"user_surname", "user_name", "user_patronymic", "user_email"})
ADMIN_USER_PATCH_FIELDS = frozenset({
    "role_name",
    "user_login",
    "user_surname",
    "user_name",
    "user_patronymic",
    "user_email",
})


class UserServiceError(RuntimeError):
    """Контролируемая ошибка user-service."""


def _user_row_to_dict(row: Any) -> dict[str, Any] | None:
    return dict(row) if row else None


def _patch_from_allowed_fields(data: dict[str, Any], allowed_fields: frozenset[str]) -> dict[str, Any]:
    return {field: data[field] for field in allowed_fields if field in data}


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    with get_db_manager().get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {USER_PUBLIC_COLUMNS}
                FROM users u
                JOIN roles r ON r.role_id = u.role_id
                WHERE u.user_id = %s
                """,
                (user_id,),
            )
            return _user_row_to_dict(cursor.fetchone())


def get_user_by_login(login: str, *, include_password_hash: bool = False) -> dict[str, Any] | None:
    extra = ", u.password_hash" if include_password_hash else ""
    with get_db_manager().get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {USER_PUBLIC_COLUMNS}{extra}
                FROM users u
                JOIN roles r ON r.role_id = u.role_id
                WHERE u.user_login = %s
                """,
                (str(login or "").strip(),),
            )
            return _user_row_to_dict(cursor.fetchone())


def list_users(*, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    safe_limit = max(1, min(int(limit or 100), 500))
    safe_offset = max(0, int(offset or 0))
    with get_db_manager().get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {USER_PUBLIC_COLUMNS}
                FROM users u
                JOIN roles r ON r.role_id = u.role_id
                ORDER BY u.user_login ASC
                LIMIT %s OFFSET %s
                """,
                (safe_limit, safe_offset),
            )
            return [dict(row) for row in cursor.fetchall()]


def list_roles() -> list[dict[str, Any]]:
    with get_db_manager().get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("SELECT role_id, role_name FROM roles ORDER BY role_name")
            return [dict(row) for row in cursor.fetchall()]


def create_user(
    *,
    login: str,
    role_name: str,
    password: str,
) -> dict[str, Any]:
    normalized_login = str(login or "").strip()
    normalized_role = str(role_name or "user").strip() or "user"
    if not normalized_login:
        raise UserServiceError("Логин не должен быть пустым")
    if not str(password or "").strip():
        raise UserServiceError("Пароль не должен быть пустым")

    pwd_hash = _hash_plain_password(str(password))

    with get_db_manager().get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("SELECT role_id FROM roles WHERE role_name = %s", (normalized_role,))
            if not cursor.fetchone():
                raise UserServiceError(f"Роль не найдена: {normalized_role}")
            cursor.execute(
                "SELECT ok, message FROM create_user(%s, %s)",
                (normalized_login, pwd_hash),
            )
            row = cursor.fetchone()
            if not row or not row.get("ok"):
                raise UserServiceError(str(row.get("message") if row else "") or "Не удалось создать пользователя")
            cursor.execute(
                f"""
                SELECT {USER_PUBLIC_COLUMNS}
                FROM users u
                JOIN roles r ON r.role_id = u.role_id
                WHERE u.user_login = %s
                """,
                (normalized_login,),
            )
            created = _user_row_to_dict(cursor.fetchone())
            if created and created.get("role_name") != normalized_role:
                cursor.execute(
                    "SELECT ok, message FROM edit_user(%s, %s)",
                    (
                        created.get("user_id"),
                        psycopg2.extras.Json({"role_name": normalized_role}),
                    ),
                )
                row = cursor.fetchone()
                if not row or not row.get("ok"):
                    raise UserServiceError(str(row.get("message") if row else "") or "Не удалось назначить роль")
                cursor.execute(
                    f"""
                    SELECT {USER_PUBLIC_COLUMNS}
                    FROM users u
                    JOIN roles r ON r.role_id = u.role_id
                    WHERE u.user_login = %s
                    """,
                    (normalized_login,),
                )
                created = _user_row_to_dict(cursor.fetchone())
        conn.commit()

    if not created:
        raise UserServiceError("Созданный пользователь не найден")
    return created


def update_own_profile(
    *,
    user_id: int,
    data: dict[str, Any],
) -> dict[str, Any]:
    target = get_user_by_id(user_id)
    if not target:
        raise UserServiceError("Пользователь не найден")
    patch = _patch_from_allowed_fields(data, OWN_PROFILE_PATCH_FIELDS)
    if not patch:
        return target

    with get_db_manager().get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                "SELECT ok, message FROM edit_user(%s, %s)",
                (
                    user_id,
                    psycopg2.extras.Json(patch),
                ),
            )
            row = cursor.fetchone()
            if not row or not row.get("ok"):
                raise UserServiceError(str(row.get("message") if row else "") or "Не удалось сохранить профиль")
        conn.commit()

    user = get_user_by_id(user_id)
    if not user:
        raise UserServiceError("Пользователь не найден")
    return user


def change_own_password(*, user_id: int, old_password: str, new_password: str) -> None:
    if not str(new_password or "").strip():
        raise UserServiceError("Новый пароль не должен быть пустым")
    with get_db_manager().get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("SELECT password_hash FROM users WHERE user_id = %s", (user_id,))
            row = cursor.fetchone()
            if not row:
                raise UserServiceError("Пользователь не найден")
            stored = str(row.get("password_hash") or "")
            if not check_password_hash(stored, str(old_password)):
                raise UserServiceError("Старый пароль указан неверно")
            new_hash = _hash_plain_password(str(new_password))
            cursor.execute(
                "SELECT ok, message FROM set_user_password(%s, %s)",
                (user_id, new_hash),
            )
            proc = cursor.fetchone()
            if not proc or not proc.get("ok"):
                raise UserServiceError(str(proc.get("message") if proc else "") or "Не удалось сменить пароль")
        conn.commit()


def update_user_admin(*, target_user_id: int, data: dict[str, Any], actor_user_id: int) -> dict[str, Any]:
    target = get_user_by_id(target_user_id)
    if not target:
        raise UserServiceError("Пользователь не найден")

    patch = _patch_from_allowed_fields(data, ADMIN_USER_PATCH_FIELDS)
    if "user_login" in patch and not str(patch.get("user_login") or "").strip():
        raise UserServiceError("Логин не должен быть пустым")
    if (
        target_user_id == actor_user_id
        and "role_name" in patch
        and str(patch.get("role_name") or "").strip() != target.get("role_name")
    ):
        raise UserServiceError("Admin не может изменить свою роль")
    if not patch:
        return target

    with get_db_manager().get_connection() as conn:
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT ok, message FROM edit_user(%s, %s)",
                    (
                        target_user_id,
                        psycopg2.extras.Json(patch),
                    ),
                )
                row = cursor.fetchone()
                if not row or not row.get("ok"):
                    raise UserServiceError(str(row.get("message") if row else "") or "Не удалось сохранить пользователя")
            conn.commit()
        except psycopg2.Error as exc:
            conn.rollback()
            raise UserServiceError(str(exc).strip() or "Не удалось сохранить пользователя") from exc

    updated = get_user_by_id(target_user_id)
    if not updated:
        raise UserServiceError("Пользователь не найден")
    return updated


def set_user_password_admin(
    *,
    target_user_id: int,
    new_password: str,
    actor_user_id: int,
) -> None:
    void_actor = actor_user_id
    void_actor  # noqa: B018

    if not str(new_password or "").strip():
        raise UserServiceError("Пароль не должен быть пустым")
    pwd_hash = _hash_plain_password(str(new_password))
    with get_db_manager().get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                "SELECT ok, message FROM set_user_password(%s, %s)",
                (target_user_id, pwd_hash),
            )
            row = cursor.fetchone()
            if not row or not row.get("ok"):
                raise UserServiceError(str(row.get("message") if row else "") or "Не удалось задать пароль")
        conn.commit()


def toggle_user_block(*, target_user_id: int, actor_user_id: int) -> dict[str, Any]:
    target = get_user_by_id(target_user_id)
    if not target:
        raise UserServiceError("Пользователь не найден")
    if target_user_id == actor_user_id:
        raise UserServiceError("Нельзя заблокировать самого себя")
    next_status = "blocked" if target.get("user_status") == "active" else "active"
    with get_db_manager().get_connection() as conn:
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT ok, message FROM set_user_status(%s, %s)",
                    (target_user_id, next_status),
                )
                row = cursor.fetchone()
                if not row or not row.get("ok"):
                    raise UserServiceError(str(row.get("message") if row else "") or "Не удалось изменить статус")
            conn.commit()
        except psycopg2.Error as exc:
            conn.rollback()
            raise UserServiceError(str(exc).strip() or "Не удалось изменить статус") from exc

    if next_status == "blocked":
        from .auth_service import revoke_user_sessions

        revoke_user_sessions(target_user_id)

    updated = get_user_by_id(target_user_id)
    if not updated:
        raise UserServiceError("Пользователь не найден")
    return updated
