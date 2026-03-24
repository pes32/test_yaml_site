# backend/routes_api.py
"""REST-эндпоинты, не относящиеся к debug-панели."""
from __future__ import annotations

import logging
import os
from typing import Any, Callable

from flask import jsonify, make_response, request

from .config import ConfigLoadError, PAGES_DIR, load_modal_gui_payload

logger = logging.getLogger(__name__)
META_KEYS = frozenset({"url", "title", "description"})
CommandHandler = Callable[[dict[str, Any]], Any]
COMMAND_HANDLERS: dict[str, CommandHandler] = {}


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
        mids = page_config.get("modalGuiIds")
        if mids:
            result["modalGuiIds"] = mids
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

    @app.route("/api/modal-gui")
    def api_modal_gui():
        """Ленивая загрузка разметки модалки из pages/<page>/modal_<id>.yaml."""
        page_name = (request.args.get("page") or "").strip()
        modal_id = (request.args.get("id") or "").strip()
        if not page_name or not modal_id:
            return _no_cache(make_response(jsonify({
                "error": "Укажите query-параметры page и id",
            }), 400))

        page_config = config_service.get_page(page_name)
        if not page_config:
            return _no_cache(make_response(jsonify({"error": "Страница не найдена"}), 404))

        page_path = os.path.join(PAGES_DIR, page_name)
        try:
            payload = load_modal_gui_payload(page_path, modal_id)
        except ConfigLoadError as exc:
            logger.info("modal-gui: %s", exc)
            return _no_cache(make_response(jsonify({
                "error": str(exc),
            }), 404))

        return _no_cache(make_response(jsonify(payload)))

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
        command = str(data.get("command") or "").strip()
        if not command:
            return _no_cache(make_response(jsonify({
                "success": False,
                "code": "command_required",
                "error": "Не указана команда для выполнения",
                "message": "Не указана команда для выполнения",
            }), 400))

        params = data.get("params") or {}
        if not isinstance(params, dict):
            return _no_cache(make_response(jsonify({
                "success": False,
                "code": "invalid_params",
                "error": "Параметр params должен быть JSON-объектом",
                "message": "Параметр params должен быть JSON-объектом",
            }), 400))

        handler = COMMAND_HANDLERS.get(command)
        if handler is None:
            return _no_cache(make_response(jsonify({
                "success": False,
                "code": "command_not_found",
                "error": f"Команда '{command}' не зарегистрирована на бэкенде",
                "message": f"Команда '{command}' не зарегистрирована на бэкенде",
                "command": command,
                "params": params,
                "page": data.get("page"),
                "widget": data.get("widget"),
                "availableCommands": sorted(COMMAND_HANDLERS.keys()),
            }), 404))

        try:
            result = handler({
                "command": command,
                "params": params,
                "page": data.get("page"),
                "widget": data.get("widget"),
                "output_attrs": data.get("output_attrs") or [],
            }) or {}
        except Exception as exc:  # pragma: no cover
            logger.exception("Ошибка выполнения backend-команды '%s'", command)
            return _no_cache(make_response(jsonify({
                "success": False,
                "code": "command_failed",
                "error": str(exc),
                "message": f"Ошибка выполнения команды '{command}'",
                "command": command,
            }), 500))

        return _no_cache(make_response(jsonify({
            "success": True,
            "command": command,
            "params": params,
            "page": data.get("page"),
            "widget": data.get("widget"),
            "message": result.get("message") or f"Команда '{command}' выполнена",
            "data": result.get("data"),
        })))
