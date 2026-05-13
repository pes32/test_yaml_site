"""Auth API routes."""
from __future__ import annotations

from flask import request

from .api_response import error_payload, json_response, success_payload
from .database_errors import classify_db_error
from .auth_service import (
    AuthError,
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    get_current_user,
    login_with_password,
    revoke_session_token,
    set_session_cookie,
)


def register_auth_routes(app):
    @app.route("/api/auth/me")
    def api_auth_me():
        user = get_current_user()
        return json_response(success_payload(data={"user": user}))

    @app.route("/api/auth/login", methods=["POST"])
    def api_auth_login():
        data = request.get_json(silent=True) or {}
        login = str(data.get("login") or "").strip()
        password = str(data.get("password") or "")
        try:
            user, token = login_with_password(login, password, request)
        except AuthError as exc:
            return json_response(
                error_payload(code=exc.code, message=str(exc)),
                exc.status_code,
            )
        except Exception as exc:
            spec = classify_db_error(exc)
            if spec is None:
                raise
            details = str(exc).strip()
            return json_response(
                error_payload(
                    code=spec.code,
                    message=spec.message,
                    details=details,
                ),
                spec.status,
            )

        response = json_response(success_payload(data={"user": user}))
        return set_session_cookie(response, token)

    @app.route("/api/auth/logout", methods=["POST"])
    def api_auth_logout():
        user = get_current_user()
        token = request.cookies.get(SESSION_COOKIE_NAME)
        revoke_session_token(token)
        response = json_response(success_payload(data={"logged_out": True}))
        return clear_session_cookie(response)
