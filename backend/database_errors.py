"""Классификация ошибок БД → канонический код/сообщение/HTTP-статус для API."""

from __future__ import annotations

from dataclasses import dataclass

import psycopg2


@dataclass(frozen=True)
class ApiErrorSpec:
    code: str
    message: str
    status: int


def classify_db_error(exc: BaseException) -> ApiErrorSpec | None:
    """Распознаёт текущий драйвер (psycopg2). Возвращает None, если это не «наша» ошибка БД."""
    if isinstance(exc, psycopg2.OperationalError):
        return ApiErrorSpec(
            code="DB_CONNECTION_ERROR",
            message="Ошибка подключения к БД",
            status=503,
        )
    if isinstance(exc, psycopg2.Error):
        return ApiErrorSpec(
            code="DB_ERROR",
            message="Ошибка базы данных",
            status=503,
        )
    return None
