type UnknownRecord = Record<string, unknown>;

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

function asObject<T extends UnknownRecord = UnknownRecord>(value: unknown): T {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as T)
        : ({} as T);
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function readErrorRecord(payload: unknown): UnknownRecord {
    return asObject(asObject(payload).error);
}

function normalizeEnvelopeErrorMessage(payload: unknown, fallbackMessage: string): string {
    const envelope = asObject(payload);
    const error = envelope.error;
    const errorMessage = asObject(error).message;

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
    const envelope = asObject<ApiEnvelope>(payload);
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

function uniqueNames(items: unknown): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    (Array.isArray(items) ? items : []).forEach((item) => {
        const value = String(item || '').trim();
        if (!value || seen.has(value)) {
            return;
        }
        seen.add(value);
        result.push(value);
    });

    return result;
}

function readEnvelopeData(payload: unknown): UnknownRecord {
    return asObject(asObject<ApiEnvelope>(payload).data);
}

function readEnvelopeDiagnostics(payload: unknown): unknown[] {
    const diagnostics = asObject<ApiEnvelope>(payload).diagnostics;
    return Array.isArray(diagnostics) ? diagnostics : [];
}

function readEnvelopeSnapshotVersion(payload: unknown): string {
    return asString(asObject<ApiEnvelope>(payload).snapshot_version);
}

function normalizePageResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    const page = asObject(data.page);
    return {
        page: Object.keys(page).length ? page : null,
        attrs: asObject(data.attrs),
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

function normalizeAttrsResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    const attrs = asObject(data.attrs);
    return {
        page: asString(data.page),
        attrs,
        resolvedNames: uniqueNames(data.resolved_names || Object.keys(attrs)),
        missingNames: uniqueNames(data.missing_names),
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

function normalizeModalResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    const attrs = asObject(data.attrs);
    const dependencies = asObject(data.dependencies);
    const modal = asObject(data.modal);
    return {
        page: asString(data.page),
        modal: Object.keys(modal).length ? modal : null,
        attrs,
        resolvedNames: uniqueNames(data.resolved_names || Object.keys(attrs)),
        missingNames: uniqueNames(data.missing_names),
        dependencies,
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

function normalizeExecuteResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    return {
        command: asString(data.command),
        params: asObject(data.params),
        page: asString(data.page) || null,
        widget: asString(data.widget) || null,
        message: asString(data.message) || 'Команда выполнена',
        data: Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : null,
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

function normalizePagesResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    return {
        pages: Array.isArray(data.pages)
            ? data.pages.map((item): PageSummary => {
                const page = asObject(item);
                return {
                    name: asString(page.name),
                    title: asString(page.title),
                    url: asString(page.url)
                };
            })
            : [],
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

function normalizeDebugStructureResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    return {
        routes: Array.isArray(data.routes) ? data.routes : [],
        snapshot: asObject(data.snapshot)
    };
}

function normalizeDebugLogsResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    return {
        lines: Array.isArray(data.lines) ? data.lines : [],
        total: Number(data.total) || 0
    };
}

function normalizeDebugPagesResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    return {
        pages: Array.isArray(data.pages) ? data.pages : [],
        snapshot: asObject(data.snapshot),
        diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : [],
        lastError: typeof data.last_error === 'string' ? data.last_error : null
    };
}

function normalizeDebugSnapshotResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    return {
        meta: asObject(data.meta),
        pageCount: Number(data.page_count) || 0,
        pagesByUrl: asObject(data.pages_by_url),
        diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : [],
        lastError: typeof data.last_error === 'string' ? data.last_error : null
    };
}

function normalizeDebugSqlResponse(payload: unknown) {
    const data = readEnvelopeData(payload);
    return {
        query: asString(data.query),
        columns: Array.isArray(data.columns)
            ? data.columns.map((item) => asString(item)).filter(Boolean)
            : [],
        rows: Array.isArray(data.rows) ? data.rows.map((item) => asObject(item)) : [],
        rowCount: Number(data.row_count) || 0,
        truncated: Boolean(data.truncated),
        maxRows: Number(data.max_rows) || 0,
        durationMs: Number(data.duration_ms) || 0,
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

function createFrontendApiClient() {
    return {
        requestEnvelope,

        async fetchPage(pageName: string) {
            return normalizePageResponse(
                await requestEnvelope(`/api/page/${encodeURIComponent(pageName)}`)
            );
        },

        async fetchAttrs(pageName: string, names: unknown) {
            const query = encodeURIComponent((Array.isArray(names) ? names : []).join(','));
            return normalizeAttrsResponse(
                await requestEnvelope(`/api/attrs?page=${encodeURIComponent(pageName)}&names=${query}`)
            );
        },

        async fetchModal(pageName: string, modalId: string) {
            return normalizeModalResponse(
                await requestEnvelope(
                    `/api/modal-gui?page=${encodeURIComponent(pageName)}&id=${encodeURIComponent(modalId)}`
                )
            );
        },

        async fetchPages() {
            return normalizePagesResponse(
                await requestEnvelope('/api/pages')
            );
        },

        async executeCommand(payload: ExecuteRequestPayload) {
            return normalizeExecuteResponse(
                await requestEnvelope('/api/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
            );
        },

        async fetchDebugStructure() {
            return normalizeDebugStructureResponse(
                await requestEnvelope('/api/debug/structure')
            );
        },

        async fetchDebugLogs() {
            return normalizeDebugLogsResponse(
                await requestEnvelope('/api/debug/logs')
            );
        },

        async fetchDebugPages() {
            return normalizeDebugPagesResponse(
                await requestEnvelope('/api/debug/pages')
            );
        },

        async fetchDebugSnapshot() {
            return normalizeDebugSnapshotResponse(
                await requestEnvelope('/api/debug/snapshot')
            );
        },

        async executeDebugSql(query: string) {
            return normalizeDebugSqlResponse(
                await requestEnvelope('/api/debug/sql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                })
            );
        }
    };
}

const frontendApiClient = createFrontendApiClient();

export type {
    ApiEnvelope,
    ExecuteRequestPayload,
    FrontendApiErrorOptions,
    PageSummary
};

export {
    FrontendApiError,
    createFrontendApiClient,
    frontendApiClient,
    normalizeAttrsResponse,
    normalizeDebugLogsResponse,
    normalizeDebugPagesResponse,
    normalizeDebugSqlResponse,
    normalizeDebugSnapshotResponse,
    normalizeDebugStructureResponse,
    normalizeEnvelopeErrorMessage,
    normalizeExecuteResponse,
    normalizeModalResponse,
    normalizePagesResponse,
    normalizePageResponse,
    requestEnvelope
};

export default frontendApiClient;
