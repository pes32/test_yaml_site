# backend/routes_static.py
"""Раздача вспомогательных статических файлов, не попадающих под стандартный /static."""

from flask import jsonify, request, send_file, send_from_directory
import logging
import mimetypes
import os
from werkzeug.exceptions import NotFound

logger = logging.getLogger(__name__)


def register_static_routes(app):
    """Регистрирует вспомогательные статические маршруты."""

    def iter_favicon_candidates():
        configured_name = os.getenv("YAMLS_FAVICON_FILE", "").strip().strip("/\\")
        root_dir = os.path.dirname(app.template_folder)
        if configured_name:
            if configured_name.startswith("templates/") or configured_name.startswith("frontend/"):
                yield os.path.join(root_dir, configured_name)
            else:
                yield os.path.join(app.template_folder, configured_name)
                yield os.path.join(app.static_folder, configured_name)

        yield os.path.join(app.template_folder, "favicon.ico")
        yield os.path.join(app.template_folder, "favicon.png")
        yield os.path.join(app.template_folder, "лого_МД.png")
        yield os.path.join(app.static_folder, "favicon.ico")

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

    # favicon в корне — единая точка выдачи для frontend/templates
    @app.route("/favicon.ico")
    def favicon():  # noqa: D401
        for favicon_path in iter_favicon_candidates():
            if not os.path.isfile(favicon_path):
                continue

            mime_type = mimetypes.guess_type(favicon_path)[0] or "application/octet-stream"
            return send_file(favicon_path, mimetype=mime_type)

        raise NotFound()

    # webfonts — шрифты с явным MIME-типом (важно для @font-face)
    webfonts_dir = os.path.join(app.static_folder, "webfonts")

    @app.route("/webfonts/<path:filename>")
    def serve_webfont(filename):  # noqa: D401
        ext = os.path.splitext(filename)[1].lower()
        mime = {".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2"}.get(ext)
        return send_from_directory(webfonts_dir, filename, mimetype=mime)
