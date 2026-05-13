"""Помощники для формальных API-ответов."""

from __future__ import annotations

import os
from typing import Any

from flask import jsonify, make_response, request

from .contracts import ApiError, Diagnostic, PageDataResponse, PagesDataResponse
from .db_yaml_runtime import sanitize_public_db_attrs
from .gui_dsl import META_KEYS
from .table_runtime import prepare_table_attrs_for_runtime


def _legacy_error_envelope_dupes_enabled() -> bool:
    """Временная совместимость: дублировать code/message/details на корне ответа.

    По умолчанию выключено (канон — только вложенный ``error``).
    Включить: ``YAMLS_LEGACY_ERROR_ENVELOPE_DUPES=1``.
    """

    raw = (os.environ.get("YAMLS_LEGACY_ERROR_ENVELOPE_DUPES") or "").strip().lower()
    return raw in ("1", "true", "yes")


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
    details: str | None = None,
    snapshot: dict[str, Any] | None = None,
    diagnostics: list[Diagnostic | dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Стандартная форма ошибочного ответа API."""

    snapshot_version, snapshot_created_at = _snapshot_meta(snapshot)
    err = ApiError(code=code, message=message, details=details).model_dump()
    base = {
        "ok": False,
        "snapshot_version": snapshot_version,
        "snapshot_created_at": snapshot_created_at,
        "error": err,
        "diagnostics": [_coerce_diagnostic(item) for item in diagnostics or []],
    }
    if _legacy_error_envelope_dupes_enabled():
        base["error_code"] = code
        base["message"] = message
        base["details"] = details or ""
    return base


def no_cache(resp):
    try:
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    except Exception:
        pass
    return resp


def json_response(payload: dict[str, Any], status: int = 200):
    return no_cache(make_response(jsonify(payload), status))


def snapshot_success(
    snapshot: dict[str, Any],
    data: Any,
    *,
    diagnostics: list[Diagnostic | dict[str, Any]] | None = None,
    status: int = 200,
):
    return json_response(
        success_payload(
            data=data,
            snapshot=snapshot,
            diagnostics=diagnostics if diagnostics is not None else snapshot.get("diagnostics") or [],
        ),
        status,
    )


def snapshot_error(
    snapshot: dict[str, Any],
    *,
    code: str,
    message: str,
    details: str | None = None,
    diagnostics: list[Diagnostic | dict[str, Any]] | None = None,
    status: int = 400,
):
    return json_response(
        error_payload(
            code=code,
            message=message,
            details=details,
            snapshot=snapshot,
            diagnostics=diagnostics,
        ),
        status,
    )


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
        "parsedGui": page_config.get("parsedGui") or {
            "menus": [],
            "modals": {},
            "rootContentOnly": False,
        },
        "guiMenuKeys": root_keys,
        "modalGuiIds": page_config.get("modalGuiIds") or [],
    }


def page_data_payload(page_config: dict[str, Any]) -> dict[str, Any]:
    """`data` payload for page API and HTML bootstrap."""

    page_name = str(page_config.get("name") or "")
    attrs, table_runtime = prepare_table_attrs_for_runtime(
        page_name,
        page_config.get("attrs") or {},
    )
    return PageDataResponse(
        page=public_page_config(page_config),
        attrs=sanitize_public_db_attrs(attrs),
        table_runtime=table_runtime,
    ).model_dump(by_alias=True)


def public_snapshot_payload(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Return a browser-safe snapshot without trusted YAML SQL descriptors."""

    payload = dict(snapshot or {})
    pages = {}
    for page_name, page_config in ((snapshot or {}).get("pages") or {}).items():
        public_page = dict(page_config or {})
        public_page["attrs"] = sanitize_public_db_attrs(public_page.get("attrs") or {})
        pages[page_name] = public_page
    payload["pages"] = pages
    payload["page_attrs"] = {
        page_name: sanitize_public_db_attrs(attrs or {})
        for page_name, attrs in ((snapshot or {}).get("page_attrs") or {}).items()
    }
    return payload


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
