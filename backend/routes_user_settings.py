"""Страница /user_settings и связанные API."""
from __future__ import annotations

import os
import shutil
import subprocess
from datetime import date

from flask import make_response, render_template, request

from .api_response import error_payload, json_response, no_cache, success_payload
from .auth_service import require_admin, require_auth
from .db_settings_service import (
    DbSettingsError,
    load_active_db_settings,
    load_fallback_db_settings,
    normalize_db_settings,
    save_and_activate_runtime_db_settings,
    test_db_settings,
)
from .users_service import (
    UserServiceError,
    change_own_password,
    create_user,
    list_roles,
    list_users,
    set_user_password_admin,
    toggle_user_block,
    update_own_profile,
    update_user_admin,
)


def _public_db_settings(loaded: dict):
    settings = dict(loaded.get("settings") or {})
    password_set = bool(settings.pop("password", ""))
    settings["password_set"] = password_set
    return {
        "settings": settings,
        "source": loaded.get("source"),
        "path": loaded.get("path"),
    }


def _service_error(code: str, exc: Exception, status: int = 400):
    cause = getattr(exc, "__cause__", None)
    details = str(cause).strip() if cause else None
    return json_response(error_payload(code=code, message=str(exc), details=details), status)


def _db_settings_payload(data: dict) -> dict:
    payload = dict(data or {})
    password_changed = bool(payload.pop("password_changed", False))
    password_source = str(payload.pop("password_source", "") or "")
    password_value = payload.get("password")

    if not password_changed and not str(password_value or ""):
        base = load_fallback_db_settings() if password_source == "fallback" else load_active_db_settings()
        payload["password"] = (base.get("settings") or {}).get("password", "")

    return payload


def _download_filename(kind: str, db_name: str) -> str:
    safe_db_name = "".join(
        ch if ch.isascii() and (ch.isalnum() or ch in {"_", "-", "."}) else "_"
        for ch in str(db_name or "").strip()
    ).strip("_") or "database"
    today = date.today().strftime("%Y_%m_%d")
    if kind == "schema_only":
        return f"{today}_{safe_db_name}_schema.sql"
    return f"{today}_{safe_db_name}.sql"


def _pg_dump_executable() -> str | None:
    path = shutil.which("pg_dump")
    if path:
        return path
    candidates = [
        "/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump",
        "/Applications/Postgres.app/Contents/Versions/17/bin/pg_dump",
        "/Applications/Postgres.app/Contents/Versions/16/bin/pg_dump",
        "/opt/homebrew/opt/libpq/bin/pg_dump",
        "/usr/local/opt/libpq/bin/pg_dump",
        "/usr/local/Cellar/libpq/17.4_1/bin/pg_dump",
        "/usr/local/Cellar/libpq/16.2_1/bin/pg_dump",
    ]
    for candidate in candidates:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def _run_pg_dump(kind: str):
    if kind not in {"schema_only", "full"}:
        return json_response(error_payload(code="validation_error", message="Неизвестный тип дампа"), 400)

    loaded = load_active_db_settings()
    settings = loaded.get("settings") or {}
    pg_dump = _pg_dump_executable()
    if not pg_dump:
        return json_response(error_payload(code="pg_dump_not_found", message="pg_dump не найден на сервере"), 500)

    cmd = [
        pg_dump,
        "--no-owner",
        "--no-acl",
        "-F",
        "p",
        "--no-password",
        "-h",
        str(settings.get("address") or ""),
        "-p",
        str(settings.get("port") or ""),
        "-U",
        str(settings.get("user") or ""),
    ]
    if kind == "schema_only":
        cmd.append("--schema-only")
    cmd.append(str(settings.get("db_name") or ""))

    env = os.environ.copy()
    env["PGPASSWORD"] = str(settings.get("password") or "")
    env.setdefault("PGCONNECT_TIMEOUT", "10")

    try:
        result = subprocess.run(cmd, capture_output=True, env=env, timeout=300, check=False)
    except subprocess.TimeoutExpired:
        return json_response(error_payload(code="pg_dump_timeout", message="Создание дампа заняло слишком много времени"), 504)

    if result.returncode != 0:
        details = result.stderr.decode("utf-8", errors="replace").strip() or None
        return json_response(error_payload(code="pg_dump_failed", message="Не удалось создать дамп БД", details=details), 500)

    response = make_response(result.stdout)
    response.headers["Content-Type"] = "application/sql; charset=utf-8"
    response.headers["Content-Disposition"] = f'attachment; filename="{_download_filename(kind, str(settings.get("db_name") or ""))}"'
    return no_cache(response)


def register_user_settings_routes(app):
    @app.route("/user_settings")
    def user_settings_page():
        return no_cache(
            make_response(
                render_template(
                    "user_settings.html",
                    header_active="user_settings",
                )
            )
        )

    @app.route("/api/user-settings/bootstrap")
    @require_auth
    def api_user_settings_bootstrap(current_user):
        return json_response(
            success_payload(
                data={
                    "user": current_user,
                    "is_admin": current_user.get("role_name") == "admin",
                }
            )
        )

    @app.route("/api/user-settings/account", methods=["PUT"])
    @require_auth
    def api_user_settings_account_save(current_user):
        data = request.get_json(silent=True) or {}
        try:
            user = update_own_profile(
                user_id=int(current_user["user_id"]),
                data=data,
            )
        except UserServiceError as exc:
            return _service_error("user_update_failed", exc)
        return json_response(success_payload(data={"user": user}))

    @app.route("/api/user-settings/password", methods=["POST"])
    @require_auth
    def api_user_settings_password(current_user):
        data = request.get_json(silent=True) or {}
        try:
            change_own_password(
                user_id=int(current_user["user_id"]),
                old_password=str(data.get("old_password") or ""),
                new_password=str(data.get("new_password") or ""),
            )
        except UserServiceError as exc:
            return _service_error("password_change_failed", exc)
        return json_response(success_payload(data={"changed": True}))

    @app.route("/api/admin/users")
    @require_admin
    def api_admin_users(current_user):  # noqa: ARG001
        limit = request.args.get("limit", 100)
        offset = request.args.get("offset", 0)
        return json_response(success_payload(data={"users": list_users(limit=int(limit), offset=int(offset))}))

    @app.route("/api/admin/roles")
    @require_admin
    def api_admin_roles(current_user):  # noqa: ARG001
        return json_response(success_payload(data={"roles": list_roles()}))

    @app.route("/api/admin/users", methods=["POST"])
    @require_admin
    def api_admin_create_user(current_user):
        data = request.get_json(silent=True) or {}
        try:
            user = create_user(
                login=str(data.get("user_login") or ""),
                role_name=str(data.get("role_name") or ""),
                password=str(data.get("password") or ""),
            )
        except UserServiceError as exc:
            return _service_error("user_create_failed", exc)
        return json_response(success_payload(data={"user": user}))

    @app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
    @require_admin
    def api_admin_update_user(current_user, user_id: int):
        data = request.get_json(silent=True) or {}
        try:
            user = update_user_admin(target_user_id=user_id, data=data, actor_user_id=int(current_user["user_id"]))
        except UserServiceError as exc:
            return _service_error("user_update_failed", exc)
        return json_response(success_payload(data={"user": user}))

    @app.route("/api/admin/users/<int:user_id>/password", methods=["POST"])
    @require_admin
    def api_admin_user_password(current_user, user_id: int):
        data = request.get_json(silent=True) or {}
        try:
            set_user_password_admin(
                target_user_id=user_id,
                new_password=str(data.get("password") or ""),
                actor_user_id=int(current_user["user_id"]),
            )
        except UserServiceError as exc:
            return _service_error("password_set_failed", exc)
        return json_response(success_payload(data={"changed": True}))

    @app.route("/api/admin/users/<int:user_id>/toggle-block", methods=["POST"])
    @require_admin
    def api_admin_toggle_block(current_user, user_id: int):
        try:
            user = toggle_user_block(target_user_id=user_id, actor_user_id=int(current_user["user_id"]))
        except UserServiceError as exc:
            return _service_error("user_block_failed", exc)
        return json_response(success_payload(data={"user": user}))

    @app.route("/api/admin/db-settings")
    @require_admin
    def api_admin_db_settings(current_user):  # noqa: ARG001
        return json_response(success_payload(data=_public_db_settings(load_active_db_settings())))

    @app.route("/api/admin/db-settings/fallback")
    @require_admin
    def api_admin_db_settings_fallback(current_user):  # noqa: ARG001
        return json_response(success_payload(data=_public_db_settings(load_fallback_db_settings())))

    def _validate_and_test_db_payload(payload: dict):
        try:
            normalize_db_settings(payload)
        except DbSettingsError as exc:
            return None, json_response(error_payload(code="validation_error", message=str(exc)), 400)
        result = test_db_settings(payload)
        return result, None

    @app.route("/api/admin/db-settings/test", methods=["POST"])
    @require_admin
    def api_admin_db_settings_test(current_user):
        data = _db_settings_payload(request.get_json(silent=True) or {})
        result, err_resp = _validate_and_test_db_payload(data)
        if err_resp:
            return err_resp
        if not result.get("success"):
            return json_response(
                error_payload(
                    code="db_connection_failed",
                    message="Не удаётся подключиться к БД",
                    details=str(result.get("error") or ""),
                ),
                400,
            )
        return json_response(success_payload(data=result))

    @app.route("/api/admin/db-settings/save", methods=["POST"])
    @require_admin
    def api_admin_db_settings_save(current_user):
        data = _db_settings_payload(request.get_json(silent=True) or {})
        result, err_resp = _validate_and_test_db_payload(data)
        if err_resp:
            return err_resp
        if not result.get("success"):
            return json_response(
                error_payload(
                    code="db_connection_save_failed",
                    message="Не удаётся подключиться к БД",
                    details=str(result.get("error") or ""),
                ),
                400,
            )

        loaded = save_and_activate_runtime_db_settings(data)
        return json_response(success_payload(data=_public_db_settings(loaded)))

    @app.route("/api/admin/db-backup/<kind>")
    @require_admin
    def api_admin_db_backup(current_user, kind: str):  # noqa: ARG001
        return _run_pg_dump(kind)
