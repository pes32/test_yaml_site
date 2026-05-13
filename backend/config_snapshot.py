"""Snapshot assembly and page loading."""

from __future__ import annotations

import hashlib
from typing import Any

from .config_files import (
    PAGES_DIR,
    is_reserved_page_url,
    list_page_directories,
    page_name_from_path,
)
from .config_pipeline_stages import (
    stage_collect_and_merge_modals,
    stage_load_page_raw,
    stage_merge_and_validate_attrs,
    stage_normalize_gui,
    stage_validate_page,
)
from .config_shared import (
    ConfigLoadError,
    SnapshotValidationError,
    _has_error_level_diagnostics,
    _page_load_failure_diagnostic,
    _relpath,
    _source_file_meta,
    load_yaml_dict,
    make_diagnostic,
)
from .config_attr_validation import _validate_attr_config
from .config_gui_validation import (
    _build_duplicate_attr_diagnostics,
    _build_unused_attr_diagnostics,
)
from .contracts import (
    AppSnapshot,
    Diagnostic,
    PageSnapshot,
    RawAttrsFragment,
    SnapshotMeta,
    SourceFileMeta,
    utc_now_iso,
)


WIDGET_ERROR_DIAGNOSTIC_CODES = frozenset(
    {
        "invalid_attr_option_value",
        "invalid_voc_column_label",
        "invalid_voc_source_row_width",
        "missing_attr_reference",
        "unknown_attr_widget",
        "unsupported_attr_option",
        "voc_columns_required",
    }
)


def _diagnostic_attr_name(item: Diagnostic) -> str:
    node_path = str(item.node_path or "").strip()
    if not node_path:
        return ""
    return node_path.split(".", 1)[0].split("[", 1)[0].strip()


def _should_render_attr_as_error(item: Diagnostic) -> bool:
    if item.level != "error" or item.code not in WIDGET_ERROR_DIAGNOSTIC_CODES:
        return False
    return bool(_diagnostic_attr_name(item))


def _error_attr_config(
    attr_name: str,
    original_config: Any,
    diagnostics: list[Diagnostic],
) -> dict[str, Any]:
    original = original_config if isinstance(original_config, dict) else {}
    label = str(original.get("label") or attr_name or "error").strip()
    config: dict[str, Any] = {
        "widget": "str",
        "label": label,
        "default": attr_name or "error",
        "regex": "(?!)",
        "err_text": "error!",
        "sup_text": "error!",
        "x_config_error": True,
        "x_config_error_codes": sorted({item.code for item in diagnostics}),
        "x_config_error_messages": [item.message for item in diagnostics],
    }

    width = original.get("width")
    if isinstance(width, (int, float, str)) and not isinstance(width, bool):
        config["width"] = width

    return config


def _with_error_widgets(page_config: dict[str, Any], diagnostics: list[Diagnostic]) -> dict[str, Any]:
    grouped: dict[str, list[Diagnostic]] = {}
    for item in diagnostics:
        if not _should_render_attr_as_error(item):
            continue
        attr_name = _diagnostic_attr_name(item)
        grouped.setdefault(attr_name, []).append(item)

    if not grouped:
        return page_config

    attrs = dict(page_config.get("attrs") or {})
    for attr_name, items in grouped.items():
        attrs[attr_name] = _error_attr_config(attr_name, attrs.get(attr_name), items)

    page_config = dict(page_config)
    page_config["attrs"] = attrs
    return page_config


def _merge_attrs_files(
    attr_files: list[str],
    page_name: str,
    page_url: str,
) -> tuple[dict[str, Any], list[SourceFileMeta], list[Diagnostic]]:
    attrs: dict[str, Any] = {}
    source_files: list[SourceFileMeta] = []
    diagnostics: list[Diagnostic] = []

    from .config_shared import _compose_yaml_root

    for filepath in attr_files:
        root_node = _compose_yaml_root(filepath)
        node_items = {}
        if hasattr(root_node, "value"):
            from .config_shared import _mapping_node_items

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

    return attrs, source_files, diagnostics


def load_page_config(
    page_path: str,
    page_name: str,
    *,
    pages_dir: str = PAGES_DIR,
) -> dict[str, Any]:
    raw = stage_load_page_raw(page_path, page_name, pages_dir=pages_dir)
    attrs, attr_sources, diagnostics = stage_merge_and_validate_attrs(
        raw["attr_files"],
        raw["page_name"],
        raw["page_url"],
    )
    merged_modals, modal_sources, modal_diagnostics = stage_collect_and_merge_modals(
        raw["gui"],
        raw["gui_file"],
        raw["modal_files"],
        raw["page_name"],
    )
    diagnostics.extend(modal_diagnostics)
    norm = stage_normalize_gui(raw["gui"])
    gui = norm["gui"]
    page_snapshot = PageSnapshot(
        name=raw["page_name"],
        url=raw["page_url"],
        title=str(gui.get("title", raw["page_name"])),
        gui=gui,
        parsedGui=norm["parsedGui"],
        attrs=attrs,
        modals=merged_modals,
        guiMenuKeys=norm["guiMenuKeys"],
        modalGuiIds=sorted(merged_modals.keys()),
        sourceFiles=[_source_file_meta(raw["gui_file"], "gui"), *attr_sources, *modal_sources],
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


def stage_build_snapshot(
    pages_dir: str = PAGES_DIR,
    *,
    strict: bool = True,
) -> dict[str, Any]:
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
            diagnostics.append(_page_load_failure_diagnostic(page_name, page_path, str(exc)))
            continue

        page_diagnostics = [
            Diagnostic.model_validate(item)
            for item in page_config.get("diagnostics") or []
        ]
        page_attr_definitions, page_refs, page_validation_diagnostics = stage_validate_page(
            page_path,
            page_name,
            page_config["url"],
            page_config.get("attrs", {}),
            pages_dir=pages_dir,
        )
        page_all_diagnostics = [*page_diagnostics, *page_validation_diagnostics]
        diagnostics.extend(page_all_diagnostics)
        page_config = _with_error_widgets(page_config, page_all_diagnostics)
        page_config["diagnostics"] = [item.model_dump() for item in page_all_diagnostics]

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


def build_config_snapshot(
    pages_dir: str = PAGES_DIR,
    *,
    strict: bool = True,
) -> dict[str, Any]:
    return stage_build_snapshot(pages_dir=pages_dir, strict=strict)


def load_config() -> dict[str, Any]:
    return build_config_snapshot()
