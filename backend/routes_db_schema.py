"""API интроспекции схемы и DDL для админки."""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from flask import request

from .api_response import error_payload, json_response, success_payload
from .auth_service import require_admin
from .database import get_db_manager
from .db_schema_admin import (
    DbSchemaError,
    fetch_columns,
    fetch_table_constraints_bundle,
    fetch_tree_tables,
    preview_add_column,
    preview_add_foreign_key,
    preview_add_primary_key,
    preview_alter_column,
    preview_create_table,
    preview_drop_column,
    preview_drop_foreign_key,
    preview_drop_primary_key,
    preview_drop_table,
    run_ddl_statements,
)


def _db_schema_read_json(message: str, build_data: Callable[[Any], dict[str, Any]]):
    """Общий try/except для GET-интроспекции схемы (таблицы, столбцы, ограничения)."""
    try:
        with get_db_manager().get_connection() as conn:
            with conn.cursor() as cursor:
                payload_data = build_data(cursor)
        return json_response(success_payload(data=payload_data))
    except Exception as exc:
        return json_response(
            error_payload(
                code="db_schema_read_failed",
                message=message,
                details=str(exc).strip(),
            ),
            500,
        )


def _schema_table_pair(data: dict) -> tuple[str, str]:
    return str(data.get("schema") or "").strip(), str(data.get("table") or "").strip()


def _schema_table_from_query() -> tuple[str, str] | None:
    schema = str(request.args.get("schema") or "").strip()
    table = str(request.args.get("table") or "").strip()
    if not schema or not table:
        return None
    return schema, table


def register_db_schema_routes(app):
    @app.route("/api/admin/db-schema/tables")
    @require_admin
    def api_db_schema_tables(current_user):  # noqa: ARG001
        return _db_schema_read_json(
            "Не удалось загрузить список таблиц",
            lambda c: {"items": fetch_tree_tables(c)},
        )

    @app.route("/api/admin/db-schema/columns")
    @require_admin
    def api_db_schema_columns(current_user):  # noqa: ARG001
        pair = _schema_table_from_query()
        if pair is None:
            return json_response(error_payload(code="validation_error", message="Укажите schema и table"), 400)
        schema, table = pair
        return _db_schema_read_json(
            "Не удалось загрузить столбцы",
            lambda c: {"columns": fetch_columns(c, schema, table)},
        )

    @app.route("/api/admin/db-schema/constraints")
    @require_admin
    def api_db_schema_constraints(current_user):  # noqa: ARG001
        pair = _schema_table_from_query()
        if pair is None:
            return json_response(error_payload(code="validation_error", message="Укажите schema и table"), 400)
        schema, table = pair
        return _db_schema_read_json(
            "Не удалось загрузить ограничения таблицы",
            lambda c: fetch_table_constraints_bundle(c, schema, table),
        )

    @app.route("/api/admin/db-schema/ddl/preview", methods=["POST"])
    @require_admin
    def api_db_schema_ddl_preview(current_user):  # noqa: ARG001
        data = request.get_json(silent=True) or {}
        try:
            stmts = _build_statements(data, preview_only=True)
            return json_response(success_payload(data={"statements": stmts, "sql": ";\n".join(stmts) + (";" if stmts else "")}))
        except DbSchemaError as exc:
            return json_response(error_payload(code="ddl_validation_error", message="Ошибка проверки DDL", details=str(exc)), 400)

    @app.route("/api/admin/db-schema/ddl/execute", methods=["POST"])
    @require_admin
    def api_db_schema_ddl_execute(current_user):
        data = request.get_json(silent=True) or {}
        try:
            stmts = _build_statements(data, preview_only=False)
            if not stmts:
                return json_response(error_payload(code="ddl_validation_error", message="Пустой DDL"), 400)
            with get_db_manager().get_connection() as conn:
                run_ddl_statements(conn, stmts)
            return json_response(success_payload(data={"ok": True, "statements": stmts}))
        except DbSchemaError as exc:
            return json_response(error_payload(code="ddl_validation_error", message="Ошибка проверки DDL", details=str(exc)), 400)
        except Exception as exc:
            details = str(exc).strip()
            return json_response(
                error_payload(code="ddl_execution_failed", message="Ошибка выполнения DDL", details=details),
                400,
            )


def _build_statements(data: dict, *, preview_only: bool) -> list[str]:
    op = str(data.get("operation") or "").strip()
    _ = preview_only

    if op == "create_table":
        schema, table = _schema_table_pair(data)
        return preview_create_table(schema, table)

    if op == "drop_table":
        schema, table = _schema_table_pair(data)
        cascade = bool(data.get("cascade"))
        return preview_drop_table(schema, table, cascade)

    if op == "add_column":
        schema, table = _schema_table_pair(data)
        column = str(data.get("column") or "").strip()
        return preview_add_column(
            schema,
            table,
            column,
            data_type=str(data.get("data_type") or ""),
            char_len=_maybe_int(data.get("character_maximum_length")),
            num_prec=_maybe_int(data.get("numeric_precision")),
            num_scale=_maybe_int(data.get("numeric_scale")),
            datetime_precision=_maybe_int(data.get("datetime_precision")),
            interval_type=str(data.get("interval_type") or "") or None,
            interval_precision=_maybe_int(data.get("interval_precision")),
            is_nullable=str(data.get("is_nullable") or "YES"),
            column_default=str(data.get("column_default") or "") or None,
        )

    if op == "drop_column":
        schema, table = _schema_table_pair(data)
        column = str(data.get("column") or "").strip()
        cascade = bool(data.get("cascade"))
        return preview_drop_column(schema, table, column, cascade)

    if op == "alter_column":
        schema, table = _schema_table_pair(data)
        column = str(data.get("column") or "").strip()
        payload = data.get("patch") or {}
        return preview_alter_column(
            schema,
            table,
            column,
            new_name=str(payload.get("column_name") or "").strip() or None,
            data_type=str(payload.get("data_type") or "").strip() or None,
            char_len=_maybe_int(payload.get("character_maximum_length")),
            num_prec=_maybe_int(payload.get("numeric_precision")),
            num_scale=_maybe_int(payload.get("numeric_scale")),
            datetime_precision=_maybe_int(payload.get("datetime_precision")),
            interval_type=str(payload.get("interval_type") or "") or None,
            interval_precision=_maybe_int(payload.get("interval_precision")),
            is_nullable=str(payload.get("is_nullable") or "").strip() or None,
            column_default=str(payload.get("column_default")) if payload.get("column_default") is not None else None,
            drop_default=bool(payload.get("drop_default")),
            previous_is_nullable=str(data.get("previous_is_nullable") or "").strip() or None,
            is_unique=str(payload.get("is_unique") or "").strip() or None,
            previous_unique_constraint=str(data.get("previous_unique_constraint") or "").strip() or None,
        )

    if op == "add_primary_key":
        schema, table = _schema_table_pair(data)
        columns = _string_list(data.get("columns"))
        cname = str(data.get("constraint_name") or "").strip() or None
        return preview_add_primary_key(schema, table, columns, cname)

    if op == "drop_primary_key":
        schema, table = _schema_table_pair(data)
        cname = str(data.get("constraint_name") or "").strip()
        return preview_drop_primary_key(schema, table, cname)

    if op == "add_foreign_key":
        schema, table = _schema_table_pair(data)
        return preview_add_foreign_key(
            schema,
            table,
            constraint_name=str(data.get("constraint_name") or "").strip(),
            columns=_string_list(data.get("columns")),
            ref_schema=str(data.get("ref_schema") or "").strip(),
            ref_table=str(data.get("ref_table") or "").strip(),
            ref_columns=_string_list(data.get("ref_columns")),
            on_delete=str(data.get("on_delete") or "") or None,
            on_update=str(data.get("on_update") or "") or None,
        )

    if op == "drop_foreign_key":
        schema, table = _schema_table_pair(data)
        cname = str(data.get("constraint_name") or "").strip()
        return preview_drop_foreign_key(schema, table, cname)

    raise DbSchemaError(f"Неизвестная операция: {op}")


def _maybe_int(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _string_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return []
