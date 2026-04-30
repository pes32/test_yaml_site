"""Attr widget schema definitions."""

from __future__ import annotations

from typing import Any


ATTR_WIDGET_SCHEMA: dict[str, dict[str, Any]] = {
    "img": {
        "allowed": frozenset({"widget", "label", "source", "sup_text", "width"}),
    },
    "text": {
        "allowed": frozenset(
            {
                "widget",
                "label",
                "default",
                "err_text",
                "placeholder",
                "readonly",
                "regex",
                "rows",
                "sup_text",
                "width",
            }
        ),
    },
    "button": {
        "allowed": frozenset(
            {
                "widget",
                "command",
                "dialog",
                "fon",
                "hint",
                "icon",
                "label",
                "select_attrs",
                "size",
                "source",
                "sup_text",
                "url",
                "width",
            }
        ),
    },
    "split_button": {
        "allowed": frozenset(
            {
                "widget",
                "command",
                "dialog",
                "fon",
                "hint",
                "icon",
                "label",
                "select_attrs",
                "size",
                "source",
                "sup_text",
                "url",
                "width",
            }
        ),
    },
    "str": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "int": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "float": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "list": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "editable",
                "label",
                "multiselect",
                "placeholder",
                "readonly",
                "source",
                "sup_text",
                "width",
            }
        ),
    },
    "voc": {
        "allowed": frozenset(
            {
                "widget",
                "columns",
                "default",
                "label",
                "multiselect",
                "placeholder",
                "readonly",
                "source",
                "sup_text",
                "width",
            }
        ),
    },
    "ip": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "ip_mask": {
        "allowed": frozenset(
            {
                "widget",
                "default",
                "err_text",
                "label",
                "placeholder",
                "readonly",
                "regex",
                "sup_text",
                "width",
            }
        ),
    },
    "date": {
        "allowed": frozenset({"widget", "default", "label", "readonly", "sup_text", "width"}),
    },
    "time": {
        "allowed": frozenset({"widget", "default", "label", "readonly", "sup_text", "width"}),
    },
    "datetime": {
        "allowed": frozenset({"widget", "default", "label", "readonly", "sup_text", "width"}),
    },
    "table": {
        "allowed": frozenset(
            {
                "widget",
                "label",
                "line_numbers",
                "abc",
                "readonly",
                "row",
                "sort",
                "source",
                "sticky_header",
                "sup_text",
                "table_attrs",
                "toolbar",
                "width",
                "zebra",
            }
        ),
    },
}
