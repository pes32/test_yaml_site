"""Hardcoded PostgreSQL tool routes."""

from __future__ import annotations

import logging
import os
import tempfile
import zipfile

from flask import render_template, send_file, url_for


logger = logging.getLogger(__name__)


def register_postgres_routes(app):
    """Register hardcoded PostgreSQL landing page and download route."""

    bundle_dir = os.path.join(app.template_folder, "sql_inspect.app")

    def _build_bundle_archive() -> str:
        bundle_parent_dir = os.path.dirname(bundle_dir)
        archive_fd, archive_path = tempfile.mkstemp(prefix="sql_inspect.", suffix=".zip")
        os.close(archive_fd)

        try:
            with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for root, dirnames, filenames in os.walk(bundle_dir):
                    dirnames.sort()
                    filenames.sort()

                    relative_root = os.path.relpath(root, bundle_parent_dir)
                    if not dirnames and not filenames:
                        archive.writestr(f"{relative_root}/", "")

                    for filename in filenames:
                        absolute_path = os.path.join(root, filename)
                        archive_name = os.path.relpath(absolute_path, bundle_parent_dir)
                        archive.write(absolute_path, archive_name)
        except Exception:
            try:
                os.unlink(archive_path)
            except OSError:
                pass
            raise

        return archive_path

    @app.route("/postgres")
    def postgres_page():
        return render_template(
            "postgres.html",
            debug_tooling_enabled=bool(app.config.get("DEBUG_TOOLING_ENABLED")),
            download_url=url_for("download_postgres_bundle"),
            header_active="postgres",
        )

    @app.route("/postgres/download")
    def download_postgres_bundle():
        if not os.path.isdir(bundle_dir):
            logger.error("Не найден bundle для скачивания: %s", bundle_dir)
            return "Файл sql_inspect.app не найден", 404

        try:
            archive_path = _build_bundle_archive()
            archive_handle = open(archive_path, "rb")
        except Exception:
            archive_path = locals().get("archive_path")
            if archive_path:
                try:
                    os.unlink(archive_path)
                except OSError:
                    pass
            logger.exception("Не удалось подготовить архив sql_inspect.app")
            return "Не удалось подготовить sql_inspect.app для скачивания", 500

        response = send_file(
            archive_handle,
            mimetype="application/zip",
            as_attachment=True,
            download_name="sql_inspect.app.zip",
            max_age=0,
        )
        response.headers["Cache-Control"] = "no-store"

        @response.call_on_close
        def _cleanup_archive():
            try:
                archive_handle.close()
            finally:
                try:
                    os.unlink(archive_path)
                except OSError:
                    logger.warning("Не удалось удалить временный архив: %s", archive_path)

        return response
