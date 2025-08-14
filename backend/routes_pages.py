# backend/routes_pages.py
"""Маршруты, связанные с отображением страниц пользовательского интерфейса."""
from __future__ import annotations

from flask import render_template
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


def register_page_routes(app, CONFIG: Dict[str, Any]):
    """Регистрирует набор маршрутов, использующих данные `CONFIG`."""

    # ------------------------------------------------------------------
    # Вспомогательные функции
    # ------------------------------------------------------------------
    def _has_rule(path: str) -> bool:
        try:
            return any(str(r) == path for r in app.url_map.iter_rules())
        except Exception:
            return False

    def _make_page_view(page_name: str):
        def _view():
            page_config = CONFIG["pages"][page_name]
            page_config.setdefault("name", page_name)
            return render_template("page.html", page_config=page_config, all_attrs={})
        return _view

    def register_page_urls_from_config():
        for name, cfg in CONFIG.get("pages", {}).items():
            path = cfg.get("url")
            if not path:
                continue
            if not path.startswith("/"):
                path = "/" + path
            if _has_rule(path):
                continue
            endpoint = f"page_by_url__{name}"
            try:
                app.add_url_rule(path, endpoint=endpoint, view_func=_make_page_view(name))
                logger.info("Зарегистрирован маршрут страницы '%s' по URL: %s", name, path)
            except Exception as e:  # pragma: no cover
                logger.error("Не удалось зарегистрировать маршрут %s: %s", name, e)

    # регистрируем динамические URL один раз
    register_page_urls_from_config()

    # ------------------------------------------------------------------
    # Статические роуты
    # ------------------------------------------------------------------
    @app.route("/")
    def index():
        return render_template("page.html", page_config=CONFIG["pages"]["main"], all_attrs={})

    @app.route("/page/<page_name>")
    def page(page_name):
        if page_name not in CONFIG["pages"]:
            return "Страница не найдена", 404
        page_config = CONFIG["pages"][page_name]
        page_config.setdefault("name", page_name)
        return render_template("page.html", page_config=page_config, all_attrs={})
