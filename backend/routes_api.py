# backend/routes_api.py
"""REST-эндпоинты, не относящиеся к debug-панели."""
from __future__ import annotations

import logging
from typing import Any

from flask import jsonify, make_response, request

logger = logging.getLogger(__name__)
META_KEYS = frozenset({"url", "title", "description"})


def register_api_routes(app, config_service, LOG_FILE_PATH: str):  # noqa: ARG001
    """Регистрирует /api/* маршруты."""

    def _no_cache(resp):
        try:
            resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            resp.headers["Pragma"] = "no-cache"
            resp.headers["Expires"] = "0"
        except Exception:
            pass
        return resp

    def _public_page_config(page_config: dict[str, Any]) -> dict[str, Any]:
        result = {
            key: value
            for key, value in page_config.items()
            if key != "attrs"
        }
        gui = (page_config.get("gui") or {})
        if gui:
            result["guiMenuKeys"] = [
                k for k in gui.keys()
                if k not in META_KEYS
            ]
        return result

    @app.route("/api/config")
    def api_get_config():
        snapshot = config_service.get_snapshot()
        return _no_cache(make_response(jsonify(snapshot)))

    @app.route("/api/pages")
    def api_get_pages():
        snapshot = config_service.get_snapshot()
        pages_list = [
            {
                "name": name,
                "title": cfg.get("title", name),
                "url": cfg.get("url", f"/page/{name}"),
            }
            for name, cfg in snapshot["pages"].items()
        ]
        return _no_cache(make_response(jsonify(pages_list)))

    @app.route("/api/page/<page_name>")
    def api_get_page(page_name):
        page_config = config_service.get_page(page_name)
        if not page_config:
            return _no_cache(make_response(jsonify({"error": "Страница не найдена"}), 404))

        return _no_cache(make_response(jsonify({
            "page": _public_page_config(page_config),
            "allAttrs": page_config.get("attrs", {}),
        })))

    @app.route("/api/attrs")
    def api_get_attrs():
        page_name = (request.args.get("page") or "").strip()
        if not page_name:
            return _no_cache(make_response(jsonify({"error": "Не указан параметр page"}), 400))

        page_config = config_service.get_page(page_name)
        if not page_config:
            return _no_cache(make_response(jsonify({"error": "Страница не найдена"}), 404))

        page_attrs = page_config.get("attrs", {})
        names_param = request.args.get("names")
        if names_param:
            requested = [n.strip() for n in names_param.split(",") if n.strip()]
            subset = {n: page_attrs.get(n) for n in requested if n in page_attrs}
            return _no_cache(make_response(jsonify(subset)))

        return _no_cache(make_response(jsonify(page_attrs)))

    @app.route("/api/reload", methods=["POST"])
    def api_reload_config():
        try:
            result = config_service.force_reload()
            snapshot = result["snapshot"]
            return _no_cache(make_response(jsonify({
                "success": result["last_error"] is None,
                "updated": result["updated"],
                "message": (
                    "Snapshot конфигурации обновлён"
                    if result["updated"]
                    else "Изменений не найдено или сохранён предыдущий валидный snapshot"
                ),
                "pagesCount": len(snapshot["pages"]),
                "lastError": result["last_error"],
            })))
        except Exception as e:  # pragma: no cover
            logger.exception("Ошибка при принудительном обновлении конфигурации")
            return _no_cache(make_response(jsonify({"success": False, "error": str(e)}), 500))

    @app.route("/api/execute", methods=["POST"])
    def api_execute():
        # silent=True — не генерировать 400 при пустом/битом JSON
        data = request.get_json(silent=True) or {}
        command = data.get("command")
        return jsonify({"success": True, "command": command, "result": f"Команда {command} выполнена успешно"})
