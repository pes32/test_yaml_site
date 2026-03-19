# backend/routes_debug.py
"""Debug-панель: /debug и /api/debug/*."""

from __future__ import annotations

import logging
import os

from flask import jsonify, render_template

logger = logging.getLogger(__name__)


def register_debug_routes(app, config_service, log_file_path: str):
    """Регистрирует debug-панель и API."""

    @app.route("/debug")
    def debug_panel():
        return render_template("debug.html")

    @app.route("/api/debug/structure")
    def api_debug_structure():
        """Структура API приложения — все зарегистрированные маршруты."""
        routes = []
        for rule in app.url_map.iter_rules():
            if rule.endpoint and rule.endpoint != "static":
                routes.append({
                    "rule": str(rule.rule),
                    "methods": sorted(m for m in (rule.methods or set()) if m not in {"HEAD", "OPTIONS"}),
                    "endpoint": rule.endpoint,
                })
        routes.sort(key=lambda r: r["rule"])
        return jsonify({"routes": routes})

    @app.route("/api/debug/logs")
    def api_debug_logs():
        """Последние 1000 строк лога."""
        path = log_file_path or os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "app.log")
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            last_1000 = lines[-1000:] if len(lines) > 1000 else lines
            return jsonify({
                "lines": last_1000,
                "total": len(lines),
            })
        except FileNotFoundError:
            return jsonify({"lines": [], "total": 0, "error": "Файл лога не найден"})
        except Exception as e:
            logger.exception("Ошибка чтения файла лога: %s", path)
            return jsonify({"lines": [], "total": 0, "error": str(e)}), 500

    @app.route("/api/debug/pages")
    def api_debug_pages():
        """Информация о зарегистрированных страницах (YAML)."""
        snapshot = config_service.get_snapshot()
        pages = []
        for name, cfg in snapshot.get("pages", {}).items():
            pages.append({
                "name": name,
                "title": cfg.get("title", name),
                "url": cfg.get("url", f"/page/{name}"),
            })
        pages.sort(key=lambda p: p["name"])
        return jsonify({"pages": pages})
