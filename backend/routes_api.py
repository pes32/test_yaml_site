# backend/routes_api.py
"""REST-эндпоинты, не относящиеся к debug-панели."""
from __future__ import annotations

from flask import jsonify, request
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


def register_api_routes(app, CONFIG: Dict[str, Any], LOG_FILE_PATH: str):  # noqa: ARG001
    """Регистрирует /api/* маршруты."""

    @app.route("/api/config")
    def api_get_config():
        return jsonify(CONFIG)

    @app.route("/api/pages")
    def api_get_pages():
        pages_list = [
            {
                "name": name,
                "title": cfg.get("title", name),
                "description": cfg.get("description", ""),
                "url": cfg.get("url", f"/page/{name}"),
            }
            for name, cfg in CONFIG["pages"].items()
        ]
        return jsonify(pages_list)

    @app.route("/api/page/<page_name>")
    def api_get_page(page_name):
        if page_name not in CONFIG["pages"]:
            return jsonify({"error": "Страница не найдена"}), 404
        return jsonify({
            "page": CONFIG["pages"][page_name],
            "all_attrs": CONFIG["all_attrs"],
        })

    @app.route("/api/attrs")
    def api_get_attrs():
        names_param = request.args.get("names")
        if names_param:
            requested = [n.strip() for n in names_param.split(",") if n.strip()]
            subset = {n: CONFIG["all_attrs"].get(n) for n in requested if n in CONFIG["all_attrs"]}
            return jsonify(subset)
        return jsonify(CONFIG["all_attrs"])

    @app.route("/api/reload", methods=["POST"])
    def api_reload_config():
        from .config import load_config  # локальный импорт, чтобы избежать циклов

        nonlocal CONFIG  # type: ignore[misc]
        try:
            CONFIG.clear()
            CONFIG.update(load_config())
            # Динамические страницы нужно пере-регистрировать
            from .routes_pages import register_page_routes  # noqa: WPS433 (runtime import)
            register_page_routes(app, CONFIG)
            return jsonify({"success": True, "message": "Конфигурация перезагружена", "pages_count": len(CONFIG["pages"])})
        except Exception as e:  # pragma: no cover
            return jsonify({"success": False, "error": str(e)}), 500

    @app.route("/api/execute", methods=["POST"])
    def api_execute():
        # silent=True — не генерировать 400 при пустом/битом JSON
        data = request.get_json(silent=True) or {}
        command = data.get("command")
        params = data.get("params", {})
        logger.info("Выполнение команды: %s с параметрами: %s", command, params)
        return jsonify({"success": True, "command": command, "result": f"Команда {command} выполнена успешно"})
