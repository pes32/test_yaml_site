"""GUI/page validation orchestration and attr diagnostics."""

from __future__ import annotations

from typing import Any

from .config_attr_validation import _collect_attr_definitions, _collect_attr_refs
from .config_files import collect_page_scope_files
from .config_gui_content_validation import _validate_gui_document, _validate_modal_documents
from .config_shared import make_diagnostic
from .contracts import Diagnostic


def _build_missing_attr_diagnostics(
    refs: list[dict[str, Any]],
    page_name: str,
    page_attrs: dict[str, Any],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    seen: set[tuple[str, int | None, str]] = set()

    for ref in refs:
        attr_name = str(ref.get("name") or "").strip()
        if not attr_name or attr_name in page_attrs:
            continue

        key = (str(ref.get("file") or ""), ref.get("line"), attr_name)
        if key in seen:
            continue
        seen.add(key)

        line = ref.get("line")
        url = str(ref.get("url") or "")
        diagnostics.append(
            make_diagnostic(
                "error",
                "missing_attr_reference",
                f'url: "{url}" - {"стр." + str(line) if line else "стр.?"}: {attr_name}',
                page=page_name,
                file=ref.get("file"),
                line=line,
                url=url,
                node_path=attr_name,
            )
        )

    return diagnostics


def _build_duplicate_attr_diagnostics(attr_definitions: list[dict[str, Any]]) -> list[Diagnostic]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in attr_definitions:
        grouped.setdefault((str(item.get("page") or ""), str(item.get("name") or "")), []).append(item)

    diagnostics: list[Diagnostic] = []
    for (_page_name, attr_name), items in sorted(grouped.items()):
        if len(items) < 2:
            continue
        locations = "; ".join(
            f"{entry['file']} - стр.{entry['line'] or '?'}"
            for entry in items
        )
        diagnostics.append(
            make_diagnostic(
                "warning",
                "duplicate_attr",
                f"Обнаружен дубликат attrs {attr_name}: {locations}.",
                file=items[0]["file"],
                line=items[0]["line"],
                node_path=attr_name,
            )
        )
    return diagnostics


def _build_unused_attr_diagnostics(
    attr_definitions: list[dict[str, Any]],
    refs_by_page: dict[str, list[dict[str, Any]]],
) -> list[Diagnostic]:
    used_names_by_page = {
        page_name: {str(ref.get("name") or "").strip() for ref in refs}
        for page_name, refs in refs_by_page.items()
    }

    return [
        make_diagnostic(
            "warning",
            "unused_attr",
            f"{entry['file']} - стр.{entry['line'] or '?'}: {entry['name']}",
            page=entry["page"],
            file=entry["file"],
            line=entry["line"],
            node_path=entry["name"],
        )
        for entry in attr_definitions
        if str(entry.get("file") or "").startswith(f"pages/{entry['page']}/")
        and entry["name"] not in used_names_by_page.get(entry["page"], set())
    ]


def _validate_page_documents(
    page_path: str,
    page_name: str,
    page_url: str,
    page_attrs: dict[str, Any],
    *,
    pages_dir: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[Diagnostic]]:
    gui_file, attr_files, modal_files = collect_page_scope_files(page_path, page_name, pages_dir)

    attr_definitions = _collect_attr_definitions(attr_files, page_name)
    attr_refs = _collect_attr_refs(attr_files, page_name=page_name, page_url=page_url)
    gui_refs, gui_diagnostics = _validate_gui_document(gui_file, page_name=page_name, page_url=page_url)
    modal_refs, modal_diagnostics = _validate_modal_documents(
        modal_files,
        page_name=page_name,
        page_url=page_url,
    )

    refs = [*gui_refs, *modal_refs, *attr_refs]
    diagnostics = [*gui_diagnostics, *modal_diagnostics]
    diagnostics.extend(_build_missing_attr_diagnostics(refs, page_name, page_attrs))
    return attr_definitions, refs, diagnostics
