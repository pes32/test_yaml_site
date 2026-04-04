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
    documentation_dir = os.path.join(app.template_folder, "Документация")

    def _build_directory_archive(source_dir: str, *, archive_prefix: str, base_dir: str) -> str:
        archive_fd, archive_path = tempfile.mkstemp(prefix=archive_prefix, suffix=".zip")
        os.close(archive_fd)

        try:
            with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for root, dirnames, filenames in os.walk(source_dir):
                    dirnames.sort()
                    filenames.sort()

                    relative_root = os.path.relpath(root, base_dir)
                    if not dirnames and not filenames:
                        archive.writestr(f"{relative_root}/", "")

                    for filename in filenames:
                        absolute_path = os.path.join(root, filename)
                        archive_name = os.path.relpath(absolute_path, base_dir)
                        archive.write(absolute_path, archive_name)
        except Exception:
            try:
                os.unlink(archive_path)
            except OSError:
                pass
            raise

        return archive_path

    def _send_directory_archive(
        *,
        source_dir: str,
        archive_prefix: str,
        download_name: str,
        not_found_message: str,
        preparation_error_message: str,
        preparation_log_message: str,
        base_dir: str | None = None,
    ):
        if not os.path.isdir(source_dir):
            logger.error("Не найдена папка для скачивания: %s", source_dir)
            return not_found_message, 404

        archive_base_dir = base_dir or os.path.dirname(source_dir)

        try:
            archive_path = _build_directory_archive(
                source_dir,
                archive_prefix=archive_prefix,
                base_dir=archive_base_dir,
            )
            archive_handle = open(archive_path, "rb")
        except Exception:
            archive_path = locals().get("archive_path")
            if archive_path:
                try:
                    os.unlink(archive_path)
                except OSError:
                    pass
            logger.exception(preparation_log_message)
            return preparation_error_message, 500

        response = send_file(
            archive_handle,
            mimetype="application/zip",
            as_attachment=True,
            download_name=download_name,
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

    @app.route("/postgres")
    def postgres_page():
        return render_template(
            "postgres.html",
            debug_tooling_enabled=bool(app.config.get("DEBUG_TOOLING_ENABLED")),
            download_url=url_for("download_postgres_bundle"),
            documentation_url=url_for("download_postgres_documentation"),
            header_active="postgres",
        )

    @app.route("/postgres/download")
    def download_postgres_bundle():
        return _send_directory_archive(
            source_dir=bundle_dir,
            archive_prefix="sql_inspect.",
            download_name="sql_inspect.app.zip",
            not_found_message="Файл sql_inspect.app не найден",
            preparation_error_message="Не удалось подготовить sql_inspect.app для скачивания",
            preparation_log_message="Не удалось подготовить архив sql_inspect.app",
            base_dir=os.path.dirname(bundle_dir),
        )

    @app.route("/postgres/documentation")
    def download_postgres_documentation():
        return _send_directory_archive(
            source_dir=documentation_dir,
            archive_prefix="postgres_docs.",
            download_name="sql_inspect_documentation.zip",
            not_found_message="Папка с документацией не найдена",
            preparation_error_message="Не удалось подготовить документацию для скачивания",
            preparation_log_message="Не удалось подготовить архив документации",
            base_dir=documentation_dir,
        )
