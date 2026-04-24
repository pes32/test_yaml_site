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
    message?: unknown;
    ok?: boolean;
    snapshot_version?: unknown;
};

export type PageSummary = {
    name: string;
    title: string;
    url: string;
};

export type ExecuteRequestPayload = {
    command: string;
    output_attrs?: string[];
    page?: string;
    params?: UnknownRecord;
    widget?: string;
};

export type PageResponse = {
    attrs: UnknownRecord;
    diagnostics: ApiDiagnostic[];
    page: UnknownRecord | null;
    snapshotVersion: string;
};

export type AttrsResponse = {
    attrs: UnknownRecord;
    diagnostics: ApiDiagnostic[];
    missingNames: string[];
    page: string;
    resolvedNames: string[];
    snapshotVersion: string;
};

export type ModalResponse = AttrsResponse & {
    dependencies: UnknownRecord;
    modal: UnknownRecord | null;
};

export type ExecuteResponse = {
    command: string;
    data: unknown;
    diagnostics: ApiDiagnostic[];
    message: string;
    page: string | null;
    params: UnknownRecord;
    snapshotVersion: string;
    widget: string | null;
};

export type DebugApiRoute = {
    endpoint: string;
    methods: string[];
    rule: string;
};

export type DebugSqlRow = UnknownRecord;

export type DebugStructureResponse = {
    routes: DebugApiRoute[];
    snapshot: UnknownRecord;
};

export type DebugLogsResponse = {
    lines: string[];
    total: number;
};

export type DebugPagesResponse = {
    diagnostics: ApiDiagnostic[];
    lastError: string | null;
    pages: PageSummary[];
    snapshot: UnknownRecord;
};

export type DebugSnapshotResponse = {
    diagnostics: ApiDiagnostic[];
    lastError: string | null;
    meta: UnknownRecord;
    pageCount: number;
    pagesByUrl: UnknownRecord;
};

export type DebugSqlResponse = {
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
