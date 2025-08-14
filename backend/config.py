# backend/config.py
"""Загрузка YAML-конфигураций страниц и сбор агрегированной конфигурации системы."""

from __future__ import annotations

import os
import yaml
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------------
# Вспомогательные функции для разбора YAML-файлов страниц
# ----------------------------------------------------------------------------

def determine_file_type(content: Dict[str, Any], filepath: str) -> str | None:
    """Грубое определение типа YAML-файла.

    Возвращает `'attrs'`, `'gui'` или `None`.
    """
    if not isinstance(content, dict):
        return None

    if "url" in content:
        return "gui"
    if "widget" in content:
        return "attrs"

    for value in content.values():
        if isinstance(value, dict) and "widget" in value:
            return "attrs"
    return "attrs"


def load_page_config(page_path: str, page_name: str) -> Dict[str, Any]:
    """Загружает **все** YAML-файлы папки страницы и формирует её конфигурацию."""
    page_config: Dict[str, Any] = {"name": page_name, "attrs": {}, "gui": {}}

    try:
        if os.path.isdir(page_path):
            yaml_files = sorted([
                os.path.join(page_path, fname)
                for fname in os.listdir(page_path)
                if fname.endswith((".yaml", ".yml"))
            ])
            for fpath in yaml_files:
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        loaded = yaml.safe_load(f) or {}
                    if not isinstance(loaded, dict):
                        logger.warning("%s не содержит словарь, пропущен", fpath)
                        continue

                    file_type = determine_file_type(loaded, fpath)
                    if file_type == "attrs":
                        page_config["attrs"].update(loaded)
                        logger.info("Загружены атрибуты: %s", fpath)
                    elif file_type == "gui":
                        page_config["gui"].update(loaded)
                        logger.info("Загружен GUI: %s", fpath)

                        # метаданные страницы
                        for key in ("url", "title", "description"):
                            if key in loaded:
                                page_config[key] = loaded[key]
                    else:
                        logger.warning("%s — неизвестный тип, пропущен", fpath)
                except Exception as e:  # pragma: no cover
                    logger.error("Ошибка загрузки %s: %s", fpath, e)
    except Exception as e:  # pragma: no cover
        logger.error("Ошибка обхода %s: %s", page_path, e)

    return page_config


def load_pages_config() -> Dict[str, Any]:
    pages_config: Dict[str, Any] = {}
    pages_dir = "pages"
    if os.path.exists(pages_dir):
        for page_folder in os.listdir(pages_dir):
            page_path = os.path.join(pages_dir, page_folder)
            if os.path.isdir(page_path):
                page_cfg = load_page_config(page_path, page_folder)
                if page_cfg:
                    pages_config[page_folder] = page_cfg
    return pages_config


# ----------------------------------------------------------------------------
# Агрегированная конфигурация всей системы
# ----------------------------------------------------------------------------

def load_config() -> Dict[str, Any]:
    config: Dict[str, Any] = {"legacy": {}}

    # страницы
    config["pages"] = load_pages_config()

    # все атрибуты
    all_attrs: Dict[str, Any] = {}
    legacy_attrs = (config.get("legacy") or {}).get("attrs") or {}
    if isinstance(legacy_attrs, dict):
        all_attrs.update(legacy_attrs)
    for page_cfg in config["pages"].values():
        all_attrs.update(page_cfg.get("attrs", {}))

    config["all_attrs"] = all_attrs
    return config
