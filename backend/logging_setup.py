# backend/logging_setup.py
"""Настройка логирования с ротацией."""

import os
import logging
from logging.handlers import RotatingFileHandler
from typing import TYPE_CHECKING

if TYPE_CHECKING:
	from flask import Flask  # pragma: no cover

def setup_logging(app: "Flask") -> str:
	"""Настраивает логирование в файл `logs/app.log` с ротацией.

	Возвращает путь к лог-файлу.
	"""
	log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "logs")
	os.makedirs(log_dir, exist_ok=True)
	log_file = os.path.join(log_dir, "app.log")

	# Базовый конфиг уровня
	logging.basicConfig(level=logging.INFO)
	formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")

	file_handler = RotatingFileHandler(log_file, maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8")
	file_handler.setLevel(logging.INFO)
	file_handler.setFormatter(formatter)

	# ВНИМАНИЕ: хендлер вешаем ТОЛЬКО на root-логгер, чтобы избежать дублей
	root_logger = logging.getLogger()
	if not any(isinstance(h, RotatingFileHandler) for h in root_logger.handlers):
		root_logger.addHandler(file_handler)

	# Не добавляем хендлеров к app.logger — пусть сообщения всплывают к root
	app.logger.setLevel(logging.INFO)
	app.logger.propagate = True

	return log_file
