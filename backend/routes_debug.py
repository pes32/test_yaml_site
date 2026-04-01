# backend/routes_debug.py
"""Debug-панель: /debug и /api/debug/*."""

from __future__ import annotations

import logging
import os

from flask import jsonify, make_response, render_template, request
from pydantic import ValidationError

from .api_response import error_payload, success_payload
from .contracts import DebugSqlRequest
from .database import DebugSqlError, get_db_manager

logger = logging.getLogger(__name__)


def register_debug_routes(app, config_service, log_file_path: str):
    """Регистрирует debug-панель и API."""

    def _snapshot():
        return config_service.get_snapshot()

    def _no_cache(resp):
        try:
            resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            resp.headers["Pragma"] = "no-cache"
            resp.headers["Expires"] = "0"
        except Exception:
            pass
        return resp

    def _json_response(payload, status: int = 200):
        return _no_cache(make_response(jsonify(payload), status))

    @app.route("/debug")
    def debug_panel():
        return render_template("debug.html")

    @app.route("/api/debug/structure")
    def api_debug_structure():
        """Структура API приложения — все зарегистрированные маршруты."""
        snapshot = _snapshot()
        routes = []
        for rule in app.url_map.iter_rules():
            if rule.endpoint and rule.endpoint != "static":
                routes.append({
                    "rule": str(rule.rule),
                    "methods": sorted(m for m in (rule.methods or set()) if m not in {"HEAD", "OPTIONS"}),
                    "endpoint": rule.endpoint,
                })
        routes.sort(key=lambda r: r["rule"])
        return _json_response(
            success_payload(
                data={
                    "routes": routes,
                    "snapshot": config_service.get_meta(),
                },
                snapshot=snapshot,
                diagnostics=snapshot.get("diagnostics") or [],
            )
        )

    @app.route("/api/debug/logs")
    def api_debug_logs():
        """Последние 1000 строк лога."""
        snapshot = _snapshot()
        path = log_file_path or os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "app.log")
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as handle:
                lines = handle.readlines()
            last_1000 = lines[-1000:] if len(lines) > 1000 else lines
            return _json_response(
                success_payload(
                    data={
                        "lines": last_1000,
                        "total": len(lines),
                    },
                    snapshot=snapshot,
                    diagnostics=snapshot.get("diagnostics") or [],
                )
            )
        except FileNotFoundError:
            return _json_response(
                error_payload(
                    code="log_file_not_found",
                    message="Файл лога не найден",
                    snapshot=snapshot,
                ),
                404,
            )
        except Exception as exc:
            logger.exception("Ошибка чтения файла лога: %s", path)
            return _json_response(
                error_payload(
                    code="log_read_failed",
                    message=str(exc),
                    snapshot=snapshot,
                ),
                500,
            )

    @app.route("/api/debug/pages")
    def api_debug_pages():
        """Информация о зарегистрированных страницах (YAML)."""
        snapshot = _snapshot()
        pages = []
        for name, cfg in snapshot.get("pages", {}).items():
            pages.append({
                "name": name,
                "title": cfg.get("title", name),
                "url": cfg.get("url", f"/page/{name}"),
                "modal_ids": cfg.get("modalGuiIds") or [],
                "source_files": cfg.get("sourceFiles") or [],
                "diagnostics": cfg.get("diagnostics") or [],
            })
        pages.sort(key=lambda p: p["name"])
        return _json_response(
            success_payload(
                data={
                    "pages": pages,
                    "snapshot": snapshot.get("meta") or {},
                    "diagnostics": snapshot.get("diagnostics") or [],
                    "last_error": config_service.get_last_error(),
                },
                snapshot=snapshot,
                diagnostics=snapshot.get("diagnostics") or [],
            )
        )

    @app.route("/api/debug/snapshot")
    def api_debug_snapshot():
        """Краткая диагностика текущего snapshot."""
        snapshot = _snapshot()
        return _json_response(
            success_payload(
                data={
                    "meta": snapshot.get("meta") or {},
                    "page_count": len(snapshot.get("pages") or {}),
                    "pages_by_url": snapshot.get("pages_by_url") or {},
                    "diagnostics": snapshot.get("diagnostics") or [],
                    "last_error": config_service.get_last_error(),
                },
                snapshot=snapshot,
                diagnostics=snapshot.get("diagnostics") or [],
            )
        )

    @app.route("/api/debug/sql", methods=["POST"])
    def api_debug_sql():
        """Read-only SQL helper для debug-панели."""
        snapshot = _snapshot()
        data = request.get_json(silent=True) or {}

        try:
            payload = DebugSqlRequest.model_validate(data)
        except ValidationError:
            return _json_response(
                error_payload(
                    code="invalid_debug_sql_request",
                    message="Некорректное тело запроса debug SQL",
                    snapshot=snapshot,
                    diagnostics=snapshot.get("diagnostics") or [],
                ),
                400,
            )

        try:
            result = get_db_manager().execute_readonly_select(payload.query)
        except DebugSqlError as exc:
            return _json_response(
                error_payload(
                    code=exc.code,
                    message=str(exc),
                    snapshot=snapshot,
                    diagnostics=snapshot.get("diagnostics") or [],
                ),
                exc.status_code,
            )

        return _json_response(
            success_payload(
                data=result,
                snapshot=snapshot,
                diagnostics=snapshot.get("diagnostics") or [],
            )
        )
