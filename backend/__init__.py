# backend/__init__.py
"""Главная точка сборки backend-части."""

from __future__ import annotations

import json
import os
import time

from flask import Flask

# Отключаем ANSI-цвета в логах Werkzeug, чтобы [36m, [0m и т.п. не попадали в app.log
import werkzeug.serving

from .config_service import ConfigService
from .logging_setup import setup_logging


werkzeug.serving._log_add_style = False

# Корневая директория проекта (папка выше backend)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
VITE_MANIFEST_PATH = os.path.join(ROOT_DIR, "frontend", "dist", ".vite", "manifest.json")

CONFIG_SERVICE: ConfigService | None = None
CONFIG: dict | None = None
LOG_FILE_PATH: str | None = None


def _parse_bool_env(name: str):
    raw = os.getenv(name)
    if raw is None:
        return None
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return None


def _debug_tooling_enabled() -> bool:
    forced = _parse_bool_env("YAMLS_ENABLE_DEBUG_ROUTES")
    if forced is not None:
        return forced

    env_name = (
        os.getenv("YAMLS_ENV")
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
    """Возвращает entry asset и связанные CSS/JS preload-файлы из imported chunks."""

    manifest = _load_vite_manifest()
    entry = manifest.get(entry_name)
    if not isinstance(entry, dict):
        return {}

    css_files: list[str] = []
    import_files: list[str] = []
    seen_chunks: set[str] = set()
    seen_css: set[str] = set()
    seen_imports: set[str] = set()

    def _collect_chunk_assets(chunk_name: str, include_js: bool = True):
        if chunk_name in seen_chunks:
            return
        seen_chunks.add(chunk_name)

        chunk = manifest.get(chunk_name)
        if not isinstance(chunk, dict):
            return

        js_file = chunk.get("file")
        if include_js and isinstance(js_file, str) and js_file not in seen_imports:
            seen_imports.add(js_file)
            import_files.append(js_file)

        for css_file in chunk.get("css") or []:
            if not isinstance(css_file, str) or css_file in seen_css:
                continue
            seen_css.add(css_file)
            css_files.append(css_file)

        for imported_chunk in chunk.get("imports") or []:
            if isinstance(imported_chunk, str):
                _collect_chunk_assets(imported_chunk)

    _collect_chunk_assets(entry_name, include_js=False)

    return {
        "file": entry.get("file"),
        "imports": import_files,
        "css": css_files,
    }


def _sudoku_is_available() -> bool:
    try:
        from sudoku import is_sudoku_available
    except Exception:
        return False

    try:
        return bool(is_sudoku_available())
    except Exception:
        return False


def _register_optional_sudoku(app: Flask) -> None:
    if not _sudoku_is_available():
        return

    try:
        from sudoku.registrar import register_sudoku
    except Exception:
        return

    try:
        register_sudoku(app)
    except Exception:
        return


def create_app() -> Flask:
    """Создаёт и настраивает Flask-приложение."""

    global CONFIG_SERVICE, CONFIG, LOG_FILE_PATH

    app = Flask(
        __name__,
        template_folder=os.path.join(ROOT_DIR, "templates"),
        static_folder=os.path.join(ROOT_DIR, "frontend"),
        static_url_path="/frontend",
    )
    app.config["DEBUG_TOOLING_ENABLED"] = _debug_tooling_enabled()

    app.jinja_env.globals["ASSETS_VERSION"] = int(time.time())
    app.jinja_env.globals["vite_manifest"] = _load_vite_manifest
    app.jinja_env.globals["vite_entry_assets"] = _vite_entry_assets
    app.jinja_env.globals["sudoku_is_available"] = _sudoku_is_available

    LOG_FILE_PATH = setup_logging(app)

    try:
        CONFIG_SERVICE = ConfigService(ROOT_DIR)
        CONFIG = CONFIG_SERVICE.get_snapshot()

        from .routes_api import register_api_routes
        from .routes_debug import register_debug_routes
        from .routes_pages import register_page_routes
        from .routes_postgres import register_postgres_routes
        from .routes_static import register_static_routes

        register_static_routes(app)
        register_postgres_routes(app)
        _register_optional_sudoku(app)
        if app.config["DEBUG_TOOLING_ENABLED"]:
            register_debug_routes(app, CONFIG_SERVICE, LOG_FILE_PATH)
        register_page_routes(app, CONFIG_SERVICE)
        register_api_routes(app, CONFIG_SERVICE, LOG_FILE_PATH)
    except Exception:  # pragma: no cover
        app.logger.exception("Ошибка инициализации backend")
        raise

    return app


__all__ = ["create_app", "ROOT_DIR", "VITE_MANIFEST_PATH", "CONFIG", "CONFIG_SERVICE", "LOG_FILE_PATH"]
