import type {
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
} from './api_contract.ts';
import { asRecord } from '../shared/object_record.ts';
import { uniqueNames } from '../shared/string_list.ts';
import { asString } from '../shared/string_value.ts';

class FrontendApiError extends Error {
    code: string;
    diagnostics: unknown[];
    payload: unknown;
    snapshotVersion: string;
    status: number;

    constructor(message: string, options: FrontendApiErrorOptions = {}) {
        super(message);
        this.name = 'FrontendApiError';
        this.code = typeof options.code === 'string' && options.code ? options.code : 'frontend_api_error';
        this.status = Number(options.status) || 0;
        this.diagnostics = Array.isArray(options.diagnostics) ? options.diagnostics : [];
        this.snapshotVersion = typeof options.snapshotVersion === 'string' ? options.snapshotVersion : '';
        this.payload = options.payload || null;
    }
}

function readErrorRecord(payload: unknown): UnknownRecord {
    return asRecord(asRecord(payload).error);
}

function normalizeEnvelopeErrorMessage(payload: unknown, fallbackMessage: string): string {
    const envelope = asRecord(payload);
    const error = envelope.error;
    const errorMessage = asRecord(error).message;

    if (typeof errorMessage === 'string' && errorMessage.trim()) {
        return errorMessage.trim();
    }

    if (typeof envelope.message === 'string' && envelope.message.trim()) {
        return envelope.message.trim();
    }

    if (typeof error === 'string' && error.trim()) {
        return error.trim();
    }

    return fallbackMessage;
}

async function parseResponseBody(response: Response): Promise<unknown | null> {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return null;
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
}

async function requestEnvelope(url: string, options: RequestInit = {}): Promise<ApiEnvelope | null> {
    const response = await fetch(url, options);
    const payload = await parseResponseBody(response);
    const envelope = asRecord<ApiEnvelope>(payload);
    const errorRecord = readErrorRecord(payload);
    const fallbackMessage = `HTTP ${response.status}`;

    if (!response.ok) {
        throw new FrontendApiError(
            normalizeEnvelopeErrorMessage(payload, fallbackMessage),
            {
                code: errorRecord.code || 'http_error',
                status: response.status,
                diagnostics: envelope.diagnostics,
                snapshotVersion: envelope.snapshot_version,
                payload
            }
        );
    }

    if (payload && envelope.ok === false) {
        throw new FrontendApiError(
            normalizeEnvelopeErrorMessage(payload, 'Запрос завершился ошибкой'),
            {
                code: errorRecord.code || 'api_error',
                status: response.status,
                diagnostics: envelope.diagnostics,
                snapshotVersion: envelope.snapshot_version,
                payload
            }
        );
    }

    return payload ? envelope : null;
}

function readEnvelopeData(payload: unknown): UnknownRecord {
    return asRecord(asRecord<ApiEnvelope>(payload).data);
}

function readEnvelopeDiagnostics(payload: unknown): ApiDiagnostic[] {
    const diagnostics = asRecord<ApiEnvelope>(payload).diagnostics;
    return Array.isArray(diagnostics)
        ? diagnostics.filter((item): item is ApiDiagnostic => !!item && typeof item === 'object' && !Array.isArray(item))
        : [];
}

function readEnvelopeSnapshotVersion(payload: unknown): string {
    return asString(asRecord<ApiEnvelope>(payload).snapshot_version);
}

function readEnvelopeMeta(payload: unknown) {
    return {
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

function normalizePageResponse(payload: unknown): PageResponse {
    const data = readEnvelopeData(payload);
    const page = asRecord(data.page);
    return {
        page: Object.keys(page).length ? page : null,
        attrs: asRecord(data.attrs),
        ...readEnvelopeMeta(payload)
    };
}

function normalizeAttrsPayload(data: UnknownRecord) {
    const attrs = asRecord(data.attrs);
    return {
        page: asString(data.page),
        attrs,
        resolvedNames: uniqueNames(data.resolved_names || Object.keys(attrs)),
        missingNames: uniqueNames(data.missing_names)
    };
}

function normalizeAttrsResponse(payload: unknown): AttrsResponse {
    const data = readEnvelopeData(payload);
    return {
        ...normalizeAttrsPayload(data),
        ...readEnvelopeMeta(payload)
    };
}

function normalizeModalResponse(payload: unknown): ModalResponse {
    const data = readEnvelopeData(payload);
    const dependencies = asRecord(data.dependencies);
    const modal = asRecord(data.modal);
    return {
        ...normalizeAttrsPayload(data),
        modal: Object.keys(modal).length ? modal : null,
        dependencies,
        ...readEnvelopeMeta(payload)
    };
}

function normalizeExecuteResponse(payload: unknown): ExecuteResponse {
    const data = readEnvelopeData(payload);
    return {
        command: asString(data.command),
        params: asRecord(data.params),
        page: asString(data.page) || null,
        widget: asString(data.widget) || null,
        message: asString(data.message) || 'Команда выполнена',
        data: Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : null,
        ...readEnvelopeMeta(payload)
    };
}

function normalizePageSummary(item: unknown): PageSummary {
    const page = asRecord(item);
    return {
        name: asString(page.name),
        title: asString(page.title),
        url: asString(page.url)
    };
}

function normalizePagesResponse(payload: unknown): { pages: PageSummary[]; diagnostics: ApiDiagnostic[]; snapshotVersion: string } {
    const data = readEnvelopeData(payload);
    return {
        pages: Array.isArray(data.pages)
            ? data.pages.map(normalizePageSummary)
            : [],
        ...readEnvelopeMeta(payload)
    };
}

function normalizeDebugRoute(item: unknown): DebugApiRoute {
    const route = asRecord(item);
    return {
        endpoint: asString(route.endpoint),
        methods: Array.isArray(route.methods)
            ? route.methods.map((method) => asString(method)).filter(Boolean)
            : [],
        rule: asString(route.rule)
    };
}

function normalizeDebugStructureResponse(payload: unknown): DebugStructureResponse {
    const data = readEnvelopeData(payload);
    return {
        routes: Array.isArray(data.routes) ? data.routes.map(normalizeDebugRoute) : [],
        snapshot: asRecord(data.snapshot)
    };
}

function normalizeDebugLogsResponse(payload: unknown): DebugLogsResponse {
    const data = readEnvelopeData(payload);
    return {
        lines: Array.isArray(data.lines) ? data.lines.map((line) => String(line)) : [],
        total: Number(data.total) || 0
    };
}

function normalizeDebugPagesResponse(payload: unknown): DebugPagesResponse {
    const data = readEnvelopeData(payload);
    return {
        pages: Array.isArray(data.pages) ? data.pages.map(normalizePageSummary) : [],
        snapshot: asRecord(data.snapshot),
        diagnostics: Array.isArray(data.diagnostics) ? readEnvelopeDiagnostics({ diagnostics: data.diagnostics }) : [],
        lastError: typeof data.last_error === 'string' ? data.last_error : null
    };
}

function normalizeDebugSnapshotResponse(payload: unknown): DebugSnapshotResponse {
    const data = readEnvelopeData(payload);
    return {
        meta: asRecord(data.meta),
        pageCount: Number(data.page_count) || 0,
        pagesByUrl: asRecord(data.pages_by_url),
        diagnostics: Array.isArray(data.diagnostics) ? readEnvelopeDiagnostics({ diagnostics: data.diagnostics }) : [],
        lastError: typeof data.last_error === 'string' ? data.last_error : null
    };
}

function normalizeDebugSqlResponse(payload: unknown): DebugSqlResponse {
    const data = readEnvelopeData(payload);
    return {
        query: asString(data.query),
        columns: Array.isArray(data.columns)
            ? data.columns.map((item) => asString(item)).filter(Boolean)
            : [],
        rows: Array.isArray(data.rows) ? data.rows.map((item) => asRecord(item)) : [],
        rowCount: Number(data.row_count) || 0,
        truncated: Boolean(data.truncated),
        maxRows: Number(data.max_rows) || 0,
        durationMs: Number(data.duration_ms) || 0,
        ...readEnvelopeMeta(payload)
    };
}

async function requestNormalized<T>(
    url: string,
    normalize: (payload: unknown) => T,
    options: RequestInit = {}
): Promise<T> {
    return normalize(await requestEnvelope(url, options));
}

function createFrontendApiClient() {
    return {
        requestEnvelope,

        async fetchPage(pageName: string) {
            return requestNormalized(`/api/page/${encodeURIComponent(pageName)}`, normalizePageResponse);
        },

        async fetchAttrs(pageName: string, names: unknown) {
            const query = encodeURIComponent((Array.isArray(names) ? names : []).join(','));
            return requestNormalized(
                `/api/attrs?page=${encodeURIComponent(pageName)}&names=${query}`,
                normalizeAttrsResponse
            );
        },

        async fetchModal(pageName: string, modalId: string) {
            return requestNormalized(
                `/api/modal-gui?page=${encodeURIComponent(pageName)}&id=${encodeURIComponent(modalId)}`,
                normalizeModalResponse
            );
        },

        async fetchPages() {
            return requestNormalized('/api/pages', normalizePagesResponse);
        },

        async executeCommand(payload: ExecuteRequestPayload) {
            return requestNormalized(
                '/api/execute',
                normalizeExecuteResponse,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );
        },

        async fetchDebugStructure() {
            return requestNormalized('/api/debug/structure', normalizeDebugStructureResponse);
        },

        async fetchDebugLogs() {
            return requestNormalized('/api/debug/logs', normalizeDebugLogsResponse);
        },

        async fetchDebugPages() {
            return requestNormalized('/api/debug/pages', normalizeDebugPagesResponse);
        },

        async fetchDebugSnapshot() {
            return requestNormalized('/api/debug/snapshot', normalizeDebugSnapshotResponse);
        },

        async executeDebugSql(query: string) {
            return requestNormalized(
                '/api/debug/sql',
                normalizeDebugSqlResponse,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                }
            );
        }
    };
}

const frontendApiClient = createFrontendApiClient();

export type {
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
    PageSummary
};

export {
    FrontendApiError,
    frontendApiClient,
    normalizePageResponse
};

export default frontendApiClient;
