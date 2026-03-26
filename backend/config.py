"""Загрузка YAML-конфигурации страниц и сбор versioned snapshot."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any

import yaml

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
from .gui_dsl import collect_widget_names_from_modal, extract_embedded_modals, gui_root_keys, normalize_modal_runtime

logger = logging.getLogger(__name__)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
PAGES_DIR = os.path.join(ROOT_DIR, "pages")
GUI_FILENAMES = {"gui.yaml", "gui.yml"}
RESERVED_PAGE_PREFIXES = ("/api", "/debug", "/frontend", "/page/", "/templates")
RESERVED_PAGE_PATHS = {"/favicon.ico"}

MODAL_GUI_ID_RE = re.compile(r"^modal_[a-zA-Z][a-zA-Z0-9_]*$")
MODAL_FILE_ROOT_KEY_RE = re.compile(r"^(.+?)(?:\s+\"([^\"]*)\")?\s*$")


class ConfigLoadError(Exception):
    """Фатальная ошибка при построении snapshot конфигурации."""


def make_diagnostic(
    level: str,
    code: str,
    message: str,
    *,
    page: str | None = None,
    file: str | None = None,
    node_path: str | None = None,
) -> Diagnostic:
    """Упрощённое создание Diagnostic."""
    return Diagnostic(
        level=level,
        code=code,
        message=message,
        page=page,
        file=file,
        node_path=node_path,
    )


def _relpath(path: str, root_dir: str = ROOT_DIR) -> str:
    try:
        return os.path.relpath(path, root_dir)
    except ValueError:
        return path


def _read_yaml(filepath: str) -> Any:
    try:
        with open(filepath, "r", encoding="utf-8") as handle:
            return yaml.safe_load(handle)
    except yaml.YAMLError as exc:
        raise ConfigLoadError(f"Ошибка парсинга YAML {filepath}: {exc}") from exc
    except FileNotFoundError as exc:
        raise ConfigLoadError(f"YAML-файл не найден: {filepath}") from exc
    except OSError as exc:
        raise ConfigLoadError(f"Ошибка чтения {filepath}: {exc}") from exc


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


def list_page_directories(pages_dir: str = PAGES_DIR) -> list[str]:
    """Возвращает список директорий страниц в детерминированном порядке."""
    if not os.path.isdir(pages_dir):
        return []

    return [
        os.path.join(pages_dir, name)
        for name in sorted(os.listdir(pages_dir))
        if os.path.isdir(os.path.join(pages_dir, name))
    ]


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


def _merge_attrs_files(attr_files: list[str], page_name: str) -> tuple[dict[str, Any], list[SourceFileMeta], list[Diagnostic]]:
    attrs: dict[str, Any] = {}
    attr_sources: dict[str, str] = {}
    source_files: list[SourceFileMeta] = []
    diagnostics: list[Diagnostic] = []

    for filepath in attr_files:
        loaded = RawAttrsFragment.model_validate(load_yaml_dict(filepath)).root
        source_files.append(_source_file_meta(filepath, "attrs"))
        for attr_name, attr_config in loaded.items():
            previous = attr_sources.get(attr_name)
            if previous:
                diagnostics.append(
                    make_diagnostic(
                        "warning",
                        "duplicate_attr",
                        f"Attrs '{attr_name}' из {_relpath(filepath)} переопределяет {_relpath(previous)}",
                        page=page_name,
                        file=_relpath(filepath),
                        node_path=attr_name,
                    )
                )
            attrs[attr_name] = attr_config
            attr_sources[attr_name] = filepath

    return attrs, source_files, diagnostics


def _collect_file_modals(page_path: str, page_name: str) -> tuple[dict[str, NormalizedModal], list[SourceFileMeta], list[Diagnostic]]:
    modals: dict[str, NormalizedModal] = {}
    source_files: list[SourceFileMeta] = []
    diagnostics: list[Diagnostic] = []

    for modal_id in list_modal_gui_ids(page_path):
        filepath = os.path.join(page_path, f"{modal_id}.yaml")
        if not os.path.isfile(filepath):
            filepath = os.path.join(page_path, f"{modal_id}.yml")
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


def load_page_config(page_path: str, page_name: str) -> dict[str, Any]:
    """Загружает одну страницу и возвращает нормализованный snapshot страницы."""
    yaml_files = list_yaml_files(page_path)
    gui_file = find_gui_file(yaml_files, page_name)
    gui = RawGuiDocument.model_validate(load_yaml_dict(gui_file)).root

    attr_files = [
        path
        for path in yaml_files
        if path != gui_file and not is_modal_gui_filename(os.path.basename(path))
    ]
    attrs, attr_sources, diagnostics = _merge_attrs_files(attr_files, page_name)

    file_modals, modal_sources, modal_diagnostics = _collect_file_modals(page_path, page_name)
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
        url=normalize_page_url(gui.get("url"), page_name),
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


def build_config_snapshot(pages_dir: str = PAGES_DIR) -> dict[str, Any]:
    """Строит полный versioned snapshot конфигурации из каталога pages/."""
    pages: dict[str, dict[str, Any]] = {}
    pages_by_url: dict[str, str] = {}
    page_attrs: dict[str, dict[str, Any]] = {}
    diagnostics: list[Diagnostic] = []
    all_source_files: list[SourceFileMeta] = []

    for page_path in list_page_directories(pages_dir):
        page_name = os.path.basename(page_path)
        page_config = load_page_config(page_path, page_name)
        page_diagnostics = [
            Diagnostic.model_validate(item)
            for item in page_config.get("diagnostics") or []
        ]

        pages[page_name] = page_config
        page_attrs[page_name] = page_config.get("attrs", {})
        all_source_files.extend(
            SourceFileMeta.model_validate(item)
            for item in page_config.get("sourceFiles") or []
        )
        diagnostics.extend(page_diagnostics)

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
    return snapshot.model_dump(by_alias=True)


def load_config() -> dict[str, Any]:
    """Legacy-обёртка над актуальной сборкой snapshot."""
    return build_config_snapshot()

