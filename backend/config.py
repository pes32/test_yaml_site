# backend/config.py
"""Загрузка YAML-конфигурации страниц.

Одна страница состоит из одного GUI-файла (`gui.yaml` или `gui.yml`) и
любого количества attrs-фрагментов в той же папке страницы.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict

import yaml

logger = logging.getLogger(__name__)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
PAGES_DIR = os.path.join(ROOT_DIR, "pages")
GUI_FILENAMES = {"gui.yaml", "gui.yml"}
RESERVED_PAGE_PREFIXES = ("/api", "/debug", "/frontend", "/page/", "/templates")
RESERVED_PAGE_PATHS = {"/favicon.ico"}


class ConfigLoadError(Exception):
    """Фатальная ошибка при построении snapshot конфигурации."""


def load_yaml_dict(filepath: str) -> Dict[str, Any]:
    """Загружает YAML-файл и требует словарь на верхнем уровне."""
    try:
        with open(filepath, "r", encoding="utf-8") as handle:
            loaded = yaml.safe_load(handle) or {}
    except yaml.YAMLError as exc:
        raise ConfigLoadError(f"Ошибка парсинга YAML {filepath}: {exc}") from exc
    except FileNotFoundError as exc:
        raise ConfigLoadError(f"YAML-файл не найден: {filepath}") from exc
    except OSError as exc:
        raise ConfigLoadError(f"Ошибка чтения {filepath}: {exc}") from exc

    if not isinstance(loaded, dict):
        raise ConfigLoadError(f"{filepath} должен содержать YAML-словарь")

    return loaded


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


def merge_attrs_files(attr_files: list[str], page_name: str) -> Dict[str, Any]:
    """Мержит attrs-фрагменты страницы и логирует дубли ключей."""
    merged: Dict[str, Any] = {}
    attr_sources: Dict[str, str] = {}

    for filepath in attr_files:
        loaded = load_yaml_dict(filepath)
        for attr_name, attr_config in loaded.items():
            previous = attr_sources.get(attr_name)
            if previous:
                logger.warning(
                    "Дубликат attrs '%s' на странице '%s': %s переопределяет %s",
                    attr_name,
                    page_name,
                    filepath,
                    previous,
                )
            merged[attr_name] = attr_config
            attr_sources[attr_name] = filepath

    return merged


def load_page_config(page_path: str, page_name: str) -> Dict[str, Any]:
    """Загружает одну страницу из GUI-файла и attrs-фрагментов."""
    yaml_files = list_yaml_files(page_path)
    gui_file = find_gui_file(yaml_files, page_name)
    gui = load_yaml_dict(gui_file)
    attr_files = [path for path in yaml_files if path != gui_file]
    attrs = merge_attrs_files(attr_files, page_name)
    url = normalize_page_url(gui.get("url"), page_name)

    page_config: Dict[str, Any] = {
        "name": page_name,
        "url": url,
        "title": gui.get("title", page_name),
        "gui": gui,
        "attrs": attrs,
    }

    return page_config


def build_config_snapshot(pages_dir: str = PAGES_DIR) -> Dict[str, Any]:
    """Строит полный snapshot конфигурации из каталога pages/."""
    pages: Dict[str, Any] = {}
    pages_by_url: Dict[str, str] = {}
    page_attrs: Dict[str, Dict[str, Any]] = {}

    for page_path in list_page_directories(pages_dir):
        page_name = os.path.basename(page_path)
        page_config = load_page_config(page_path, page_name)

        pages[page_name] = page_config
        page_attrs[page_name] = page_config["attrs"]

        page_url = page_config["url"]
        if is_reserved_page_url(page_url):
            logger.warning(
                "URL страницы '%s' конфликтует с системным маршрутом и не будет опубликован: %s",
                page_name,
                page_url,
            )
            continue

        previous_page = pages_by_url.get(page_url)
        if previous_page:
            logger.warning(
                "Дубликат URL %s: страница '%s' конфликтует с '%s' и не будет опубликована по URL",
                page_url,
                page_name,
                previous_page,
            )
            continue

        pages_by_url[page_url] = page_name

    return {
        "pages": pages,
        "pages_by_url": pages_by_url,
        "page_attrs": page_attrs,
    }


def load_config() -> Dict[str, Any]:
    """Legacy-обёртка над актуальной сборкой snapshot."""
    return build_config_snapshot()
