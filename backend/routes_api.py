# backend/routes_api.py
"""REST-эндпоинты, не относящиеся к debug-панели."""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List

from flask import request
from pydantic import ValidationError

from .api_response import page_data_payload, pages_data_payload, snapshot_error, snapshot_success
from .contracts import (
    AttrsDataResponse,
    ExecuteRequest,
    ExecuteResponse,
    ModalDataResponse,
)

logger = logging.getLogger(__name__)
CommandHandler = Callable[[Dict[str, Any]], Any]
COMMAND_HANDLERS: Dict[str, CommandHandler] = {}


def register_api_routes(app, config_service, LOG_FILE_PATH: str):  # noqa: ARG001
    """Регистрирует /api/* маршруты."""

    @app.route("/api/config")
    def api_get_config():
        snapshot = config_service.get_snapshot()
        return snapshot_success(snapshot, snapshot)

    @app.route("/api/pages")
    def api_get_pages():
        snapshot = config_service.get_snapshot()
        return snapshot_success(snapshot, pages_data_payload(snapshot), diagnostics=[])

    @app.route("/api/page/<path:page_name>")
    def api_get_page(page_name):
        snapshot = config_service.get_snapshot()
        page_config = (snapshot.get("pages") or {}).get(str(page_name or "").strip())
        if not page_config:
            return snapshot_error(snapshot, code="page_not_found", message="Страница не найдена", status=404)

        return snapshot_success(
            snapshot,
            page_data_payload(page_config),
            diagnostics=list((page_config or {}).get("diagnostics") or []),
        )

    @app.route("/api/attrs")
    def api_get_attrs():
        snapshot = config_service.get_snapshot()
        page_name = (request.args.get("page") or "").strip()
        if not page_name:
            return snapshot_error(snapshot, code="page_required", message="Не указан параметр page")

        page_config = (snapshot.get("pages") or {}).get(page_name)
        if not page_config:
            return snapshot_error(snapshot, code="page_not_found", message="Страница не найдена", status=404)

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

        data = AttrsDataResponse(
            page=page_name,
            attrs=attrs,
            resolved_names=resolved_names,
            missing_names=missing_names,
        ).model_dump(by_alias=True)
        return snapshot_success(
            snapshot,
            data,
            diagnostics=list((page_config or {}).get("diagnostics") or []),
        )

    @app.route("/api/modal-gui")
    def api_modal_gui():
        """Нормализованная ленивая загрузка модалки из snapshot страницы."""
        snapshot = config_service.get_snapshot()
        page_name = (request.args.get("page") or "").strip()
        modal_id = (request.args.get("id") or "").strip()
        if not page_name or not modal_id:
            return snapshot_error(snapshot, code="modal_query_required", message="Укажите query-параметры page и id")

        page_config = (snapshot.get("pages") or {}).get(page_name)
        if not page_config:
            return snapshot_error(snapshot, code="page_not_found", message="Страница не найдена", status=404)

        modal = (page_config.get("modals") or {}).get(modal_id)
        if not modal:
            return snapshot_error(
                snapshot,
                code="modal_not_found",
                message=f"Модалка '{modal_id}' не найдена",
                diagnostics=list((page_config or {}).get("diagnostics") or []),
                status=404,
            )

        page_attrs = page_config.get("attrs") or {}
        widget_names = list(modal.get("widgetNames") or [])
        attrs = {name: page_attrs[name] for name in widget_names if name in page_attrs}
        missing_names = [name for name in widget_names if name not in page_attrs]
        data = ModalDataResponse(
            page=page_name,
            modal=modal,
            attrs=attrs,
            resolved_names=list(attrs.keys()),
            missing_names=missing_names,
            dependencies={
                "widget_names": widget_names,
            },
        ).model_dump(by_alias=True)
        return snapshot_success(
            snapshot,
            data,
            diagnostics=list((page_config or {}).get("diagnostics") or []),
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
                return snapshot_success(snapshot, data)
            else:
                return snapshot_error(
                    snapshot,
                    code="reload_failed",
                    message=result["last_error"],
                    diagnostics=snapshot.get("diagnostics") or [],
                )
        except Exception as exc:  # pragma: no cover
            logger.exception("Ошибка при принудительном обновлении конфигурации")
            return snapshot_error(
                config_service.get_snapshot(),
                code="reload_failed_unexpected",
                message=str(exc),
                status=500,
            )

    @app.route("/api/execute", methods=["POST"])
    def api_execute():
        snapshot = config_service.get_snapshot()
        data = request.get_json(silent=True) or {}
        try:
            payload = ExecuteRequest.model_validate(data)
        except ValidationError:
            return snapshot_error(snapshot, code="invalid_execute_request", message="Некорректное тело запроса execute")

        handler = COMMAND_HANDLERS.get(payload.command)
        if handler is None:
            return snapshot_error(
                snapshot,
                code="command_not_found",
                message=f"Команда '{payload.command}' не зарегистрирована на бэкенде",
                status=404,
            )

        try:
            result = handler(payload.model_dump(by_alias=True)) or {}
        except Exception as exc:  # pragma: no cover
            logger.exception("Ошибка выполнения backend-команды '%s'", payload.command)
            return snapshot_error(
                snapshot,
                code="command_failed",
                message=str(exc) or f"Ошибка выполнения команды '{payload.command}'",
                status=500,
            )

        response_data = ExecuteResponse(
            command=payload.command,
            params=payload.params,
            page=payload.page,
            widget=payload.widget,
            message=result.get("message") or f"Команда '{payload.command}' выполнена",
            data=result.get("data"),
        )
        return snapshot_success(snapshot, response_data.model_dump(), diagnostics=[])
