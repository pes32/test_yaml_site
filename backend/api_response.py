"""Помощники для формальных API-ответов."""

from __future__ import annotations

from typing import Any

from .contracts import ApiError, Diagnostic


def _coerce_diagnostic(item: Diagnostic | dict[str, Any]) -> dict[str, Any]:
    if isinstance(item, Diagnostic):
        return item.model_dump()
    return dict(item)


def _snapshot_meta(snapshot: dict[str, Any] | None) -> tuple[str | None, str | None]:
    meta = (snapshot or {}).get("meta") or {}
    return meta.get("version"), meta.get("created_at")


def success_payload(
    *,
    data: Any,
    snapshot: dict[str, Any] | None = None,
    diagnostics: list[Diagnostic | dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Стандартная форма успешного ответа API."""

    snapshot_version, snapshot_created_at = _snapshot_meta(snapshot)
    return {
        "ok": True,
        "snapshot_version": snapshot_version,
        "snapshot_created_at": snapshot_created_at,
        "data": data,
        "diagnostics": [_coerce_diagnostic(item) for item in diagnostics or []],
    }


def error_payload(
    *,
    code: str,
    message: str,
    snapshot: dict[str, Any] | None = None,
    diagnostics: list[Diagnostic | dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Стандартная форма ошибочного ответа API."""

    snapshot_version, snapshot_created_at = _snapshot_meta(snapshot)
    return {
        "ok": False,
        "snapshot_version": snapshot_version,
        "snapshot_created_at": snapshot_created_at,
        "error": ApiError(code=code, message=message).model_dump(),
        "diagnostics": [_coerce_diagnostic(item) for item in diagnostics or []],
    }
