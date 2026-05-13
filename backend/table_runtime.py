"""Runtime helpers for table row providers and paged table queries."""

from __future__ import annotations

import hashlib
import json
import csv
import os
import re
import sqlite3
import tempfile
from functools import cmp_to_key
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple

from .config_shared import ROOT_DIR

LOCAL_FULL_MAX_ROWS = 100
DEFAULT_TABLE_QUERY_LIMIT = 100
MAX_TABLE_QUERY_LIMIT = 100
TABLE_RUNTIME_CONFIG_KEY = "__tableRuntime"
SUPPORTED_FILE_FORMATS = {"csv", "json", "jsonl", "ndjson"}
SQL_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

FILE_VIEW_IN_MEMORY_MAX_ROWS = 200_000
FILE_EXPORT_MAX_ROWS = 500_000
EXPORT_CHUNK_HARD_MAX = 50_000

JsonDict = Dict[str, Any]

_FILE_ROWS_COUNT_CACHE: Dict[str, int] = {}

_SQLITE_FILE_HANDLES: Dict[str, sqlite3.Connection] = {}
_SQLITE_FILE_PATHS: Dict[str, str] = {}
_SQLITE_FILES_ORDER: List[str] = []
_SQLITE_FILE_CACHE_MAX = 4


class TableQueryRejected(Exception):
    """Raised when a table query/export cannot be completed safely without exhausting memory."""

    def __init__(self, *, code: str, message: str, status: int = 413):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _is_record(value: Any) -> bool:
    return isinstance(value, dict)


def _is_table_config(value: Any) -> bool:
    return isinstance(value, dict) and str(value.get("widget") or "").strip() == "table"


def _parse_positive_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def normalize_query_limit(value: Any, fallback: int = DEFAULT_TABLE_QUERY_LIMIT) -> int:
    return max(1, min(MAX_TABLE_QUERY_LIMIT, _parse_positive_int(value, fallback)))


def _source_key(config: JsonDict) -> Optional[str]:
    for key in ("value", "source", "data"):
        if key in config:
            return key
    return None


def _source_config(config: JsonDict) -> JsonDict:
    key = _source_key(config)
    value = config.get(key) if key else None
    return dict(value) if isinstance(value, dict) else {}


def _inline_rows(config: JsonDict) -> Tuple[Optional[str], Optional[List[Any]]]:
    key = _source_key(config)
    if key and isinstance(config.get(key), list):
        return key, list(config.get(key) or [])
    if key and isinstance(config.get(key), dict) and isinstance(config[key].get("rows"), list):
        return key, list(config[key].get("rows") or [])
    return key, None


def _safe_file_path(raw_path: Any) -> str:
    path = str(raw_path or "").strip()
    if not path:
        raise ValueError("File table source requires non-empty path")
    root = os.path.abspath(ROOT_DIR)
    candidate = path if os.path.isabs(path) else os.path.join(root, path)
    normalized = os.path.abspath(candidate)
    if normalized != root and not normalized.startswith(root + os.sep):
        raise ValueError("File table source path must stay inside project root")
    return normalized


def _infer_file_format(path: str, raw_format: Any = None) -> str:
    fmt = str(raw_format or "").strip().lower()
    if fmt in SUPPORTED_FILE_FORMATS:
        return "jsonl" if fmt == "ndjson" else fmt
    lower = path.lower()
    if lower.endswith(".csv"):
        return "csv"
    if lower.endswith(".jsonl") or lower.endswith(".ndjson"):
        return "jsonl"
    if lower.endswith(".json"):
        return "json"
    raise ValueError("Unsupported table file format")


def _normalize_file_json_row(value: Any) -> Any:
    if isinstance(value, dict) and isinstance(value.get("values"), list):
        return {
            "id": value.get("rowId") or value.get("row_id") or value.get("id"),
            "cells": list(value.get("values") or []),
        }
    return value


def _iter_file_rows(source: JsonDict) -> Iterator[Any]:
    path = _safe_file_path(source.get("path"))
    fmt = _infer_file_format(path, source.get("format"))
    if not os.path.isfile(path):
        raise ValueError(f"Table file source not found: {os.path.relpath(path, ROOT_DIR)}")
    if fmt == "csv":
        with open(path, "r", encoding=str(source.get("encoding") or "utf-8"), newline="") as handle:
            reader = csv.reader(handle)
            skip_header = source.get("header") is True or source.get("headers") is True
            for index, row in enumerate(reader):
                if index == 0 and skip_header:
                    continue
                yield list(row)
        return
    if fmt == "jsonl":
        with open(path, "r", encoding=str(source.get("encoding") or "utf-8")) as handle:
            for line in handle:
                text = line.strip()
                if not text:
                    continue
                yield _normalize_file_json_row(json.loads(text))
        return
    with open(path, "r", encoding=str(source.get("encoding") or "utf-8")) as handle:
        payload = json.load(handle)
    rows = payload.get("rows") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("JSON table file source must contain an array or { rows: [...] }")
    for row in rows:
        yield _normalize_file_json_row(row)


def _iter_source_rows(config: JsonDict) -> Iterator[Any]:
    provider = _row_source_kind(config)
    if provider == "file":
        yield from _iter_file_rows(_source_config(config))
        return
    if provider == "db":
        columns = _column_keys_from_table_attrs(config.get("table_attrs"))
        rows, _total = _db_query_window(
            config,
            columns,
            {"offset": 0, "limit": MAX_TABLE_QUERY_LIMIT},
        )
        yield from rows
        return
    _source_key_value, rows = _inline_rows(config)
    yield from (rows or [])


def _source_total_hint(config: JsonDict) -> Optional[int]:
    source = _source_config(config)
    for key in ("total", "row_count", "rowCount", "totalRows"):
        if key in source:
            try:
                total = int(source.get(key))
            except (TypeError, ValueError):
                continue
            if total >= 0:
                return total
    return None


def _source_initial_rows_and_total(config: JsonDict, limit: int) -> Tuple[List[Any], Optional[int]]:
    provider = _row_source_kind(config)
    if provider == "db":
        columns = _column_keys_from_table_attrs(config.get("table_attrs"))
        return _db_query_window(config, columns, {"offset": 0, "limit": limit})
    if provider != "file":
        _key, rows = _inline_rows(config)
        return list(rows or [])[:limit], len(rows) if rows is not None else _source_total_hint(config)
    rows: List[Any] = []
    total = 0
    for row in _iter_file_rows(_source_config(config)):
        if len(rows) < limit:
            rows.append(row)
        total += 1
    return rows, _source_total_hint(config) or total


def _plain_source_window(config: JsonDict, offset: int, limit: int) -> Optional[Tuple[List[Any], int]]:
    provider = _row_source_kind(config)
    if provider == "db":
        columns = _column_keys_from_table_attrs(config.get("table_attrs"))
        return _db_query_window(config, columns, {"offset": offset, "limit": limit})
    if provider == "inline":
        _source_key_value, rows = _inline_rows(config)
        if rows is None:
            return None
        total = len(rows)
        return list(rows[offset : offset + limit]), total
    if provider != "file":
        return None
    rows: List[Any] = []
    total = 0
    end = offset + limit
    for row in _iter_file_rows(_source_config(config)):
        if offset <= total < end:
            rows.append(row)
        total += 1
    return rows, _source_total_hint(config) or total


def _row_source_kind(config: JsonDict) -> str:
    key = _source_key(config)
    value = config.get(key) if key else None
    if isinstance(value, dict):
        kind = str(value.get("kind") or "").strip().lower()
        if kind in {"db", "file", "inline"}:
            return kind
    if isinstance(value, list):
        return "inline"
    return "unknown"


def _column_keys_from_table_attrs(table_attrs: Any) -> List[str]:
    if not isinstance(table_attrs, str):
        return []
    keys: List[str] = []
    for raw_line in table_attrs.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("/"):
            continue
        key = line.split("/", 1)[0].strip().split(" ", 1)[0].strip()
        if key:
            keys.append(key)
    return keys


def _row_values(row: Any) -> List[Any]:
    if isinstance(row, dict) and isinstance(row.get("cells"), list):
        return list(row.get("cells") or [])
    if isinstance(row, list):
        return list(row)
    return [row]


def _table_row_from_record(row: Any, columns: List[str]) -> Any:
    if not isinstance(row, dict):
        return row
    if isinstance(row.get("cells"), list):
        return row
    if columns:
        return [row.get(column) for column in columns]
    return list(row.values())


def _quote_sql_identifier(name: str) -> str:
    text = str(name or "").strip()
    if not SQL_IDENTIFIER_RE.match(text):
        raise ValueError(f"Unsafe SQL identifier: {text}")
    return f'"{text}"'


def _quote_sql_table_name(name: str) -> str:
    parts = [part.strip() for part in str(name or "").split(".") if part.strip()]
    if not parts:
        raise ValueError("DB table source requires table or query")
    return ".".join(_quote_sql_identifier(part) for part in parts)


def _sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def _db_base_query(source: JsonDict) -> str:
    raw_query = str(source.get("query") or source.get("sql") or "").strip().rstrip(";")
    if raw_query:
        return raw_query
    return f"SELECT * FROM {_quote_sql_table_name(str(source.get('table') or ''))}"


def _db_where_clauses(columns: List[str], filters: Any, search: Any) -> List[str]:
    clauses: List[str] = []
    if isinstance(filters, list):
        valid_columns = set(columns)
        for item in filters:
            if not isinstance(item, dict):
                continue
            key = str(item.get("columnKey") or item.get("colKey") or "").strip()
            if key not in valid_columns:
                continue
            ident = _quote_sql_identifier(key)
            op = str(item.get("op") or "eq").strip().lower()
            value = item.get("value")
            if op in {"contains", "icontains"}:
                clauses.append(f"CAST({ident} AS TEXT) ILIKE '%' || {_sql_literal(value)} || '%'")
            elif op in {"neq", "not_eq", "!="}:
                clauses.append(f"{ident} IS DISTINCT FROM {_sql_literal(value)}")
            elif op in {"gt", ">", "gte", ">=", "lt", "<", "lte", "<="}:
                sql_op = {"gt": ">", "gte": ">=", "lt": "<", "lte": "<="}.get(op, op)
                clauses.append(f"{ident} {sql_op} {_sql_literal(value)}")
            elif op in {"empty", "is_empty"}:
                clauses.append(f"({ident} IS NULL OR CAST({ident} AS TEXT) = '')")
            elif op in {"not_empty", "non_empty"}:
                clauses.append(f"({ident} IS NOT NULL AND CAST({ident} AS TEXT) <> '')")
            else:
                clauses.append(f"{ident} = {_sql_literal(value)}")
    search_text = str(search or "").strip()
    if search_text and columns:
        search_parts = [
            f"CAST({_quote_sql_identifier(column)} AS TEXT) ILIKE '%' || {_sql_literal(search_text)} || '%'"
            for column in columns
        ]
        clauses.append("(" + " OR ".join(search_parts) + ")")
    return clauses


def _db_order_clause(columns: List[str], sort_spec: Any) -> str:
    if not isinstance(sort_spec, list):
        return ""
    valid_columns = set(columns)
    parts: List[str] = []
    for item in sort_spec:
        if not isinstance(item, dict):
            continue
        key = str(item.get("columnKey") or item.get("colKey") or "").strip()
        if key not in valid_columns:
            continue
        direction = "DESC" if str(item.get("direction") or item.get("dir") or "asc").lower() == "desc" else "ASC"
        parts.append(f"{_quote_sql_identifier(key)} {direction}")
    return " ORDER BY " + ", ".join(parts) if parts else ""


def _db_view_sql(config: JsonDict, columns: List[str], view: JsonDict, *, count: bool) -> str:
    base = _db_base_query(_source_config(config))
    where = _db_where_clauses(columns, view.get("filters"), view.get("search"))
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""
    if count:
        return f"SELECT COUNT(*) AS total FROM ({base}) AS table_runtime_source{where_sql}"
    order_sql = _db_order_clause(columns, view.get("sort"))
    offset = max(0, _parse_positive_int(view.get("offset"), 0) if view.get("offset") else 0)
    limit = normalize_query_limit(view.get("limit"))
    return (
        f"SELECT * FROM ({base}) AS table_runtime_source"
        f"{where_sql}{order_sql} LIMIT {limit} OFFSET {offset}"
    )


def _db_query_window(config: JsonDict, columns: List[str], view: JsonDict) -> Tuple[List[Any], int]:
    from .database import get_db_manager

    manager = get_db_manager()
    limit = normalize_query_limit(view.get("limit"))
    rows_result = manager.execute_readonly_select(_db_view_sql(config, columns, view, count=False), max_rows=limit)
    rows = [_table_row_from_record(row, columns) for row in rows_result.get("rows", [])]
    try:
        count_result = manager.execute_readonly_select(_db_view_sql(config, columns, view, count=True), max_rows=1)
        first = (count_result.get("rows") or [{}])[0]
        total = int(first.get("total") if isinstance(first, dict) else 0)
    except Exception:
        offset = max(0, _parse_positive_int(view.get("offset"), 0) if view.get("offset") else 0)
        total = offset + len(rows)
    return rows, max(total, len(rows))


def _group_columns_from_spec(group_spec: Any, columns: List[str]) -> List[str]:
    if not isinstance(group_spec, list) or not group_spec:
        return []
    valid = set(columns)
    seen = set()
    result: List[str] = []
    for item in group_spec:
        if not isinstance(item, dict):
            continue
        column_key = str(item.get("columnKey") or item.get("colKey") or "").strip()
        if not column_key or column_key not in valid or column_key in seen:
            continue
        seen.add(column_key)
        result.append(column_key)
    return result


def _group_value_text(value: Any) -> str:
    return str(value if value is not None else "")


def _group_id_from_segments(segments: List[Tuple[str, Any]]) -> str:
    return "/".join(f"{column_key}:{_group_value_text(value)}" for column_key, value in segments)


def _group_display_record(
    *,
    column_key: str,
    count: int,
    expanded: bool,
    group_id: str,
    key_value: Any,
    level: int,
) -> JsonDict:
    return {
        "kind": "group",
        "columnKey": column_key,
        "groupId": group_id,
        "level": level,
        "key": _group_value_text(key_value),
        "count": count,
        "expanded": expanded,
    }


def _db_query_group_display_items(
    config: JsonDict,
    columns: List[str],
    view: JsonDict,
    offset: int,
    limit: int,
) -> Tuple[List[JsonDict], int]:
    from .database import get_db_manager

    group_columns = _group_columns_from_spec(view.get("group"), columns)
    if not group_columns:
        return [], 0

    manager = get_db_manager()
    base = _db_base_query(_source_config(config))
    expanded_ids = set(str(item) for item in view.get("expandedGroups") or [])
    base_filters = list(view.get("filters") or []) if isinstance(view.get("filters"), list) else []
    window_end = offset + limit

    result: List[JsonDict] = []

    def group_rows_for(column_key: str, filters: List[JsonDict]) -> List[JsonDict]:
        where = _db_where_clauses(columns, filters, view.get("search"))
        where_sql = (" WHERE " + " AND ".join(where)) if where else ""
        ident = _quote_sql_identifier(column_key)
        group_query = (
            f"SELECT {ident} AS key, COUNT(*) AS count "
            f"FROM ({base}) AS table_runtime_source"
            f"{where_sql} GROUP BY {ident} ORDER BY {ident} ASC"
        )
        return manager.execute_readonly_select(group_query, max_rows=10000).get("rows", [])

    def append_if_visible(display_index: int, item: JsonDict) -> None:
        if offset <= display_index < window_end and len(result) < limit:
            result.append(item)

    def walk(
        level: int,
        filters: List[JsonDict],
        prefix: List[Tuple[str, Any]],
        logical_index: int,
    ) -> int:
        column_key = group_columns[level]
        for group_row in group_rows_for(column_key, filters):
            key_value = group_row.get("key") if isinstance(group_row, dict) else ""
            count = int(group_row.get("count") if isinstance(group_row, dict) else 0)
            segments = prefix + [(column_key, key_value)]
            group_id = _group_id_from_segments(segments)
            expanded = group_id in expanded_ids
            append_if_visible(
                logical_index,
                _group_display_record(
                    column_key=column_key,
                    count=count,
                    expanded=expanded,
                    group_id=group_id,
                    key_value=key_value,
                    level=level,
                ),
            )
            logical_index += 1
            if not expanded:
                continue

            child_filters = filters + [{"columnKey": column_key, "op": "eq", "value": key_value}]
            if level + 1 < len(group_columns):
                logical_index = walk(level + 1, child_filters, segments, logical_index)
                continue

            child_offset = max(0, offset - logical_index)
            child_limit = max(0, min(count - child_offset, window_end - max(offset, logical_index)))
            if child_limit > 0 and len(result) < limit:
                child_rows, _child_total = _db_query_window(
                    config,
                    columns,
                    {
                        **view,
                        "filters": child_filters,
                        "group": [],
                        "limit": min(child_limit, limit - len(result)),
                        "offset": child_offset,
                    },
                )
                for child_index, child_row in enumerate(child_rows):
                    result.extend(_display_items([child_row], logical_index + child_offset + child_index))
            logical_index += count
        return logical_index

    total = walk(0, base_filters, [], 0)
    return result[:limit], total


def _row_id(row: Any, source_index: int) -> str:
    if isinstance(row, dict) and row.get("id") is not None:
        return str(row.get("id"))
    return f"row_{source_index}"


def _display_items(rows: Iterable[Any], offset: int = 0) -> List[JsonDict]:
    items: List[JsonDict] = []
    for index, row in enumerate(rows):
        source_index = offset + index
        items.append(
            {
                "kind": "row",
                "rowId": _row_id(row, source_index),
                "sourceIndex": source_index,
                "values": _row_values(row),
            }
        )
    return items


def _stable_view_id(payload: JsonDict) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return "view_" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def _canonical_view_for_fingerprint(view: JsonDict) -> JsonDict:
    """Canonical TableViewState for stable fingerprint alignment with frontend."""
    offset = max(
        0,
        _parse_positive_int(view.get("offset"), 0) if view.get("offset") is not None else 0,
    )
    limit = normalize_query_limit(view.get("limit"))
    sort_list = view.get("sort") if isinstance(view.get("sort"), list) else []
    filters_list = view.get("filters") if isinstance(view.get("filters"), list) else []
    group_list = view.get("group") if isinstance(view.get("group"), list) else []
    search_raw = view.get("search")
    search_out = None if search_raw is None else str(search_raw)
    expanded_raw = view.get("expandedGroups") if isinstance(view.get("expandedGroups"), list) else []
    expanded_sorted = sorted(str(item) for item in expanded_raw)
    return {
        "expandedGroups": expanded_sorted,
        "filters": filters_list,
        "group": group_list,
        "limit": limit,
        "offset": offset,
        "search": search_out,
        "sort": sort_list,
    }


def _table_query_view_fingerprint(
    *,
    page_name: str,
    attr_name: str,
    provider: str,
    source_key: Optional[str],
    canonical_view: JsonDict,
) -> str:
    """Stable fingerprint (no total rows) — secondary stale-response guard."""
    return _stable_view_id(
        {
            "attr": attr_name,
            "page": page_name,
            "provider": provider,
            "sourceKey": source_key if source_key is not None else "",
            "view": canonical_view,
        }
    )


def _initial_limit(config: JsonDict) -> int:
    """Cap first serialized window in page/attrs at `LOCAL_FULL_MAX_ROWS`."""
    requested = normalize_query_limit(config.get("lazy_chunk_size"), LOCAL_FULL_MAX_ROWS)
    return min(LOCAL_FULL_MAX_ROWS, requested)


def _runtime_sidecar(
    *,
    attr_name: str,
    config: JsonDict,
    mode: str,
    page_name: str,
    provider: str,
    rows: Optional[List[Any]],
    source_key: Optional[str],
    total: Optional[int],
) -> JsonDict:
    limit = _initial_limit(config)
    effective_source_key = source_key or _source_key(config) or ""
    safe_total = int(total if total is not None else (len(rows or []) if rows is not None else 0))
    initial_rows = list(rows or [])[:limit]
    initial_view = {
        "offset": 0,
        "limit": limit,
        "sort": [],
        "filters": [],
        "group": [],
        "search": None,
        "expandedGroups": [],
    }
    view_seed = {
        "page": page_name,
        "attr": attr_name,
        "mode": mode,
        "attr": attr_name,
        "page": page_name,
        "provider": provider,
        "sourceKey": effective_source_key,
        "view": initial_view,
        "total": safe_total,
    }
    return {
        "mode": mode,
        "provider": provider,
        "tableId": f"{page_name}:{attr_name}",
        "sourceKey": effective_source_key,
        "localFullMaxRows": LOCAL_FULL_MAX_ROWS,
        "initialView": initial_view,
        "initialWindow": {
            "view_id": _stable_view_id(view_seed),
            "offset": 0,
            "limit": limit,
            "total": safe_total,
            "items": _display_items(initial_rows, 0),
            "has_more": safe_total > len(initial_rows),
        },
        "diagnostics": [],
    }


def prepare_table_attrs_for_runtime(
    page_name: str,
    attrs: Dict[str, Any],
    attr_names: Optional[Iterable[str]] = None,
) -> Tuple[Dict[str, Any], Dict[str, JsonDict]]:
    """Return attrs with huge table row payloads replaced by initial windows."""

    requested = set(attr_names or [])
    selected_names = requested if requested else set(attrs.keys())
    prepared: Dict[str, Any] = {}
    runtime: Dict[str, JsonDict] = {}

    for name, raw_config in attrs.items():
        if name not in selected_names:
            continue
        if not _is_table_config(raw_config):
            prepared[name] = raw_config
            continue

        config = dict(raw_config)
        provider = _row_source_kind(config)
        source_key, rows = _inline_rows(config)
        total = len(rows) if rows is not None else None
        mode = "local-full"

        if provider in {"db", "file"}:
            mode = "remote-paged"
        elif provider == "inline" and rows is not None and len(rows) > LOCAL_FULL_MAX_ROWS:
            mode = "remote-paged"
        elif provider == "unknown":
            mode = "remote-paged" if source_key else "local-full"

        initial_limit = _initial_limit(config)
        try:
            initial_rows, total = _source_initial_rows_and_total(config, initial_limit)
        except Exception as exc:
            initial_rows = rows or []
            total = len(initial_rows) if rows is not None else 0
            mode = "remote-paged"
            source_error = str(exc)
        else:
            source_error = ""
        sidecar = _runtime_sidecar(
            attr_name=name,
            config=config,
            mode=mode,
            page_name=page_name,
            provider=provider,
            rows=initial_rows,
            source_key=source_key,
            total=total,
        )
        if source_error:
            sidecar["diagnostics"].append(
                {
                    "level": "error",
                    "code": "table_source_unavailable",
                    "message": source_error,
                    "page": page_name,
                }
            )
        if provider == "inline" and rows is not None and len(rows) > LOCAL_FULL_MAX_ROWS:
            sidecar["diagnostics"].append(
                {
                    "level": "warning",
                    "code": "huge_inline_table",
                    "message": (
                        f"Inline table '{name}' has {len(rows)} rows. "
                        "Excel-like performance requires moving rows to file/db source."
                    ),
                    "page": page_name,
                }
            )
            if source_key:
                config[source_key] = rows[: sidecar["initialWindow"]["limit"]]
        elif mode == "remote-paged" and source_key and isinstance(config.get(source_key), dict):
            source_config = dict(config[source_key])
            if "rows" in source_config:
                source_config["rows"] = initial_rows
            config[source_key] = source_config
        config[TABLE_RUNTIME_CONFIG_KEY] = sidecar
        runtime[name] = sidecar
        prepared[name] = config

    return prepared, runtime


def _compare_values(left: Any, right: Any) -> int:
    if left == right:
        return 0
    if left is None:
        return -1
    if right is None:
        return 1
    try:
        left_num = float(left)
        right_num = float(right)
        if left_num < right_num:
            return -1
        if left_num > right_num:
            return 1
        return 0
    except (TypeError, ValueError):
        pass
    left_text = str(left)
    right_text = str(right)
    return -1 if left_text < right_text else 1


def _column_index_map(columns: List[str]) -> Dict[str, int]:
    return {key: index for index, key in enumerate(columns)}


def _coerce_filter_value(value: Any) -> Any:
    if isinstance(value, str):
        text = value.strip()
        if text == "":
            return ""
        try:
            return float(text)
        except ValueError:
            return value
    return value


def _filter_compare(cell: Any, op: str, expected: Any) -> bool:
    op = str(op or "eq").strip().lower()
    if op in {"empty", "is_empty"}:
        return cell is None or cell == ""
    if op in {"not_empty", "non_empty"}:
        return not (cell is None or cell == "")
    if op in {"contains", "icontains"}:
        return str(expected).lower() in str(cell or "").lower()
    if op in {"starts", "startswith"}:
        return str(cell or "").lower().startswith(str(expected).lower())
    if op in {"ends", "endswith"}:
        return str(cell or "").lower().endswith(str(expected).lower())
    if op in {"neq", "not_eq", "!="}:
        return cell != expected
    if op in {"gt", ">", "gte", ">=", "lt", "<", "lte", "<="}:
        compared = _compare_values(_coerce_filter_value(cell), _coerce_filter_value(expected))
        return {
            "gt": compared > 0,
            ">": compared > 0,
            "gte": compared >= 0,
            ">=": compared >= 0,
            "lt": compared < 0,
            "<": compared < 0,
            "lte": compared <= 0,
            "<=": compared <= 0,
        }[op]
    return cell == expected


def _apply_search_and_filters(rows: List[Any], columns: List[str], filters: Any, search: Any) -> List[Any]:
    column_index = _column_index_map(columns)
    normalized_filters: List[Tuple[int, str, Any]] = []
    if isinstance(filters, list):
        for item in filters:
            if not isinstance(item, dict):
                continue
            key = str(item.get("columnKey") or item.get("colKey") or "").strip()
            if key not in column_index:
                continue
            normalized_filters.append((column_index[key], str(item.get("op") or "eq"), item.get("value")))
    search_text = str(search or "").strip().lower()
    if not normalized_filters and not search_text:
        return rows

    result: List[Any] = []
    for row in rows:
        values = _row_values(row)
        if search_text and not any(search_text in str(value or "").lower() for value in values):
            continue
        accepted = True
        for col_index, op, expected in normalized_filters:
            cell = values[col_index] if col_index < len(values) else None
            if not _filter_compare(cell, op, expected):
                accepted = False
                break
        if accepted:
            result.append(row)
    return result


def _sort_rows(rows: List[Any], columns: List[str], sort_spec: Any) -> List[Any]:
    if not isinstance(sort_spec, list) or not sort_spec:
        return list(rows)

    column_index = _column_index_map(columns)
    normalized = []
    for item in sort_spec:
        if not isinstance(item, dict):
            continue
        key = str(item.get("columnKey") or item.get("colKey") or "").strip()
        if not key or key not in column_index:
            continue
        normalized.append((column_index[key], str(item.get("direction") or item.get("dir") or "asc") == "desc"))
    if not normalized:
        return list(rows)

    indexed = list(enumerate(rows))

    def compare(left: Tuple[int, Any], right: Tuple[int, Any]) -> int:
        left_values = _row_values(left[1])
        right_values = _row_values(right[1])
        for col_index, desc in normalized:
            result = _compare_values(
                left_values[col_index] if col_index < len(left_values) else None,
                right_values[col_index] if col_index < len(right_values) else None,
            )
            if result:
                return -result if desc else result
        return left[0] - right[0]

    return [row for _index, row in sorted(indexed, key=cmp_to_key(compare))]


def _group_display_items(rows: List[Any], columns: List[str], group_spec: Any, expanded: Any) -> Optional[List[JsonDict]]:
    group_columns = _group_columns_from_spec(group_spec, columns)
    if not group_columns:
        return None
    expanded_ids = set(str(item) for item in expanded) if isinstance(expanded, list) else set()
    items: List[JsonDict] = []

    def walk(bucket_rows: List[Tuple[int, Any]], level: int, prefix: List[Tuple[str, Any]]) -> None:
        if level >= len(group_columns):
            for source_index, row in bucket_rows:
                items.extend(_display_items([row], source_index))
            return
        column_key = group_columns[level]
        col_index = columns.index(column_key)
        buckets: Dict[str, List[Tuple[int, Any]]] = {}
        for source_index, row in bucket_rows:
            values = _row_values(row)
            key = _group_value_text(values[col_index] if col_index < len(values) else "")
            buckets.setdefault(key, []).append((source_index, row))
        for key in sorted(buckets.keys()):
            child_bucket = buckets[key]
            segments = prefix + [(column_key, key)]
            group_id = _group_id_from_segments(segments)
            is_expanded = group_id in expanded_ids
            items.append(
                _group_display_record(
                    column_key=column_key,
                    count=len(child_bucket),
                    expanded=is_expanded,
                    group_id=group_id,
                    key_value=key,
                    level=level,
                )
            )
            if is_expanded:
                walk(child_bucket, level + 1, segments)

    walk(list(enumerate(rows)), 0, [])
    return items


def _file_row_count_physical_key(config: JsonDict) -> Optional[str]:
    try:
        if _row_source_kind(config) != "file":
            return None
        source = _source_config(config)
        path = _safe_file_path(source.get("path"))
        if not os.path.isfile(path):
            return None
        stat = os.stat(path)
        return f"{path}|{stat.st_mtime_ns}|{stat.st_size}|{_infer_file_format(path, source.get('format'))}"
    except Exception:
        return None


def _estimate_file_rows(config: JsonDict) -> int:
    sig = _file_row_count_physical_key(config)
    if sig and sig in _FILE_ROWS_COUNT_CACHE:
        return _FILE_ROWS_COUNT_CACHE[sig]
    source_cfg = _source_config(config)
    count = sum(1 for _ in _iter_file_rows(source_cfg))
    if sig:
        _FILE_ROWS_COUNT_CACHE[sig] = count
    return count


def _sqlite_quote_col(index: int) -> str:
    alias = f"c{index}"
    if not SQL_IDENTIFIER_RE.match(alias):
        raise ValueError(f"Invalid SQLite column alias: {alias}")
    return f'"{alias}"'


def _evict_remote_sqlite_entry(cache_key: str) -> None:
    conn = _SQLITE_FILE_HANDLES.pop(cache_key, None)
    path_val = _SQLITE_FILE_PATHS.pop(cache_key, None)
    if conn:
        try:
            conn.close()
        except sqlite3.Error:
            pass
    if path_val and os.path.isfile(path_val):
        try:
            os.unlink(path_val)
        except OSError:
            pass


def _evict_remote_sqlite_lru_if_needed() -> None:
    while len(_SQLITE_FILES_ORDER) > _SQLITE_FILE_CACHE_MAX:
        victim = _SQLITE_FILES_ORDER.pop(0)
        _evict_remote_sqlite_entry(victim)


def _sqlite_cache_signature(config: JsonDict, columns: List[str]) -> Optional[str]:
    base = _file_row_count_physical_key(config)
    if not base:
        return None
    return base + "|" + ",".join(columns)


def _sqlite_build_disk_connection(config: JsonDict, columns: List[str]) -> Tuple[sqlite3.Connection, str]:
    tmp_handle = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    tmp_path = tmp_handle.name
    tmp_handle.close()
    conn = sqlite3.connect(tmp_path)
    defs = ",".join(f"{_sqlite_quote_col(idx)} TEXT" for idx in range(len(columns)))
    conn.execute(f"CREATE TABLE t (_pk INTEGER PRIMARY KEY AUTOINCREMENT,{defs})")
    col_list = ",".join(_sqlite_quote_col(idx) for idx in range(len(columns)))
    placeholder = ",".join(["?"] * len(columns))
    sql_insert = f"INSERT INTO t ({col_list}) VALUES ({placeholder})"
    batch: List[Tuple[Any, ...]] = []
    source_cfg = _source_config(config)
    for raw_row in _iter_file_rows(source_cfg):
        vals = list(_row_values(raw_row))
        while len(vals) < len(columns):
            vals.append(None)
        clipped = vals[: len(columns)]
        tup = tuple(None if cell is None else str(cell) for cell in clipped)
        batch.append(tup)
        if len(batch) >= 5000:
            conn.executemany(sql_insert, batch)
            batch.clear()
    if batch:
        conn.executemany(sql_insert, batch)
    conn.commit()
    return conn, tmp_path


def _get_sqlite_conn_for_cached_file(config: JsonDict, columns: List[str]) -> sqlite3.Connection:
    sig = _sqlite_cache_signature(config, columns)
    if not sig:
        conn, tmp_uncached = _sqlite_build_disk_connection(config, columns)
        volatile_key = "_volatile_" + hex(id(conn))[2:]
        _SQLITE_FILE_HANDLES[volatile_key] = conn
        _SQLITE_FILE_PATHS[volatile_key] = tmp_uncached
        _SQLITE_FILES_ORDER.append(volatile_key)
        _evict_remote_sqlite_lru_if_needed()
        return conn

    if sig in _SQLITE_FILE_HANDLES:
        conn = _SQLITE_FILE_HANDLES[sig]
        try:
            _SQLITE_FILES_ORDER.remove(sig)
        except ValueError:
            pass
        _SQLITE_FILES_ORDER.append(sig)
        return conn

    _evict_remote_sqlite_lru_if_needed()
    conn, path_val = _sqlite_build_disk_connection(config, columns)
    _SQLITE_FILE_HANDLES[sig] = conn
    _SQLITE_FILE_PATHS[sig] = path_val
    _SQLITE_FILES_ORDER.append(sig)
    return conn


def _sqlite_where_sql(columns: List[str], filters: Any, search: Any, params: List[Any]) -> str:
    column_map = _column_index_map(columns)
    clauses: List[str] = []
    filters_list = filters if isinstance(filters, list) else []
    for raw in filters_list:
        if not isinstance(raw, dict):
            continue
        key_name = str(raw.get("columnKey") or raw.get("colKey") or "").strip()
        if key_name not in column_map:
            continue
        col_ix = column_map[key_name]
        quoted = _sqlite_quote_col(col_ix)
        txt_cast = f"CAST({quoted} AS TEXT)"
        raw_op = str(raw.get("op") or "eq").strip().lower()
        raw_val = raw.get("value")
        cast_real = f"CAST(NULLIF(TRIM({quoted}),'') AS REAL)"

        if raw_op in {"empty", "is_empty"}:
            clauses.append(f"({quoted} IS NULL OR {txt_cast} = '')")
        elif raw_op in {"not_empty", "non_empty"}:
            clauses.append(f"({quoted} IS NOT NULL AND {txt_cast} <> '')")
        elif raw_op in {"contains", "icontains"}:
            clauses.append(f"LOWER({txt_cast}) LIKE '%' || LOWER(?) || '%'")
            params.append(str(raw_val))
        elif raw_op in {"starts", "startswith"}:
            clauses.append(f"LOWER({txt_cast}) LIKE LOWER(?) || '%'")
            params.append(str(raw_val))
        elif raw_op in {"ends", "endswith"}:
            clauses.append(f"LOWER({txt_cast}) LIKE '%' || LOWER(?)")
            params.append(str(raw_val))
        elif raw_op in {"neq", "not_eq", "!="}:
            clauses.append(f"({txt_cast}) IS DISTINCT FROM COALESCE(CAST(? AS TEXT), '')")
            params.append("" if raw_val is None else str(raw_val))
        elif raw_op in {"gt", ">", "gte", ">=", "lt", "<", "lte", "<="}:
            sql_txt_op = {"gt": ">", ">": ">", "gte": ">=", ">=": ">=", "lt": "<", "<": "<", "lte": "<=", "<=": "<="}[
                raw_op
            ]
            try:
                ev_num = float(_coerce_filter_value(raw_val))
                params.append(ev_num)
                clauses.append(f"(({cast_real} IS NOT NULL) AND ({cast_real} {sql_txt_op} ?))")
            except (TypeError, ValueError):
                params.append("" if raw_val is None else str(raw_val))
                clauses.append(f"({txt_cast} {sql_txt_op} CAST(? AS TEXT))")
        else:
            clauses.append(f"{txt_cast} = COALESCE(CAST(? AS TEXT), '')")
            params.append("" if raw_val is None else str(raw_val))

    search_trim = str(search or "").strip()
    if search_trim:
        searches: List[str] = []
        for col_k in columns:
            if col_k not in column_map:
                continue
            qi = column_map[col_k]
            txt = f"CAST({_sqlite_quote_col(qi)} AS TEXT)"
            searches.append(f"LOWER({txt}) LIKE '%' || LOWER(?) || '%'")
            params.append(search_trim)
        if searches:
            clauses.append("(" + " OR ".join(searches) + ")")

    if not clauses:
        return ""

    return " WHERE " + " AND ".join(clauses)


def _sqlite_order_sql(columns: List[str], sort_spec: Any) -> str:
    column_map = _column_index_map(columns)
    if not isinstance(sort_spec, list):
        return ""
    fragments: List[str] = []
    for item in sort_spec:
        if not isinstance(item, dict):
            continue
        key_name = str(item.get("columnKey") or item.get("colKey") or "").strip()
        if key_name not in column_map:
            continue
        direction_sql = (
            "DESC"
            if str(item.get("direction") or item.get("dir") or "asc").strip().lower() == "desc"
            else "ASC"
        )
        quoted = _sqlite_quote_col(column_map[key_name])
        fragments.append(f"{quoted} COLLATE NOCASE {direction_sql}")
    if not fragments:
        return ""
    return " ORDER BY " + ", ".join(fragments)


def _sqlite_file_select_window(
    config: JsonDict,
    *,
    columns: List[str],
    view: JsonDict,
    offset: int,
    limit: int,
) -> Tuple[List[Any], int]:
    conn = _get_sqlite_conn_for_cached_file(config, columns)

    sql_params_main: List[Any] = []
    rebuild_clause = _sqlite_where_sql(columns, view.get("filters"), view.get("search"), sql_params_main)

    sql_count = "SELECT COUNT(*)" + f" FROM t{rebuild_clause}"
    counted = conn.execute(sql_count, sql_params_main).fetchone()
    row_total = int(counted[0]) if counted and counted[0] is not None else 0

    order_sql = _sqlite_order_sql(columns, view.get("sort"))
    col_select = ",".join(_sqlite_quote_col(idx) for idx in range(len(columns)))
    win_params = list(sql_params_main)
    win_sql = f"SELECT {col_select} FROM t{rebuild_clause}{order_sql} LIMIT ? OFFSET ?"
    win_params.extend([limit, offset])
    cursor_win = conn.execute(win_sql, win_params)
    materialized_rows: List[Any] = []
    for tup in cursor_win.fetchall():
        materialized_rows.append(list(tup))
    return materialized_rows, row_total


def _query_large_file_via_sqlite(
    *,
    page_name: str,
    attr_name: str,
    provider: str,
    source_key: Optional[str],
    config: JsonDict,
    columns: List[str],
    view: JsonDict,
    offset: int,
    limit: int,
    view_fingerprint: str,
) -> JsonDict:
    window_rows_any, filtered_total = _sqlite_file_select_window(
        config,
        columns=columns,
        view=view,
        offset=offset,
        limit=limit,
    )
    normalized_view = {
        "offset": offset,
        "limit": limit,
        "sort": view.get("sort") if isinstance(view.get("sort"), list) else [],
        "filters": view.get("filters") if isinstance(view.get("filters"), list) else [],
        "group": view.get("group") if isinstance(view.get("group"), list) else [],
        "search": view.get("search") if view.get("search") is not None else None,
        "expandedGroups": view.get("expandedGroups") if isinstance(view.get("expandedGroups"), list) else [],
    }

    payload_view_id = _stable_view_id(
        {
            "page": page_name,
            "attr": attr_name,
            "provider": provider,
            "sourceKey": source_key,
            "view": normalized_view,
            "total": filtered_total,
        }
    )

    return {
        "page": page_name,
        "attr": attr_name,
        "provider": provider,
        "source_key": source_key,
        "view_id": payload_view_id,
        "view_fingerprint": view_fingerprint,
        "offset": offset,
        "limit": limit,
        "total": filtered_total,
        "items": _display_items(window_rows_any, offset),
        "has_more": offset + len(window_rows_any) < filtered_total,
    }


def query_table_view(
    *,
    page_name: str,
    attr_name: str,
    config: JsonDict,
    view: JsonDict,
) -> JsonDict:
    provider = _row_source_kind(config)
    source_key, rows = _inline_rows(config)
    columns = _column_keys_from_table_attrs(config.get("table_attrs"))
    offset = max(0, _parse_positive_int(view.get("offset"), 0) if view.get("offset") else 0)
    limit = normalize_query_limit(view.get("limit"))
    view_eff = dict(view)
    view_eff["limit"] = limit
    view_eff["offset"] = offset
    view_fingerprint = _table_query_view_fingerprint(
        page_name=page_name,
        attr_name=attr_name,
        provider=str(provider),
        source_key=source_key,
        canonical_view=_canonical_view_for_fingerprint(view_eff),
    )
    has_view_ops = bool(
        (isinstance(view.get("sort"), list) and view.get("sort"))
        or (isinstance(view.get("filters"), list) and view.get("filters"))
        or (isinstance(view.get("group"), list) and view.get("group"))
        or str(view.get("search") or "").strip()
    )
    if provider == "db" and isinstance(view.get("group"), list) and view.get("group"):
        window_items, total = _db_query_group_display_items(config, columns, view, offset, limit)
        normalized_view = {
            "offset": offset,
            "limit": limit,
            "sort": view.get("sort") if isinstance(view.get("sort"), list) else [],
            "filters": view.get("filters") if isinstance(view.get("filters"), list) else [],
            "group": view.get("group") if isinstance(view.get("group"), list) else [],
            "search": view.get("search") if view.get("search") is not None else None,
            "expandedGroups": view.get("expandedGroups") if isinstance(view.get("expandedGroups"), list) else [],
        }
        return {
            "page": page_name,
            "attr": attr_name,
            "provider": provider,
            "source_key": source_key,
            "view_id": _stable_view_id(
                {
                    "page": page_name,
                    "attr": attr_name,
                    "provider": provider,
                    "sourceKey": source_key,
                    "view": normalized_view,
                    "total": total,
                }
            ),
            "view_fingerprint": view_fingerprint,
            "offset": offset,
            "limit": limit,
            "total": total,
            "items": window_items,
            "has_more": offset + len(window_items) < total,
        }
    if provider == "db" and not (isinstance(view.get("group"), list) and view.get("group")):
        window, total = _db_query_window(config, columns, {**view, "offset": offset, "limit": limit})
        normalized_view = {
            "offset": offset,
            "limit": limit,
            "sort": view.get("sort") if isinstance(view.get("sort"), list) else [],
            "filters": view.get("filters") if isinstance(view.get("filters"), list) else [],
            "group": [],
            "search": view.get("search") if view.get("search") is not None else None,
            "expandedGroups": [],
        }
        return {
            "page": page_name,
            "attr": attr_name,
            "provider": provider,
            "source_key": source_key,
            "view_id": _stable_view_id(
                {
                    "page": page_name,
                    "attr": attr_name,
                    "provider": provider,
                    "sourceKey": source_key,
                    "view": normalized_view,
                    "total": total,
                }
            ),
            "view_fingerprint": view_fingerprint,
            "offset": offset,
            "limit": limit,
            "total": total,
            "items": _display_items(window, offset),
            "has_more": offset + len(window) < total,
        }
    if not has_view_ops:
        plain_window = _plain_source_window(config, offset, limit)
        if plain_window is not None:
            window, total = plain_window
            normalized_view = {
                "offset": offset,
                "limit": limit,
                "sort": [],
                "filters": [],
                "group": [],
                "search": None,
                "expandedGroups": [],
            }
            return {
                "page": page_name,
                "attr": attr_name,
                "provider": provider,
                "source_key": source_key,
                "view_id": _stable_view_id(
                    {
                        "page": page_name,
                        "attr": attr_name,
                        "provider": provider,
                        "sourceKey": source_key,
                        "view": normalized_view,
                        "total": total,
                    }
                ),
                "view_fingerprint": view_fingerprint,
                "offset": offset,
                "limit": limit,
                "total": total,
                "items": _display_items(window, offset),
                "has_more": offset + len(window) < total,
            }

    if provider == "file" and has_view_ops:
        file_estimate_rows = _estimate_file_rows(config)
        group_active_big = isinstance(view.get("group"), list) and view.get("group")
        if file_estimate_rows > FILE_VIEW_IN_MEMORY_MAX_ROWS:
            if group_active_big:
                raise TableQueryRejected(
                    code="file_view_group_too_large",
                    message=(
                        "Группировка по очень большому локальному файлу не поддерживается. "
                        "Перенесите данные в БД или сократите файл."
                    ),
                    status=413,
                )
            return _query_large_file_via_sqlite(
                page_name=page_name,
                attr_name=attr_name,
                provider=str(provider),
                source_key=source_key,
                config=config,
                columns=columns,
                view=view,
                offset=offset,
                limit=limit,
                view_fingerprint=view_fingerprint,
            )

    source_rows = list(_iter_source_rows(config))
    filtered_rows = _apply_search_and_filters(
        source_rows,
        columns,
        view.get("filters"),
        view.get("search"),
    )
    sorted_rows = _sort_rows(filtered_rows, columns, view.get("sort"))
    grouped_items = _group_display_items(
        sorted_rows,
        columns,
        view.get("group"),
        view.get("expandedGroups"),
    )
    if grouped_items is not None:
        total = len(grouped_items)
        window_items = grouped_items[offset : offset + limit]
    else:
        total = len(sorted_rows)
        window = sorted_rows[offset : offset + limit]
        window_items = _display_items(window, offset)
    normalized_view = {
        "offset": offset,
        "limit": limit,
        "sort": view.get("sort") if isinstance(view.get("sort"), list) else [],
        "filters": view.get("filters") if isinstance(view.get("filters"), list) else [],
        "group": view.get("group") if isinstance(view.get("group"), list) else [],
        "search": view.get("search") if view.get("search") is not None else None,
        "expandedGroups": view.get("expandedGroups") if isinstance(view.get("expandedGroups"), list) else [],
    }
    return {
        "page": page_name,
        "attr": attr_name,
        "provider": provider,
        "source_key": source_key,
        "view_id": _stable_view_id(
            {
                "page": page_name,
                "attr": attr_name,
                "provider": provider,
                "sourceKey": source_key,
                "view": normalized_view,
                "total": total,
            }
        ),
        "view_fingerprint": view_fingerprint,
        "offset": offset,
        "limit": limit,
        "total": total,
        "items": window_items,
        "has_more": offset + len(window_items) < total,
    }


def export_table_window(
    config: JsonDict, view: JsonDict | None, offset: int, limit: int
) -> JsonDict:
    """Return a slice of the materialized view for chunked export (no full JSON response)."""

    normalized_view = dict(view or {})
    columns = _column_keys_from_table_attrs(config.get("table_attrs"))
    group_list = normalized_view.get("group")
    if isinstance(group_list, list) and group_list:
        raise TableQueryRejected(
            code="table_export_group_unsupported",
            message="Экспорт по частям для сгруппированного представления не поддерживается.",
            status=400,
        )
    offset_i = max(0, int(offset))
    try:
        requested = int(limit)
    except (TypeError, ValueError):
        requested = EXPORT_CHUNK_HARD_MAX
    limit_i = max(1, min(requested, EXPORT_CHUNK_HARD_MAX))

    provider = _row_source_kind(config)
    file_estimate = _estimate_file_rows(config) if provider == "file" else 0
    if provider == "file" and file_estimate > FILE_VIEW_IN_MEMORY_MAX_ROWS:
        window_rows, row_total = _sqlite_file_select_window(
            config,
            columns=columns,
            view=normalized_view,
            offset=offset_i,
            limit=limit_i,
        )
        payload_rows = []
        for row in window_rows:
            payload_rows.append(row if isinstance(row, list) else list(row))
        return {
            "rows": payload_rows,
            "total": row_total,
            "export_chunked": True,
            "export_has_more": offset_i + len(payload_rows) < row_total,
            "export_offset": offset_i,
            "export_limit": limit_i,
        }

    source_rows = list(_iter_source_rows(config))
    filtered_rows = _apply_search_and_filters(
        source_rows,
        columns,
        normalized_view.get("filters"),
        normalized_view.get("search"),
    )
    sorted_rows = _sort_rows(filtered_rows, columns, normalized_view.get("sort"))
    row_total = len(sorted_rows)
    window = sorted_rows[offset_i : offset_i + limit_i]
    return {
        "rows": [_row_values(row) for row in window],
        "total": row_total,
        "export_chunked": True,
        "export_has_more": offset_i + len(window) < row_total,
        "export_offset": offset_i,
        "export_limit": limit_i,
    }


def export_table_value(config: JsonDict, view: JsonDict | None = None) -> JsonDict:
    """Materialize the current table view for explicit export/save flows."""

    normalized_view = dict(view or {})
    columns = _column_keys_from_table_attrs(config.get("table_attrs"))
    if _row_source_kind(config) == "file" and _estimate_file_rows(config) > FILE_EXPORT_MAX_ROWS:
        raise TableQueryRejected(
            code="table_export_too_large",
            message=(
                f"Экспорт ограничен {FILE_EXPORT_MAX_ROWS} строками для файловых таблиц. "
                "Сузьте фильтры или перенесите данные в БД."
            ),
            status=413,
        )
    source_rows = list(_iter_source_rows(config))
    filtered_rows = _apply_search_and_filters(
        source_rows,
        columns,
        normalized_view.get("filters"),
        normalized_view.get("search"),
    )
    sorted_rows = _sort_rows(filtered_rows, columns, normalized_view.get("sort"))
    return {
        "rows": [_row_values(row) for row in sorted_rows],
        "total": len(sorted_rows),
    }


def apply_table_commands(
    *,
    page_name: str,
    attr_name: str,
    config: JsonDict,
    view: JsonDict,
    commands: Any,
) -> JsonDict:
    """Apply command-style remote table operations and return a fresh view window.

    This endpoint intentionally avoids returning or storing a full table snapshot.
    Commands that require persistence/materialization are reported as accepted
    placeholders until a real mutation backend is attached.
    """

    next_view = dict(view or {})
    applied: List[JsonDict] = []
    if isinstance(commands, list):
        for command in commands:
            if not isinstance(command, dict):
                continue
            kind = str(command.get("kind") or command.get("type") or "").strip()
            if kind == "sort":
                next_view["sort"] = command.get("sort") if isinstance(command.get("sort"), list) else []
                next_view["offset"] = 0
                applied.append({"kind": "sort"})
            elif kind in {"filter", "filters"}:
                next_view["filters"] = command.get("filters") if isinstance(command.get("filters"), list) else []
                next_view["offset"] = 0
                applied.append({"kind": "filters"})
            elif kind == "search":
                next_view["search"] = command.get("search") if command.get("search") is not None else None
                next_view["offset"] = 0
                applied.append({"kind": "search"})
            elif kind == "group":
                next_view["group"] = command.get("group") if isinstance(command.get("group"), list) else []
                next_view["offset"] = 0
                applied.append({"kind": "group"})
            elif kind == "toggle-group":
                expanded = set(str(item) for item in next_view.get("expandedGroups") or [])
                group_id = str(command.get("groupId") or command.get("group_id") or "").strip()
                if group_id:
                    if group_id in expanded:
                        expanded.remove(group_id)
                    else:
                        expanded.add(group_id)
                    next_view["expandedGroups"] = sorted(expanded)
                    applied.append({"kind": "toggle-group", "groupId": group_id})
            elif kind in {"format", "selection", "insert-row", "delete-rows"}:
                applied.append(
                    {
                        "kind": kind,
                        "message": "Мутации и форматы выполняются локально на клиенте; серверный персист пока не используется.",
                        "status": "client_only",
                    }
                )

    result = query_table_view(
        page_name=page_name,
        attr_name=attr_name,
        config=config,
        view=next_view,
    )
    result["commands_applied"] = applied
    return result
