"""Admin SQL API."""
from __future__ import annotations

from flask import request

from .api_response import error_payload, json_response, success_payload
from .auth_service import require_admin
from .database import get_db_manager

ADMIN_SQL_TIMEOUT_MS = 60000


def register_admin_sql_routes(app):
    @app.route("/api/admin/sql", methods=["POST"])
    @require_admin
    def api_admin_sql(current_user):
        data = request.get_json(silent=True) or {}
        query = str(data.get("query") or "").strip()
        result = get_db_manager().execute_admin_sql(query, statement_timeout_ms=ADMIN_SQL_TIMEOUT_MS)
        if not result.get("success"):
            details = str(result.get("error") or "").strip()
            return json_response(
                error_payload(
                    code="admin_sql_failed",
                    message="Ошибка выполнения SQL",
                    details=details or None,
                ),
                400,
            )
        return json_response(success_payload(data=result))
