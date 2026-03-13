"""Сервис live-updating snapshot конфигурации страниц."""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Dict

from .config import ROOT_DIR, ConfigLoadError, build_config_snapshot

logger = logging.getLogger(__name__)


class ConfigService:
    """Хранит последний валидный snapshot и обновляет его по mtime."""

    def __init__(self, root_dir: str = ROOT_DIR):
        self.root_dir = root_dir
        self.pages_dir = os.path.join(root_dir, "pages")
        self._lock = threading.RLock()
        self._snapshot: Dict[str, Any] = self._empty_snapshot()
        self._fingerprint: Dict[str, int] = {}
        self._failed_fingerprint: Dict[str, int] | None = None
        self._last_error: str | None = None
        self.force_reload()

    def _empty_snapshot(self) -> Dict[str, Any]:
        return {
            "pages": {},
            "pages_by_url": {},
            "page_attrs": {},
        }

    def _build_fingerprint(self) -> Dict[str, int]:
        fingerprint: Dict[str, int] = {}

        if not os.path.isdir(self.pages_dir):
            return fingerprint

        for page_path in sorted(
            os.path.join(self.pages_dir, name)
            for name in os.listdir(self.pages_dir)
            if os.path.isdir(os.path.join(self.pages_dir, name))
        ):
            for filename in sorted(os.listdir(page_path)):
                if not filename.endswith((".yaml", ".yml")):
                    continue

                filepath = os.path.join(page_path, filename)
                try:
                    fingerprint[filepath] = os.stat(filepath).st_mtime_ns
                except FileNotFoundError:
                    continue

        return fingerprint

    def _reload_if_needed(self, force: bool = False) -> bool:
        fingerprint = self._build_fingerprint()

        if not force:
            if fingerprint == self._fingerprint:
                return False
            if self._failed_fingerprint is not None and fingerprint == self._failed_fingerprint:
                return False

        try:
            snapshot = build_config_snapshot(self.pages_dir)
        except ConfigLoadError as exc:
            self._failed_fingerprint = fingerprint
            self._last_error = str(exc)
            logger.error("Не удалось обновить snapshot конфигурации: %s", exc)
            return False
        except Exception as exc:  # pragma: no cover
            self._failed_fingerprint = fingerprint
            self._last_error = str(exc)
            logger.exception("Неожиданная ошибка при обновлении snapshot конфигурации: %s", exc)
            return False

        self._snapshot = snapshot
        self._fingerprint = fingerprint
        self._failed_fingerprint = None
        self._last_error = None
        return True

    def get_snapshot(self) -> Dict[str, Any]:
        with self._lock:
            self._reload_if_needed()
            return self._snapshot

    def force_reload(self) -> Dict[str, Any]:
        with self._lock:
            updated = self._reload_if_needed(force=True)
            return {
                "updated": updated,
                "snapshot": self._snapshot,
                "last_error": self._last_error,
            }

    def get_page(self, page_name: str) -> Dict[str, Any] | None:
        snapshot = self.get_snapshot()
        return snapshot["pages"].get(page_name)

    def get_page_name_by_url(self, path: str) -> str | None:
        snapshot = self.get_snapshot()
        return snapshot["pages_by_url"].get(path)

    def get_page_by_url(self, path: str) -> Dict[str, Any] | None:
        snapshot = self.get_snapshot()
        page_name = snapshot["pages_by_url"].get(path)
        if not page_name:
            return None
        return snapshot["pages"].get(page_name)

    def get_page_attrs(self, page_name: str) -> Dict[str, Any]:
        snapshot = self.get_snapshot()
        return snapshot["page_attrs"].get(page_name, {})
