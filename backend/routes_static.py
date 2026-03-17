# backend/routes_static.py
"""Раздача вспомогательных статических файлов, не попадающих под стандартный /static."""

from flask import send_from_directory
import logging
import os

logger = logging.getLogger(__name__)


def register_static_routes(app):
    """Регистрирует вспомогательные статические маршруты."""

    # Каталог icons расположен внутри общей папки templates
    icons_dir = os.path.join(app.template_folder, "icons")
    templates_dir = app.template_folder

    @app.route("/templates/icons/<path:filename>")
    def serve_icon(filename):  # noqa: D401 (simple function)
        """Отдаёт SVG-иконки из каталога templates/icons."""
        try:
            return send_from_directory(icons_dir, filename, mimetype="image/svg+xml")
        except Exception as exc:  # pragma: no cover
            logger.error("Ошибка при загрузке иконки %s: %s", filename, exc)
            return f"Ошибка загрузки иконки: {exc}", 500

    @app.route("/templates/<path:filename>")
    def serve_template_file(filename):  # noqa: D401
        """Отдаёт файлы (изображения и пр.) из каталога templates."""
        try:
            return send_from_directory(templates_dir, filename)
        except Exception as exc:  # pragma: no cover
            logger.error("Ошибка при загрузке файла %s: %s", filename, exc)
            return f"Ошибка загрузки: {exc}", 500

    # favicon в корне — переброс к файлу во frontend
    @app.route("/favicon.ico")
    def favicon():  # noqa: D401
        return send_from_directory(app.static_folder, "favicon.ico", mimetype="image/x-icon")

