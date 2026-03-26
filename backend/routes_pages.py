# backend/routes_pages.py
"""Маршруты, связанные с отображением страниц пользовательского интерфейса."""

from __future__ import annotations

from typing import Any

from flask import abort, render_template, request

from .api_response import success_payload


META_KEYS = frozenset({"url", "title", "description"})


def register_page_routes(app, config_service):
    """Регистрирует стабильные page routes поверх live snapshot."""

    def _public_page_config(page_config: dict[str, Any]) -> dict[str, Any]:
        gui = page_config.get("gui") or {}
        root_keys = page_config.get("guiMenuKeys")
        if not isinstance(root_keys, list):
            root_keys = [key for key in gui.keys() if key not in META_KEYS]

        return {
            "name": page_config.get("name"),
            "url": page_config.get("url"),
            "title": page_config.get("title"),
            "gui": gui,
            "guiMenuKeys": root_keys,
            "modalGuiIds": page_config.get("modalGuiIds") or [],
        }

    def _page_bootstrap(snapshot: dict[str, Any], page_config: dict[str, Any]) -> dict[str, Any]:
        public_page = _public_page_config(page_config)
        attrs = page_config.get("attrs") or {}
        return success_payload(
            data={"page": public_page, "attrs": attrs},
            snapshot=snapshot,
            diagnostics=page_config.get("diagnostics") or [],
        )

    def _render_page(snapshot: dict[str, Any], page_config: dict[str, Any]):
        public_page = _public_page_config(page_config)
        return render_template(
            "page.html",
            page_config=public_page,
            page_bootstrap=_page_bootstrap(snapshot, page_config),
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

        return _render_page(snapshot, page_config)

    @app.route("/page/<page_name>")
    def page(page_name):
        snapshot = config_service.get_snapshot()
        page_config = snapshot["pages"].get(page_name)
        if not page_config:
            return "Страница не найдена", 404

        return _render_page(snapshot, page_config)

    @app.route("/<path:requested_path>")
    def page_by_path(requested_path):
        snapshot = config_service.get_snapshot()
        page_name = snapshot["pages_by_url"].get(request.path)
        if not page_name:
            return "Страница не найдена", 404

        page_config = snapshot["pages"].get(page_name)
        if not page_config:
            return "Страница не найдена", 404

        return _render_page(snapshot, page_config)
