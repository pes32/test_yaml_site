"""Runtime/fallback настройки подключения к PostgreSQL."""
from __future__ import annotations

import logging
import os
import base64
import hashlib
import hmac
import secrets
import tempfile
from typing import Any

import psycopg2
import yaml

logger = logging.getLogger(__name__)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
DATABASE_DIR = os.path.join(ROOT_DIR, "database")
FALLBACK_DB_SETTINGS_PATH = os.path.join(DATABASE_DIR, "db_settings.yaml")
RUNTIME_DB_SETTINGS_PATH = os.path.join(DATABASE_DIR, "db_settings.runtime.yaml")
RUNTIME_DB_SETTINGS_KEY_PATH = os.path.join(DATABASE_DIR, ".db_settings.runtime.key")
LEGACY_DB_SETTINGS_PATH = os.path.join(ROOT_DIR, "db_settings.yaml")

DB_SETTINGS_REQUIRED_FIELDS = ("address", "port", "db_name", "user")


class DbSettingsError(RuntimeError):
    """Контролируемая ошибка работы с настройками БД."""


def _read_yaml_file(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        loaded = yaml.safe_load(handle) or {}
    if not isinstance(loaded, dict):
        raise DbSettingsError(f"Файл настроек БД должен содержать YAML-объект: {path}")
    return loaded


def _runtime_secret_key() -> bytes:
    os.makedirs(DATABASE_DIR, exist_ok=True)
    try:
        with open(RUNTIME_DB_SETTINGS_KEY_PATH, "rb") as handle:
            key = handle.read().strip()
            if key:
                return key
    except FileNotFoundError:
        pass

    key = base64.urlsafe_b64encode(secrets.token_bytes(32))
    fd, temp_path = tempfile.mkstemp(
        prefix=".db_settings.runtime.key.",
        dir=DATABASE_DIR,
    )
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(key)
            handle.write(b"\n")
        try:
            os.chmod(temp_path, 0o600)
        except OSError:
            logger.warning("Не удалось выставить права 0600 на ключ runtime-конфига БД")
        os.replace(temp_path, RUNTIME_DB_SETTINGS_KEY_PATH)
        try:
            os.chmod(RUNTIME_DB_SETTINGS_KEY_PATH, 0o600)
        except OSError:
            logger.warning("Не удалось выставить права 0600 на ключ runtime-конфига БД")
    except Exception:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise
    return key


def _xor_stream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        out.extend(hmac.new(key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest())
        counter += 1
    return bytes(out[:length])


def encrypt_runtime_password(password: str) -> str:
    raw = str(password or "").encode("utf-8")
    nonce = secrets.token_bytes(16)
    key = _runtime_secret_key()
    stream = _xor_stream(key, nonce, len(raw))
    cipher = bytes(a ^ b for a, b in zip(raw, stream))
    tag = hmac.new(key, nonce + cipher, hashlib.sha256).digest()[:16]
    return "v1:" + ":".join(
        base64.urlsafe_b64encode(part).decode("ascii")
        for part in (nonce, cipher, tag)
    )


def decrypt_runtime_password(value: str) -> str:
    parts = str(value or "").split(":")
    if len(parts) != 4 or parts[0] != "v1":
        raise DbSettingsError("Некорректный формат зашифрованного пароля runtime-настроек БД")
    try:
        nonce, cipher, tag = (base64.urlsafe_b64decode(part.encode("ascii")) for part in parts[1:])
    except Exception as exc:
        raise DbSettingsError("Некорректная кодировка зашифрованного пароля runtime-настроек БД") from exc
    key = _runtime_secret_key()
    expected = hmac.new(key, nonce + cipher, hashlib.sha256).digest()[:16]
    if not hmac.compare_digest(tag, expected):
        raise DbSettingsError("Не удалось проверить зашифрованный пароль runtime-настроек БД")
    stream = _xor_stream(key, nonce, len(cipher))
    raw = bytes(a ^ b for a, b in zip(cipher, stream))
    return raw.decode("utf-8")


def normalize_db_settings(
    settings: dict[str, Any],
) -> dict[str, Any]:
    """Проверяет поля подключения. Без пароля подключение не проверяется и не сохраняется."""

    normalized = dict(settings or {})

    missing = [field for field in DB_SETTINGS_REQUIRED_FIELDS if field not in normalized]
    if missing:
        raise DbSettingsError("Отсутствуют обязательные поля настроек БД: " + ", ".join(missing))

    normalized["address"] = str(normalized["address"]).strip()
    normalized["db_name"] = str(normalized["db_name"]).strip()
    normalized["user"] = str(normalized["user"]).strip()
    if "password" not in normalized:
        normalized["password"] = ""
    normalized["password"] = str(normalized["password"])

    try:
        normalized["port"] = int(normalized["port"])
    except (TypeError, ValueError) as exc:
        raise DbSettingsError("Поле port должно быть числом") from exc

    for field in ("address", "db_name", "user"):
        if not normalized[field]:
            raise DbSettingsError(f"Поле {field} не должно быть пустым")

    if not normalized["password"].strip():
        raise DbSettingsError("Пароль не указан. Укажите пароль подключения.")

    return normalized


def connection_params_from_settings(settings: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_db_settings(settings)
    return {
        "host": normalized["address"],
        "port": normalized["port"],
        "database": normalized["db_name"],
        "user": normalized["user"],
        "password": normalized["password"],
    }


def get_runtime_settings_mtime() -> int | None:
    try:
        return os.stat(RUNTIME_DB_SETTINGS_PATH).st_mtime_ns
    except FileNotFoundError:
        return None


def test_db_settings(settings: dict[str, Any]) -> dict[str, Any]:
    """Проверяет произвольные настройки без изменения активного подключения."""

    conn = None
    normalized: dict[str, Any] = {}
    try:
        normalized = normalize_db_settings(settings)
        conn = psycopg2.connect(**connection_params_from_settings(normalized))
        with conn.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
        return {
            "success": True,
            "message": "Подключено!",
            "version": version,
            "database": normalized["db_name"],
            "host": normalized["address"],
            "port": normalized["port"],
        }
    except DbSettingsError as exc:
        return {
            "success": False,
            "error": str(exc),
            "database": normalized.get("db_name"),
            "host": normalized.get("address"),
            "port": normalized.get("port"),
        }
    except Exception as exc:
        logger.exception("Ошибка проверки настроек подключения к БД")
        return {
            "success": False,
            "error": str(exc),
            "database": normalized.get("db_name"),
            "host": normalized.get("address"),
            "port": normalized.get("port"),
        }
    finally:
        if conn:
            conn.close()


def _connection_dict_from_yaml_raw(raw: dict[str, Any]) -> dict[str, Any]:
    missing = [field for field in DB_SETTINGS_REQUIRED_FIELDS if field not in raw]
    if missing:
        raise DbSettingsError("Отсутствуют обязательные поля настроек БД: " + ", ".join(missing))
    password = raw.get("password", "")
    if "password_encrypted" in raw:
        password = decrypt_runtime_password(str(raw.get("password_encrypted") or ""))
    return {
        "address": raw["address"],
        "port": raw["port"],
        "db_name": raw["db_name"],
        "user": raw["user"],
        "password": password,
    }


def _load_settings_file(path: str, source: str) -> dict[str, Any]:
    raw = _read_yaml_file(path)
    settings = normalize_db_settings(_connection_dict_from_yaml_raw(raw))
    return {
        "settings": settings,
        "source": source,
        "path": path,
        "runtime_mtime": get_runtime_settings_mtime(),
    }


def load_fallback_db_settings() -> dict[str, Any]:
    """Читает базовые настройки проекта."""

    candidates = (FALLBACK_DB_SETTINGS_PATH, LEGACY_DB_SETTINGS_PATH)
    path = next((item for item in candidates if os.path.isfile(item)), None)
    if not path:
        raise FileNotFoundError("Файл настроек БД не найден. Проверены пути: " + ", ".join(candidates))
    source = "fallback" if path == FALLBACK_DB_SETTINGS_PATH else "legacy"
    return _load_settings_file(path, source)


def load_active_db_settings() -> dict[str, Any]:
    """Читает runtime-конфиг, если он рабочий, иначе fallback-конфиг."""

    if os.path.isfile(RUNTIME_DB_SETTINGS_PATH):
        try:
            raw = _read_yaml_file(RUNTIME_DB_SETTINGS_PATH)
            runtime_conn = _connection_dict_from_yaml_raw(raw)
            settings = normalize_db_settings(runtime_conn)
            runtime_bundle = {
                "settings": settings,
                "source": "runtime",
                "path": RUNTIME_DB_SETTINGS_PATH,
                "runtime_mtime": get_runtime_settings_mtime(),
            }
            result = test_db_settings(settings)
            if result.get("success"):
                return runtime_bundle
            logger.error("Runtime-настройки БД не прошли проверку: %s", result.get("error"))
        except Exception as exc:
            logger.exception("Runtime-настройки БД не загружены: %s", exc)

    return load_fallback_db_settings()


def write_runtime_db_settings(settings: dict[str, Any]) -> dict[str, Any]:
    """Атомарно сохраняет runtime-настройки БД."""

    normalized = normalize_db_settings(settings)
    os.makedirs(DATABASE_DIR, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(
        prefix=".db_settings.runtime.",
        suffix=".yaml",
        dir=DATABASE_DIR,
        text=True,
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            yaml.safe_dump(
                {
                    "address": normalized["address"],
                    "port": normalized["port"],
                    "db_name": normalized["db_name"],
                    "user": normalized["user"],
                    "password_encrypted": encrypt_runtime_password(normalized["password"]),
                },
                handle,
                allow_unicode=True,
                sort_keys=False,
            )
        try:
            os.chmod(temp_path, 0o600)
        except OSError:
            logger.warning("Не удалось выставить права 0600 на runtime-конфиг БД")
        os.replace(temp_path, RUNTIME_DB_SETTINGS_PATH)
        try:
            os.chmod(RUNTIME_DB_SETTINGS_PATH, 0o600)
        except OSError:
            logger.warning("Не удалось выставить права 0600 на runtime-конфиг БД")
    except Exception:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise

    return {
        "settings": normalized,
        "source": "runtime",
        "path": RUNTIME_DB_SETTINGS_PATH,
        "runtime_mtime": get_runtime_settings_mtime(),
    }


def save_and_activate_runtime_db_settings(settings: dict[str, Any]) -> dict[str, Any]:
    """Сохраняет runtime-настройки и инициирует замену активного DB manager."""

    loaded = write_runtime_db_settings(settings)

    from .database import DatabaseManager, replace_db_manager

    replace_db_manager(
        DatabaseManager(
            loaded["settings"],
            source=str(loaded.get("source") or ""),
            settings_path=str(loaded.get("path") or ""),
            runtime_mtime=loaded.get("runtime_mtime"),
        )
    )
    return loaded
