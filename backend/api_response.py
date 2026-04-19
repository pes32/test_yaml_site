"""Помощники для формальных API-ответов."""

from __future__ import annotations

from typing import Any

from .contracts import ApiError, Diagnostic, PageDataResponse, PagesDataResponse
from .gui_dsl import META_KEYS


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


def public_page_config(page_config: dict[str, Any]) -> dict[str, Any]:
    """Public page config shared by page routes and page API."""

    gui = page_config.get("gui") or {}
    root_keys = page_config.get("guiMenuKeys")
    if not isinstance(root_keys, list):
        root_keys = [key for key in gui.keys() if key not in META_KEYS]

    return {
        "name": page_config.get("name"),
        "url": page_config.get("url"),
        "title": page_config.get("title"),
        "gui": gui,
        "guiMenuKeys": root_keys,
        "modalGuiIds": page_config.get("modalGuiIds") or [],
    }


def page_data_payload(page_config: dict[str, Any]) -> dict[str, Any]:
    """`data` payload for page API and HTML bootstrap."""

    return PageDataResponse(
        page=public_page_config(page_config),
        attrs=page_config.get("attrs") or {},
    ).model_dump(by_alias=True)


def pages_data_payload(snapshot: dict[str, Any]) -> dict[str, Any]:
    """`data` payload for GET /api/pages."""

    pages = [
        {
            "name": name,
            "title": cfg.get("title", name),
            "url": cfg.get("url", f"/page/{name}"),
        }
        for name, cfg in (snapshot.get("pages") or {}).items()
    ]
    return PagesDataResponse(pages=pages).model_dump(by_alias=True)
