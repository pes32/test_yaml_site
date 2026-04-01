"""Сервис live-updating versioned snapshot конфигурации страниц."""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Dict

from .config import ROOT_DIR, ConfigLoadError, SnapshotValidationError, build_config_snapshot, make_diagnostic

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
        self._last_logged_snapshot_version: str | None = None
        self._last_logged_failure_signature: tuple[tuple[str, int], ...] | None = None
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

    def _fingerprint_signature(self, fingerprint: Dict[str, int]) -> tuple[tuple[str, int], ...]:
        return tuple(sorted(fingerprint.items()))

    def _diagnostic_line(self, item: dict[str, Any]) -> str:
        message = str(item.get("message") or "").strip()
        if not message:
            message = str(item.get("code") or "diagnostic").strip()

        if item.get("code") in {
            "duplicate_attr",
            "unused_attr",
            "missing_attr_reference",
        }:
            return message

        location_parts = []
        if item.get("file"):
            location_parts.append(str(item["file"]))
        if item.get("line"):
            location_parts.append(f"стр.{item['line']}")
        if item.get("node_path"):
            location_parts.append(str(item["node_path"]))

        if not location_parts:
            return message
        return f"{message} ({' | '.join(location_parts)})"

    def _log_diagnostic_group(self, level: int, header: str, items: list[dict[str, Any]]) -> None:
        if not items:
            return
        logger.log(level, header)
        for item in items:
            logger.log(level, self._diagnostic_line(item))

    def _log_snapshot_diagnostics(self, diagnostics: list[dict[str, Any]]) -> None:
        duplicate_attrs = [item for item in diagnostics if item.get("code") == "duplicate_attr"]
        unused_attrs = [item for item in diagnostics if item.get("code") == "unused_attr"]
        missing_attrs = [item for item in diagnostics if item.get("code") == "missing_attr_reference"]
        invalid_gui = [item for item in diagnostics if item.get("code") == "invalid_gui_value"]

        self._log_diagnostic_group(logging.WARNING, "Обнаружены дубликаты attrs:", duplicate_attrs)
        self._log_diagnostic_group(logging.WARNING, "Обнаружены не используемые attrs:", unused_attrs)
        self._log_diagnostic_group(logging.ERROR, "Обнаруженны не существующие attrs:", missing_attrs)
        self._log_diagnostic_group(logging.ERROR, "Обнаружены ошибки структуры gui.yaml:", invalid_gui)

        grouped_codes = {
            "duplicate_attr",
            "unused_attr",
            "missing_attr_reference",
            "invalid_gui_value",
        }
        for item in diagnostics:
            if item.get("code") in grouped_codes:
                continue
            level_name = str(item.get("level") or "info").lower()
            level = logging.INFO
            if level_name == "warning":
                level = logging.WARNING
            elif level_name == "error":
                level = logging.ERROR
            logger.log(level, self._diagnostic_line(item))

    def _log_success_once(self, snapshot: Dict[str, Any]) -> None:
        meta = snapshot.get("meta") or {}
        version = str(meta.get("version") or "").strip()
        if version and version == self._last_logged_snapshot_version:
            return

        self._last_logged_snapshot_version = version or None
        self._last_logged_failure_signature = None
        logger.info(
            "Snapshot конфигурации загружен: version=%s pages=%s",
            version or "unknown",
            meta.get("page_count") or 0,
        )
        self._log_snapshot_diagnostics(list(snapshot.get("diagnostics") or []))

    def _log_failure_once(
        self,
        fingerprint: Dict[str, int],
        *,
        last_error: str,
        diagnostics: list[dict[str, Any]] | None = None,
    ) -> None:
        signature = self._fingerprint_signature(fingerprint)
        if signature == self._last_logged_failure_signature:
            return

        self._last_logged_failure_signature = signature
        if diagnostics:
            self._log_snapshot_diagnostics(diagnostics)
        logger.error("Не удалось обновить snapshot конфигурации: %s", last_error)

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
        except SnapshotValidationError as exc:
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
            self._log_failure_once(
                fingerprint,
                last_error="Новый snapshot отклонён из-за validation errors; сохранён предыдущий валидный snapshot",
                diagnostics=[item.model_dump() for item in exc.diagnostics],
            )
            return False
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
            self._log_failure_once(fingerprint, last_error=str(exc))
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
            self._log_failure_once(fingerprint, last_error=str(exc))
            logger.exception("Неожиданная ошибка при обновлении snapshot конфигурации: %s", exc)
            return False

        self._snapshot = self._set_build_status(snapshot, last_error=None)
        self._fingerprint = fingerprint
        self._failed_fingerprint = None
        self._last_error = None
        self._schedule_next_scan()
        self._log_success_once(snapshot)
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
