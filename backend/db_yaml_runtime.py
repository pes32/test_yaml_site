"""Shared SQL executor for DB-backed YAML widgets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import psycopg2
import psycopg2.extras

from .database import SqlError, _json_safe_value, get_db_manager


SQL_DESCRIPTOR_PREFIXES = frozenset(
    {
        "select",
        "with",
        "call",
        "insert",
        "update",
        "delete",
        "create",
        "alter",
        "drop",
        "truncate",
        "do",
        "begin",
    }
)

YAML_DB_SQL_TIMEOUT_MS = 60000
PUBLIC_DB_COMMAND_TOKEN = "__yaml_db_command__"
PUBLIC_DB_SOURCE_TOKEN = "__yaml_db_source__"


class YamlDbRuntimeError(RuntimeError):
    """User-facing DB error for YAML-driven SQL."""

    def __init__(self, message: str, *, code: str = "yaml_db_sql_failed", status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class YamlDbResult:
    query: str
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "columns": self.columns,
            "rows": self.rows,
            "row_count": self.row_count,
        }


def _descriptor_text(value: Any) -> str:
    return str(value or "").strip()


def is_pg_function_descriptor(value: Any) -> bool:
    return _descriptor_text(value).lower().endswith(" -pg")


def is_raw_sql_descriptor(value: Any) -> bool:
    text = _descriptor_text(value)
    if not text:
        return False
    first_token = text.split(None, 1)[0].strip().lower()
    return first_token in SQL_DESCRIPTOR_PREFIXES


def is_yaml_db_descriptor(value: Any) -> bool:
    return is_pg_function_descriptor(value) or is_raw_sql_descriptor(value)


def sanitize_public_db_attr_config(config: dict[str, Any]) -> dict[str, Any]:
    """Hide trusted YAML SQL from browser-visible attr payloads."""

    widget_type = str((config or {}).get("widget") or "").strip()
    sanitized = dict(config or {})
    if widget_type in {"button", "split_button"} and is_yaml_db_descriptor(sanitized.get("command")):
        sanitized["command"] = PUBLIC_DB_COMMAND_TOKEN
        sanitized["x_db_command"] = True
    if widget_type in {"list", "voc"} and is_yaml_db_descriptor(sanitized.get("source")):
        sanitized["source"] = PUBLIC_DB_SOURCE_TOKEN
        sanitized["x_db_source"] = True
    return sanitized


def sanitize_public_db_attrs(attrs: dict[str, Any]) -> dict[str, Any]:
    return {
        name: sanitize_public_db_attr_config(config) if isinstance(config, dict) else config
        for name, config in dict(attrs or {}).items()
    }


def sql_from_yaml_db_descriptor(value: Any) -> str:
    text = _descriptor_text(value)
    if not text:
        raise YamlDbRuntimeError("Пустой SQL-источник", code="yaml_db_empty_sql")
    if is_pg_function_descriptor(text):
        function_name = text[: -len("-pg")].strip()
        if not function_name:
            raise YamlDbRuntimeError("Не указано имя PostgreSQL-функции", code="yaml_db_empty_function")
        return f"SELECT * FROM {function_name}();"
    return text


def execute_yaml_db_descriptor(value: Any) -> YamlDbResult:
    """Execute `name -pg` or raw SQL from trusted YAML in one transaction."""

    query = sql_from_yaml_db_descriptor(value)
    try:
        manager = get_db_manager()
        with manager.get_connection() as conn:
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    cursor.execute("SET LOCAL statement_timeout = %s", (YAML_DB_SQL_TIMEOUT_MS,))
                    cursor.execute(query)
                    columns = [desc[0] for desc in cursor.description] if cursor.description else []
                    rows = [_json_safe_value(dict(row)) for row in cursor.fetchall()] if cursor.description else []
                conn.commit()
            except Exception:
                conn.rollback()
                raise
    except psycopg2.OperationalError as exc:
        message = str(exc).strip() or "Не удалось подключиться к БД"
        raise YamlDbRuntimeError(message, code="yaml_db_connection_failed", status_code=503) from exc
    except psycopg2.Error as exc:
        message = str(exc).strip() or "Ошибка выполнения SQL"
        raise YamlDbRuntimeError(message) from exc
    except SqlError as exc:
        raise YamlDbRuntimeError(str(exc), code=exc.code, status_code=exc.status_code) from exc

    return YamlDbResult(
        query=query,
        columns=columns,
        rows=rows,
        row_count=len(rows),
    )


def require_result_columns(result: YamlDbResult, required_columns: list[str], *, context: str) -> None:
    available = set(result.columns)
    missing = [column for column in required_columns if column not in available]
    if not missing:
        return
    raise YamlDbRuntimeError(
        (
            f"SQL result for {context} does not contain required column(s): "
            + ", ".join(missing)
        ),
        code="yaml_db_missing_columns",
    )
