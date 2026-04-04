"""Tolerant JSON storage for the isolated Sudoku feature."""

from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

from . import SAVE_DATA_PATH, USERS_DATA_PATH
from .engine import blank_board, copy_board


_LOCK = threading.RLock()


def _read_json(path: Path, default: Any) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, OSError, ValueError, TypeError):
        return default


def _atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=f".{path.stem}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        try:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        except OSError:
            pass


def _normalize_int(value: Any, default: int = 0) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def normalize_user_record(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {"games": 0, "wins": 0, "win_rate": 0.0}

    games = _normalize_int(value.get("games"), 0)
    wins = _normalize_int(value.get("wins"), 0)
    win_rate = (wins / games) * 100 if games > 0 else 0.0
    return {
        "games": games,
        "wins": wins,
        "win_rate": win_rate,
    }


def normalize_users_data(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    normalized: dict[str, Any] = {}
    for key, record in value.items():
        if not isinstance(key, str):
            continue
        username = key.strip()
        if not username:
            continue
        normalized[username] = normalize_user_record(record)
    return normalized


def load_users_data() -> dict[str, Any]:
    with _LOCK:
        payload = _read_json(USERS_DATA_PATH, {})
        return normalize_users_data(payload)


def save_users_data(users_data: Any) -> dict[str, Any]:
    normalized = normalize_users_data(users_data)
    with _LOCK:
        _atomic_write_json(USERS_DATA_PATH, normalized)
    return normalized


def load_saved_board() -> list[list[int]]:
    with _LOCK:
        payload = _read_json(SAVE_DATA_PATH, blank_board())
        return copy_board(payload)


def save_saved_board(board: Any) -> list[list[int]]:
    normalized = copy_board(board)
    with _LOCK:
        _atomic_write_json(SAVE_DATA_PATH, normalized)
    return normalized


__all__ = [
    "load_saved_board",
    "load_users_data",
    "normalize_user_record",
    "normalize_users_data",
    "save_saved_board",
    "save_users_data",
]
