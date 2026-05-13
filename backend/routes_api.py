# backend/routes_api.py
"""REST-эндпоинты YAML runtime."""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List

from flask import request
from pydantic import ValidationError

from .api_response import (
    page_data_payload,
    pages_data_payload,
    public_snapshot_payload,
    snapshot_error,
    snapshot_success,
)
from .contracts import (
    AttrsDataResponse,
    ExecuteRequest,
    ExecuteResponse,
    ModalDataResponse,
)
from .db_yaml_runtime import (
    PUBLIC_DB_COMMAND_TOKEN,
    YamlDbResult,
    YamlDbRuntimeError,
    execute_yaml_db_descriptor,
    is_yaml_db_descriptor,
    require_result_columns,
    sanitize_public_db_attrs,
)
from .table_runtime import (
    TableQueryRejected,
    apply_table_commands,
    export_table_value,
    export_table_window,
    _column_keys_from_table_attrs,
    prepare_table_attrs_for_runtime,
    query_table_view,
)

logger = logging.getLogger(__name__)
CommandHandler = Callable[[Dict[str, Any]], Any]
COMMAND_HANDLERS: Dict[str, CommandHandler] = {}


def _split_csv_names(value: str) -> list[str]:
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


def _normalize_select_attrs(value: Any) -> dict[str, str]:
    if isinstance(value, dict):
        return {
            str(target or "").strip(): str(column or "").strip()
            for target, column in value.items()
            if str(target or "").strip() and str(column or "").strip()
        }
    if isinstance(value, list):
        names = [str(item or "").strip() for item in value]
    elif isinstance(value, str):
        names = _split_csv_names(value)
    else:
        names = []
    return {name: name for name in names if name}


def _page_widget_config(snapshot: dict[str, Any], page_name: str, widget_name: str) -> dict[str, Any] | None:
    page_config = (snapshot.get("pages") or {}).get(page_name)
    if not page_config:
        return None
    config = (page_config.get("attrs") or {}).get(widget_name)
    return config if isinstance(config, dict) else None


def _page_attrs(snapshot: dict[str, Any], page_name: str) -> dict[str, Any]:
    page_config = (snapshot.get("pages") or {}).get(page_name)
    return dict((page_config or {}).get("attrs") or {})


def _widget_type(config: dict[str, Any] | None) -> str:
    return str((config or {}).get("widget") or "").strip()


def _sql_error_response(snapshot: dict[str, Any], exc: YamlDbRuntimeError):
    return snapshot_error(
        snapshot,
        code=exc.code,
        message=str(exc),
        status=exc.status_code,
    )


def _rows_for_columns(result: YamlDbResult, columns: list[str], *, context: str) -> list[list[Any]]:
    require_result_columns(result, columns, context=context)
    return [[row.get(column) for column in columns] for row in result.rows]


def _build_button_value_updates(
    snapshot: dict[str, Any],
    page_name: str,
    button_config: dict[str, Any],
    result: YamlDbResult,
) -> dict[str, Any]:
    select_map = _normalize_select_attrs(button_config.get("select_attrs"))
    if not select_map:
        return {}

    attrs = _page_attrs(snapshot, page_name)
    scalar_targets: dict[str, str] = {}
    table_targets: dict[str, list[str]] = {}

    for widget_name, db_column in select_map.items():
        target_config = attrs.get(widget_name)
        if not isinstance(target_config, dict):
            raise YamlDbRuntimeError(
                f"select_attrs references unknown widget '{widget_name}'",
                code="yaml_db_unknown_target",
            )
        if _widget_type(target_config) == "table":
            table_targets[widget_name] = _column_keys_from_table_attrs(target_config.get("table_attrs"))
        else:
            scalar_targets[widget_name] = db_column

    if scalar_targets:
        if result.row_count != 1:
            raise YamlDbRuntimeError(
                (
                    "SQL result for scalar select_attrs must contain exactly one row; "
                    f"received {result.row_count}"
                ),
                code="yaml_db_scalar_row_count",
            )
        require_result_columns(result, list(scalar_targets.values()), context="select_attrs")

    values: dict[str, Any] = {}
    if scalar_targets:
        row = result.rows[0]
        values.update({widget_name: row.get(db_column) for widget_name, db_column in scalar_targets.items()})

    for widget_name, columns in table_targets.items():
        values[widget_name] = _rows_for_columns(result, columns, context=f"table '{widget_name}'")

    return values


def _execute_yaml_db_button(
    snapshot: dict[str, Any],
    payload: ExecuteRequest,
) -> dict[str, Any] | None:
    page_name = str(payload.page or "").strip()
    widget_name = str(payload.widget or "").strip()
    if not page_name or not widget_name:
        return None

    button_config = _page_widget_config(snapshot, page_name, widget_name)
    if not button_config or _widget_type(button_config) not in {"button", "split_button"}:
        return None

    command = button_config.get("command")
    if not is_yaml_db_descriptor(command):
        return None

    result = execute_yaml_db_descriptor(command)
    values = _build_button_value_updates(snapshot, page_name, button_config, result)
    return ExecuteResponse(
        command=PUBLIC_DB_COMMAND_TOKEN,
        params=payload.params,
        page=payload.page,
        widget=payload.widget,
        message="Команда выполнена",
        data=None,
        updates={"values": values} if values else {},
        silent_success=True,
    ).model_dump()


def _normalize_widget_source_patch(attr_config: dict[str, Any], result: YamlDbResult, widget_name: str) -> dict[str, Any]:
    widget_type = _widget_type(attr_config)
    if widget_type == "list":
        column = str(attr_config.get("columns") or "").strip()
        if not column:
            raise YamlDbRuntimeError(
                f"list '{widget_name}' requires columns with a DB column name",
                code="yaml_db_missing_source_columns",
            )
        require_result_columns(result, [column], context=f"list '{widget_name}'")
        return {
            "source": [row.get(column) for row in result.rows],
        }

    labels = attr_config.get("columns") if isinstance(attr_config.get("columns"), list) else []
    db_columns = attr_config.get("x_db_columns") if isinstance(attr_config.get("x_db_columns"), list) else []
    if not db_columns:
        db_columns = [str(item or "").strip() for item in labels if str(item or "").strip()]
    db_columns = [str(item or "").strip() for item in db_columns if str(item or "").strip()]
    labels = [str(item or "").strip() for item in labels if str(item or "").strip()]
    if not db_columns or len(labels) != len(db_columns):
        raise YamlDbRuntimeError(
            f"voc '{widget_name}' requires columns with DB field names and labels",
            code="yaml_db_missing_source_columns",
        )
    require_result_columns(result, db_columns, context=f"voc '{widget_name}'")
    return {
        "columns": labels,
        "source": [[row.get(column) for column in db_columns] for row in result.rows],
        "x_db_columns": db_columns,
    }


def register_api_routes(app, config_service, LOG_FILE_PATH: str):  # noqa: ARG001
    """Регистрирует /api/* маршруты."""

    @app.route("/api/config")
    def api_get_config():
        snapshot = config_service.get_snapshot()
        return snapshot_success(snapshot, public_snapshot_payload(snapshot))

    @app.route("/api/pages")
    def api_get_pages():
        snapshot = config_service.get_snapshot()
        return snapshot_success(snapshot, pages_data_payload(snapshot))

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

        attrs, table_runtime = prepare_table_attrs_for_runtime(page_name, attrs, resolved_names)
        attrs = sanitize_public_db_attrs(attrs)
        data = AttrsDataResponse(
            page=page_name,
            attrs=attrs,
            table_runtime=table_runtime,
            resolved_names=resolved_names,
            missing_names=missing_names,
        ).model_dump(by_alias=True)
        return snapshot_success(
            snapshot,
            data,
            diagnostics=list((page_config or {}).get("diagnostics") or []),
        )

    @app.route("/api/table-query", methods=["POST"])
    def api_table_query():
        snapshot = config_service.get_snapshot()
        data = request.get_json(silent=True) or {}
        page_name = str(data.get("page") or "").strip()
        attr_name = str(data.get("attr") or "").strip()
        requested_snapshot = str(data.get("snapshot_version") or "").strip()
        current_snapshot = str(((snapshot.get("meta") or {}).get("version")) or "").strip()
        if requested_snapshot and current_snapshot and requested_snapshot != current_snapshot:
            return snapshot_error(
                snapshot,
                code="snapshot_changed",
                message="Snapshot конфигурации изменился, нужно обновить таблицу",
                status=409,
            )
        if not page_name or not attr_name:
            return snapshot_error(
                snapshot,
                code="table_query_required",
                message="Укажите page и attr для запроса таблицы",
            )
        page_config = (snapshot.get("pages") or {}).get(page_name)
        if not page_config:
            return snapshot_error(snapshot, code="page_not_found", message="Страница не найдена", status=404)
        attr_config = (page_config.get("attrs") or {}).get(attr_name)
        if not attr_config or str(attr_config.get("widget") or "").strip() != "table":
            return snapshot_error(
                snapshot,
                code="table_attr_not_found",
                message=f"Таблица '{attr_name}' не найдена",
                status=404,
            )
        view = data.get("view") if isinstance(data.get("view"), dict) else {}
        try:
            table_payload = query_table_view(
                page_name=page_name,
                attr_name=attr_name,
                config=attr_config,
                view=view,
            )
        except TableQueryRejected as exc:
            return snapshot_error(
                snapshot,
                code=exc.code,
                message=exc.message,
                status=exc.status,
            )
        return snapshot_success(
            snapshot,
            table_payload,
            diagnostics=[],
        )

    @app.route("/api/table-command", methods=["POST"])
    def api_table_command():
        snapshot = config_service.get_snapshot()
        data = request.get_json(silent=True) or {}
        page_name = str(data.get("page") or "").strip()
        attr_name = str(data.get("attr") or "").strip()
        requested_snapshot = str(data.get("snapshot_version") or "").strip()
        current_snapshot = str(((snapshot.get("meta") or {}).get("version")) or "").strip()
        if requested_snapshot and current_snapshot and requested_snapshot != current_snapshot:
            return snapshot_error(
                snapshot,
                code="snapshot_changed",
                message="Snapshot конфигурации изменился, нужно обновить таблицу",
                status=409,
            )
        if not page_name or not attr_name:
            return snapshot_error(
                snapshot,
                code="table_command_required",
                message="Укажите page и attr для команды таблицы",
            )
        page_config = (snapshot.get("pages") or {}).get(page_name)
        if not page_config:
            return snapshot_error(snapshot, code="page_not_found", message="Страница не найдена", status=404)
        attr_config = (page_config.get("attrs") or {}).get(attr_name)
        if not attr_config or str(attr_config.get("widget") or "").strip() != "table":
            return snapshot_error(
                snapshot,
                code="table_attr_not_found",
                message=f"Таблица '{attr_name}' не найдена",
                status=404,
            )
        view = data.get("view") if isinstance(data.get("view"), dict) else {}
        commands = data.get("commands") if isinstance(data.get("commands"), list) else []
        try:
            command_payload = apply_table_commands(
                page_name=page_name,
                attr_name=attr_name,
                config=attr_config,
                view=view,
                commands=commands,
            )
        except TableQueryRejected as exc:
            return snapshot_error(
                snapshot,
                code=exc.code,
                message=exc.message,
                status=exc.status,
            )
        return snapshot_success(
            snapshot,
            command_payload,
            diagnostics=[],
        )

    @app.route("/api/table-export", methods=["POST"])
    def api_table_export():
        snapshot = config_service.get_snapshot()
        data = request.get_json(silent=True) or {}
        page_name = str(data.get("page") or "").strip()
        attr_name = str(data.get("attr") or "").strip()
        requested_snapshot = str(data.get("snapshot_version") or "").strip()
        current_snapshot = str(((snapshot.get("meta") or {}).get("version")) or "").strip()
        if requested_snapshot and current_snapshot and requested_snapshot != current_snapshot:
            return snapshot_error(
                snapshot,
                code="snapshot_changed",
                message="Snapshot конфигурации изменился, нужно обновить таблицу",
                status=409,
            )
        if not page_name or not attr_name:
            return snapshot_error(
                snapshot,
                code="table_export_required",
                message="Укажите page и attr для экспорта таблицы",
            )
        page_config = (snapshot.get("pages") or {}).get(page_name)
        if not page_config:
            return snapshot_error(snapshot, code="page_not_found", message="Страница не найдена", status=404)
        attr_config = (page_config.get("attrs") or {}).get(attr_name)
        if not attr_config or str(attr_config.get("widget") or "").strip() != "table":
            return snapshot_error(
                snapshot,
                code="table_attr_not_found",
                message=f"Таблица '{attr_name}' не найдена",
                status=404,
            )
        view = data.get("view") if isinstance(data.get("view"), dict) else {}
        chunk = data.get("export_chunk") if isinstance(data.get("export_chunk"), dict) else None
        if chunk is None and isinstance(data.get("exportChunk"), dict):
            chunk = data.get("exportChunk")
        try:
            if chunk is not None:
                off = chunk.get("offset")
                lim = chunk.get("limit")
                try:
                    off_i = max(0, int(off or 0))
                except (TypeError, ValueError):
                    off_i = 0
                exported_payload = export_table_window(attr_config, view, off_i, lim or 0)
            else:
                exported_payload = export_table_value(attr_config, view)
        except TableQueryRejected as exc:
            return snapshot_error(
                snapshot,
                code=exc.code,
                message=exc.message,
                status=exc.status,
            )
        return snapshot_success(
            snapshot,
            {
                "page": page_name,
                "attr": attr_name,
                **exported_payload,
            },
            diagnostics=[],
        )

    @app.route("/api/widget-source", methods=["POST"])
    def api_widget_source():
        snapshot = config_service.get_snapshot()
        data = request.get_json(silent=True) or {}
        page_name = str(data.get("page") or "").strip()
        widget_name = str(data.get("widget") or "").strip()
        requested_snapshot = str(data.get("snapshot_version") or "").strip()
        current_snapshot = str(((snapshot.get("meta") or {}).get("version")) or "").strip()
        if requested_snapshot and current_snapshot and requested_snapshot != current_snapshot:
            return snapshot_error(
                snapshot,
                code="snapshot_changed",
                message="Snapshot конфигурации изменился, нужно обновить источник виджета",
                status=409,
            )
        if not page_name or not widget_name:
            return snapshot_error(
                snapshot,
                code="widget_source_required",
                message="Укажите page и widget для загрузки источника виджета",
            )

        attr_config = _page_widget_config(snapshot, page_name, widget_name)
        widget_type = _widget_type(attr_config)
        if not attr_config or widget_type not in {"list", "voc"}:
            return snapshot_error(
                snapshot,
                code="widget_source_not_found",
                message=f"Виджет '{widget_name}' не найден или не поддерживает DB-source",
                status=404,
            )
        source = attr_config.get("source")
        if not is_yaml_db_descriptor(source):
            return snapshot_error(
                snapshot,
                code="widget_source_not_db",
                message=f"Виджет '{widget_name}' не использует DB-source",
                status=400,
            )

        try:
            result = execute_yaml_db_descriptor(source)
            patch = _normalize_widget_source_patch(attr_config, result, widget_name)
        except YamlDbRuntimeError as exc:
            return _sql_error_response(snapshot, exc)

        return snapshot_success(
            snapshot,
            {
                "page": page_name,
                "widget": widget_name,
                "patch": patch,
            },
            diagnostics=[],
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
        attrs, table_runtime = prepare_table_attrs_for_runtime(page_name, attrs, attrs.keys())
        attrs = sanitize_public_db_attrs(attrs)
        data = ModalDataResponse(
            page=page_name,
            modal=modal,
            attrs=attrs,
            table_runtime=table_runtime,
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
                message="Ошибка обновления конфигурации",
                details=str(exc),
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

        try:
            yaml_db_result = _execute_yaml_db_button(snapshot, payload)
        except YamlDbRuntimeError as exc:
            return _sql_error_response(snapshot, exc)
        if yaml_db_result is not None:
            return snapshot_success(snapshot, yaml_db_result, diagnostics=[])

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
                message=f"Ошибка выполнения команды '{payload.command}'",
                details=str(exc),
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
