# backend/__init__.py
"""Главная точка сборки backend-части
Формирует объект `app`, настраивает логирование, загружает конфигурацию
и регистрирует все маршруты, разбитые по модулям."""

import time
import os
import json
from flask import Flask
from flask_cors import CORS

# Отключаем ANSI-цвета в логах Werkzeug, чтобы [36m, [0m и т.п. не попадали в app.log
import werkzeug.serving
werkzeug.serving._log_add_style = False

from .logging_setup import setup_logging
from .config_service import ConfigService

# Корневая директория проекта (папка выше backend)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
VITE_MANIFEST_PATH = os.path.join(ROOT_DIR, "frontend", "dist", ".vite", "manifest.json")


def _parse_bool_env(name):
    raw = os.getenv(name)
    if raw is None:
        return None
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return None


def _debug_tooling_enabled():
    forced = _parse_bool_env("LOWCODE_ENABLE_DEBUG_ROUTES")
    if forced is not None:
        return forced

    env_name = (
        os.getenv("LOWCODE_ENV")
        or os.getenv("APP_ENV")
        or os.getenv("FLASK_ENV")
        or ""
    ).strip().lower()

    if env_name in {"prod", "production"}:
        return False

    return True


def _load_vite_manifest():
    if not os.path.isfile(VITE_MANIFEST_PATH):
        return {}
    try:
        with open(VITE_MANIFEST_PATH, "r", encoding="utf-8") as handle:
            loaded = json.load(handle)
    except (OSError, ValueError):
        return {}
    return loaded if isinstance(loaded, dict) else {}


def _vite_entry_assets(entry_name: str) -> dict:
    """Возвращает entry asset и все связанные CSS-файлы, включая imported chunks."""

    manifest = _load_vite_manifest()
    entry = manifest.get(entry_name)
    if not isinstance(entry, dict):
        return {}

    css_files: list[str] = []
    seen_chunks: set[str] = set()
    seen_css: set[str] = set()

    def _collect_css(chunk_name: str):
        if chunk_name in seen_chunks:
            return
        seen_chunks.add(chunk_name)

        chunk = manifest.get(chunk_name)
        if not isinstance(chunk, dict):
            return

        for css_file in chunk.get("css") or []:
            if not isinstance(css_file, str) or css_file in seen_css:
                continue
            seen_css.add(css_file)
            css_files.append(css_file)

        for imported_chunk in chunk.get("imports") or []:
            if isinstance(imported_chunk, str):
                _collect_css(imported_chunk)

    _collect_css(entry_name)

    return {
        "file": entry.get("file"),
        "css": css_files,
    }

# Создаём Flask-приложение, указывая реальные каталоги templates и static
app = Flask(
    __name__,
    template_folder=os.path.join(ROOT_DIR, "templates"),
    static_folder=os.path.join(ROOT_DIR, "frontend"),
    static_url_path="/frontend",  # URL, по которому отдаётся статика
)
CORS(app)
app.config["DEBUG_TOOLING_ENABLED"] = _debug_tooling_enabled()

# Busting кэша статических ассетов
app.jinja_env.globals["ASSETS_VERSION"] = int(time.time())
app.jinja_env.globals["vite_manifest"] = _load_vite_manifest
app.jinja_env.globals["vite_entry_assets"] = _vite_entry_assets

# Логирование
LOG_FILE_PATH = setup_logging(app)

try:
    # Единый live-updating snapshot конфигурации
    CONFIG_SERVICE = ConfigService(ROOT_DIR)
    CONFIG = CONFIG_SERVICE.get_snapshot()

    # ---- Регистрация маршрутов ----
    # Статические маршруты (/templates/*, favicon и т.д.) — до catch-all страниц
    from .routes_static import register_static_routes
    from .routes_pages import register_page_routes
    from .routes_api import register_api_routes
    from .routes_debug import register_debug_routes

    register_static_routes(app)
    if app.config["DEBUG_TOOLING_ENABLED"]:
        register_debug_routes(app, CONFIG_SERVICE, LOG_FILE_PATH)  # до catch-all страниц
    register_page_routes(app, CONFIG_SERVICE)
    register_api_routes(app, CONFIG_SERVICE, LOG_FILE_PATH)
except Exception:  # pragma: no cover
    app.logger.exception("Ошибка инициализации backend")
    raise

# Упрощённый экспорт
__all__ = ["app", "CONFIG", "CONFIG_SERVICE", "LOG_FILE_PATH"]
