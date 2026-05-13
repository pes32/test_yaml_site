"""Явные стадии пайплайна YAML-конфига (тонкие обёртки; порядок: attrs → GUI)."""

from __future__ import annotations

from typing import Any, TypedDict

from .config_files import (
    PAGES_DIR,
    collect_page_scope_files,
    normalize_page_url,
)
from .config_modals import _collect_embedded_modals, _collect_file_modals
from .config_shared import (
    SourceFileMeta,
    load_yaml_dict,
    make_diagnostic,
    _relpath,
)
from .config_gui_validation import _validate_page_documents
from .contracts import Diagnostic, RawGuiDocument
from .gui_dsl import gui_root_keys, normalize_page_gui


class PageRawConfig(TypedDict):
    """Стадия: загрузка сырья (scope, сырой GUI YAML, списки файлов attrs/modals)."""

    page_path: str
    page_name: str
    pages_dir: str
    gui_file: str
    attr_files: list[str]
    modal_files: list[str]
    gui: dict[str, Any]
    page_url: str


class NormalizedGuiConfig(TypedDict):
    """Стадия: нормализация GUI после merge attrs (`gui` + parsedGui + ключи меню)."""

    gui: dict[str, Any]
    parsedGui: dict[str, Any]
    guiMenuKeys: list[str]


def stage_load_page_raw(
    page_path: str,
    page_name: str,
    *,
    pages_dir: str = PAGES_DIR,
) -> PageRawConfig:
    gui_file, attr_files, modal_files = collect_page_scope_files(
        page_path,
        page_name,
        pages_dir,
    )
    gui = RawGuiDocument.model_validate(load_yaml_dict(gui_file)).root
    page_url = normalize_page_url(gui.get("url"), page_name)
    raw: PageRawConfig = {
        "page_path": page_path,
        "page_name": page_name,
        "pages_dir": pages_dir,
        "gui_file": gui_file,
        "attr_files": attr_files,
        "modal_files": modal_files,
        "gui": gui,
        "page_url": page_url,
    }
    return raw


def stage_merge_and_validate_attrs(
    attr_files: list[str],
    page_name: str,
    page_url: str,
) -> tuple[dict[str, Any], list[SourceFileMeta], list[Diagnostic]]:
    from .config_snapshot import _merge_attrs_files

    return _merge_attrs_files(attr_files, page_name, page_url)


def stage_collect_and_merge_modals(
    gui: dict[str, Any],
    gui_file: str,
    modal_files: list[str],
    page_name: str,
) -> tuple[dict[str, Any], list[SourceFileMeta], list[Diagnostic]]:
    """Сборка модалок страницы (файлы + embedded) и merge; до нормализации GUI."""
    file_modals, modal_sources, modal_diagnostics = _collect_file_modals(modal_files, page_name)
    embedded_modals, embedded_diagnostics = _collect_embedded_modals(gui, page_name, gui_file)
    diagnostics = [*modal_diagnostics, *embedded_diagnostics]

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

    return merged_modals, modal_sources, diagnostics


def stage_normalize_gui(gui: dict[str, Any]) -> NormalizedGuiConfig:
    page_gui_root_keys = gui_root_keys(gui)
    return NormalizedGuiConfig(
        gui=gui,
        parsedGui=normalize_page_gui(gui, page_gui_root_keys),
        guiMenuKeys=page_gui_root_keys,
    )


def stage_validate_page(
    page_path: str,
    page_name: str,
    page_url: str,
    page_attrs: dict[str, Any],
    *,
    pages_dir: str = PAGES_DIR,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[Diagnostic]]:
    """Валидация страницы (`_validate_page_documents`); refs/definitions нужны для snapshot."""
    return _validate_page_documents(
        page_path,
        page_name,
        page_url,
        page_attrs,
        pages_dir=pages_dir,
    )
