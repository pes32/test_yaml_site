"""Формальные контракты snapshot, API и YAML-документов."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, RootModel, field_validator


JsonDict = Dict[str, Any]


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
    line: Optional[int] = None
    url: Optional[str] = None
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
    source_files: List[SourceFileMeta] = Field(default_factory=list)
    last_build_error: Optional[str] = None
    last_successful_build_at: Optional[str] = None


class RawGuiDocument(RootModel[JsonDict]):
    """Raw GUI-документ страницы."""


class RawAttrsFragment(RootModel[JsonDict]):
    """Raw attrs-фрагмент страницы."""


class RawModalDocument(RootModel[Union[List[Any], JsonDict]]):
    """Raw YAML-документ модалки."""


class NormalizedModal(BaseModel):
    """Нормализованный runtime-контракт модального окна."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: str
    name: str
    title: Optional[str] = None
    icon: Optional[str] = None
    tabs: List[JsonDict] = Field(default_factory=list)
    content: List[JsonDict] = Field(default_factory=list)
    buttons: List[str] = Field(default_factory=list)
    widget_names: List[str] = Field(default_factory=list, alias="widgetNames")
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
    parsed_gui: JsonDict = Field(default_factory=dict, alias="parsedGui")
    attrs: JsonDict = Field(default_factory=dict)
    modals: Dict[str, NormalizedModal] = Field(default_factory=dict)
    gui_root_keys: List[str] = Field(default_factory=list, alias="guiMenuKeys")
    modal_gui_ids: List[str] = Field(default_factory=list, alias="modalGuiIds")
    source_files: List[SourceFileMeta] = Field(default_factory=list, alias="sourceFiles")
    diagnostics: List[Diagnostic] = Field(default_factory=list)


class AppSnapshot(BaseModel):
    """Полный snapshot конфигурации приложения."""

    model_config = ConfigDict(extra="forbid")

    meta: SnapshotMeta
    pages: Dict[str, PageSnapshot] = Field(default_factory=dict)
    pages_by_url: Dict[str, str] = Field(default_factory=dict)
    page_attrs: Dict[str, JsonDict] = Field(default_factory=dict)
    diagnostics: List[Diagnostic] = Field(default_factory=list)


class ApiError(BaseModel):
    """Формальная структура ошибки API."""

    model_config = ConfigDict(extra="forbid")

    code: str
    message: str


class PagePublicConfigResponse(BaseModel):
    """Public page config inside page/bootstrap responses."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    gui: JsonDict = Field(default_factory=dict)
    parsed_gui: JsonDict = Field(default_factory=dict, alias="parsedGui")
    gui_root_keys: List[str] = Field(default_factory=list, alias="guiMenuKeys")
    modal_gui_ids: List[str] = Field(default_factory=list, alias="modalGuiIds")


class PageDataResponse(BaseModel):
    """`data` contract for GET /api/page/<name> and HTML bootstrap."""

    model_config = ConfigDict(extra="forbid")

    page: PagePublicConfigResponse
    attrs: JsonDict = Field(default_factory=dict)


class AttrsDataResponse(BaseModel):
    """`data` contract for GET /api/attrs."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    page: str
    attrs: JsonDict = Field(default_factory=dict)
    resolved_names: List[str] = Field(default_factory=list, alias="resolved_names")
    missing_names: List[str] = Field(default_factory=list, alias="missing_names")


class ModalDataResponse(AttrsDataResponse):
    """`data` contract for GET /api/modal-gui."""

    modal: Optional[JsonDict] = None
    dependencies: JsonDict = Field(default_factory=dict)


class PageSummaryResponse(BaseModel):
    """Short page summary used by /api/pages."""

    model_config = ConfigDict(extra="forbid")

    name: str
    title: str
    url: str


class PagesDataResponse(BaseModel):
    """`data` contract for GET /api/pages."""

    model_config = ConfigDict(extra="forbid")

    pages: List[PageSummaryResponse] = Field(default_factory=list)


class DebugRouteResponse(BaseModel):
    """One route row for debug structure."""

    model_config = ConfigDict(extra="forbid")

    endpoint: str
    methods: List[str] = Field(default_factory=list)
    rule: str


class DebugStructureDataResponse(BaseModel):
    """`data` contract for GET /api/debug/structure."""

    model_config = ConfigDict(extra="forbid")

    routes: List[DebugRouteResponse] = Field(default_factory=list)
    snapshot: JsonDict = Field(default_factory=dict)


class DebugLogsDataResponse(BaseModel):
    """`data` contract for GET /api/debug/logs."""

    model_config = ConfigDict(extra="forbid")

    lines: List[str] = Field(default_factory=list)
    total: int = 0


class DebugPageSummaryResponse(BaseModel):
    """One page row for GET /api/debug/pages."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: str
    title: str
    url: str
    modal_ids: List[str] = Field(default_factory=list, alias="modal_ids")
    source_files: List[JsonDict] = Field(default_factory=list, alias="source_files")
    diagnostics: List[JsonDict] = Field(default_factory=list)


class DebugPagesDataResponse(BaseModel):
    """`data` contract for GET /api/debug/pages."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    pages: List[DebugPageSummaryResponse] = Field(default_factory=list)
    snapshot: JsonDict = Field(default_factory=dict)
    diagnostics: List[JsonDict] = Field(default_factory=list)
    last_error: Optional[str] = Field(default=None, alias="last_error")


class DebugSnapshotDataResponse(BaseModel):
    """`data` contract for GET /api/debug/snapshot."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    meta: JsonDict = Field(default_factory=dict)
    page_count: int = Field(default=0, alias="page_count")
    pages_by_url: Dict[str, str] = Field(default_factory=dict, alias="pages_by_url")
    diagnostics: List[JsonDict] = Field(default_factory=list)
    last_error: Optional[str] = Field(default=None, alias="last_error")


class DebugSqlDataResponse(BaseModel):
    """`data` contract for POST /api/debug/sql."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    query: str
    columns: List[str] = Field(default_factory=list)
    rows: List[JsonDict] = Field(default_factory=list)
    row_count: int = Field(default=0, alias="row_count")
    truncated: bool = False
    max_rows: int = Field(default=0, alias="max_rows")
    duration_ms: int = Field(default=0, alias="duration_ms")


class ExecuteRequest(BaseModel):
    """Контракт тела POST /api/execute."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    command: str
    params: JsonDict = Field(default_factory=dict)
    page: Optional[str] = None
    widget: Optional[str] = None
    output_attrs: List[str] = Field(default_factory=list, alias="output_attrs")

    @field_validator("command")
    @classmethod
    def _validate_command(cls, value: str) -> str:
        stripped = str(value or "").strip()
        if not stripped:
            raise ValueError("command is required")
        return stripped


class DebugSqlRequest(BaseModel):
    """Контракт тела POST /api/debug/sql."""

    model_config = ConfigDict(extra="ignore")

    query: str

    @field_validator("query")
    @classmethod
    def _validate_query(cls, value: str) -> str:
        stripped = str(value or "").strip()
        if not stripped:
            raise ValueError("query is required")
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
