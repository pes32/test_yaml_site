"""GUI content and modal structure validation helpers."""

from __future__ import annotations

from typing import Any

from yaml.nodes import MappingNode, ScalarNode, SequenceNode

from .config_shared import (
    _compose_yaml_root,
    _invalid_gui_value,
    _node_kind,
    _node_line,
    _relpath,
)
from .contracts import Diagnostic
from .gui_dsl import META_KEYS, ROOT_CONTENT_TYPES, parse_dynamic_key, split_names


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
