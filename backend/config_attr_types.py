"""Primitive attr option validators."""

from __future__ import annotations

from typing import Any


def _is_scalar_attr_value(value: Any) -> bool:
    return not isinstance(value, (dict, list))


def _is_string_attr_value(value: Any) -> bool:
    return isinstance(value, str)


def _is_scalar_sequence(value: Any) -> bool:
    return isinstance(value, list) and all(_is_scalar_attr_value(item) for item in value)


def _is_widget_name_list_value(value: Any) -> bool:
    return _is_string_attr_value(value) or (
        isinstance(value, list) and all(_is_string_attr_value(item) for item in value)
    )


def _is_string_list_value(value: Any) -> bool:
    return isinstance(value, list) and all(_is_string_attr_value(item) for item in value)


def _is_bool_attr_value(value: Any) -> bool:
    return isinstance(value, bool)


def _is_int_attr_value(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_dialog_value(value: Any) -> bool:
    return isinstance(value, dict)


def _is_list_source_option(item: Any) -> bool:
    if _is_scalar_attr_value(item):
        return True
    if not isinstance(item, dict):
        return False
    allowed_keys = {"id", "label", "value"}
    if not set(item.keys()).issubset(allowed_keys):
        return False
    return all(_is_scalar_attr_value(option_value) for option_value in item.values())


def _is_source_value_valid(widget_type: str, value: Any) -> bool:
    if widget_type == "list":
        if _is_scalar_attr_value(value):
            return True
        return isinstance(value, list) and all(_is_list_source_option(item) for item in value)
    if widget_type == "voc":
        if _is_string_attr_value(value):
            return True
        return isinstance(value, list) and all(
            _is_scalar_attr_value(item) or _is_scalar_sequence(item) for item in value
        )
    if widget_type in {"button", "split_button", "img"}:
        return _is_string_attr_value(value)
    if widget_type == "table":
        return _is_scalar_attr_value(value) or isinstance(value, list)
    return True


def _validate_attr_option_value(widget_type: str, option_name: str, value: Any) -> str | None:
    if option_name == "select_attrs" and not _is_widget_name_list_value(value):
        return "ожидается строка или список строк"
    if option_name == "dialog" and not _is_dialog_value(value):
        return "ожидается словарь"
    if option_name == "columns" and not _is_string_list_value(value):
        return "ожидается список строк"
    if option_name == "rows" and not _is_int_attr_value(value):
        return "ожидается целое число"

    if option_name in {
        "readonly",
        "editable",
        "multiselect",
        "fon",
        "abc",
        "line_numbers",
        "sort",
        "sticky_header",
        "toolbar",
        "zebra",
    } and not _is_bool_attr_value(value):
        return "ожидается булево значение"

    if option_name == "row" and not _is_int_attr_value(value):
        return "ожидается целое число"

    if option_name == "source" and not _is_source_value_valid(widget_type, value):
        if widget_type == "list":
            return "ожидается строка, список строк или список options-объектов"
        if widget_type == "voc":
            return "ожидается block-scalar строка, список строк или список строковых рядов"
        if widget_type in {"button", "split_button", "img"}:
            return "ожидается строка"
        if widget_type == "table":
            return "ожидается строка или список строк"

    return None
