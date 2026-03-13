# backend/routes_pages.py
"""Маршруты, связанные с отображением страниц пользовательского интерфейса."""
from __future__ import annotations

from typing import Any

from flask import abort, render_template, request


def register_page_routes(app, config_service):
    """Регистрирует стабильные page routes поверх live snapshot."""

    def _public_page_config(page_config: dict[str, Any]) -> dict[str, Any]:
        return {
            key: value
            for key, value in page_config.items()
            if key != "attrs"
        }

    def _render_page(page_config: dict[str, Any]):
        return render_template(
            "page.html",
            page_config=_public_page_config(page_config),
            all_attrs=page_config.get("attrs", {}),
        )

    @app.route("/")
    def index():
        snapshot = config_service.get_snapshot()
        page_name = snapshot["pages_by_url"].get("/") or ("main" if "main" in snapshot["pages"] else None)
        if not page_name:
            abort(404)

        page_config = snapshot["pages"].get(page_name)
        if not page_config:
            abort(404)

        return _render_page(page_config)

    @app.route("/page/<page_name>")
    def page(page_name):
        page_config = config_service.get_page(page_name)
        if not page_config:
            return "Страница не найдена", 404

        return _render_page(page_config)

    @app.route("/<path:requested_path>")
    def page_by_path(requested_path):
        page_config = config_service.get_page_by_url(request.path)
        if not page_config:
            return "Страница не найдена", 404

        return _render_page(page_config)
