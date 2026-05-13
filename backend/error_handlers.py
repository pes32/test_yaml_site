"""Глобальные обработчики ошибок: маршруты /api/* отдают JSON-конверт, не HTML."""

from __future__ import annotations

import traceback

from flask import Flask, request
from werkzeug.exceptions import HTTPException, InternalServerError

from .api_response import error_payload, json_response
from .database_errors import classify_db_error


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(Exception)
    def handle_exception(exc: Exception):
        if isinstance(exc, HTTPException):
            if request.path.startswith("/api/"):
                return json_response(
                    error_payload(
                        code=f"http_{exc.code}",
                        message=str(exc.description or exc.name),
                        details=str(exc),
                    ),
                    exc.code or 500,
                )
            return exc.get_response(environ=request.environ)

        app.logger.exception("Необработанное исключение")
        if request.path.startswith("/api/"):
            details = str(exc).strip()
            spec = classify_db_error(exc)
            if spec is not None:
                code = spec.code
                message = spec.message
                status = spec.status
            else:
                code = "internal_error"
                message = "Внутренняя ошибка сервера"
                status = 500
            if app.debug:
                details = "".join(traceback.format_exception(exc)).strip()
            return json_response(
                error_payload(
                    code=code,
                    message=message,
                    details=details or repr(exc),
                ),
                status,
            )

        return InternalServerError().get_response(environ=request.environ)
