# backend/logging_setup.py
"""Настройка логирования с ротацией."""

from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from typing import TYPE_CHECKING

from flask.logging import default_handler

if TYPE_CHECKING:
    from flask import Flask  # pragma: no cover


LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"
CONSOLE_LEVEL = logging.WARNING
FILE_LEVEL = logging.ERROR


def _configure_console_handler(root_logger: logging.Logger, formatter: logging.Formatter) -> None:
    console_handler = next(
        (
            handler
            for handler in root_logger.handlers
            if isinstance(handler, logging.StreamHandler)
            and not isinstance(handler, RotatingFileHandler)
        ),
        None,
    )

    if console_handler is None:
        console_handler = logging.StreamHandler()
        root_logger.addHandler(console_handler)

    console_handler.setLevel(CONSOLE_LEVEL)
    console_handler.setFormatter(formatter)


def _configure_file_handler(
    root_logger: logging.Logger,
    log_file: str,
    formatter: logging.Formatter,
) -> None:
    normalized_log_file = os.path.abspath(log_file)
    file_handler = next(
        (
            handler
            for handler in root_logger.handlers
            if isinstance(handler, RotatingFileHandler)
            and os.path.abspath(getattr(handler, "baseFilename", "")) == normalized_log_file
        ),
        None,
    )

    if file_handler is None:
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=2 * 1024 * 1024,
            backupCount=3,
            encoding="utf-8",
        )
        root_logger.addHandler(file_handler)

    file_handler.setLevel(FILE_LEVEL)
    file_handler.setFormatter(formatter)


def setup_logging(app: "Flask") -> str:
    """Настраивает логирование в файл `logs/app.log` с ротацией.

    Возвращает путь к лог-файлу.
    """
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "app.log")

    formatter = logging.Formatter(LOG_FORMAT)
    root_logger = logging.getLogger()
    root_logger.setLevel(CONSOLE_LEVEL)

    _configure_console_handler(root_logger, formatter)
    _configure_file_handler(root_logger, log_file, formatter)

    # Убираем поток GET /frontend/... и подобных строк из app.log.
    logging.getLogger("werkzeug").setLevel(logging.ERROR)

    # Не добавляем хендлеров к app.logger — пусть сообщения всплывают к root.
    if default_handler in app.logger.handlers:
        app.logger.removeHandler(default_handler)
    app.logger.setLevel(logging.ERROR)
    app.logger.propagate = True

    return log_file
