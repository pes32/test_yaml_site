"""Авторизация, серверные сессии и role guards."""
from __future__ import annotations

import hashlib
import secrets
from functools import wraps
from typing import Any, Callable

from werkzeug.security import check_password_hash
from flask import Request, request

from .api_response import error_payload, json_response
from .database import get_db_manager
from .env_utils import parse_bool_env
from .users_service import get_user_by_id, get_user_by_login

SESSION_COOKIE_NAME = "yamls_session"


class AuthError(RuntimeError):
    """Контролируемая ошибка авторизации."""

    def __init__(self, message: str, *, code: str = "auth_error", status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(str(token).encode("utf-8")).hexdigest()


def _client_ip(req: Request | None = None) -> str | None:
    active_request = req or request
    forwarded = active_request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return active_request.remote_addr


def client_ip(req: Request | None = None) -> str | None:
    return _client_ip(req)


def _cookie_secure() -> bool:
    return request.is_secure or bool(
        parse_bool_env("YAMLS_SESSION_COOKIE_SECURE", False, invalid_default=False)
    )


def _user_agent(req: Request | None = None) -> str | None:
    active_request = req or request
    return active_request.headers.get("User-Agent")


def create_session(user_id: int, req: Request | None = None) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = _hash_session_token(token)
    with get_db_manager().get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO user_sessions (
                    user_id,
                    session_token_hash,
                    ip_address,
                    user_agent
                )
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, token_hash, _client_ip(req), _user_agent(req)),
            )
        conn.commit()
    return token


def revoke_session_token(token: str | None) -> None:
    if not token:
        return
    with get_db_manager().get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE user_sessions SET revoked_at = now() WHERE session_token_hash = %s AND revoked_at IS NULL",
                (_hash_session_token(token),),
            )
        conn.commit()


def revoke_user_sessions(user_id: int) -> None:
    with get_db_manager().get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE user_sessions SET revoked_at = now() WHERE user_id = %s AND revoked_at IS NULL",
                (user_id,),
            )
        conn.commit()


def get_current_user(req: Request | None = None) -> dict[str, Any] | None:
    active_request = req or request
    token = active_request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None

    token_hash = _hash_session_token(token)
    with get_db_manager().get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id
                FROM user_sessions
                WHERE session_token_hash = %s
                  AND revoked_at IS NULL
                """,
                (token_hash,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            user_id = int(row[0])
            cursor.execute(
                "UPDATE user_sessions SET last_seen_at = now() WHERE session_token_hash = %s",
                (token_hash,),
            )
        conn.commit()

    user = get_user_by_id(user_id)
    if not user or user.get("user_status") != "active":
        revoke_session_token(token)
        return None
    return user


def login_with_password(login: str, password: str, req: Request | None = None) -> tuple[dict[str, Any], str]:
    user = get_user_by_login(login, include_password_hash=True)
    if not user:
        raise AuthError("Пользователь не найден", code="user_not_found", status_code=401)
    if user.get("user_status") == "blocked":
        raise AuthError("Ваш аккаунт заблокирован", code="user_blocked", status_code=403)

    stored_hash = str(user.pop("password_hash", "") or "")
    if not stored_hash or not check_password_hash(stored_hash, str(password)):
        raise AuthError("Неверный пароль", code="invalid_password", status_code=401)

    token = create_session(int(user["user_id"]), req)
    return user, token


def set_session_cookie(response, token: str):
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        samesite="Lax",
        secure=_cookie_secure(),
    )
    return response


def clear_session_cookie(response):
    response.delete_cookie(SESSION_COOKIE_NAME, samesite="Lax", secure=_cookie_secure())
    return response


def auth_error_response(message: str, *, code: str = "auth_required", status: int = 401):
    return json_response(error_payload(code=code, message=message), status)


def require_auth(handler: Callable):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return auth_error_response("Требуется авторизация", code="auth_required", status=401)
        return handler(user, *args, **kwargs)

    return wrapper


def require_admin(handler: Callable):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return auth_error_response("Требуется авторизация", code="auth_required", status=401)
        if user.get("role_name") != "admin":
            return auth_error_response("Требуется роль admin", code="admin_required", status=403)
        return handler(user, *args, **kwargs)

    return wrapper
