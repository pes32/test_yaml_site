"""Compatibility facade for YAML config loading."""

from .config_files import PAGES_DIR
from .config_modals import load_modal_gui_payload
from .config_shared import (
    ROOT_DIR,
    ConfigLoadError,
    SnapshotValidationError,
    load_yaml_dict,
    load_yaml_root,
    make_diagnostic,
)
from .config_snapshot import build_config_snapshot, load_config, load_page_config

__all__ = [
    "ConfigLoadError",
    "PAGES_DIR",
    "ROOT_DIR",
    "SnapshotValidationError",
    "build_config_snapshot",
    "load_config",
    "load_modal_gui_payload",
    "load_page_config",
    "load_yaml_dict",
    "load_yaml_root",
    "make_diagnostic",
]
