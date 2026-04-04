"""Validation facade for config modules."""

from .config_attr_validation import (
    ATTR_WIDGET_SCHEMA,
    _collect_attr_definitions,
    _collect_attr_refs,
    _validate_attr_config,
)
from .config_gui_validation import (
    _build_duplicate_attr_diagnostics,
    _build_unused_attr_diagnostics,
    _validate_page_documents,
)

__all__ = [
    "ATTR_WIDGET_SCHEMA",
    "_build_duplicate_attr_diagnostics",
    "_build_unused_attr_diagnostics",
    "_collect_attr_definitions",
    "_collect_attr_refs",
    "_validate_attr_config",
    "_validate_page_documents",
]
