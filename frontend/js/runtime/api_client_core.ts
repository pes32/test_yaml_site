import type {
    ApiDiagnostic,
    ApiEnvelope,
    AttrsResponse,
    ExecuteRequestPayload,
    ExecuteResponse,
    FrontendApiErrorOptions,
    ModalResponse,
    PageResponse,
    PageSummary,
    PagesIndexState,
    TableCommandResponse,
    TableExportResponse,
    TableQueryResponse,
    UnknownRecord,
    WidgetSourceResponse,
    UserRecord
} from './api_contract.ts';
import { asRecord } from '../shared/object_record.ts';
import { uniqueNames } from '../shared/string_list.ts';
import { asString } from '../shared/string_value.ts';

export class FrontendApiError extends Error {
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

/** Канон: `error.code`; legacy: корневой `error_code`. */
function readApiErrorCode(payload: unknown, fallbackCode: string): string {
    const envelope = asRecord(payload);
    const nested = readErrorRecord(payload);
    const fromNested = typeof nested.code === 'string' ? nested.code.trim() : '';
    if (fromNested) {
        return fromNested;
    }
    const fromRoot = typeof envelope.error_code === 'string' ? envelope.error_code.trim() : '';
    if (fromRoot) {
        return fromRoot;
    }
    return fallbackCode;
}

/**
 * Текст ошибки для UI: сначала `error.message`, затем плоское `message`, затем `error` как строка.
 * Details: сначала `error.details`, затем корневой `details` (legacy duplicate).
 */
function normalizeEnvelopeErrorMessage(payload: unknown, fallbackMessage: string): string {
    const envelope = asRecord(payload);
    const error = envelope.error;
    const errorRecord = asRecord(error);
    const errorMessage = errorRecord.message;

    let base = '';
    if (typeof errorMessage === 'string' && errorMessage.trim()) {
        base = errorMessage.trim();
    } else if (typeof envelope.message === 'string' && envelope.message.trim()) {
        base = envelope.message.trim();
    } else if (typeof error === 'string' && error.trim()) {
        base = error.trim();
    } else {
        base = fallbackMessage;
    }

    const nestedDetails = errorRecord.details;
    const topDetails = envelope.details;
    const detailsRaw =
        typeof nestedDetails === 'string'
            ? nestedDetails
            : typeof topDetails === 'string'
              ? topDetails
              : '';
    const details = detailsRaw.trim();
    return details ? `${base}: ${details}` : base;
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

export async function requestEnvelope(url: string, options: RequestInit = {}): Promise<ApiEnvelope | null> {
    const response = await fetch(url, options);
    const payload = await parseResponseBody(response);
    const envelope = asRecord<ApiEnvelope>(payload);
    const fallbackMessage = `HTTP ${response.status}`;

    if (!response.ok) {
        throw new FrontendApiError(
            normalizeEnvelopeErrorMessage(payload, fallbackMessage),
            {
                code: readApiErrorCode(payload, 'http_error'),
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
                code: readApiErrorCode(payload, 'api_error'),
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

function readEnvelopeSnapshotVersion(payload: unknown): string | null {
    const raw = asRecord<ApiEnvelope>(payload).snapshot_version;
    if (raw == null) {
        return null;
    }
    if (typeof raw !== 'string') {
        return null;
    }
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
}

function readEnvelopeMeta(payload: unknown) {
    return {
        diagnostics: readEnvelopeDiagnostics(payload),
        snapshotVersion: readEnvelopeSnapshotVersion(payload)
    };
}

export function normalizePageResponse(payload: unknown): PageResponse {
    const data = readEnvelopeData(payload);
    const page = asRecord(data.page);
    return {
        page: Object.keys(page).length ? page : null,
        attrs: asRecord(data.attrs),
        tableRuntime: asRecord(data.table_runtime),
        ...readEnvelopeMeta(payload)
    };
}

function normalizeAttrsPayload(data: UnknownRecord) {
    const attrs = asRecord(data.attrs);
    return {
        page: asString(data.page),
        attrs,
        tableRuntime: asRecord(data.table_runtime),
        resolvedNames: uniqueNames(data.resolved_names || Object.keys(attrs)),
        missingNames: uniqueNames(data.missing_names)
    };
}

export function normalizeTableQueryResponse(payload: unknown): TableQueryResponse {
    const data = readEnvelopeData(payload);
    return {
        attr: asString(data.attr),
        hasMore: data.has_more === true,
        items: Array.isArray(data.items) ? data.items.slice() : [],
        limit: Number(data.limit) || 0,
        offset: Number(data.offset) || 0,
        page: asString(data.page),
        total: Number(data.total) || 0,
        viewFingerprint: typeof data.view_fingerprint === 'string' ? data.view_fingerprint : '',
        viewId: asString(data.view_id),
        ...readEnvelopeMeta(payload)
    };
}

export function normalizeTableCommandResponse(payload: unknown): TableCommandResponse {
    const data = readEnvelopeData(payload);
    return {
        ...normalizeTableQueryResponse(payload),
        commandsApplied: Array.isArray(data.commands_applied) ? data.commands_applied.slice() : []
    };
}

export function normalizeTableExportResponse(payload: unknown): TableExportResponse {
    const data = readEnvelopeData(payload);
    return {
        attr: asString(data.attr),
        exportChunked: data.export_chunked === true || data.exportChunked === true,
        exportHasMore: data.export_has_more === true || data.exportHasMore === true,
        exportLimit: Number(data.export_limit ?? data.exportLimit) || 0,
        exportOffset: Number(data.export_offset ?? data.exportOffset) || 0,
        page: asString(data.page),
        rows: Array.isArray(data.rows)
            ? data.rows.map((row) => Array.isArray(row) ? row.slice() : [row])
            : [],
        total: Number(data.total) || 0,
        ...readEnvelopeMeta(payload)
    };
}

export function normalizeAttrsResponse(payload: unknown): AttrsResponse {
    const data = readEnvelopeData(payload);
    return {
        ...normalizeAttrsPayload(data),
        ...readEnvelopeMeta(payload)
    };
}

export function normalizeModalResponse(payload: unknown): ModalResponse {
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

export function normalizeExecuteResponse(payload: unknown): ExecuteResponse {
    const data = readEnvelopeData(payload);
    return {
        command: asString(data.command),
        params: asRecord(data.params),
        page: asString(data.page) || null,
        widget: asString(data.widget) || null,
        message: asString(data.message) || 'Команда выполнена',
        data: Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : null,
        updates: asRecord(data.updates),
        silentSuccess: data.silent_success === true || data.silentSuccess === true,
        ...readEnvelopeMeta(payload)
    };
}

export function normalizeWidgetSourceResponse(payload: unknown): WidgetSourceResponse {
    const data = readEnvelopeData(payload);
    return {
        page: asString(data.page),
        widget: asString(data.widget),
        patch: asRecord(data.patch),
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

export function normalizePagesResponse(payload: unknown): PagesIndexState {
    const data = readEnvelopeData(payload);
    return {
        pages: Array.isArray(data.pages)
            ? data.pages.map(normalizePageSummary)
            : [],
        ...readEnvelopeMeta(payload)
    };
}

export async function requestNormalized<T>(
    url: string,
    normalize: (payload: unknown) => T,
    options: RequestInit = {}
): Promise<T> {
    return normalize(await requestEnvelope(url, options));
}

export async function requestData<T = UnknownRecord>(url: string, options: RequestInit = {}): Promise<T> {
    return readEnvelopeData(await requestEnvelope(url, options)) as T;
}

export function jsonRequest(method: string, payload?: unknown): RequestInit {
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: payload == null ? undefined : JSON.stringify(payload)
    };
}
