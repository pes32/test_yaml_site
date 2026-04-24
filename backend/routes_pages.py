# backend/routes_pages.py
"""Маршруты, связанные с отображением страниц пользовательского интерфейса."""

from __future__ import annotations

from flask import abort, render_template, request

from .api_response import page_data_payload, public_page_config, success_payload


def register_page_routes(app, config_service):
    """Регистрирует стабильные page routes поверх live snapshot."""

    def _page_bootstrap(snapshot, page_config):
        return success_payload(
            data=page_data_payload(page_config),
            snapshot=snapshot,
            diagnostics=list((page_config or {}).get("diagnostics") or []),
        )

    def _render_page(snapshot, page_config):
        public_page = public_page_config(page_config)
        return render_template(
            "page.html",
            debug_tooling_enabled=bool(app.config.get("DEBUG_TOOLING_ENABLED")),
            page_config=public_page,
            page_bootstrap=_page_bootstrap(snapshot, page_config),
        )

    @app.route("/")
    def index():
        snapshot = config_service.get_snapshot()
        pages = snapshot.get("pages") or {}
        page_name = (snapshot.get("pages_by_url") or {}).get("/") or ("main" if "main" in pages else None)
        if not page_name:
            abort(404)

        page_config = pages.get(page_name)
        if not page_config:
            abort(404)

        return _render_page(snapshot, page_config)

    @app.route("/page/<path:page_name>")
    def page(page_name):
        snapshot = config_service.get_snapshot()
        page_config = (snapshot.get("pages") or {}).get(str(page_name or "").strip())
        if not page_config:
            return "Страница не найдена", 404

        return _render_page(snapshot, page_config)

    @app.route("/<path:requested_path>")
    def page_by_path(requested_path):
        snapshot = config_service.get_snapshot()
        page_name = (snapshot.get("pages_by_url") or {}).get(request.path)
        if not page_name:
            return "Страница не найдена", 404

        page_config = (snapshot.get("pages") or {}).get(page_name)
        if not page_config:
            return "Страница не найдена", 404

        return _render_page(snapshot, page_config)
