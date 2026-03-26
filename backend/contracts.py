"""Формальные контракты snapshot, API и YAML-документов."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, RootModel, field_validator


JsonDict = dict[str, Any]


def utc_now_iso() -> str:
    """UTC timestamp в ISO-формате без двусмысленности таймзоны."""
    return datetime.now(timezone.utc).isoformat()


class Diagnostic(BaseModel):
    """Структурированная диагностика сборки snapshot и API-контрактов."""

    model_config = ConfigDict(extra="forbid")

    level: Literal["info", "warning", "error"]
    code: str
    message: str
    page: Optional[str] = None
    file: Optional[str] = None
    node_path: Optional[str] = None


class SourceFileMeta(BaseModel):
    """Метаданные исходного YAML-файла, входящего в snapshot."""

    model_config = ConfigDict(extra="forbid")

    path: str
    kind: Literal["gui", "attrs", "modal"]
    digest: str
    mtime_ns: Optional[int] = None


class SnapshotMeta(BaseModel):
    """Метаданные собранного snapshot."""

    model_config = ConfigDict(extra="forbid")

    version: str
    created_at: str
    page_count: int = 0
    source_files: list[SourceFileMeta] = Field(default_factory=list)
    last_build_error: Optional[str] = None
    last_successful_build_at: Optional[str] = None


class RawGuiDocument(RootModel[JsonDict]):
    """Raw GUI-документ страницы."""


class RawAttrsFragment(RootModel[JsonDict]):
    """Raw attrs-фрагмент страницы."""


class RawModalDocument(RootModel[Union[list[Any], JsonDict]]):
    """Raw YAML-документ модалки."""


class NormalizedModal(BaseModel):
    """Нормализованный runtime-контракт модального окна."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: str
    name: str
    title: Optional[str] = None
    icon: Optional[str] = None
    tabs: list[JsonDict] = Field(default_factory=list)
    content: list[JsonDict] = Field(default_factory=list)
    buttons: list[str] = Field(default_factory=list)
    widget_names: list[str] = Field(default_factory=list, alias="widgetNames")
    source: Literal["embedded", "file"]
    source_file: Optional[str] = Field(default=None, alias="sourceFile")

    @field_validator("id", "name")
    @classmethod
    def _strip_required(cls, value: str) -> str:
        stripped = str(value or "").strip()
        if not stripped:
            raise ValueError("must not be empty")
        return stripped

    @field_validator("title")
    @classmethod
    def _strip_optional_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = str(value).strip()
        return stripped or None


class PageSnapshot(BaseModel):
    """Собранный snapshot одной страницы."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: str
    url: str
    title: str
    gui: JsonDict
    attrs: JsonDict = Field(default_factory=dict)
    modals: dict[str, NormalizedModal] = Field(default_factory=dict)
    gui_root_keys: list[str] = Field(default_factory=list, alias="guiMenuKeys")
    modal_gui_ids: list[str] = Field(default_factory=list, alias="modalGuiIds")
    source_files: list[SourceFileMeta] = Field(default_factory=list, alias="sourceFiles")
    diagnostics: list[Diagnostic] = Field(default_factory=list)


class AppSnapshot(BaseModel):
    """Полный snapshot конфигурации приложения."""

    model_config = ConfigDict(extra="forbid")

    meta: SnapshotMeta
    pages: dict[str, PageSnapshot] = Field(default_factory=dict)
    pages_by_url: dict[str, str] = Field(default_factory=dict)
    page_attrs: dict[str, JsonDict] = Field(default_factory=dict)
    diagnostics: list[Diagnostic] = Field(default_factory=list)


class ApiError(BaseModel):
    """Формальная структура ошибки API."""

    model_config = ConfigDict(extra="forbid")

    code: str
    message: str


class ExecuteRequest(BaseModel):
    """Контракт тела POST /api/execute."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    command: str
    params: JsonDict = Field(default_factory=dict)
    page: Optional[str] = None
    widget: Optional[str] = None
    output_attrs: list[str] = Field(default_factory=list, alias="output_attrs")

    @field_validator("command")
    @classmethod
    def _validate_command(cls, value: str) -> str:
        stripped = str(value or "").strip()
        if not stripped:
            raise ValueError("command is required")
        return stripped


class ExecuteResponse(BaseModel):
    """Формальный ответ execute API."""

    model_config = ConfigDict(extra="forbid")

    command: str
    params: JsonDict = Field(default_factory=dict)
    page: Optional[str] = None
    widget: Optional[str] = None
    message: str
    data: Any = None
