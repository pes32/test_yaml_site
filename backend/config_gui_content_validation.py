"""GUI content and modal structure validation helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from yaml.nodes import MappingNode, ScalarNode, SequenceNode

from .config_shared import (
    _compose_yaml_root,
    _invalid_gui_node_kind,
    _invalid_gui_value,
    _node_line,
    _relpath,
)
from .contracts import Diagnostic
from .gui_dsl import META_KEYS, ROOT_CONTENT_TYPES, parse_dynamic_key, split_names


@dataclass(frozen=True)
class _GuiValidationContext:
    page_name: str
    page_url: str
    file_rel: str

    def with_file(self, file_rel: str) -> "_GuiValidationContext":
        return type(self)(self.page_name, self.page_url, file_rel)

    def ref(self, name: str, line: int | None) -> dict[str, Any]:
        return {
            "name": name,
            "page": self.page_name,
            "url": self.page_url,
            "file": self.file_rel,
            "line": line,
        }

    def invalid_kind(
        self,
        node: Any,
        node_path: str,
        expected: str,
        *,
        prefix: str = "Некорректное значение",
    ) -> Diagnostic:
        return _invalid_gui_node_kind(
            page_name=self.page_name,
            page_url=self.page_url,
            file_rel=self.file_rel,
            node=node,
            node_path=node_path,
            expected=expected,
            prefix=prefix,
        )

    def invalid_value(self, node_path: str, message: str, line: int | None = None) -> Diagnostic:
        return _invalid_gui_value(
            page_name=self.page_name,
            page_url=self.page_url,
            file_rel=self.file_rel,
            line=line,
            node_path=node_path,
            message=message,
        )

    def invalid_key(self, node_path: str, container: str, allowed: set[str], line: int | None) -> Diagnostic:
        return self.invalid_value(
            node_path,
            (
                f"Некорректный ключ '{node_path}' в {container}: "
                f"разрешены только {', '.join(sorted(allowed))}"
            ),
            line,
        )


def _collect_name_refs_from_node(
    node: Any,
    *,
    ctx: _GuiValidationContext,
    node_path: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    if isinstance(node, ScalarNode):
        line = _node_line(node)
        refs = [
            ctx.ref(name, line)
            for name in split_names(node.value)
            if name != "CLOSE"
        ]
        return refs, []

    if isinstance(node, SequenceNode):
        refs: list[dict[str, Any]] = []
        diagnostics: list[Diagnostic] = []
        for item in node.value:
            nested_refs, nested_diagnostics = _collect_name_refs_from_node(
                item,
                ctx=ctx,
                node_path=node_path,
            )
            refs.extend(nested_refs)
            diagnostics.extend(nested_diagnostics)
        return refs, diagnostics

    return [], [ctx.invalid_kind(node, node_path, "строка или список имён attrs")]


def _validate_rows_node(
    node: Any,
    *,
    ctx: _GuiValidationContext,
    node_path: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    if isinstance(node, ScalarNode):
        return _collect_name_refs_from_node(node, ctx=ctx, node_path=node_path)

    if not isinstance(node, SequenceNode):
        return [], [ctx.invalid_kind(node, node_path, "скаляр или список rows")]

    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []
    for item in node.value:
        if isinstance(item, ScalarNode):
            continue
        if isinstance(item, SequenceNode):
            nested_refs, nested_diagnostics = _validate_rows_node(
                item,
                ctx=ctx,
                node_path=node_path,
            )
            refs.extend(nested_refs)
            diagnostics.extend(nested_diagnostics)
            continue
        if not isinstance(item, MappingNode) or len(item.value) != 1:
            diagnostics.append(
                ctx.invalid_value(
                    node_path,
                    (
                        f"Некорректный элемент '{node_path}': ожидается "
                        "single-key mapping с row/widgets/rows"
                    ),
                    _node_line(item),
                )
            )
            continue

        key_node, value_node = item.value[0]
        raw_key = str(getattr(key_node, "value", "") or "")
        entry_type, _entry_name = parse_dynamic_key(raw_key)
        allowed = {"row", "widgets", "rows"}
        if entry_type not in allowed:
            diagnostics.append(ctx.invalid_key(raw_key, "rows", allowed, _node_line(key_node)))
            continue

        nested_refs, nested_diagnostics = _validate_content_entry(
            entry_type,
            value_node,
            ctx=ctx,
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
    ctx: _GuiValidationContext,
    node_path: str,
    container: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    if entry_type == "icon":
        diagnostics = [] if isinstance(value_node, ScalarNode) else [
            ctx.invalid_kind(value_node, node_path, "строка")
        ]
        return [], diagnostics

    if entry_type in {"row", "widgets", "button"}:
        return _collect_name_refs_from_node(value_node, ctx=ctx, node_path=node_path)

    if entry_type == "rows":
        return _validate_rows_node(value_node, ctx=ctx, node_path=node_path)

    if entry_type == "tab":
        if not isinstance(value_node, SequenceNode):
            return [], [ctx.invalid_kind(value_node, node_path, "список элементов tab")]
        return _validate_content_list(value_node, ctx=ctx, container="content")

    if entry_type in {"box", "collapse"}:
        if isinstance(value_node, ScalarNode):
            return [], []
        if not isinstance(value_node, SequenceNode):
            return [], [ctx.invalid_kind(value_node, node_path, "строка или список элементов")]
        return _validate_content_list(value_node, ctx=ctx, container="section")

    return [], [
        ctx.invalid_value(
            node_path,
            f"Неподдерживаемый ключ '{node_path}' в контейнере {container}",
            _node_line(value_node),
        )
    ]


def _validate_content_list(
    node: Any,
    *,
    ctx: _GuiValidationContext,
    container: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    if not isinstance(node, SequenceNode):
        return [], [
            ctx.invalid_kind(
                node,
                container,
                "список",
                prefix="Некорректное значение контейнера",
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
                ctx.invalid_value(
                    container,
                    (
                        f"Некорректный элемент контейнера '{container}': "
                        "ожидается single-key mapping или строка"
                    ),
                    _node_line(item),
                )
            )
            continue

        key_node, value_node = item.value[0]
        raw_key = str(getattr(key_node, "value", "") or "")
        entry_type, _entry_name = parse_dynamic_key(raw_key)
        if entry_type not in allowed:
            diagnostics.append(ctx.invalid_key(raw_key, container, allowed, _node_line(key_node)))
            continue

        nested_refs, nested_diagnostics = _validate_content_entry(
            entry_type,
            value_node,
            ctx=ctx,
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
    ctx = _GuiValidationContext(page_name, page_url, _relpath(gui_file))
    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []
    root_node = _compose_yaml_root(gui_file)
    if not isinstance(root_node, MappingNode):
        return refs, diagnostics

    for key_node, value_node in root_node.value:
        raw_key = str(getattr(key_node, "value", "") or "")
        if raw_key in {"url", "title", "description"}:
            if not isinstance(value_node, ScalarNode):
                diagnostics.append(ctx.invalid_kind(value_node, raw_key, "строка"))
            continue
        if raw_key in META_KEYS:
            continue

        entry_type, _entry_name = parse_dynamic_key(raw_key)
        if entry_type == "menu":
            nested_refs, nested_diagnostics = _validate_content_list(
                value_node,
                ctx=ctx,
                container="content",
            )
        elif entry_type in ROOT_CONTENT_TYPES:
            nested_refs, nested_diagnostics = _validate_content_entry(
                entry_type,
                value_node,
                ctx=ctx,
                node_path=raw_key,
                container="root",
            )
        elif isinstance(value_node, SequenceNode):
            nested_refs, nested_diagnostics = _validate_content_list(
                value_node,
                ctx=ctx,
                container="content",
            )
        else:
            nested_refs, nested_diagnostics = [], [
                ctx.invalid_kind(
                    value_node,
                    raw_key,
                    "список элементов",
                    prefix="Некорректное значение встроенной модалки",
                )
            ]

        refs.extend(nested_refs)
        diagnostics.extend(nested_diagnostics)
    return refs, diagnostics


def _extract_modal_content_node(
    modal_file: str,
    *,
    page_name: str,
    page_url: str,
) -> tuple[Any, list[Diagnostic]]:
    ctx = _GuiValidationContext(page_name, page_url, _relpath(modal_file))
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
        return None, [ctx.invalid_kind(value_node, key, "список")]
    return None, []


def _validate_modal_documents(
    modal_files: list[str],
    *,
    page_name: str,
    page_url: str,
) -> tuple[list[dict[str, Any]], list[Diagnostic]]:
    refs: list[dict[str, Any]] = []
    diagnostics: list[Diagnostic] = []
    base_ctx = _GuiValidationContext(page_name, page_url, "")

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
            ctx=base_ctx.with_file(_relpath(modal_file)),
            container="content",
        )
        refs.extend(nested_refs)
        diagnostics.extend(nested_diagnostics)
    return refs, diagnostics
