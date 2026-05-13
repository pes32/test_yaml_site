/**
 * Stable view fingerprint for /api/table-query — mirrors backend canonicalization
 * in table_runtime._canonical_view_for_fingerprint + _table_query_view_fingerprint.
 */

/** Должно совпадать с `MAX_TABLE_QUERY_LIMIT` в `backend/table_runtime.py`. */
export const MAX_TABLE_QUERY_LIMIT = 100;
/** Должно совпадать с `DEFAULT_TABLE_QUERY_LIMIT` в `backend/table_runtime.py`. */
const DEFAULT_TABLE_QUERY_LIMIT = 100;

function finitePositiveInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function normalizeQueryLimitForFingerprint(value: unknown, fallback = DEFAULT_TABLE_QUERY_LIMIT): number {
    return Math.max(1, Math.min(MAX_TABLE_QUERY_LIMIT, finitePositiveInt(value, fallback)));
}

function jsonEscapePyStyle(input: string): string {
    let out = '"';
    for (let index = 0; index < input.length; index += 1) {
        const char = input[index]!;
        const code = char.charCodeAt(0);
        if (char === '"') {
            out += '\\"';
        } else if (char === '\\') {
            out += '\\\\';
        } else if (char === '\b') {
            out += '\\b';
        } else if (char === '\f') {
            out += '\\f';
        } else if (char === '\n') {
            out += '\\n';
        } else if (char === '\r') {
            out += '\\r';
        } else if (char === '\t') {
            out += '\\t';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            out += char;
        }
    }
    return `${out}"`;
}

function stableStringifyPy(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (value === true) {
        return 'true';
    }
    if (value === false) {
        return 'false';
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return 'null';
        }
        if (Number.isInteger(value)) {
            return String(value);
        }
        return String(value);
    }
    if (typeof value === 'string') {
        return jsonEscapePyStyle(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringifyPy(item)).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const keys = Object.keys(record).sort();
        const parts = keys.map(
            (key) => `${jsonEscapePyStyle(key)}: ${stableStringifyPy(record[key])}`
        );
        return `{${parts.join(', ')}}`;
    }
    return jsonEscapePyStyle(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function canonicalViewForFingerprint(view: Record<string, unknown>): Record<string, unknown> {
    const rawOffset = view.offset;
    const offset = rawOffset === undefined || rawOffset === null || rawOffset === ''
        ? 0
        : Math.max(0, Math.floor(Number(rawOffset) || 0));
    const limit = normalizeQueryLimitForFingerprint(view.limit);
    const sort = Array.isArray(view.sort) ? view.sort : [];
    const filters = Array.isArray(view.filters) ? view.filters : [];
    const group = Array.isArray(view.group) ? view.group : [];
    const searchRaw = view.search;
    const search =
        searchRaw === undefined || searchRaw === null ? null : String(searchRaw);
    const expandedRaw = Array.isArray(view.expandedGroups) ? view.expandedGroups : [];
    const expandedSorted = [...expandedRaw].map(String).sort();
    return {
        expandedGroups: expandedSorted,
        filters,
        group,
        limit,
        offset,
        search,
        sort
    };
}

export async function computeTableQueryViewFingerprint(params: {
    attr: string;
    page: string;
    provider: string;
    sourceKey?: string | null;
    view: Record<string, unknown>;
}): Promise<string> {
    const viewMerged = {
        ...params.view,
        limit: normalizeQueryLimitForFingerprint(params.view.limit),
        offset: Math.max(
            0,
            params.view.offset === undefined || params.view.offset === null
                ? 0
                : Math.floor(Number(params.view.offset) || 0)
        )
    };
    const canonicalView = canonicalViewForFingerprint(viewMerged);
    const payload = {
        attr: params.attr,
        page: params.page,
        provider: params.provider,
        sourceKey: params.sourceKey != null ? String(params.sourceKey) : '',
        view: canonicalView
    };
    const raw = stableStringifyPy(payload);
    const bytes = new TextEncoder().encode(raw);
    const digest = await crypto.subtle.digest('SHA-1', bytes);
    const hex = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    return `view_${hex.slice(0, 16)}`;
}
