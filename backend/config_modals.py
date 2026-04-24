"""Modal normalization and collection helpers."""

from __future__ import annotations

import os
from typing import Any

from .config_files import parse_gui_style_key
from .config_shared import ConfigLoadError, _relpath, _source_file_meta, load_yaml_root, make_diagnostic
from .contracts import Diagnostic, NormalizedModal, RawModalDocument, SourceFileMeta
from .gui_dsl import collect_widget_names_from_modal, extract_embedded_modals, normalize_modal_runtime


def _duplicate_modal_warning(code: str, modal_id: str, page_name: str, file_rel: str, label: str) -> Diagnostic:
    return make_diagnostic(
        "warning",
        code,
        f"{label} '{modal_id}' объявлена повторно; используется последняя версия",
        page=page_name,
        file=file_rel,
        node_path=modal_id,
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


def load_modal_gui_payload(page_path: str, modal_id: str) -> dict[str, Any]:
    from .config_shared import MODAL_GUI_ID_RE

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
                _duplicate_modal_warning(
                    "duplicate_file_modal",
                    modal_id,
                    page_name,
                    _relpath(filepath),
                    "Модалка",
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
                _duplicate_modal_warning(
                    "duplicate_embedded_modal",
                    modal_id,
                    page_name,
                    _relpath(gui_file),
                    "Встроенная модалка",
                )
            )
        modals[modal_id] = NormalizedModal.model_validate(raw_modal)

    return modals, diagnostics
