"""Shared helpers and constants for YAML config loading."""

from __future__ import annotations

import hashlib
import os
import re
from typing import Any

import yaml
from yaml.nodes import MappingNode, ScalarNode, SequenceNode

from .contracts import Diagnostic, SourceFileMeta


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
PAGES_DIR = os.path.join(ROOT_DIR, "pages")
GUI_FILENAMES = {"gui.yaml", "gui.yml"}
RESERVED_PAGE_PREFIXES = ("/api", "/debug", "/frontend", "/page/", "/templates")
RESERVED_PAGE_PATHS = {"/favicon.ico"}

MODAL_GUI_ID_RE = re.compile(r"^modal_[a-zA-Z][a-zA-Z0-9_]*$")
MODAL_FILE_ROOT_KEY_RE = re.compile(r"^(.+?)(?:\s+\"([^\"]*)\")?\s*$")
TABLE_ATTR_TOKEN_RE = re.compile(r":\S+")
TABLE_ATTR_WIDTH_TOKEN_RE = re.compile(r"^[0-9]+$")
TABLE_ATTR_BUILTIN_TOKENS = frozenset(
    {
        "str",
        "int",
        "float",
        "date",
        "time",
        "datetime",
        "list",
        "ip",
        "ip_mask",
    }
)
TABLE_ATTR_BLOCK_SCALAR_STYLES = {"|", ">"}


class ConfigLoadError(Exception):
    """Фатальная ошибка при построении snapshot конфигурации."""


class SnapshotValidationError(ConfigLoadError):
    """Ошибка валидации snapshot с набором структурированных diagnostics."""

    def __init__(self, diagnostics: list[Diagnostic]):
        self.diagnostics = diagnostics
        summary = "; ".join(item.message for item in diagnostics[:5])
        if len(diagnostics) > 5:
            summary += f"; +{len(diagnostics) - 5} ещё"
        super().__init__(summary or "Snapshot validation failed")


def make_diagnostic(
    level: str,
    code: str,
    message: str,
    *,
    page: str | None = None,
    file: str | None = None,
    line: int | None = None,
    url: str | None = None,
    node_path: str | None = None,
) -> Diagnostic:
    return Diagnostic(
        level=level,
        code=code,
        message=message,
        page=page,
        file=file,
        line=line,
        url=url,
        node_path=node_path,
    )


def _relpath(path: str, root_dir: str = ROOT_DIR) -> str:
    try:
        return os.path.relpath(path, root_dir)
    except ValueError:
        return path


def _page_load_failure_diagnostic(page_name: str, page_path: str, message: str) -> Diagnostic:
    return make_diagnostic(
        "error",
        "page_load_failed",
        f"Страница '{page_name}' пропущена: {message}",
        page=page_name,
        file=_relpath(page_path),
        url=f"/page/{page_name}",
    )


def _has_error_level_diagnostics(items: list[Diagnostic]) -> bool:
    return any(item.level == "error" for item in items)


def _read_yaml_text(filepath: str) -> str:
    try:
        with open(filepath, "r", encoding="utf-8") as handle:
            return handle.read()
    except FileNotFoundError as exc:
        raise ConfigLoadError(f"YAML-файл не найден: {filepath}") from exc
    except OSError as exc:
        raise ConfigLoadError(f"Ошибка чтения {filepath}: {exc}") from exc


def _read_yaml(filepath: str) -> Any:
    raw_text = _read_yaml_text(filepath)
    try:
        return yaml.safe_load(raw_text)
    except yaml.YAMLError as exc:
        raise ConfigLoadError(f"Ошибка парсинга YAML {filepath}: {exc}") from exc


def _compose_yaml_root(filepath: str):
    raw_text = _read_yaml_text(filepath)
    try:
        return yaml.compose(raw_text, Loader=yaml.SafeLoader)
    except yaml.YAMLError as exc:
        raise ConfigLoadError(f"Ошибка парсинга YAML {filepath}: {exc}") from exc


def load_yaml_dict(filepath: str) -> dict[str, Any]:
    loaded = _read_yaml(filepath)
    if loaded is None:
        return {}
    if not isinstance(loaded, dict):
        raise ConfigLoadError(f"{filepath} должен содержать YAML-словарь")
    return loaded


def load_yaml_root(filepath: str) -> Any:
    return _read_yaml(filepath)


def _node_line(node: Any) -> int | None:
    if node is None or not hasattr(node, "start_mark") or node.start_mark is None:
        return None
    return int(node.start_mark.line) + 1


def _node_kind(node: Any) -> str:
    if isinstance(node, MappingNode):
        return "словарь"
    if isinstance(node, SequenceNode):
        return "список"
    if isinstance(node, ScalarNode):
        return "скаляр"
    if node is None:
        return "пустое значение"
    return type(node).__name__


def _invalid_gui_value(
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    line: int | None,
    node_path: str,
    message: str,
) -> Diagnostic:
    return make_diagnostic(
        "error",
        "invalid_gui_value",
        message,
        page=page_name,
        file=file_rel,
        line=line,
        url=page_url,
        node_path=node_path,
    )


def _mapping_node_items(node: Any) -> dict[str, tuple[Any, Any]]:
    if not isinstance(node, MappingNode):
        return {}

    items: dict[str, tuple[Any, Any]] = {}
    for key_node, value_node in node.value:
        key = str(getattr(key_node, "value", "") or "").strip()
        if not key:
            continue
        items[key] = (key_node, value_node)
    return items


def _attr_option_diagnostic(
    level: str,
    code: str,
    message: str,
    *,
    page_name: str,
    page_url: str,
    file_rel: str,
    line: int | None,
    node_path: str,
) -> Diagnostic:
    return make_diagnostic(
        level,
        code,
        message,
        page=page_name,
        file=file_rel,
        line=line,
        url=page_url,
        node_path=node_path,
    )


def _file_digest(filepath: str) -> str:
    digest = hashlib.sha256()
    try:
        with open(filepath, "rb") as handle:
            for chunk in iter(lambda: handle.read(65536), b""):
                digest.update(chunk)
    except OSError as exc:
        raise ConfigLoadError(f"Ошибка чтения {filepath}: {exc}") from exc
    return digest.hexdigest()


def _source_file_meta(filepath: str, kind: str) -> SourceFileMeta:
    try:
        stat = os.stat(filepath)
        mtime_ns = stat.st_mtime_ns
    except FileNotFoundError:
        mtime_ns = None
    return SourceFileMeta(
        path=_relpath(filepath),
        kind=kind,
        digest=_file_digest(filepath),
        mtime_ns=mtime_ns,
    )
