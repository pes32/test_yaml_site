"""Нормализация YAML GUI DSL и извлечение runtime-зависимостей."""

from __future__ import annotations

from typing import Any


META_KEYS = {"url", "title", "description"}
ROOT_CONTENT_TYPES = {"row", "rows", "widgets", "box", "collapse", "icon", "tab", "button"}


def parse_dynamic_key(raw_key: Any) -> tuple[str, str]:
    """Разбор ключа вида `menu "Главная"` -> (`menu`, `Главная`)."""
    key = str(raw_key or "").strip()
    if not key:
        return "", ""

    if '"' not in key:
        return key, ""

    head, _, tail = key.partition('"')
    name, _, _rest = tail.partition('"')
    return head.strip(), name


def split_names(value: Any) -> list[str]:
    """Разбирает CSV / list / scalar в список имён виджетов."""
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(split_names(item))
        return [item for item in result if item]

    if value is None:
        return []

    return [item.strip() for item in str(value).split(",") if item.strip()]


def normalize_row_entry(entry: Any) -> list[Any]:
    """Нормализует элемент строки в runtime-представление."""
    if entry is None:
        return []

    if isinstance(entry, str):
        return [entry]

    if isinstance(entry, list):
        result: list[Any] = []
        for item in entry:
            result.extend(normalize_row_entry(item))
        return result

    if not isinstance(entry, dict):
        return []

    first_entry = next(iter(entry.items()), None)
    if not first_entry:
        return []

    raw_key, raw_value = first_entry
    entry_type, _name = parse_dynamic_key(raw_key)

    if entry_type in {"row", "widgets"}:
        widgets = split_names(raw_value)
        return [{"widgets": widgets}] if widgets else []

    if entry_type == "rows":
        return normalize_rows(raw_value)

    return []


def normalize_rows(value: Any) -> list[Any]:
    """Нормализует набор rows/row/widgets в единый список row-элементов."""
    if isinstance(value, list):
        result: list[Any] = []
        for item in value:
            result.extend(normalize_row_entry(item))
        return result

    if value is None:
        return []

    return normalize_row_entry({"row": value})


def create_section(section_type: str, name: str, *, has_frame: bool = False) -> dict[str, Any]:
    """Создаёт нормализованную секцию контента."""
    normalized_type = "collapse" if section_type == "collapse" else "box"
    return {
        "type": normalized_type,
        "name": name or "",
        "icon": "",
        "rows": [],
        "collapsible": normalized_type == "collapse",
        "showHeader": bool(name),
        "hasFrame": bool(has_frame),
    }


def add_rows_to_section(section: dict[str, Any], entry_type: str, value: Any) -> None:
    """Добавляет runtime rows в секцию."""
    if entry_type == "rows":
        rows = normalize_rows(value)
    elif entry_type == "widgets":
        rows = normalize_row_entry({"widgets": value})
    else:
        rows = normalize_row_entry({"row": value})

    section["rows"].extend(rows)


def normalize_section(section_type: str, name: str, body: Any) -> dict[str, Any]:
    """Нормализует box/collapse секцию."""
    section = create_section(section_type, name, has_frame=True)

    if isinstance(body, list):
        for item in body:
            if isinstance(item, str):
                section["rows"].append(item)
                continue

            if not isinstance(item, dict):
                continue

            first_entry = next(iter(item.items()), None)
            if not first_entry:
                continue

            raw_key, raw_value = first_entry
            entry_type, _entry_name = parse_dynamic_key(raw_key)

            if entry_type == "icon":
                section["icon"] = str(raw_value or "").strip()
                continue

            if entry_type in {"row", "rows", "widgets"}:
                add_rows_to_section(section, entry_type, raw_value)

        return section

    add_rows_to_section(section, "row", body)
    return section


def normalize_content_items(items: Any) -> dict[str, Any]:
    """Нормализует список элементов меню/модалки в единый runtime-контракт."""
    content: list[dict[str, Any]] = []
    tabs: list[dict[str, Any]] = []
    buttons: list[str] = []
    icon = ""
    loose_section = create_section("box", "")

    def flush_loose_section() -> None:
        nonlocal loose_section
        if not loose_section["rows"]:
            return
        content.append(loose_section)
        loose_section = create_section("box", "")

    if not isinstance(items, list):
        return {
            "icon": icon,
            "tabs": tabs,
            "content": content,
            "buttons": buttons,
        }

    for item in items:
        if isinstance(item, str):
            loose_section["rows"].append(item)
            continue

        if not isinstance(item, dict):
            continue

        first_entry = next(iter(item.items()), None)
        if not first_entry:
            continue

        raw_key, raw_value = first_entry
        entry_type, entry_name = parse_dynamic_key(raw_key)

        if entry_type == "icon":
            icon = str(raw_value or "").strip()
            continue

        if entry_type == "button":
            buttons.extend(split_names(raw_value))
            continue

        if entry_type == "tab":
            flush_loose_section()
            tabs.append(normalize_tab(entry_name, raw_value))
            continue

        if entry_type in {"box", "collapse"}:
            flush_loose_section()
            content.append(normalize_section(entry_type, entry_name, raw_value))
            continue

        if entry_type in {"row", "rows", "widgets"}:
            add_rows_to_section(loose_section, entry_type, raw_value)

    flush_loose_section()

    return {
        "icon": icon,
        "tabs": tabs,
        "content": content,
        "buttons": buttons,
    }


def normalize_tab(name: str, items: Any) -> dict[str, Any]:
    """Нормализует вкладку."""
    normalized = normalize_content_items(items)
    return {
        "name": name or "",
        "icon": normalized["icon"],
        "content": normalized["content"],
    }


def normalize_modal_runtime(
    modal_id: str,
    modal_name: str,
    items: Any,
    *,
    icon: str | None,
) -> dict[str, Any]:
    """Собирает runtime-представление модалки."""
    normalized = normalize_content_items(items)
    return {
        "id": modal_id,
        "name": modal_name or modal_id,
        "title": modal_name or modal_id,
        "icon": (icon or normalized["icon"] or "").strip() or None,
        "tabs": normalized["tabs"],
        "content": normalized["content"],
        "buttons": normalized["buttons"],
    }


def collect_widget_names_from_rows(rows: list[Any], names: set[str] | None = None) -> set[str]:
    """Собирает имена виджетов из runtime rows."""
    target = names or set()
    if not isinstance(rows, list):
        return target

    for row in rows:
        if not isinstance(row, dict):
            continue

        widgets = row.get("widgets")
        if isinstance(widgets, list):
            for widget_name in widgets:
                token = str(widget_name or "").strip()
                if token:
                    target.add(token)

    return target


def collect_widget_names_from_sections(sections: list[dict[str, Any]], buttons: list[str] | None = None) -> list[str]:
    """Собирает имена виджетов из runtime sections и кнопок."""
    names: set[str] = set()

    if isinstance(sections, list):
        for section in sections:
            if not isinstance(section, dict):
                continue
            collect_widget_names_from_rows(section.get("rows") or [], names)

    if isinstance(buttons, list):
        for button_name in buttons:
            token = str(button_name or "").strip()
            if token and token != "CLOSE":
                names.add(token)

    return sorted(names)


def collect_widget_names_from_modal(modal: dict[str, Any]) -> list[str]:
    """Собирает виджеты, требуемые модалкой."""
    names: set[str] = set()

    for section in modal.get("content") or []:
        if not isinstance(section, dict):
            continue
        collect_widget_names_from_rows(section.get("rows") or [], names)

    for tab in modal.get("tabs") or []:
        if not isinstance(tab, dict):
            continue
        for section in tab.get("content") or []:
            if not isinstance(section, dict):
                continue
            collect_widget_names_from_rows(section.get("rows") or [], names)

    for button_name in modal.get("buttons") or []:
        token = str(button_name or "").strip()
        if token and token != "CLOSE":
            names.add(token)

    return sorted(names)


def gui_root_keys(gui: dict[str, Any]) -> list[str]:
    """Порядок корневых ключей GUI без meta-полей."""
    return [key for key in gui.keys() if key not in META_KEYS]


def extract_embedded_modals(gui: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Извлекает встроенные модалки из gui.yaml."""
    modals: dict[str, dict[str, Any]] = {}

    for key, value in gui.items():
        if key in META_KEYS:
            continue

        entry_type, entry_name = parse_dynamic_key(key)
        if entry_type == "menu" or entry_type in ROOT_CONTENT_TYPES:
            continue

        runtime = normalize_modal_runtime(entry_type, entry_name or entry_type, value, icon=None)
        runtime["widgetNames"] = collect_widget_names_from_modal(runtime)
        modals[entry_type] = runtime

    return modals

