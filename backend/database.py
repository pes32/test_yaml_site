# backend/database.py
"""Модуль для работы с PostgreSQL базой данных."""
from __future__ import annotations

import logging
import json
import os
import re
from contextlib import contextmanager
from datetime import date, datetime, time
from decimal import Decimal
from time import perf_counter
from typing import Any, Dict
from uuid import UUID

import psycopg2
import psycopg2.extras
import yaml

logger = logging.getLogger(__name__)

# Корневая директория проекта
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DB_SETTINGS_CANDIDATES = (
    os.path.join(ROOT_DIR, "db_settings.yaml"),
    os.path.join(ROOT_DIR, "database", "db_settings.yaml"),
)
READONLY_SQL_MAX_ROWS = 200
READONLY_SQL_MAX_QUERY_LENGTH = 10000
READONLY_SQL_STATEMENT_TIMEOUT_MS = 5000
READONLY_SQL_LOCK_TIMEOUT_MS = 1000
READONLY_SQL_DISALLOWED_FUNCTIONS_RE = re.compile(
    r"\b(?:"
    r"pg_[a-z0-9_]+|"
    r"pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|"
    r"pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|"
    r"lo_import|lo_export|"
    r"dblink_connect|dblink_connect_u|dblink_disconnect|dblink_exec"
    r")\s*\(",
    re.IGNORECASE,
)
READONLY_SQL_LOCKING_RE = re.compile(
    r"\bfor\s+(?:update|share|no\s+key\s+update|key\s+share)\b",
    re.IGNORECASE,
)
READONLY_SQL_SYSTEM_SCHEMAS = frozenset({
    "information_schema",
    "pg_catalog",
    "pg_toast",
})
READONLY_SQL_BLOCKED_PLAN_NODE_TYPES = frozenset({
    "Function Scan",
    "Table Function Scan",
    "Values Scan",
    "Named Tuplestore Scan",
    "WorkTable Scan",
})


class DebugSqlError(RuntimeError):
    """Контролируемая ошибка debug SQL API."""

    def __init__(self, message: str, *, code: str, status_code: int):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class DebugSqlValidationError(DebugSqlError):
    """Некорректный SQL-запрос для debug-only SELECT режима."""

    def __init__(self, message: str):
        super().__init__(message, code="invalid_debug_sql_query", status_code=400)


def _json_safe_value(value: Any) -> Any:
    """Преобразует значения psycopg2 в JSON-safe примитивы."""

    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, memoryview):
        return value.tobytes().hex()
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, dict):
        return {str(key): _json_safe_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe_value(item) for item in value]
    return str(value)


def _normalize_debug_select_query(query: str) -> str:
    """Разрешает только один безопасный SELECT-запрос для debug UI."""

    normalized = str(query or "").strip()
    if not normalized:
        raise DebugSqlValidationError("Пустой SQL-запрос")

    if len(normalized) > READONLY_SQL_MAX_QUERY_LENGTH:
        raise DebugSqlValidationError(
            f"SQL-запрос слишком длинный: максимум {READONLY_SQL_MAX_QUERY_LENGTH} символов"
        )

    if any(token in normalized for token in ("--", "/*", "*/")):
        raise DebugSqlValidationError("SQL-комментарии в debug SQL запрещены")

    if ";" in normalized:
        if normalized.count(";") > 1 or not normalized.endswith(";"):
            raise DebugSqlValidationError("Разрешён только один SELECT-запрос без дополнительных команд")
        normalized = normalized[:-1].strip()

    if not re.match(r"^select\b", normalized, flags=re.IGNORECASE):
        raise DebugSqlValidationError("Разрешён только SELECT-запрос")

    if READONLY_SQL_LOCKING_RE.search(normalized):
        raise DebugSqlValidationError("SELECT ... FOR UPDATE/SHARE запрещён")

    if READONLY_SQL_DISALLOWED_FUNCTIONS_RE.search(normalized):
        raise DebugSqlValidationError("Запрещены потенциально опасные SQL-функции")

    return normalized


def _is_system_schema(schema_name: str | None) -> bool:
    normalized = str(schema_name or "").strip().lower()
    if not normalized:
        return False
    return normalized in READONLY_SQL_SYSTEM_SCHEMAS or normalized.startswith("pg_")


def _is_system_relation_name(relation_name: str | None) -> bool:
    normalized = str(relation_name or "").strip().lower()
    return bool(normalized) and normalized.startswith("pg_")


def _iter_explain_nodes(item: Any):
    if isinstance(item, dict):
        if "Node Type" in item or "Relation Name" in item:
            yield item
        for value in item.values():
            yield from _iter_explain_nodes(value)
    elif isinstance(item, list):
        for child in item:
            yield from _iter_explain_nodes(child)


def _parse_explain_root(raw_plan: Any) -> dict[str, Any]:
    explain_data = raw_plan
    if isinstance(explain_data, str):
        try:
            explain_data = json.loads(explain_data)
        except ValueError as exc:
            raise DebugSqlValidationError("Не удалось разобрать SQL-план") from exc

    if isinstance(explain_data, dict):
        explain_data = [explain_data]

    if not isinstance(explain_data, list) or not explain_data:
        raise DebugSqlValidationError("Не удалось разобрать SQL-план")

    root = explain_data[0]
    if not isinstance(root, dict):
        raise DebugSqlValidationError("Не удалось разобрать SQL-план")

    plan = root.get("Plan") or root
    if not isinstance(plan, dict):
        raise DebugSqlValidationError("Не удалось разобрать SQL-план")

    return plan


def _validate_readonly_select_plan(cursor, query: str) -> None:
    """Проверяет, что запрос обращается только к пользовательским таблицам."""

    cursor.execute(f"EXPLAIN (VERBOSE, FORMAT JSON) {query}")
    explain_row = cursor.fetchone()
    if not explain_row:
        raise DebugSqlValidationError("Не удалось получить SQL-план")

    raw_plan = explain_row.get("QUERY PLAN") if hasattr(explain_row, "get") else explain_row[0]
    plan_root = _parse_explain_root(raw_plan)

    relation_count = 0
    blocked_targets: list[str] = []
    blocked_node_types: list[str] = []

    for node in _iter_explain_nodes(plan_root):
        node_type = str(node.get("Node Type") or "").strip()
        if node_type in READONLY_SQL_BLOCKED_PLAN_NODE_TYPES:
            blocked_node_types.append(node_type)

        relation_name = str(node.get("Relation Name") or "").strip()
        if not relation_name:
            continue

        relation_count += 1
        schema_name = str(node.get("Schema") or "").strip()
        if _is_system_schema(schema_name) or _is_system_relation_name(relation_name):
            qualified_name = ".".join(part for part in (schema_name, relation_name) if part)
            blocked_targets.append(qualified_name or relation_name)

    if blocked_targets:
        blocked_targets.sort()
        raise DebugSqlValidationError(
            "Доступ к системным объектам PostgreSQL запрещён: "
            + ", ".join(dict.fromkeys(blocked_targets))
        )

    if blocked_node_types:
        blocked_node_types.sort()
        raise DebugSqlValidationError(
            "Разрешены только SELECT-запросы к пользовательским таблицам: "
            + ", ".join(dict.fromkeys(blocked_node_types))
        )

    if relation_count == 0:
        raise DebugSqlValidationError("Разрешены только SELECT-запросы к пользовательским таблицам")


def load_db_settings() -> Dict[str, Any]:
    """Загружает настройки базы данных из db_settings.yaml."""

    try:
        db_settings_path = next((path for path in DB_SETTINGS_CANDIDATES if os.path.isfile(path)), None)
        if not db_settings_path:
            candidates = ", ".join(DB_SETTINGS_CANDIDATES)
            raise FileNotFoundError(f"Файл настроек БД не найден. Проверены пути: {candidates}")

        with open(db_settings_path, "r", encoding="utf-8") as f:
            settings = yaml.safe_load(f) or {}

        # Валидация обязательных полей
        required_fields = ["address", "port", "db_name", "user", "password"]
        for field in required_fields:
            if field not in settings:
                raise ValueError(f"Отсутствует обязательное поле: {field}")

        return settings
    except FileNotFoundError:
        logger.error("Файл настроек БД не найден")
        raise
    except yaml.YAMLError as e:
        logger.error("Ошибка парсинга db_settings.yaml: %s", e)
        raise
    except Exception as e:
        logger.exception("Ошибка загрузки настроек БД: %s", e)
        raise


class DatabaseManager:
    """Менеджер для работы с PostgreSQL базой данных."""

    def __init__(self):
        """Инициализация менеджера БД."""
        self.settings = load_db_settings()
        self._connection_params = {
            "host": self.settings["address"],
            "port": self.settings["port"],
            "database": self.settings["db_name"],
            "user": self.settings["user"],
            "password": self.settings["password"],
        }

    @contextmanager
    def get_connection(self):
        """Контекстный менеджер для получения соединения с БД."""
        conn = None
        try:
            conn = psycopg2.connect(**self._connection_params)
            yield conn
        except psycopg2.Error as e:
            logger.error("Ошибка подключения к БД: %s", e)
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()

    def test_connection(self) -> Dict[str, Any]:
        """Тестирует подключение к базе данных."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT version();")
                    version = cursor.fetchone()[0]
                    return {
                        "success": True,
                        "message": "Подключение успешно",
                        "version": version,
                        "database": self.settings["db_name"],
                        "host": self.settings["address"],
                        "port": self.settings["port"]
                    }
        except Exception as e:
            logger.exception("Ошибка тестирования подключения: %s", e)
            return {
                "success": False,
                "error": str(e),
                "database": self.settings["db_name"],
                "host": self.settings["address"],
                "port": self.settings["port"]
            }

    def execute_query(self, query: str) -> Dict[str, Any]:
        """Выполняет SQL запрос и возвращает результат."""
        try:
            query = query.strip()
            if not query:
                return {
                    "success": False,
                    "error": "Пустой запрос"
                }
            
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    cursor.execute(query)
                    
                    # Определяем тип запроса
                    query_lower = query.lower().strip()
                    
                    if query_lower.startswith(('select', 'with', 'show')):
                        # Запросы, возвращающие данные
                        rows = cursor.fetchall()
                        columns = [desc[0] for desc in cursor.description] if cursor.description else []
                        
                        # Конвертируем RealDictRow в обычные словари
                        data = [dict(row) for row in rows]
                        
                        return {
                            "success": True,
                            "data": data,
                            "columns": columns,
                            "row_count": len(data),
                            "query": query
                        }
                    
                    elif query_lower.startswith(('insert', 'update', 'delete')):
                        # Запросы, изменяющие данные
                        conn.commit()
                        affected_rows = cursor.rowcount
                        
                        return {
                            "success": True,
                            "affected_rows": affected_rows,
                            "message": f"Запрос выполнен успешно. Затронуто строк: {affected_rows}",
                            "query": query
                        }
                    
                    elif query_lower.startswith(('create', 'drop', 'alter', 'truncate')):
                        # DDL запросы
                        conn.commit()
                        
                        return {
                            "success": True,
                            "message": "DDL команда выполнена успешно",
                            "query": query
                        }
                    
                    else:
                        # Другие запросы
                        conn.commit()
                        return {
                            "success": True,
                            "message": "Запрос выполнен",
                            "query": query
                        }
                        
        except psycopg2.Error as e:
            error_msg = str(e).strip()
            logger.error("Ошибка выполнения SQL: %s", error_msg)
            return {
                "success": False,
                "error": error_msg,
                "query": query
            }
        except Exception as e:
            error_msg = str(e)
            logger.exception("Неожиданная ошибка при выполнении SQL: %s", error_msg)
            return {
                "success": False,
                "error": f"Неожиданная ошибка: {error_msg}",
                "query": query
            }

    def execute_readonly_select(
        self,
        query: str,
        *,
        max_rows: int = READONLY_SQL_MAX_ROWS,
        statement_timeout_ms: int = READONLY_SQL_STATEMENT_TIMEOUT_MS,
    ) -> Dict[str, Any]:
        """Выполняет только SELECT-запрос в read-only транзакции."""

        normalized_query = _normalize_debug_select_query(query)
        conn = None
        started_at = perf_counter()

        try:
            with self.get_connection() as conn:
                conn.set_session(readonly=True, autocommit=False)
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    cursor.execute("SET LOCAL statement_timeout = %s", (statement_timeout_ms,))
                    cursor.execute("SET LOCAL lock_timeout = %s", (READONLY_SQL_LOCK_TIMEOUT_MS,))
                    _validate_readonly_select_plan(cursor, normalized_query)
                    cursor.execute(normalized_query)

                    columns = [desc[0] for desc in cursor.description] if cursor.description else []
                    raw_rows = cursor.fetchmany(max_rows + 1)
                    truncated = len(raw_rows) > max_rows
                    visible_rows = raw_rows[:max_rows]
                    rows = [_json_safe_value(dict(row)) for row in visible_rows]

                    return {
                        "query": normalized_query,
                        "columns": columns,
                        "rows": rows,
                        "row_count": len(rows),
                        "truncated": truncated,
                        "max_rows": max_rows,
                        "duration_ms": int((perf_counter() - started_at) * 1000),
                    }
        except DebugSqlError:
            raise
        except psycopg2.OperationalError as exc:
            logger.error("Ошибка подключения при выполнении debug SQL: %s", exc)
            raise DebugSqlError(
                "Не удалось подключиться к БД",
                code="debug_sql_connection_failed",
                status_code=503,
            ) from exc
        except psycopg2.Error as exc:
            error_msg = str(exc).strip() or "Ошибка выполнения SQL"
            logger.error("Ошибка выполнения debug SQL: %s", error_msg)
            raise DebugSqlError(
                error_msg,
                code="debug_sql_execution_failed",
                status_code=400,
            ) from exc
        except Exception as exc:
            logger.exception("Неожиданная ошибка при выполнении debug SQL")
            raise DebugSqlError(
                f"Неожиданная ошибка: {exc}",
                code="debug_sql_unexpected_error",
                status_code=500,
            ) from exc
        finally:
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass


_db_manager: DatabaseManager | None = None


def get_db_manager() -> DatabaseManager:
    """Ленивая инициализация менеджера БД для debug SQL и прочих utility use-cases."""

    global _db_manager
    if _db_manager is None:
        try:
            _db_manager = DatabaseManager()
        except FileNotFoundError as exc:
            raise DebugSqlError(
                "SQL debug недоступен: не найден конфиг БД",
                code="debug_sql_not_configured",
                status_code=503,
            ) from exc
        except yaml.YAMLError as exc:
            logger.error("Ошибка чтения YAML-конфига БД: %s", exc)
            raise DebugSqlError(
                "SQL debug недоступен: ошибка чтения конфига БД",
                code="debug_sql_not_configured",
                status_code=503,
            ) from exc
        except ValueError as exc:
            raise DebugSqlError(
                f"SQL debug недоступен: {exc}",
                code="debug_sql_not_configured",
                status_code=503,
            ) from exc
    return _db_manager
