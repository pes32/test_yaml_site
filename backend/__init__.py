# backend/__init__.py
"""Главная точка сборки backend-части
Формирует объект `app`, настраивает логирование, загружает конфигурацию
и регистрирует все маршруты, разбитые по модулям."""

import time
import os
from flask import Flask
from flask_cors import CORS

from .logging_setup import setup_logging
from .config import load_config

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

# Глобальная конфигурация системы
CONFIG = load_config()

# ---- Регистрация маршрутов ----
from .routes_pages import register_page_routes
from .routes_api import register_api_routes
from .routes_debug import register_debug_routes
from .routes_static import register_static_routes

register_page_routes(app, CONFIG)
register_api_routes(app, CONFIG, LOG_FILE_PATH)
register_debug_routes(app, CONFIG, LOG_FILE_PATH)
register_static_routes(app)

# Упрощённый экспорт
__all__ = ["app", "CONFIG", "LOG_FILE_PATH"]
