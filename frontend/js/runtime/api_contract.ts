import type { UnknownRecord } from '../shared/object_record.ts';

type ApiDiagnostic = UnknownRecord;

type FrontendApiErrorOptions = {
    code?: unknown;
    diagnostics?: unknown;
    payload?: unknown;
    snapshotVersion?: unknown;
    status?: unknown;
};

type ApiEnvelope = UnknownRecord & {
    data?: unknown;
    diagnostics?: unknown;
    error?: unknown;
    message?: unknown;
    ok?: boolean;
    snapshot_version?: unknown;
};

type PageSummary = {
    name: string;
    title: string;
    url: string;
};

type ExecuteRequestPayload = {
    command: string;
    output_attrs?: string[];
    page?: string;
    params?: UnknownRecord;
    widget?: string;
};

type PageResponse = {
    attrs: UnknownRecord;
    diagnostics: ApiDiagnostic[];
    page: UnknownRecord | null;
    snapshotVersion: string;
};

type AttrsResponse = {
    attrs: UnknownRecord;
    diagnostics: ApiDiagnostic[];
    missingNames: string[];
    page: string;
    resolvedNames: string[];
    snapshotVersion: string;
};

type ModalResponse = AttrsResponse & {
    dependencies: UnknownRecord;
    modal: UnknownRecord | null;
};

type ExecuteResponse = {
    command: string;
    data: unknown;
    diagnostics: ApiDiagnostic[];
    message: string;
    page: string | null;
    params: UnknownRecord;
    snapshotVersion: string;
    widget: string | null;
};

type DebugApiRoute = {
    endpoint: string;
    methods: string[];
    rule: string;
};

type DebugSqlRow = UnknownRecord;

type DebugStructureResponse = {
    routes: DebugApiRoute[];
    snapshot: UnknownRecord;
};

type DebugLogsResponse = {
    lines: string[];
    total: number;
};

type DebugPagesResponse = {
    diagnostics: ApiDiagnostic[];
    lastError: string | null;
    pages: PageSummary[];
    snapshot: UnknownRecord;
};

type DebugSnapshotResponse = {
    diagnostics: ApiDiagnostic[];
    lastError: string | null;
    meta: UnknownRecord;
    pageCount: number;
    pagesByUrl: UnknownRecord;
};

type DebugSqlResponse = {
    columns: string[];
    diagnostics: ApiDiagnostic[];
    durationMs: number;
    maxRows: number;
    query: string;
    rowCount: number;
    rows: DebugSqlRow[];
    snapshotVersion: string;
    truncated: boolean;
};

export type {
    ApiDiagnostic,
    ApiEnvelope,
    AttrsResponse,
    DebugApiRoute,
    DebugLogsResponse,
    DebugPagesResponse,
    DebugSnapshotResponse,
    DebugSqlResponse,
    DebugSqlRow,
    DebugStructureResponse,
    ExecuteRequestPayload,
    ExecuteResponse,
    FrontendApiErrorOptions,
    ModalResponse,
    PageResponse,
    PageSummary,
    UnknownRecord
};
