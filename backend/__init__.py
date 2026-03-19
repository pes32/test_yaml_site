# backend/__init__.py
"""Главная точка сборки backend-части
Формирует объект `app`, настраивает логирование, загружает конфигурацию
и регистрирует все маршруты, разбитые по модулям."""

import time
import os
from flask import Flask
from flask_cors import CORS

# Отключаем ANSI-цвета в логах Werkzeug, чтобы [36m, [0m и т.п. не попадали в app.log
import werkzeug.serving
werkzeug.serving._log_add_style = False

from .logging_setup import setup_logging
from .config_service import ConfigService

# Корневая директория проекта (папка выше backend)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

# Создаём Flask-приложение, указывая реальные каталоги templates и static
app = Flask(
    __name__,
    template_folder=os.path.join(ROOT_DIR, "templates"),
    static_folder=os.path.join(ROOT_DIR, "frontend"),
    static_url_path="/frontend",  # URL, по которому отдаётся статика
)
CORS(app)

# Busting кэша статических ассетов
app.jinja_env.globals["ASSETS_VERSION"] = int(time.time())

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
    register_debug_routes(app, CONFIG_SERVICE, LOG_FILE_PATH)  # до catch-all страниц
    register_page_routes(app, CONFIG_SERVICE)
    register_api_routes(app, CONFIG_SERVICE, LOG_FILE_PATH)
except Exception:  # pragma: no cover
    app.logger.exception("Ошибка инициализации backend")
    raise

# Упрощённый экспорт
__all__ = ["app", "CONFIG", "CONFIG_SERVICE", "LOG_FILE_PATH"]
