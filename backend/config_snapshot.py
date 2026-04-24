"""Snapshot assembly and page loading."""

from __future__ import annotations

import hashlib
from typing import Any

from .config_files import (
    PAGES_DIR,
    collect_page_scope_files,
    is_reserved_page_url,
    list_page_directories,
    normalize_page_url,
    page_name_from_path,
)
from .config_modals import _collect_embedded_modals, _collect_file_modals
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
    _validate_page_documents,
)
from .contracts import (
    AppSnapshot,
    Diagnostic,
    PageSnapshot,
    RawAttrsFragment,
    RawGuiDocument,
    SnapshotMeta,
    SourceFileMeta,
    utc_now_iso,
)
from .gui_dsl import gui_root_keys, normalize_page_gui


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

    page_gui_root_keys = gui_root_keys(gui)
    page_snapshot = PageSnapshot(
        name=page_name,
        url=page_url,
        title=str(gui.get("title", page_name)),
        gui=gui,
        parsedGui=normalize_page_gui(gui, page_gui_root_keys),
        attrs=attrs,
        modals=merged_modals,
        guiMenuKeys=page_gui_root_keys,
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
        page_attr_definitions, page_refs, page_validation_diagnostics = _validate_page_documents(
            page_path,
            page_name,
            page_config["url"],
            page_config.get("attrs", {}),
            pages_dir=pages_dir,
        )
        page_all_diagnostics = [*page_diagnostics, *page_validation_diagnostics]
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
    return build_config_snapshot()
