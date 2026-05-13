"""Формальные контракты snapshot, API и YAML-документов."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, RootModel, field_validator


JsonDict = Dict[str, Any]


def utc_now_iso() -> str:
    """UTC timestamp в ISO-формате без двусмысленности таймзоны."""
    return datetime.now(timezone.utc).isoformat()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AliasedStrictModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class IgnoreModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class AliasedIgnoreModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class Diagnostic(StrictModel):
    """Структурированная диагностика сборки snapshot и API-контрактов."""

    level: Literal["info", "warning", "error"]
    code: str
    message: str
    page: Optional[str] = None
    file: Optional[str] = None
    line: Optional[int] = None
    url: Optional[str] = None
    node_path: Optional[str] = None


class SourceFileMeta(StrictModel):
    """Метаданные исходного YAML-файла, входящего в snapshot."""

    path: str
    kind: Literal["gui", "attrs", "modal"]
    digest: str
    mtime_ns: Optional[int] = None


class SnapshotMeta(StrictModel):
    """Метаданные собранного snapshot."""

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


class NormalizedModal(AliasedStrictModel):
    """Нормализованный runtime-контракт модального окна."""

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


class PageSnapshot(AliasedStrictModel):
    """Собранный snapshot одной страницы."""

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


class AppSnapshot(StrictModel):
    """Полный snapshot конфигурации приложения."""

    meta: SnapshotMeta
    pages: Dict[str, PageSnapshot] = Field(default_factory=dict)
    pages_by_url: Dict[str, str] = Field(default_factory=dict)
    page_attrs: Dict[str, JsonDict] = Field(default_factory=dict)
    diagnostics: List[Diagnostic] = Field(default_factory=list)


class ApiError(StrictModel):
    """Формальная структура ошибки API."""

    code: str
    message: str
    details: Optional[str] = None


class PagePublicConfigResponse(AliasedStrictModel):
    """Public page config inside page/bootstrap responses."""

    name: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    gui: JsonDict = Field(default_factory=dict)
    parsed_gui: JsonDict = Field(default_factory=dict, alias="parsedGui")
    gui_root_keys: List[str] = Field(default_factory=list, alias="guiMenuKeys")
    modal_gui_ids: List[str] = Field(default_factory=list, alias="modalGuiIds")


class PageDataResponse(StrictModel):
    """`data` contract for GET /api/page/<name> and HTML bootstrap."""

    page: PagePublicConfigResponse
    attrs: JsonDict = Field(default_factory=dict)
    table_runtime: JsonDict = Field(default_factory=dict)


class AttrsDataResponse(AliasedStrictModel):
    """`data` contract for GET /api/attrs."""

    page: str
    attrs: JsonDict = Field(default_factory=dict)
    table_runtime: JsonDict = Field(default_factory=dict)
    resolved_names: List[str] = Field(default_factory=list, alias="resolved_names")
    missing_names: List[str] = Field(default_factory=list, alias="missing_names")


class ModalDataResponse(AttrsDataResponse):
    """`data` contract for GET /api/modal-gui."""

    modal: Optional[JsonDict] = None
    dependencies: JsonDict = Field(default_factory=dict)


class PageSummaryResponse(StrictModel):
    """Short page summary used by /api/pages."""

    name: str
    title: str
    url: str


class PagesDataResponse(StrictModel):
    """`data` contract for GET /api/pages."""

    pages: List[PageSummaryResponse] = Field(default_factory=list)


class ExecuteRequest(AliasedIgnoreModel):
    """Контракт тела POST /api/execute."""

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


class ExecuteResponse(StrictModel):
    """Формальный ответ execute API."""

    command: str
    params: JsonDict = Field(default_factory=dict)
    page: Optional[str] = None
    widget: Optional[str] = None
    message: str
    data: Any = None
    updates: JsonDict = Field(default_factory=dict)
    silent_success: bool = False


class UserPublicResponse(AliasedStrictModel):
    """Публичная модель пользователя для auth/user-settings/admin API."""

    user_id: int
    user_login: str
    user_surname: Optional[str] = None
    user_name: Optional[str] = None
    user_patronymic: Optional[str] = None
    user_email: Optional[str] = None
    user_status: str
    role_name: str


class RolePublicResponse(StrictModel):
    role_id: Optional[int] = None
    role_name: str


class AuthLoginRequest(AliasedIgnoreModel):
    login: str
    password: str


class UserSettingsBootstrapData(StrictModel):
    user: UserPublicResponse
    is_admin: bool


class AdminUsersData(StrictModel):
    users: List[UserPublicResponse] = Field(default_factory=list)


class AdminRolesData(StrictModel):
    roles: List[RolePublicResponse] = Field(default_factory=list)


class DbSettingsPublicData(StrictModel):
    settings: JsonDict
    source: Optional[str] = None
    path: Optional[str] = None


class AdminSqlRequest(AliasedIgnoreModel):
    query: str
