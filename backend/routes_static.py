# backend/routes_static.py
"""Раздача вспомогательных статических файлов, не попадающих под стандартный /static."""

from flask import jsonify, request, send_from_directory
import logging
import os
from werkzeug.exceptions import NotFound

logger = logging.getLogger(__name__)


def register_static_routes(app):
    """Регистрирует вспомогательные статические маршруты."""

    @app.route("/healthz")
    def healthz():  # noqa: D401
        """Технический endpoint для readiness/health checks."""
        return jsonify(
            {
                "ok": True,
                "scheme": request.scheme,
                "is_secure": request.is_secure,
                "host": request.host,
                "url_root": request.url_root,
            }
        )

    # Каталог icons расположен внутри общей папки templates
    icons_dir = os.path.join(app.template_folder, "icons")
    templates_dir = app.template_folder

    @app.route("/templates/icons/<path:filename>")
    def serve_icon(filename):  # noqa: D401 (simple function)
        """Отдаёт SVG-иконки из каталога templates/icons."""
        try:
            return send_from_directory(icons_dir, filename, mimetype="image/svg+xml")
        except NotFound:
            raise
        except Exception as exc:  # pragma: no cover
            logger.exception("Ошибка при загрузке иконки %s", filename)
            return f"Ошибка загрузки иконки: {exc}", 500

    @app.route("/templates/<path:filename>")
    def serve_template_file(filename):  # noqa: D401
        """Отдаёт файлы (изображения и пр.) из каталога templates."""
        try:
            return send_from_directory(templates_dir, filename)
        except NotFound:
            raise
        except Exception as exc:  # pragma: no cover
            logger.exception("Ошибка при загрузке файла %s", filename)
            return f"Ошибка загрузки: {exc}", 500

    # favicon в корне — переброс к файлу во frontend
    @app.route("/favicon.ico")
    def favicon():  # noqa: D401
        return send_from_directory(app.static_folder, "favicon.ico", mimetype="image/x-icon")

    # webfonts — шрифты с явным MIME-типом (важно для @font-face)
    webfonts_dir = os.path.join(app.static_folder, "webfonts")

    @app.route("/webfonts/<path:filename>")
    def serve_webfont(filename):  # noqa: D401
        ext = os.path.splitext(filename)[1].lower()
        mime = {".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2"}.get(ext)
        return send_from_directory(webfonts_dir, filename, mimetype=mime)
