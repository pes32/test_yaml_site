"""Attr validation and attr-reference extraction."""

from __future__ import annotations

from typing import Any

from yaml.nodes import MappingNode, ScalarNode, SequenceNode

from .config_attr_schema import ATTR_WIDGET_SCHEMA
from .config_attr_types import (
    _is_scalar_attr_value,
    _validate_attr_option_value,
)
from .config_shared import (
    TABLE_ATTR_BLOCK_SCALAR_STYLES,
    TABLE_ATTR_BUILTIN_TOKENS,
    TABLE_ATTR_TOKEN_RE,
    TABLE_ATTR_WIDTH_TOKEN_RE,
    _attr_option_diagnostic,
    _compose_yaml_root,
    _mapping_node_items,
    _node_line,
    _relpath,
)


def _validate_voc_columns_config(
    attr_name: str,
    columns_value: Any,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    line: int | None,
) -> list:
    diagnostics: list = []

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
) -> list:
    diagnostics: list = []
    if not isinstance(columns_value, list) or not columns_value:
        return diagnostics

    column_count = len(columns_value)
    source_path = f"{attr_name}.source"

    def add_row_width_error(*, line: int | None, row_index: int, actual_count: int) -> None:
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
                        f"attrs '{source_path}' использует scalar-source без разделителей "
                        "строк или ячеек; такой формат не разбирается и публикуется как пустой набор строк"
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
            actual_count = len(item) if isinstance(item, list) else 1
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
):
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
) -> tuple[dict[str, Any], list]:
    diagnostics: list = []
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

    allowed = ATTR_WIDGET_SCHEMA[widget_type]["allowed"]

    for option_name, option_value in attr_config.items():
        key_node, value_node = node_items.get(option_name, (None, None))
        line = _node_line(key_node) or _node_line(value_node) or _node_line(attr_node)
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
