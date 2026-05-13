import type { UnknownRecord } from '../shared/object_record.ts';
export type { UnknownRecord } from '../shared/object_record.ts';

export type ApiDiagnostic = UnknownRecord;

export type FrontendApiErrorOptions = {
    code?: unknown;
    diagnostics?: unknown;
    payload?: unknown;
    snapshotVersion?: unknown;
    status?: unknown;
};

export type ApiEnvelope = UnknownRecord & {
    data?: unknown;
    diagnostics?: unknown;
    error?: unknown;
    error_code?: unknown;
    message?: unknown;
    ok?: boolean;
    snapshot_version?: unknown;
};

export type PageSummary = {
    name: string;
    title: string;
    url: string;
};

/** Нормализованный ответ `GET /api/pages` (read-model / navigation index). */
export type PagesIndexState = {
    diagnostics: ApiDiagnostic[];
    pages: PageSummary[];
    snapshotVersion: string | null;
};

export type ExecuteRequestPayload = {
    command: string;
    output_attrs?: string[];
    page?: string;
    params?: UnknownRecord;
    widget?: string;
};

export type WidgetSourceRequestPayload = {
    page: string;
    snapshot_version?: string | null;
    widget: string;
};

export type PageResponse = {
    attrs: UnknownRecord;
    diagnostics: ApiDiagnostic[];
    page: UnknownRecord | null;
    snapshotVersion: string | null;
    tableRuntime: UnknownRecord;
};

export type AttrsResponse = {
    attrs: UnknownRecord;
    diagnostics: ApiDiagnostic[];
    missingNames: string[];
    page: string;
    resolvedNames: string[];
    snapshotVersion: string | null;
    tableRuntime: UnknownRecord;
};

export type ModalResponse = AttrsResponse & {
    dependencies: UnknownRecord;
    modal: UnknownRecord | null;
};

export type TableQueryRequestPayload = {
    attr: string;
    export_chunk?: { limit?: number; offset: number };
    page: string;
    snapshot_version?: string | null;
    view: UnknownRecord;
};

export type TableCommandRequestPayload = TableQueryRequestPayload & {
    commands: UnknownRecord[];
};

export type TableQueryResponse = {
    attr: string;
    diagnostics: ApiDiagnostic[];
    hasMore: boolean;
    items: unknown[];
    limit: number;
    offset: number;
    page: string;
    snapshotVersion: string | null;
    total: number;
    viewFingerprint: string;
    viewId: string;
};

export type TableCommandResponse = TableQueryResponse & {
    commandsApplied: UnknownRecord[];
};

export type TableExportResponse = {
    attr: string;
    diagnostics: ApiDiagnostic[];
    exportChunked: boolean;
    exportHasMore: boolean;
    exportLimit: number;
    exportOffset: number;
    page: string;
    rows: unknown[][];
    snapshotVersion: string | null;
    total: number;
};

export type ExecuteResponse = {
    command: string;
    data: unknown;
    diagnostics: ApiDiagnostic[];
    message: string;
    page: string | null;
    params: UnknownRecord;
    snapshotVersion: string | null;
    silentSuccess: boolean;
    updates: UnknownRecord;
    widget: string | null;
};

export type WidgetSourceResponse = {
    diagnostics: ApiDiagnostic[];
    page: string;
    patch: UnknownRecord;
    snapshotVersion: string | null;
    widget: string;
};

export type UserRecord = UnknownRecord & {
    role_name?: string;
    user_id?: number;
    user_login?: string;
    user_email?: string;
    user_name?: string;
    user_patronymic?: string;
    user_status?: string;
    user_surname?: string;
};

export type RoleRecord = {
    role_name: string;
};

export type DbSettingsPublicResponse = {
    path?: string;
    settings: UnknownRecord & {
        password_set?: boolean;
    };
    source?: string;
};
