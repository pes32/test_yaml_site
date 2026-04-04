"""Filesystem discovery helpers for YAML config pages."""

from __future__ import annotations

import os
from typing import Any

from .config_shared import (
    ConfigLoadError,
    GUI_FILENAMES,
    MODAL_FILE_ROOT_KEY_RE,
    MODAL_GUI_ID_RE,
    PAGES_DIR,
    RESERVED_PAGE_PATHS,
    RESERVED_PAGE_PREFIXES,
)


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


def list_page_directories(pages_dir: str = PAGES_DIR) -> list[str]:
    if not os.path.isdir(pages_dir):
        return []

    page_paths: list[str] = []
    for root, dirnames, filenames in os.walk(pages_dir):
        dirnames.sort()
        if any(filename in GUI_FILENAMES for filename in filenames):
            page_paths.append(root)

    return sorted(page_paths, key=lambda path: page_name_from_path(path, pages_dir))


def list_yaml_files(page_path: str) -> list[str]:
    if not os.path.isdir(page_path):
        return []

    return [
        os.path.join(page_path, name)
        for name in sorted(os.listdir(page_path))
        if name.endswith((".yaml", ".yml"))
    ]


def normalize_page_url(value: Any, page_name: str) -> str:
    raw = str(value).strip() if value is not None else ""
    if not raw:
        return f"/page/{page_name}"
    if not raw.startswith("/"):
        return "/" + raw
    return raw


def is_reserved_page_url(path: str) -> bool:
    if path in RESERVED_PAGE_PATHS:
        return True
    return any(path == prefix or path.startswith(prefix + "/") for prefix in RESERVED_PAGE_PREFIXES)


def find_gui_file(yaml_files: list[str], page_name: str) -> str:
    gui_files = [path for path in yaml_files if os.path.basename(path) in GUI_FILENAMES]
    if not gui_files:
        raise ConfigLoadError(f"У страницы {page_name} отсутствует gui.yaml")
    if len(gui_files) > 1:
        raise ConfigLoadError(
            f"У страницы {page_name} найдено несколько GUI-файлов: {', '.join(gui_files)}"
        )
    return gui_files[0]


def parse_gui_style_key(raw_key: str) -> tuple[str, str]:
    key = str(raw_key or "").strip()
    match = MODAL_FILE_ROOT_KEY_RE.match(key)
    if not match:
        return key, ""
    entry_type = (match.group(1) or "").strip()
    quoted = match.group(2)
    return entry_type, quoted if quoted is not None else ""


def is_modal_gui_filename(filename: str) -> bool:
    if filename.endswith(".yaml"):
        stem = filename[:-5]
    elif filename.endswith(".yml"):
        stem = filename[:-4]
    else:
        return False
    return bool(MODAL_GUI_ID_RE.fullmatch(stem))
