"""Загрузка YAML-конфигурации страниц и сбор versioned snapshot."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any

import yaml
from yaml.nodes import MappingNode, ScalarNode, SequenceNode

from .contracts import (
    AppSnapshot,
    Diagnostic,
    NormalizedModal,
    PageSnapshot,
    RawAttrsFragment,
    RawGuiDocument,
    RawModalDocument,
    SnapshotMeta,
    SourceFileMeta,
    utc_now_iso,
)
from .gui_dsl import (
    META_KEYS,
    ROOT_CONTENT_TYPES,
    collect_widget_names_from_modal,
    extract_embedded_modals,
    gui_root_keys,
    normalize_modal_runtime,
    parse_dynamic_key,
    split_names,
)

logger = logging.getLogger(__name__)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
PAGES_DIR = os.path.join(ROOT_DIR, "pages")
GUI_FILENAMES = {"gui.yaml", "gui.yml"}
RESERVED_PAGE_PREFIXES = ("/api", "/debug", "/frontend", "/page/", "/templates")
RESERVED_PAGE_PATHS = {"/favicon.ico"}

MODAL_GUI_ID_RE = re.compile(r"^modal_[a-zA-Z][a-zA-Z0-9_]*$")
MODAL_FILE_ROOT_KEY_RE = re.compile(r"^(.+?)(?:\s+\"([^\"]*)\")?\s*$")
TABLE_ATTR_TOKEN_RE = re.compile(r":\S+")
TABLE_ATTR_WIDTH_TOKEN_RE = re.compile(r"^[0-9]+$")
TABLE_ATTR_BUILTIN_TOKENS = frozenset(
    {
        "str",
        "int",
        "float",
        "date",
        "time",
        "datetime",
        "list",
        "ip",
        "ip_mask",
    }
)
TABLE_ATTR_BLOCK_SCALAR_STYLES = {"|", ">"}

ATTR_WIDGET_SCHEMA: dict[str, dict[str, Any]] = {
    "img": {
        "allowed": frozenset({"widget", "label", "source", "sup_text", "width"}),
    },
    "text": {
        "allowed": frozenset(
            {
                "widget",
                "label",
                "default",
                "err_text",
                "placeholder",
                "readonly",
                "regex",
                "rows",
                "sup_text",
                "width",
            }
        ),
    },
    "button": {
        "allowed": frozenset(
            {
                "widget",
                "command",
                "dialog",
                "fon",
                "hint",
                "icon",
                "label",
                "select_attrs",
                "size",
                "source",
                "sup_text",
                "url",
                "width",
            }
        ),
    },
    "split_button": {
        "allowed": frozenset(
            {
                "widget",
                "command",
                "dialog",
                "fon",
                "hint",
                "icon",
                "label",
                "select_attrs",
                "size",
                "source",
                "sup_text",
                "url",
                "width",
            }
        ),
    },
    "str": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "int": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "float": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "list": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "editable",
                "label",
                "multiselect",
                "placeholder",
                "readonly",
                "source",
                "sup_text",
                "width",
            }
        ),
    },
    "voc": {
        "allowed": frozenset(
            {
                "widget",
                "columns",
                "default",
                "label",
                "multiselect",
                "placeholder",
                "readonly",
                "source",
                "sup_text",
                "width",
            }
        ),
    },
    "ip": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "ip_mask": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "date": {
        "allowed": frozenset({"widget", "default", "label", "readonly", "sup_text", "width"}),
    },
    "time": {
        "allowed": frozenset({"widget", "default", "label", "readonly", "sup_text", "width"}),
    },
    "datetime": {
        "allowed": frozenset({"widget", "default", "label", "readonly", "sup_text", "width"}),
    },
    "table": {
        "allowed": frozenset(
            {
                "widget",
                "label",
                "line_numbers",
                "readonly",
                "row",
                "sort",
                "source",
                "sticky_header",
                "sup_text",
                "table_lazy",
                "table_attrs",
                "width",
                "zebra",
            }
        ),
    },
}


class ConfigLoadError(Exception):
    """Фатальная ошибка при построении snapshot конфигурации."""


class SnapshotValidationError(ConfigLoadError):
    """Ошибка валидации snapshot с набором структурированных diagnostics."""

    def __init__(self, diagnostics: list[Diagnostic]):
        self.diagnostics = diagnostics
        summary = "; ".join(item.message for item in diagnostics[:5])
        if len(diagnostics) > 5:
            summary += f"; +{len(diagnostics) - 5} ещё"
        super().__init__(summary or "Snapshot validation failed")


def make_diagnostic(
    level: str,
    code: str,
    message: str,
    *,
    page: str | None = None,
    file: str | None = None,
    line: int | None = None,
    url: str | None = None,
    node_path: str | None = None,
) -> Diagnostic:
    """Упрощённое создание Diagnostic."""
    return Diagnostic(
        level=level,
        code=code,
        message=message,
        page=page,
        file=file,
        line=line,
        url=url,
        node_path=node_path,
    )


def _page_load_failure_diagnostic(page_name: str, page_path: str, message: str) -> Diagnostic:
    return make_diagnostic(
        "error",
        "page_load_failed",
        f"Страница '{page_name}' пропущена: {message}",
        page=page_name,
        file=_relpath(page_path),
        url=f"/page/{page_name}",
    )


def _has_error_level_diagnostics(items: list[Diagnostic]) -> bool:
    return any(item.level == "error" for item in items)


def _relpath(path: str, root_dir: str = ROOT_DIR) -> str:
    try:
        return os.path.relpath(path, root_dir)
    except ValueError:
        return path


def _read_yaml_text(filepath: str) -> str:
    try:
        with open(filepath, "r", encoding="utf-8") as handle:
            return handle.read()
    except FileNotFoundError as exc:
        raise ConfigLoadError(f"YAML-файл не найден: {filepath}") from exc
    except OSError as exc:
        raise ConfigLoadError(f"Ошибка чтения {filepath}: {exc}") from exc


def _read_yaml(filepath: str) -> Any:
    raw_text = _read_yaml_text(filepath)
    try:
        return yaml.safe_load(raw_text)
    except yaml.YAMLError as exc:
        raise ConfigLoadError(f"Ошибка парсинга YAML {filepath}: {exc}") from exc


def _compose_yaml_root(filepath: str):
    raw_text = _read_yaml_text(filepath)
    try:
        return yaml.compose(raw_text, Loader=yaml.SafeLoader)
    except yaml.YAMLError as exc:
        raise ConfigLoadError(f"Ошибка парсинга YAML {filepath}: {exc}") from exc


def load_yaml_dict(filepath: str) -> dict[str, Any]:
    """Загружает YAML-файл и требует словарь на верхнем уровне."""
    loaded = _read_yaml(filepath)
    if loaded is None:
        return {}
    if not isinstance(loaded, dict):
        raise ConfigLoadError(f"{filepath} должен содержать YAML-словарь")
    return loaded


def load_yaml_root(filepath: str) -> Any:
    """Загружает YAML-файл с произвольным верхним уровнем."""
    return _read_yaml(filepath)


def _node_line(node: Any) -> int | None:
    if node is None or not hasattr(node, "start_mark") or node.start_mark is None:
        return None
    return int(node.start_mark.line) + 1


def _node_kind(node: Any) -> str:
    if isinstance(node, MappingNode):
        return "словарь"
    if isinstance(node, SequenceNode):
        return "список"
    if isinstance(node, ScalarNode):
        return "скаляр"
    if node is None:
        return "пустое значение"
    return type(node).__name__


def _invalid_gui_value(
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    line: int | None,
    node_path: str,
    message: str,
) -> Diagnostic:
    return make_diagnostic(
        "error",
        "invalid_gui_value",
        message,
        page=page_name,
        file=file_rel,
        line=line,
        url=page_url,
        node_path=node_path,
    )


def _mapping_node_items(node: Any) -> dict[str, tuple[Any, Any]]:
    if not isinstance(node, MappingNode):
        return {}

    items: dict[str, tuple[Any, Any]] = {}
    for key_node, value_node in node.value:
        key = str(getattr(key_node, "value", "") or "").strip()
        if not key:
            continue
        items[key] = (key_node, value_node)
    return items


def _attr_option_diagnostic(
    level: str,
    code: str,
    message: str,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    line: int | None,
    node_path: str,
) -> Diagnostic:
    return make_diagnostic(
        level,
        code,
        message,
        page=page_name,
        file=file_rel,
        line=line,
        url=page_url,
        node_path=node_path,
    )


def _is_scalar_attr_value(value: Any) -> bool:
    return not isinstance(value, (dict, list))


def _is_string_attr_value(value: Any) -> bool:
    return isinstance(value, str)


def _is_scalar_sequence(value: Any) -> bool:
    return isinstance(value, list) and all(_is_scalar_attr_value(item) for item in value)


def _is_widget_name_list_value(value: Any) -> bool:
    return _is_string_attr_value(value) or (
        isinstance(value, list) and all(_is_string_attr_value(item) for item in value)
    )


def _is_string_list_value(value: Any) -> bool:
    return isinstance(value, list) and all(_is_string_attr_value(item) for item in value)


def _is_bool_attr_value(value: Any) -> bool:
    return isinstance(value, bool)


def _is_int_attr_value(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_dialog_value(value: Any) -> bool:
    return isinstance(value, dict)


def _is_list_source_option(item: Any) -> bool:
    if _is_scalar_attr_value(item):
        return True

    if not isinstance(item, dict):
        return False

    allowed_keys = {"id", "label", "value"}
    if not set(item.keys()).issubset(allowed_keys):
        return False

    return all(_is_scalar_attr_value(option_value) for option_value in item.values())


def _is_source_value_valid(widget_type: str, value: Any) -> bool:
    if widget_type == "list":
        if _is_scalar_attr_value(value):
            return True
        return isinstance(value, list) and all(_is_list_source_option(item) for item in value)

    if widget_type == "voc":
        if _is_string_attr_value(value):
            return True
        return isinstance(value, list) and all(
            _is_scalar_attr_value(item) or _is_scalar_sequence(item) for item in value
        )

    if widget_type in {"button", "split_button", "img"}:
        return _is_string_attr_value(value)

    if widget_type == "table":
        return _is_scalar_attr_value(value) or isinstance(value, list)

    return True


def _validate_attr_option_value(widget_type: str, option_name: str, value: Any) -> str | None:
    if option_name == "select_attrs" and not _is_widget_name_list_value(value):
        return "ожидается строка или список строк"

    if option_name == "dialog" and not _is_dialog_value(value):
        return "ожидается словарь"

    if option_name == "columns" and not _is_string_list_value(value):
        return "ожидается список строк"

    if option_name == "rows" and not _is_int_attr_value(value):
        return "ожидается целое число"

    if option_name in {
        "readonly",
        "editable",
        "multiselect",
        "fon",
        "line_numbers",
        "sort",
        "sticky_header",
        "table_lazy",
        "zebra",
    } and not _is_bool_attr_value(value):
        return "ожидается булево значение"

    if option_name == "row" and not _is_int_attr_value(value):
        return "ожидается целое число"

    if option_name == "source" and not _is_source_value_valid(widget_type, value):
        if widget_type == "list":
            return "ожидается строка, список строк или список options-объектов"
        if widget_type == "voc":
            return "ожидается block-scalar строка, список строк или список строковых рядов"
        if widget_type in {"button", "split_button", "img"}:
            return "ожидается строка"
        if widget_type == "table":
            return "ожидается строка или список строк"

    return None


def _validate_voc_columns_config(
    attr_name: str,
    columns_value: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    line: int | None,
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []

    if not isinstance(columns_value, list):
        return diagnostics

    if not columns_value:
        diagnostics.append(
            _attr_option_diagnostic(
                "error",
                "voc_columns_required",
                f"attrs '{attr_name}.columns' должен содержать хотя бы один заголовок",
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                line=line,
                node_path=f"{attr_name}.columns",
            )
        )
        return diagnostics

    for index, item in enumerate(columns_value):
        label = str(item or "").strip() if isinstance(item, str) else ""
        if label:
            continue
        diagnostics.append(
            _attr_option_diagnostic(
                "error",
                "invalid_voc_column_label",
                (
                    f"attrs '{attr_name}.columns[{index}]' должен содержать "
                    "непустую строку заголовка"
                ),
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                line=line,
                node_path=f"{attr_name}.columns[{index}]",
            )
        )

    return diagnostics


def _validate_voc_source_config(
    attr_name: str,
    columns_value: Any,
    source_value: Any,
    source_node: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    if not isinstance(columns_value, list) or not columns_value:
        return diagnostics

    column_count = len(columns_value)
    source_path = f"{attr_name}.source"

    def add_row_width_error(
        *,
        line: int | None,
        row_index: int,
        actual_count: int,
    ) -> None:
        diagnostics.append(
            _attr_option_diagnostic(
                "error",
                "invalid_voc_source_row_width",
                (
                    f"attrs '{source_path}' строка {row_index + 1} содержит {actual_count} "
                    f"значений, ожидалось {column_count}"
                ),
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                line=line,
                node_path=source_path,
            )
        )

    if isinstance(source_value, str):
        if not isinstance(source_node, ScalarNode):
            return diagnostics

        if _voc_source_is_unsupported_scalar(source_value, source_node):
            diagnostics.append(
                _attr_option_diagnostic(
                    "warning",
                    "unsupported_voc_scalar_source",
                    (
                        f"attrs '{source_path}' использует scalar-source, который зарезервирован "
                        "для будущего DB-режима и пока не поддерживается"
                    ),
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(source_node),
                    node_path=source_path,
                )
            )
            return diagnostics

        skipped_empty_rows = 0
        for line_index, raw_line in enumerate(str(source_value or "").splitlines()):
            line_text = str(raw_line or "").strip()
            if not line_text:
                skipped_empty_rows += 1
                continue
            cells = [part.strip() for part in str(raw_line).split(";")]
            if len(cells) != column_count:
                add_row_width_error(
                    line=_table_attr_ref_line(source_node, line_index),
                    row_index=line_index,
                    actual_count=len(cells),
                )
        if skipped_empty_rows:
            diagnostics.append(
                _attr_option_diagnostic(
                    "warning",
                    "voc_source_empty_rows_skipped",
                    (
                        f"attrs '{source_path}' содержит пустые строки, которые были "
                        "пропущены при разборе"
                    ),
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(source_node),
                    node_path=source_path,
                )
            )
        return diagnostics

    if isinstance(source_value, list):
        item_nodes = source_node.value if isinstance(source_node, SequenceNode) else []
        for row_index, item in enumerate(source_value):
            if isinstance(item, list):
                actual_count = len(item)
            else:
                actual_count = 1
            if actual_count == column_count:
                continue
            item_node = item_nodes[row_index] if row_index < len(item_nodes) else source_node
            add_row_width_error(
                line=_node_line(item_node),
                row_index=row_index,
                actual_count=actual_count,
            )

    return diagnostics


def _voc_source_is_unsupported_scalar(source_value: Any, source_node: Any) -> bool:
    if not isinstance(source_value, str):
        return False
    if not isinstance(source_node, ScalarNode):
        return False
    return getattr(source_node, "style", None) not in TABLE_ATTR_BLOCK_SCALAR_STYLES


def _build_duplicate_scalar_list_source_warning(
    attr_name: str,
    source_value: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    line: int | None,
) -> Diagnostic | None:
    if not isinstance(source_value, list):
        return None

    scalar_values = [str(item) for item in source_value if _is_scalar_attr_value(item)]
    if len(scalar_values) < 2:
        return None

    seen: set[str] = set()
    duplicates: list[str] = []
    for item in scalar_values:
        if item in seen and item not in duplicates:
            duplicates.append(item)
        seen.add(item)

    if not duplicates:
        return None

    duplicate_preview = ", ".join(duplicates[:3])
    if len(duplicates) > 3:
        duplicate_preview += ", …"

    return _attr_option_diagnostic(
        "warning",
        "ambiguous_list_source_option",
        (
            f"attrs '{attr_name}.source' содержит дублирующиеся scalar-options "
            f"({duplicate_preview}); для устойчивой identity используйте object-options с явным id"
        ),
        page_name=page_name,
        page_url=page_url,
        file_rel=file_rel,
        line=line,
        node_path=f"{attr_name}.source",
    )


def _validate_attr_config(
    attr_name: str,
    attr_config: Any,
    attr_node: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
) -> tuple[dict[str, Any], list[Diagnostic]]:
    diagnostics: list[Diagnostic] = []
    normalized_config = dict(attr_config) if isinstance(attr_config, dict) else {}

    if not isinstance(attr_config, dict) or not isinstance(attr_node, MappingNode):
        diagnostics.append(
            _attr_option_diagnostic(
                "error",
                "invalid_attr_option_value",
                f"attrs '{attr_name}' должен быть словарём с описанием widget",
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                line=_node_line(attr_node),
                node_path=attr_name,
            )
        )
        return normalized_config, diagnostics

    node_items = _mapping_node_items(attr_node)
    widget_value = attr_config.get("widget")
    widget_type = str(widget_value or "").strip()
    if not widget_type:
        widget_type = "str"
        normalized_config["widget"] = "str"
    if not widget_type or widget_type not in ATTR_WIDGET_SCHEMA:
        diagnostics.append(
            _attr_option_diagnostic(
                "error",
                "unknown_attr_widget",
                f"attrs '{attr_name}' использует неизвестный widget '{widget_type or '<empty>'}'",
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                line=_node_line(node_items.get("widget", (None, attr_node))[1]),
                node_path=f"{attr_name}.widget",
            )
        )
        return normalized_config, diagnostics

    schema = ATTR_WIDGET_SCHEMA[widget_type]
    allowed = schema["allowed"]

    for option_name, option_value in attr_config.items():
        key_node, _value_node = node_items.get(option_name, (None, None))
        line = _node_line(key_node) or _node_line(_value_node) or _node_line(attr_node)
        if option_name not in allowed:
            diagnostics.append(
                _attr_option_diagnostic(
                    "error",
                    "unsupported_attr_option",
                    (
                        f"attrs '{attr_name}' для widget '{widget_type}' не поддерживает "
                        f"опцию '{option_name}'"
                    ),
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=line,
                    node_path=f"{attr_name}.{option_name}",
                )
            )
            continue

        validation_error = _validate_attr_option_value(widget_type, option_name, option_value)
        if validation_error:
            diagnostics.append(
                _attr_option_diagnostic(
                    "error",
                    "invalid_attr_option_value",
                    (
                        f"attrs '{attr_name}.{option_name}' имеет некорректное значение: "
                        f"{validation_error}"
                    ),
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=line,
                    node_path=f"{attr_name}.{option_name}",
                )
            )

    if widget_type == "list" and "source" in normalized_config:
        source_node = node_items.get("source", (None, None))[1]
        duplicate_warning = _build_duplicate_scalar_list_source_warning(
            attr_name,
            normalized_config.get("source"),
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            line=_node_line(source_node),
        )
        if duplicate_warning:
            diagnostics.append(duplicate_warning)

    if widget_type == "voc":
        columns_node = node_items.get("columns", (None, None))[1]
        source_node = node_items.get("source", (None, None))[1]
        if "columns" not in normalized_config:
            diagnostics.append(
                _attr_option_diagnostic(
                    "error",
                    "voc_columns_required",
                    f"attrs '{attr_name}' для widget 'voc' требует опцию 'columns'",
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(attr_node),
                    node_path=f"{attr_name}.columns",
                )
            )
        else:
            diagnostics.extend(
                _validate_voc_columns_config(
                    attr_name,
                    normalized_config.get("columns"),
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(columns_node) or _node_line(attr_node),
                )
            )
        if "source" in normalized_config:
            diagnostics.extend(
                _validate_voc_source_config(
                    attr_name,
                    normalized_config.get("columns"),
                    normalized_config.get("source"),
                    source_node,
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                )
            )
            if _voc_source_is_unsupported_scalar(
                normalized_config.get("source"),
                source_node,
            ):
                normalized_config["source"] = []

    return normalized_config, diagnostics


def _collect_attr_definitions(attr_files: list[str], page_name: str) -> list[dict[str, Any]]:
    definitions: list[dict[str, Any]] = []

    for filepath in attr_files:
        root_node = _compose_yaml_root(filepath)
        if not isinstance(root_node, MappingNode):
            continue

        file_rel = _relpath(filepath)
        for key_node, _value_node in root_node.value:
            attr_name = str(getattr(key_node, "value", "") or "").strip()
            if not attr_name:
                continue
            definitions.append(
                {
                    "name": attr_name,
                    "page": page_name,
                    "file": file_rel,
                    "line": _node_line(key_node),
                }
            )

    return definitions


def _table_attr_ref_line(node: ScalarNode, line_index: int) -> int | None:
    start_line = _node_line(node)
    if start_line is None:
        return None

    if getattr(node, "style", None) in TABLE_ATTR_BLOCK_SCALAR_STYLES:
        return start_line + 1 + line_index
    return start_line + line_index


def _extract_table_attr_custom_refs(
    table_attrs_node: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
) -> list[dict[str, Any]]:
    if not isinstance(table_attrs_node, ScalarNode):
        return []
    if str(getattr(table_attrs_node, "tag", "") or "") != "tag:yaml.org,2002:str":
        return []
    if _node_line(table_attrs_node) is None:
        return []

    refs: list[dict[str, Any]] = []
    for line_index, raw_line in enumerate(str(table_attrs_node.value or "").split("\n")):
        line = raw_line.strip()
        if not line or line.startswith("/"):
            continue

        ref_line = _table_attr_ref_line(table_attrs_node, line_index)
        for token_match in TABLE_ATTR_TOKEN_RE.finditer(raw_line):
            token = token_match.group(0)[1:]
            if TABLE_ATTR_WIDTH_TOKEN_RE.fullmatch(token):
                continue
            if token in TABLE_ATTR_BUILTIN_TOKENS:
                continue
            refs.append(
                {
                    "name": token,
                    "page": page_name,
                    "url": page_url,
                    "file": file_rel,
                    "line": ref_line,
                }
            )

    return refs


def _collect_attr_refs(
    attr_files: list[str],
    *,
    page_name: str,
    page_url: str,
) -> list[dict[str, Any]]:
    refs_by_attr_name: dict[str, list[dict[str, Any]]] = {}

    for filepath in attr_files:
        root_node = _compose_yaml_root(filepath)
        if not isinstance(root_node, MappingNode):
            continue

        file_rel = _relpath(filepath)
        for key_node, value_node in root_node.value:
            attr_name = str(getattr(key_node, "value", "") or "").strip()
            if not attr_name:
                continue

            refs_by_attr_name[attr_name] = []
            if not isinstance(value_node, MappingNode):
                continue

            widget_node = None
            table_attrs_node = None
            for child_key_node, child_value_node in value_node.value:
                child_key = str(getattr(child_key_node, "value", "") or "").strip()
                if child_key == "widget":
                    widget_node = child_value_node
                elif child_key == "table_attrs":
                    table_attrs_node = child_value_node

            if not isinstance(widget_node, ScalarNode):
                continue
            if str(getattr(widget_node, "value", "") or "").strip() != "table":
                continue

            refs_by_attr_name[attr_name] = _extract_table_attr_custom_refs(
                table_attrs_node,
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
            )

    refs: list[dict[str, Any]] = []
    for attr_refs in refs_by_attr_name.values():
        refs.extend(attr_refs)
    return refs


def _collect_name_refs_from_node(
    node: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    node_path: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []

    if isinstance(node, ScalarNode):
        line = _node_line(node)
        for name in split_names(node.value):
            if name == "CLOSE":
                continue
            refs.append(
                {
                    "name": name,
                    "page": page_name,
                    "url": page_url,
                    "file": file_rel,
                    "line": line,
                }
            )
        return refs, diagnostics

    if isinstance(node, SequenceNode):
        for item in node.value:
            nested_refs, nested_diagnostics = _collect_name_refs_from_node(
                item,
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                node_path=node_path,
            )
            refs.extend(nested_refs)
            diagnostics.extend(nested_diagnostics)
        return refs, diagnostics

    diagnostics.append(
        _invalid_gui_value(
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            line=_node_line(node),
            node_path=node_path,
            message=(
                f"Некорректное значение '{node_path}': "
                f"ожидается строка или список имён attrs, получено {_node_kind(node)}"
            ),
        )
    )
    return refs, diagnostics


def _validate_rows_node(
    node: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    node_path: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    if isinstance(node, ScalarNode):
        return _collect_name_refs_from_node(
            node,
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            node_path=node_path,
        )

    if not isinstance(node, SequenceNode):
        return [], [
            _invalid_gui_value(
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                line=_node_line(node),
                node_path=node_path,
                message=(
                    f"Некорректное значение '{node_path}': "
                    f"ожидается скаляр или список rows, получено {_node_kind(node)}"
                ),
            )
        ]

    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []
    for item in node.value:
        if isinstance(item, ScalarNode):
            continue

        if isinstance(item, SequenceNode):
            nested_refs, nested_diagnostics = _validate_rows_node(
                item,
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                node_path=node_path,
            )
            refs.extend(nested_refs)
            diagnostics.extend(nested_diagnostics)
            continue

        if not isinstance(item, MappingNode) or len(item.value) != 1:
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(item),
                    node_path=node_path,
                    message=(
                        f"Некорректный элемент '{node_path}': "
                        "ожидается single-key mapping с row/widgets/rows"
                    ),
                )
            )
            continue

        key_node, value_node = item.value[0]
        raw_key = str(getattr(key_node, "value", "") or "")
        entry_type, _entry_name = parse_dynamic_key(raw_key)
        if entry_type not in {"row", "widgets", "rows"}:
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(key_node),
                    node_path=raw_key,
                    message=(
                        f"Некорректный ключ '{raw_key}' в rows: "
                        "разрешены только row/widgets/rows"
                    ),
                )
            )
            continue

        nested_refs, nested_diagnostics = _validate_content_entry(
            entry_type,
            value_node,
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            node_path=raw_key,
            container="rows",
        )
        refs.extend(nested_refs)
        diagnostics.extend(nested_diagnostics)

    return refs, diagnostics


def _validate_content_entry(
    entry_type: str,
    value_node: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    node_path: str,
    container: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []

    if entry_type == "icon":
        if not isinstance(value_node, ScalarNode):
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(value_node),
                    node_path=node_path,
                    message=(
                        f"Некорректное значение '{node_path}': "
                        f"ожидается строка, получено {_node_kind(value_node)}"
                    ),
                )
            )
        return refs, diagnostics

    if entry_type in {"row", "widgets", "button"}:
        return _collect_name_refs_from_node(
            value_node,
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            node_path=node_path,
        )

    if entry_type == "rows":
        return _validate_rows_node(
            value_node,
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            node_path=node_path,
        )

    if entry_type == "tab":
        if not isinstance(value_node, SequenceNode):
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(value_node),
                    node_path=node_path,
                    message=(
                        f"Некорректное значение '{node_path}': "
                        f"ожидается список элементов tab, получено {_node_kind(value_node)}"
                    ),
                )
            )
            return refs, diagnostics
        return _validate_content_list(
            value_node,
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            container="content",
        )

    if entry_type in {"box", "collapse"}:
        if isinstance(value_node, ScalarNode):
            return refs, diagnostics
        if not isinstance(value_node, SequenceNode):
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(value_node),
                    node_path=node_path,
                    message=(
                        f"Некорректное значение '{node_path}': "
                        f"ожидается строка или список элементов, получено {_node_kind(value_node)}"
                    ),
                )
            )
            return refs, diagnostics
        return _validate_content_list(
            value_node,
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            container="section",
        )

    diagnostics.append(
        _invalid_gui_value(
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            line=_node_line(value_node),
            node_path=node_path,
            message=f"Неподдерживаемый ключ '{node_path}' в контейнере {container}",
        )
    )
    return refs, diagnostics


def _validate_content_list(
    node: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    container: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    if not isinstance(node, SequenceNode):
        return [], [
            _invalid_gui_value(
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                line=_node_line(node),
                node_path=container,
                message=(
                    f"Некорректное значение контейнера '{container}': "
                    f"ожидается список, получено {_node_kind(node)}"
                ),
            )
        ]

    allowed = {"icon", "row", "rows", "widgets"}
    if container == "content":
        allowed |= {"button", "tab", "box", "collapse"}

    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []
    for item in node.value:
        if isinstance(item, ScalarNode):
            continue

        if not isinstance(item, MappingNode) or len(item.value) != 1:
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(item),
                    node_path=container,
                    message=(
                        f"Некорректный элемент контейнера '{container}': "
                        "ожидается single-key mapping или строка"
                    ),
                )
            )
            continue

        key_node, value_node = item.value[0]
        raw_key = str(getattr(key_node, "value", "") or "")
        entry_type, _entry_name = parse_dynamic_key(raw_key)
        if entry_type not in allowed:
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(key_node),
                    node_path=raw_key,
                    message=(
                        f"Некорректный ключ '{raw_key}' в {container}: "
                        f"разрешены только {', '.join(sorted(allowed))}"
                    ),
                )
            )
            continue

        nested_refs, nested_diagnostics = _validate_content_entry(
            entry_type,
            value_node,
            page_name=page_name,
            page_url=page_url,
            file_rel=file_rel,
            node_path=raw_key,
            container=container,
        )
        refs.extend(nested_refs)
        diagnostics.extend(nested_diagnostics)

    return refs, diagnostics


def _validate_gui_document(
    gui_file: str,
    *,
    page_name: str,
    page_url: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []
    file_rel = _relpath(gui_file)
    root_node = _compose_yaml_root(gui_file)

    if not isinstance(root_node, MappingNode):
        return refs, diagnostics

    for key_node, value_node in root_node.value:
        raw_key = str(getattr(key_node, "value", "") or "")
        if raw_key == "url" and not isinstance(value_node, ScalarNode):
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(value_node),
                    node_path=raw_key,
                    message=(
                        f"Некорректное значение '{raw_key}': "
                        f"ожидается строка, получено {_node_kind(value_node)}"
                    ),
                )
            )
            continue
        if raw_key in {"title", "description"} and not isinstance(value_node, ScalarNode):
            diagnostics.append(
                _invalid_gui_value(
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    line=_node_line(value_node),
                    node_path=raw_key,
                    message=(
                        f"Некорректное значение '{raw_key}': "
                        f"ожидается строка, получено {_node_kind(value_node)}"
                    ),
                )
            )
            continue
        if raw_key in META_KEYS:
            continue

        entry_type, _entry_name = parse_dynamic_key(raw_key)
        if entry_type == "menu":
            nested_refs, nested_diagnostics = _validate_content_list(
                value_node,
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                container="content",
            )
        elif entry_type in ROOT_CONTENT_TYPES:
            nested_refs, nested_diagnostics = _validate_content_entry(
                entry_type,
                value_node,
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                node_path=raw_key,
                container="root",
            )
        else:
            if not isinstance(value_node, SequenceNode):
                nested_refs = []
                nested_diagnostics = [
                    _invalid_gui_value(
                        page_name=page_name,
                        page_url=page_url,
                        file_rel=file_rel,
                        line=_node_line(value_node),
                        node_path=raw_key,
                        message=(
                            f"Некорректное значение встроенной модалки '{raw_key}': "
                            f"ожидается список элементов, получено {_node_kind(value_node)}"
                        ),
                    )
                ]
            else:
                nested_refs, nested_diagnostics = _validate_content_list(
                    value_node,
                    page_name=page_name,
                    page_url=page_url,
                    file_rel=file_rel,
                    container="content",
                )

        refs.extend(nested_refs)
        diagnostics.extend(nested_diagnostics)

    return refs, diagnostics


def _extract_modal_content_node(
    modal_file: str,
    *,
    page_name: str,
    page_url: str,
) -> tuple[Any, list[Diagnostic]]:
    file_rel = _relpath(modal_file)
    root_node = _compose_yaml_root(modal_file)
    if isinstance(root_node, SequenceNode):
        return root_node, []

    if not isinstance(root_node, MappingNode):
        return None, []

    if len(root_node.value) == 1:
        _only_key, only_value = root_node.value[0]
        if isinstance(only_value, SequenceNode):
            return only_value, []

    for key_node, value_node in root_node.value:
        key = str(getattr(key_node, "value", "") or "").strip()
        if key not in {"content", "items"}:
            continue
        if isinstance(value_node, SequenceNode):
            return value_node, []
        return None, [
            _invalid_gui_value(
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
                line=_node_line(value_node),
                node_path=key,
                message=(
                    f"Некорректное значение '{key}' в {file_rel}: "
                    f"ожидается список, получено {_node_kind(value_node)}"
                ),
            )
        ]

    return None, []


def _validate_modal_documents(
    modal_files: list[str],
    *,
    page_name: str,
    page_url: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []

    for modal_file in modal_files:
        content_node, modal_diagnostics = _extract_modal_content_node(
            modal_file,
            page_name=page_name,
            page_url=page_url,
        )
        diagnostics.extend(modal_diagnostics)
        if content_node is None:
            continue

        nested_refs, nested_diagnostics = _validate_content_list(
            content_node,
            page_name=page_name,
            page_url=page_url,
            file_rel=_relpath(modal_file),
            container="content",
        )
        refs.extend(nested_refs)
        diagnostics.extend(nested_diagnostics)

    return refs, diagnostics


def _build_missing_attr_diagnostics(
    refs: list[dict[str, Any]],
    page_name: str,
    page_attrs: dict[str, Any],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    seen: set[tuple[str, int | None, str]] = set()

    for ref in refs:
        attr_name = str(ref.get("name") or "").strip()
        if not attr_name or attr_name in page_attrs:
            continue

        key = (str(ref.get("file") or ""), ref.get("line"), attr_name)
        if key in seen:
            continue
        seen.add(key)

        line = ref.get("line")
        url = str(ref.get("url") or "")
        line_text = f"стр.{line}" if line else "стр.?"
        diagnostics.append(
            make_diagnostic(
                "error",
                "missing_attr_reference",
                f'url: "{url}" - {line_text}: {attr_name}',
                page=page_name,
                file=ref.get("file"),
                line=line,
                url=url,
                node_path=attr_name,
            )
        )

    return diagnostics


def _build_duplicate_attr_diagnostics(attr_definitions: list[dict[str, Any]]) -> list[Diagnostic]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in attr_definitions:
        key = (str(item.get("page") or ""), str(item.get("name") or ""))
        grouped.setdefault(key, []).append(item)

    diagnostics: list[Diagnostic] = []
    for (_page_name, attr_name), items in sorted(grouped.items()):
        if len(items) < 2:
            continue
        locations = "; ".join(
            f"{entry['file']} - стр.{entry['line'] or '?'}"
            for entry in items
        )
        diagnostics.append(
            make_diagnostic(
                "warning",
                "duplicate_attr",
                f"Обнаружен дубликат attrs {attr_name}: {locations}.",
                file=items[0]["file"],
                line=items[0]["line"],
                node_path=attr_name,
            )
        )

    return diagnostics


def _build_unused_attr_diagnostics(
    attr_definitions: list[dict[str, Any]],
    refs_by_page: dict[str, list[dict[str, Any]]],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    used_names_by_page = {
        page_name: {str(ref.get("name") or "").strip() for ref in refs}
        for page_name, refs in refs_by_page.items()
    }

    for entry in attr_definitions:
        page_name = entry["page"]
        local_page_prefix = f"pages/{page_name}/"
        entry_file = str(entry.get("file") or "")
        if entry_file and not entry_file.startswith(local_page_prefix):
            continue
        if entry["name"] in used_names_by_page.get(page_name, set()):
            continue
        diagnostics.append(
            make_diagnostic(
                "warning",
                "unused_attr",
                f"{entry['file']} - стр.{entry['line'] or '?'}: {entry['name']}",
                page=page_name,
                file=entry["file"],
                line=entry["line"],
                node_path=entry["name"],
            )
        )

    return diagnostics


def page_name_from_path(page_path: str, pages_dir: str = PAGES_DIR) -> str:
    rel_path = os.path.relpath(page_path, pages_dir)
    if rel_path in {"", "."}:
        return os.path.basename(os.path.abspath(page_path))
    return rel_path.replace(os.sep, "/")


def split_page_yaml_files(yaml_files: list[str]) -> tuple[list[str], list[str], list[str]]:
    gui_files: list[str] = []
    attr_files: list[str] = []
    modal_files: list[str] = []

    for path in yaml_files:
        filename = os.path.basename(path)
        if filename in GUI_FILENAMES:
            gui_files.append(path)
        elif is_modal_gui_filename(filename):
            modal_files.append(path)
        else:
            attr_files.append(path)

    return gui_files, attr_files, modal_files


def directory_contains_gui(page_path: str) -> bool:
    gui_files, _attr_files, _modal_files = split_page_yaml_files(list_yaml_files(page_path))
    return bool(gui_files)


def page_scope_directories(page_path: str, pages_dir: str = PAGES_DIR) -> list[str]:
    abs_pages_dir = os.path.abspath(pages_dir)
    abs_page_path = os.path.abspath(page_path)
    rel_path = os.path.relpath(abs_page_path, abs_pages_dir)
    if rel_path in {"", "."}:
        return [abs_page_path]

    directories: list[str] = []
    current = abs_pages_dir
    for part in rel_path.split(os.sep):
        if not part or part == ".":
            continue
        current = os.path.join(current, part)
        directories.append(current)
    return directories


def _unique_paths(paths: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()

    for path in paths:
        normalized = os.path.abspath(path)
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(path)

    return result


def _has_page_ancestor(directory: str, pages_dir: str = PAGES_DIR) -> bool:
    abs_pages_dir = os.path.abspath(pages_dir)
    current = os.path.abspath(os.path.dirname(directory))

    while current.startswith(abs_pages_dir):
        if directory_contains_gui(current):
            return True
        if current == abs_pages_dir:
            break
        current = os.path.dirname(current)

    return False


def list_shared_attr_files(pages_dir: str = PAGES_DIR) -> list[str]:
    """Возвращает attrs-файлы из общих директорий pages/, доступные всем страницам.

    Общими считаются директории:
    - без собственного gui-файла;
    - не вложенные внутрь другой page-директории с gui-файлом.
    """
    if not os.path.isdir(pages_dir):
        return []

    shared_attr_files: list[str] = []
    for root, dirnames, filenames in os.walk(pages_dir):
        dirnames.sort()
        if directory_contains_gui(root):
            continue
        if _has_page_ancestor(root, pages_dir):
            continue

        _gui_files, attr_files, _modal_files = split_page_yaml_files(
            [
                os.path.join(root, name)
                for name in sorted(filenames)
                if name.endswith((".yaml", ".yml"))
            ]
        )
        shared_attr_files.extend(attr_files)

    return _unique_paths(shared_attr_files)


def collect_page_scope_files(
    page_path: str,
    page_name: str,
    pages_dir: str = PAGES_DIR,
) -> tuple[str, list[str], list[str]]:
    local_yaml_files = list_yaml_files(page_path)
    gui_file = find_gui_file(local_yaml_files, page_name)
    _local_gui_files, local_attr_files, local_modal_files = split_page_yaml_files(local_yaml_files)

    inherited_attr_files: list[str] = []
    inherited_modal_files: list[str] = []
    for scope_dir in page_scope_directories(page_path, pages_dir)[:-1]:
        if directory_contains_gui(scope_dir):
            continue
        _group_gui_files, group_attr_files, group_modal_files = split_page_yaml_files(
            list_yaml_files(scope_dir)
        )
        inherited_attr_files.extend(group_attr_files)
        inherited_modal_files.extend(group_modal_files)

    shared_attr_files = list_shared_attr_files(pages_dir)

    return (
        gui_file,
        _unique_paths([*shared_attr_files, *inherited_attr_files, *local_attr_files]),
        [*inherited_modal_files, *local_modal_files],
    )


def _validate_page_documents(
    page_path: str,
    page_name: str,
    page_url: str,
    page_attrs: dict[str, Any],
    *,
    pages_dir: str = PAGES_DIR,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[Diagnostic]]:
    gui_file, attr_files, modal_files = collect_page_scope_files(
        page_path,
        page_name,
        pages_dir,
    )

    attr_definitions = _collect_attr_definitions(attr_files, page_name)
    attr_refs = _collect_attr_refs(
        attr_files,
        page_name=page_name,
        page_url=page_url,
    )
    gui_refs, gui_diagnostics = _validate_gui_document(
        gui_file,
        page_name=page_name,
        page_url=page_url,
    )
    modal_refs, modal_diagnostics = _validate_modal_documents(
        modal_files,
        page_name=page_name,
        page_url=page_url,
    )
    refs = [*gui_refs, *modal_refs, *attr_refs]
    diagnostics = [*gui_diagnostics, *modal_diagnostics]
    diagnostics.extend(_build_missing_attr_diagnostics(refs, page_name, page_attrs))

    return attr_definitions, refs, diagnostics


def list_page_directories(pages_dir: str = PAGES_DIR) -> list[str]:
    """Возвращает список директорий страниц в детерминированном порядке."""
    if not os.path.isdir(pages_dir):
        return []

    page_paths: list[str] = []
    for root, dirnames, filenames in os.walk(pages_dir):
        dirnames.sort()
        if any(filename in GUI_FILENAMES for filename in filenames):
            page_paths.append(root)

    return sorted(page_paths, key=lambda path: page_name_from_path(path, pages_dir))


def list_yaml_files(page_path: str) -> list[str]:
    """Возвращает YAML-файлы страницы в детерминированном порядке."""
    if not os.path.isdir(page_path):
        return []

    return [
        os.path.join(page_path, name)
        for name in sorted(os.listdir(page_path))
        if name.endswith((".yaml", ".yml"))
    ]


def normalize_page_url(value: Any, page_name: str) -> str:
    """Нормализует URL страницы или строит fallback по имени."""
    raw = str(value).strip() if value is not None else ""
    if not raw:
        return f"/page/{page_name}"
    if not raw.startswith("/"):
        return "/" + raw
    return raw


def is_reserved_page_url(path: str) -> bool:
    """Проверяет конфликт страницы с системными маршрутами."""
    if path in RESERVED_PAGE_PATHS:
        return True
    return any(path == prefix or path.startswith(prefix + "/") for prefix in RESERVED_PAGE_PREFIXES)


def find_gui_file(yaml_files: list[str], page_name: str) -> str:
    """Находит единственный GUI-файл страницы."""
    gui_files = [path for path in yaml_files if os.path.basename(path) in GUI_FILENAMES]
    if not gui_files:
        raise ConfigLoadError(f"У страницы {page_name} отсутствует gui.yaml")
    if len(gui_files) > 1:
        raise ConfigLoadError(
            f"У страницы {page_name} найдено несколько GUI-файлов: {', '.join(gui_files)}"
        )
    return gui_files[0]


def parse_gui_style_key(raw_key: str) -> tuple[str, str]:
    """Разбор ключа вида ``modal_gui "Название"`` -> (тип, название)."""
    key = str(raw_key or "").strip()
    match = MODAL_FILE_ROOT_KEY_RE.match(key)
    if not match:
        return key, ""
    entry_type = (match.group(1) or "").strip()
    quoted = match.group(2)
    return entry_type, quoted if quoted is not None else ""


def is_modal_gui_filename(filename: str) -> bool:
    """Проверка имени файла modal_<id>.yaml."""
    if filename.endswith(".yaml"):
        stem = filename[:-5]
    elif filename.endswith(".yml"):
        stem = filename[:-4]
    else:
        return False
    return bool(MODAL_GUI_ID_RE.fullmatch(stem))


def _file_digest(filepath: str) -> str:
    digest = hashlib.sha256()
    try:
        with open(filepath, "rb") as handle:
            for chunk in iter(lambda: handle.read(65536), b""):
                digest.update(chunk)
    except OSError as exc:
        raise ConfigLoadError(f"Ошибка чтения {filepath}: {exc}") from exc
    return digest.hexdigest()


def _source_file_meta(filepath: str, kind: str) -> SourceFileMeta:
    try:
        stat = os.stat(filepath)
        mtime_ns = stat.st_mtime_ns
    except FileNotFoundError:
        mtime_ns = None
    return SourceFileMeta(
        path=_relpath(filepath),
        kind=kind,
        digest=_file_digest(filepath),
        mtime_ns=mtime_ns,
    )


def _normalize_modal_document(filepath: str, modal_id: str) -> NormalizedModal:
    raw = RawModalDocument.model_validate(load_yaml_root(filepath)).root

    if isinstance(raw, list):
        runtime = normalize_modal_runtime(modal_id, modal_id, raw, icon=None)
    elif isinstance(raw, dict):
        if len(raw) == 1:
            only_key, only_value = next(iter(raw.items()))
            if isinstance(only_value, list):
                _entry_type, display_name = parse_gui_style_key(str(only_key))
                runtime = normalize_modal_runtime(
                    modal_id,
                    display_name.strip() or modal_id,
                    only_value,
                    icon=None,
                )
            else:
                runtime = {}
        else:
            runtime = {}

        if not runtime:
            items = raw.get("content")
            if items is None:
                items = raw.get("items")
            if not isinstance(items, list):
                raise ConfigLoadError(
                    f"{filepath}: ожидается список в корне, один ключ gui-стиля со списком, "
                    f"или объект с ключом content/items (список)"
                )
            name = raw.get("name") or raw.get("title") or modal_id
            icon = raw.get("icon") if isinstance(raw.get("icon"), str) else None
            runtime = normalize_modal_runtime(modal_id, str(name).strip() or modal_id, items, icon=icon)
    else:
        raise ConfigLoadError(f"{filepath}: корень YAML должен быть списком или объектом")

    runtime["widgetNames"] = collect_widget_names_from_modal(runtime)
    runtime["source"] = "file"
    runtime["sourceFile"] = _relpath(filepath)
    return NormalizedModal.model_validate(runtime)


def list_modal_gui_ids(page_path: str) -> list[str]:
    """Имена файловых модалок по шаблону modal_<id>.yaml."""
    if not os.path.isdir(page_path):
        return []

    ids: list[str] = []
    for name in sorted(os.listdir(page_path)):
        if name.endswith(".yaml"):
            stem = name[:-5]
        elif name.endswith(".yml"):
            stem = name[:-4]
        else:
            continue
        if stem.startswith("modal_") and MODAL_GUI_ID_RE.fullmatch(stem):
            ids.append(stem)
    return ids


def load_modal_gui_payload(page_path: str, modal_id: str) -> dict[str, Any]:
    """Legacy-совместимая загрузка файловой модалки."""
    if not MODAL_GUI_ID_RE.fullmatch(modal_id):
        raise ConfigLoadError(f"Недопустимый идентификатор модалки: {modal_id!r}")

    filepath = os.path.join(page_path, f"{modal_id}.yaml")
    if not os.path.isfile(filepath):
        filepath = os.path.join(page_path, f"{modal_id}.yml")
        if not os.path.isfile(filepath):
            raise ConfigLoadError(f"Файл модалки не найден: {modal_id}.yaml")

    modal = _normalize_modal_document(filepath, modal_id)
    return {
        "name": modal.name,
        "icon": modal.icon,
        "items": modal.content if not modal.tabs else [{"tab": modal.tabs}],
    }


def _merge_attrs_files(
    attr_files: list[str],
    page_name: str,
    page_url: str,
) -> tuple[dict[str, Any], list[SourceFileMeta], list[Diagnostic]]:
    attrs: dict[str, Any] = {}
    attr_sources: dict[str, str] = {}
    source_files: list[SourceFileMeta] = []
    diagnostics: list[Diagnostic] = []

    for filepath in attr_files:
        root_node = _compose_yaml_root(filepath)
        node_items = _mapping_node_items(root_node)
        loaded = RawAttrsFragment.model_validate(load_yaml_dict(filepath)).root
        file_rel = _relpath(filepath)
        source_files.append(_source_file_meta(filepath, "attrs"))
        for attr_name, attr_config in loaded.items():
            attr_node = node_items.get(attr_name, (None, None))[1]
            normalized_attr_config, attr_diagnostics = _validate_attr_config(
                attr_name,
                attr_config,
                attr_node,
                page_name=page_name,
                page_url=page_url,
                file_rel=file_rel,
            )
            diagnostics.extend(attr_diagnostics)
            attrs[attr_name] = normalized_attr_config
            attr_sources[attr_name] = filepath

    return attrs, source_files, diagnostics


def _collect_file_modals(
    modal_files: list[str],
    page_name: str,
) -> tuple[dict[str, NormalizedModal], list[SourceFileMeta], list[Diagnostic]]:
    modals: dict[str, NormalizedModal] = {}
    source_files: list[SourceFileMeta] = []
    diagnostics: list[Diagnostic] = []

    for filepath in modal_files:
        modal_id = os.path.splitext(os.path.basename(filepath))[0]
        source_files.append(_source_file_meta(filepath, "modal"))
        modal = _normalize_modal_document(filepath, modal_id)
        previous = modals.get(modal_id)
        if previous:
            diagnostics.append(
                make_diagnostic(
                    "warning",
                    "duplicate_file_modal",
                    f"Модалка '{modal_id}' объявлена повторно; используется последняя версия",
                    page=page_name,
                    file=_relpath(filepath),
                    node_path=modal_id,
                )
            )
        modals[modal_id] = modal

    return modals, source_files, diagnostics


def _collect_embedded_modals(gui: dict[str, Any], page_name: str, gui_file: str) -> tuple[dict[str, NormalizedModal], list[Diagnostic]]:
    modals: dict[str, NormalizedModal] = {}
    diagnostics: list[Diagnostic] = []

    for modal_id, raw_modal in extract_embedded_modals(gui).items():
        raw_modal["source"] = "embedded"
        raw_modal["sourceFile"] = _relpath(gui_file)
        previous = modals.get(modal_id)
        if previous:
            diagnostics.append(
                make_diagnostic(
                    "warning",
                    "duplicate_embedded_modal",
                    f"Встроенная модалка '{modal_id}' объявлена повторно; используется последняя версия",
                    page=page_name,
                    file=_relpath(gui_file),
                    node_path=modal_id,
                )
            )
        modals[modal_id] = NormalizedModal.model_validate(raw_modal)

    return modals, diagnostics


def load_page_config(
    page_path: str,
    page_name: str,
    *,
    pages_dir: str = PAGES_DIR,
) -> dict[str, Any]:
    """Загружает одну страницу и возвращает нормализованный snapshot страницы."""
    gui_file, attr_files, modal_files = collect_page_scope_files(
        page_path,
        page_name,
        pages_dir,
    )
    gui = RawGuiDocument.model_validate(load_yaml_dict(gui_file)).root
    page_url = normalize_page_url(gui.get("url"), page_name)

    attrs, attr_sources, diagnostics = _merge_attrs_files(attr_files, page_name, page_url)

    file_modals, modal_sources, modal_diagnostics = _collect_file_modals(modal_files, page_name)
    embedded_modals, embedded_diagnostics = _collect_embedded_modals(gui, page_name, gui_file)
    diagnostics.extend(modal_diagnostics)
    diagnostics.extend(embedded_diagnostics)

    merged_modals = dict(file_modals)
    for modal_id, modal in embedded_modals.items():
        if modal_id in merged_modals:
            diagnostics.append(
                make_diagnostic(
                    "info",
                    "embedded_modal_overrides_file",
                    f"Встроенная модалка '{modal_id}' имеет приоритет над modal_<id>.yaml",
                    page=page_name,
                    file=_relpath(gui_file),
                    node_path=modal_id,
                )
            )
        merged_modals[modal_id] = modal

    page_snapshot = PageSnapshot(
        name=page_name,
        url=page_url,
        title=str(gui.get("title", page_name)),
        gui=gui,
        attrs=attrs,
        modals=merged_modals,
        guiMenuKeys=gui_root_keys(gui),
        modalGuiIds=sorted(merged_modals.keys()),
        sourceFiles=[_source_file_meta(gui_file, "gui"), *attr_sources, *modal_sources],
        diagnostics=diagnostics,
    )

    return page_snapshot.model_dump(by_alias=True)


def _snapshot_version(source_files: list[SourceFileMeta], pages_by_url: dict[str, str]) -> str:
    payload = "|".join(
        [
            f"{item.path}:{item.kind}:{item.digest}:{item.mtime_ns or 0}"
            for item in source_files
        ]
        + [f"url:{path}:{page_name}" for path, page_name in sorted(pages_by_url.items())]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def build_config_snapshot(
    pages_dir: str = PAGES_DIR,
    *,
    strict: bool = True,
) -> dict[str, Any]:
    """Строит полный versioned snapshot конфигурации из каталога pages/."""
    pages: dict[str, dict[str, Any]] = {}
    pages_by_url: dict[str, str] = {}
    page_attrs: dict[str, dict[str, Any]] = {}
    diagnostics: list[Diagnostic] = []
    all_source_files: list[SourceFileMeta] = []
    attr_definitions: list[dict[str, Any]] = []
    refs_by_page: dict[str, list[dict[str, Any]]] = {}

    for page_path in list_page_directories(pages_dir):
        page_name = page_name_from_path(page_path, pages_dir)
        try:
            page_config = load_page_config(page_path, page_name, pages_dir=pages_dir)
        except ConfigLoadError as exc:
            diagnostics.append(
                _page_load_failure_diagnostic(page_name, page_path, str(exc))
            )
            continue

        page_diagnostics = [
            Diagnostic.model_validate(item)
            for item in page_config.get("diagnostics") or []
        ]
        page_attr_definitions, page_refs, page_validation_diagnostics = _validate_page_documents(
            page_path,
            page_name,
            page_config["url"],
            page_config.get("attrs", {}),
            pages_dir=pages_dir,
        )
        page_all_diagnostics = [
            *page_diagnostics,
            *page_validation_diagnostics,
        ]
        diagnostics.extend(page_all_diagnostics)

        if _has_error_level_diagnostics(page_all_diagnostics):
            diagnostics.append(
                make_diagnostic(
                    "warning",
                    "page_skipped_due_to_errors",
                    f"Страница '{page_name}' не опубликована из-за ошибок в конфигурации",
                    page=page_name,
                    file=(page_config.get("sourceFiles") or [{}])[0].get("path")
                    if page_config.get("sourceFiles")
                    else _relpath(page_path),
                    url=page_config.get("url"),
                )
            )
            continue

        pages[page_name] = page_config
        page_attrs[page_name] = page_config.get("attrs", {})
        all_source_files.extend(
            SourceFileMeta.model_validate(item)
            for item in page_config.get("sourceFiles") or []
        )
        attr_definitions.extend(page_attr_definitions)
        refs_by_page[page_name] = page_refs

        page_url = page_config["url"]
        if is_reserved_page_url(page_url):
            diagnostics.append(
                make_diagnostic(
                    "warning",
                    "reserved_page_url",
                    f"URL страницы '{page_name}' конфликтует с системным маршрутом и не будет опубликован: {page_url}",
                    page=page_name,
                    file=(page_config.get("sourceFiles") or [{}])[0].get("path") if page_config.get("sourceFiles") else None,
                )
            )
            continue

        previous_page = pages_by_url.get(page_url)
        if previous_page:
            diagnostics.append(
                make_diagnostic(
                    "warning",
                    "duplicate_page_url",
                    f"URL {page_url} конфликтует между страницами '{previous_page}' и '{page_name}'",
                    page=page_name,
                )
            )
            continue

        pages_by_url[page_url] = page_name

    diagnostics.extend(_build_duplicate_attr_diagnostics(attr_definitions))
    diagnostics.extend(_build_unused_attr_diagnostics(attr_definitions, refs_by_page))

    created_at = utc_now_iso()
    meta = SnapshotMeta(
        version=_snapshot_version(all_source_files, pages_by_url) if all_source_files else "empty",
        created_at=created_at,
        page_count=len(pages),
        source_files=all_source_files,
        last_successful_build_at=created_at,
    )
    snapshot = AppSnapshot(
        meta=meta,
        pages={name: PageSnapshot.model_validate(config) for name, config in pages.items()},
        pages_by_url=pages_by_url,
        page_attrs=page_attrs,
        diagnostics=diagnostics,
    )
    if strict and _has_error_level_diagnostics(diagnostics):
        raise SnapshotValidationError(diagnostics)
    return snapshot.model_dump(by_alias=True)


def load_config() -> dict[str, Any]:
    """Legacy-обёртка над актуальной сборкой snapshot."""
    return build_config_snapshot()
