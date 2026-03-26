# backend/routes_api.py
"""REST-эндпоинты, не относящиеся к debug-панели."""

from __future__ import annotations

import logging
from typing import Any, Callable

from flask import jsonify, make_response, request
from pydantic import ValidationError

from .api_response import error_payload, success_payload
from .contracts import ExecuteRequest, ExecuteResponse

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

    def _json_response(payload: dict[str, Any], status: int = 200):
        return _no_cache(make_response(jsonify(payload), status))

    def _snapshot():
        return config_service.get_snapshot()

    def _page_diagnostics(page_config: dict[str, Any]) -> list[dict[str, Any]]:
        return list(page_config.get("diagnostics") or [])

    def _public_page_config(page_config: dict[str, Any]) -> dict[str, Any]:
        gui = page_config.get("gui") or {}
        root_keys = page_config.get("guiMenuKeys")
        if not isinstance(root_keys, list):
            root_keys = [key for key in gui.keys() if key not in META_KEYS]

        return {
            "name": page_config.get("name"),
            "url": page_config.get("url"),
            "title": page_config.get("title"),
            "gui": gui,
            "guiMenuKeys": root_keys,
            "modalGuiIds": page_config.get("modalGuiIds") or [],
        }

    def _page_payload(page_config: dict[str, Any]) -> dict[str, Any]:
        return {
            "page": _public_page_config(page_config),
            "attrs": page_config.get("attrs") or {},
        }

    @app.route("/api/config")
    def api_get_config():
        snapshot = _snapshot()
        return _json_response(success_payload(data=snapshot, snapshot=snapshot))

    @app.route("/api/pages")
    def api_get_pages():
        snapshot = _snapshot()
        pages_list = [
            {
                "name": name,
                "title": cfg.get("title", name),
                "url": cfg.get("url", f"/page/{name}"),
            }
            for name, cfg in snapshot.get("pages", {}).items()
        ]
        return _json_response(
            success_payload(
                data={"pages": pages_list},
                snapshot=snapshot,
            )
        )

    @app.route("/api/page/<page_name>")
    def api_get_page(page_name):
        snapshot = _snapshot()
        page_config = snapshot.get("pages", {}).get(page_name)
        if not page_config:
            return _json_response(
                error_payload(
                    code="page_not_found",
                    message="Страница не найдена",
                    snapshot=snapshot,
                ),
                404,
            )

        return _json_response(
            success_payload(
                data=_page_payload(page_config),
                snapshot=snapshot,
                diagnostics=_page_diagnostics(page_config),
            )
        )

    @app.route("/api/attrs")
    def api_get_attrs():
        snapshot = _snapshot()
        page_name = (request.args.get("page") or "").strip()
        if not page_name:
            return _json_response(
                error_payload(
                    code="page_required",
                    message="Не указан параметр page",
                    snapshot=snapshot,
                ),
                400,
            )

        page_config = snapshot.get("pages", {}).get(page_name)
        if not page_config:
            return _json_response(
                error_payload(
                    code="page_not_found",
                    message="Страница не найдена",
                    snapshot=snapshot,
                ),
                404,
            )

        page_attrs = page_config.get("attrs") or {}
        names_param = request.args.get("names")
        if names_param:
            requested = []
            seen = set()
            for raw_name in names_param.split(","):
                name = raw_name.strip()
                if not name or name in seen:
                    continue
                seen.add(name)
                requested.append(name)
            attrs = {name: page_attrs[name] for name in requested if name in page_attrs}
            missing_names = [name for name in requested if name not in page_attrs]
            resolved_names = list(attrs.keys())
        else:
            attrs = dict(page_attrs)
            resolved_names = list(attrs.keys())
            missing_names = []

        data = {
            "page": page_name,
            "attrs": attrs,
            "resolved_names": resolved_names,
            "missing_names": missing_names,
        }
        return _json_response(
            success_payload(
                data=data,
                snapshot=snapshot,
                diagnostics=_page_diagnostics(page_config),
            )
        )

    @app.route("/api/modal-gui")
    def api_modal_gui():
        """Нормализованная ленивая загрузка модалки из snapshot страницы."""
        snapshot = _snapshot()
        page_name = (request.args.get("page") or "").strip()
        modal_id = (request.args.get("id") or "").strip()
        if not page_name or not modal_id:
            return _json_response(
                error_payload(
                    code="modal_query_required",
                    message="Укажите query-параметры page и id",
                    snapshot=snapshot,
                ),
                400,
            )

        page_config = snapshot.get("pages", {}).get(page_name)
        if not page_config:
            return _json_response(
                error_payload(
                    code="page_not_found",
                    message="Страница не найдена",
                    snapshot=snapshot,
                ),
                404,
            )

        modal = (page_config.get("modals") or {}).get(modal_id)
        if not modal:
            return _json_response(
                error_payload(
                    code="modal_not_found",
                    message=f"Модалка '{modal_id}' не найдена",
                    snapshot=snapshot,
                    diagnostics=_page_diagnostics(page_config),
                ),
                404,
            )

        page_attrs = page_config.get("attrs") or {}
        widget_names = list(modal.get("widgetNames") or [])
        attrs = {name: page_attrs[name] for name in widget_names if name in page_attrs}
        missing_names = [name for name in widget_names if name not in page_attrs]
        data = {
            "page": page_name,
            "modal": modal,
            "attrs": attrs,
            "resolved_names": list(attrs.keys()),
            "missing_names": missing_names,
            "dependencies": {
                "widget_names": widget_names,
            },
        }
        return _json_response(
            success_payload(
                data=data,
                snapshot=snapshot,
                diagnostics=_page_diagnostics(page_config),
            )
        )

    @app.route("/api/reload", methods=["POST"])
    def api_reload_config():
        try:
            result = config_service.force_reload()
            snapshot = result["snapshot"]
            data = {
                "updated": result["updated"],
                "page_count": len(snapshot.get("pages", {})),
                "last_error": result["last_error"],
                "message": (
                    "Snapshot конфигурации обновлён"
                    if result["last_error"] is None and result["updated"]
                    else "Изменений не найдено, используется актуальный snapshot"
                    if result["last_error"] is None
                    else "Сохранён предыдущий валидный snapshot"
                ),
                "meta": snapshot.get("meta") or {},
            }
            if result["last_error"] is None:
                payload = success_payload(
                    data=data,
                    snapshot=snapshot,
                    diagnostics=snapshot.get("diagnostics") or [],
                )
            else:
                payload = error_payload(
                    code="reload_failed",
                    message=result["last_error"],
                    snapshot=snapshot,
                    diagnostics=snapshot.get("diagnostics") or [],
                )
            return _json_response(payload)
        except Exception as exc:  # pragma: no cover
            logger.exception("Ошибка при принудительном обновлении конфигурации")
            return _json_response(
                error_payload(
                    code="reload_failed_unexpected",
                    message=str(exc),
                    snapshot=_snapshot(),
                ),
                500,
            )

    @app.route("/api/execute", methods=["POST"])
    def api_execute():
        snapshot = _snapshot()
        data = request.get_json(silent=True) or {}
        try:
            payload = ExecuteRequest.model_validate(data)
        except ValidationError:
            return _json_response(
                error_payload(
                    code="invalid_execute_request",
                    message="Некорректное тело запроса execute",
                    snapshot=snapshot,
                ),
                400,
            )

        handler = COMMAND_HANDLERS.get(payload.command)
        if handler is None:
            return _json_response(
                error_payload(
                    code="command_not_found",
                    message=f"Команда '{payload.command}' не зарегистрирована на бэкенде",
                    snapshot=snapshot,
                ),
                404,
            )

        try:
            result = handler(payload.model_dump(by_alias=True)) or {}
        except Exception as exc:  # pragma: no cover
            logger.exception("Ошибка выполнения backend-команды '%s'", payload.command)
            return _json_response(
                error_payload(
                    code="command_failed",
                    message=str(exc) or f"Ошибка выполнения команды '{payload.command}'",
                    snapshot=snapshot,
                ),
                500,
            )

        response_data = ExecuteResponse(
            command=payload.command,
            params=payload.params,
            page=payload.page,
            widget=payload.widget,
            message=result.get("message") or f"Команда '{payload.command}' выполнена",
            data=result.get("data"),
        )
        return _json_response(
            success_payload(
                data=response_data.model_dump(),
                snapshot=snapshot,
            )
        )
