"""Сервис live-updating versioned snapshot конфигурации страниц."""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Dict

from .config import ROOT_DIR, ConfigLoadError, build_config_snapshot, make_diagnostic

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
        self._scan_interval_seconds = self._read_scan_interval_seconds()
        self._next_scan_at = 0.0
        self.force_reload()

    def _read_scan_interval_seconds(self) -> float:
        raw = os.getenv("LOWCODE_CONFIG_SCAN_INTERVAL", "0.5")
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return 0.5
        return max(0.0, value)

    def _schedule_next_scan(self) -> None:
        self._next_scan_at = time.monotonic() + self._scan_interval_seconds

    def _empty_snapshot(self) -> Dict[str, Any]:
        return {
            "meta": {
                "version": "empty",
                "created_at": None,
                "page_count": 0,
                "source_files": [],
                "last_build_error": None,
                "last_successful_build_at": None,
            },
            "pages": {},
            "pages_by_url": {},
            "page_attrs": {},
            "diagnostics": [],
        }

    def _set_build_status(
        self,
        snapshot: Dict[str, Any],
        *,
        last_error: str | None,
        diagnostics: list[dict[str, Any]] | None = None,
    ) -> Dict[str, Any]:
        result = dict(snapshot)
        meta = dict(result.get("meta") or {})
        meta["last_build_error"] = last_error
        if not meta.get("last_successful_build_at") and meta.get("created_at"):
            meta["last_successful_build_at"] = meta["created_at"]
        result["meta"] = meta

        merged_diagnostics = list(result.get("diagnostics") or [])
        if diagnostics:
            merged_diagnostics.extend(diagnostics)
        result["diagnostics"] = merged_diagnostics
        return result

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
        if (
            not force
            and self._scan_interval_seconds > 0
            and time.monotonic() < self._next_scan_at
        ):
            return False

        fingerprint = self._build_fingerprint()

        if not force:
            if fingerprint == self._fingerprint:
                self._schedule_next_scan()
                return False
            if self._failed_fingerprint is not None and fingerprint == self._failed_fingerprint:
                self._schedule_next_scan()
                return False

        try:
            snapshot = build_config_snapshot(self.pages_dir)
        except ConfigLoadError as exc:
            self._failed_fingerprint = fingerprint
            self._last_error = str(exc)
            self._snapshot = self._set_build_status(
                self._snapshot,
                last_error=self._last_error,
                diagnostics=[
                    make_diagnostic(
                        "error",
                        "snapshot_build_failed",
                        self._last_error,
                    ).model_dump()
                ],
            )
            self._schedule_next_scan()
            logger.error("Не удалось обновить snapshot конфигурации: %s", exc)
            return False
        except Exception as exc:  # pragma: no cover
            self._failed_fingerprint = fingerprint
            self._last_error = str(exc)
            self._snapshot = self._set_build_status(
                self._snapshot,
                last_error=self._last_error,
                diagnostics=[
                    make_diagnostic(
                        "error",
                        "snapshot_build_failed_unexpected",
                        self._last_error,
                    ).model_dump()
                ],
            )
            self._schedule_next_scan()
            logger.exception("Неожиданная ошибка при обновлении snapshot конфигурации: %s", exc)
            return False

        self._snapshot = self._set_build_status(snapshot, last_error=None)
        self._fingerprint = fingerprint
        self._failed_fingerprint = None
        self._last_error = None
        self._schedule_next_scan()
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

    def get_meta(self) -> Dict[str, Any]:
        snapshot = self.get_snapshot()
        return snapshot.get("meta") or {}

    def get_last_error(self) -> str | None:
        with self._lock:
            return self._last_error
