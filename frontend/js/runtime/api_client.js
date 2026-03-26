class FrontendApiError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'FrontendApiError';
        this.code = options.code || 'frontend_api_error';
        this.status = options.status || 0;
        this.diagnostics = Array.isArray(options.diagnostics) ? options.diagnostics : [];
        this.snapshotVersion = options.snapshotVersion || '';
        this.payload = options.payload || null;
    }
}

function normalizeEnvelopeErrorMessage(payload, fallbackMessage) {
    if (!payload || typeof payload !== 'object') {
        return fallbackMessage;
    }

    const message = payload.error && typeof payload.error === 'object'
        ? payload.error.message
        : null;

    if (typeof message === 'string' && message.trim()) {
        return message.trim();
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
    }

    if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim();
    }

    return fallbackMessage;
}

async function parseResponseBody(response) {
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

async function requestEnvelope(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await parseResponseBody(response);
    const fallbackMessage = `HTTP ${response.status}`;

    if (!response.ok) {
        throw new FrontendApiError(
            normalizeEnvelopeErrorMessage(payload, fallbackMessage),
            {
                code: payload && payload.error && payload.error.code ? payload.error.code : 'http_error',
                status: response.status,
                diagnostics: payload && payload.diagnostics,
                snapshotVersion: payload && payload.snapshot_version,
                payload
            }
        );
    }

    if (payload && payload.ok === false) {
        throw new FrontendApiError(
            normalizeEnvelopeErrorMessage(payload, 'Запрос завершился ошибкой'),
            {
                code: payload.error && payload.error.code ? payload.error.code : 'api_error',
                status: response.status,
                diagnostics: payload.diagnostics,
                snapshotVersion: payload.snapshot_version,
                payload
            }
        );
    }

    return payload;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function asString(value) {
    return typeof value === 'string' ? value : '';
}

function uniqueNames(items) {
    const seen = new Set();
    const result = [];

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

function readEnvelopeData(payload) {
    return asObject(payload && payload.data);
}

function readEnvelopeDiagnostics(payload) {
    return Array.isArray(payload && payload.diagnostics)
        ? payload.diagnostics
        : [];
}

function readEnvelopeSnapshotVersion(payload) {
    return asString(payload && payload.snapshot_version);
}

function normalizePageResponse(payload) {
    const data = readEnvelopeData(payload);
    const page = asObject(data.page);
    return {
        page: Object.keys(page).length ? page : null,
        attrs: asObject(data.attrs),
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

function normalizeAttrsResponse(payload) {
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

function normalizeModalResponse(payload) {
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

function normalizeExecuteResponse(payload) {
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

function normalizeDebugStructureResponse(payload) {
    const data = readEnvelopeData(payload);
    return {
        routes: Array.isArray(data.routes) ? data.routes : [],
        snapshot: asObject(data.snapshot)
    };
}

function normalizeDebugLogsResponse(payload) {
    const data = readEnvelopeData(payload);
    return {
        lines: Array.isArray(data.lines) ? data.lines : [],
        total: Number(data.total) || 0
    };
}

function normalizeDebugPagesResponse(payload) {
    const data = readEnvelopeData(payload);
    return {
        pages: Array.isArray(data.pages) ? data.pages : [],
        snapshot: asObject(data.snapshot),
        diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : [],
        lastError: typeof data.last_error === 'string' ? data.last_error : null
    };
}

function normalizeDebugSnapshotResponse(payload) {
    const data = readEnvelopeData(payload);
    return {
        meta: asObject(data.meta),
        pageCount: Number(data.page_count) || 0,
        pagesByUrl: asObject(data.pages_by_url),
        diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : [],
        lastError: typeof data.last_error === 'string' ? data.last_error : null
    };
}

function createFrontendApiClient() {
    return {
        requestEnvelope,

        async fetchPage(pageName) {
            return normalizePageResponse(
                await requestEnvelope(`/api/page/${encodeURIComponent(pageName)}`)
            );
        },

        async fetchAttrs(pageName, names) {
            const query = encodeURIComponent((Array.isArray(names) ? names : []).join(','));
            return normalizeAttrsResponse(
                await requestEnvelope(`/api/attrs?page=${encodeURIComponent(pageName)}&names=${query}`)
            );
        },

        async fetchModal(pageName, modalId) {
            return normalizeModalResponse(
                await requestEnvelope(
                    `/api/modal-gui?page=${encodeURIComponent(pageName)}&id=${encodeURIComponent(modalId)}`
                )
            );
        },

        async executeCommand(payload) {
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
        }
    };
}

const frontendApiClient = createFrontendApiClient();

export {
    FrontendApiError,
    createFrontendApiClient,
    frontendApiClient,
    normalizeAttrsResponse,
    normalizeDebugLogsResponse,
    normalizeDebugPagesResponse,
    normalizeDebugSnapshotResponse,
    normalizeDebugStructureResponse,
    normalizeEnvelopeErrorMessage,
    normalizeExecuteResponse,
    normalizeModalResponse,
    normalizePageResponse,
    requestEnvelope
};

export default frontendApiClient;
