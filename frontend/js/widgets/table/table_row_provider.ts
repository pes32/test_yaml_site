import type {
    TableDataMode,
    TableDataRow,
    TableRemoteDisplayItem,
    TableRemoteProviderState,
    TableSortDirection,
    TableRuntimeProviderConfig,
    TableViewState
} from './table_contract.ts';

/** Должно совпадать с `LOCAL_FULL_MAX_ROWS` в `backend/table_runtime.py`. */
const LOCAL_FULL_MAX_ROWS = 100;
/** Должно совпадать с `DEFAULT_TABLE_QUERY_LIMIT` в `backend/table_runtime.py`. */
const DEFAULT_REMOTE_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Как backend `table_runtime._source_key` — нужен для `sourceKey` в fingerprint /api/table-query. */
function inferInlineSourceFieldKey(widget: unknown): string {
    if (!isRecord(widget)) return '';
    for (const key of ['value', 'source', 'data'] as const) {
        if (Object.prototype.hasOwnProperty.call(widget, key) && widget[key] != null) {
            return key;
        }
    }
    return '';
}

/** Достаёт ключ поля источника строк для удалённых запросов (camelCase, snake_case или из тела виджета). */
export function resolveRemoteProviderSourceKey(runtime: unknown, widget: unknown): string {
    const rec = isRecord(runtime) ? runtime : {};
    const fromCamel = rec.sourceKey;
    if (fromCamel != null && String(fromCamel).trim() !== '') return String(fromCamel);
    const fromSnake = rec.source_key;
    if (fromSnake != null && String(fromSnake).trim() !== '') return String(fromSnake);
    return inferInlineSourceFieldKey(widget);
}

function asPositiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeMode(value: unknown): TableDataMode {
    return value === 'remote-paged' ? 'remote-paged' : 'local-full';
}

function normalizeView(value: unknown): TableViewState {
    const raw = isRecord(value) ? value : {};
    return {
        expandedGroups: Array.isArray(raw.expandedGroups)
            ? raw.expandedGroups.map((item) => String(item))
            : [],
        filters: Array.isArray(raw.filters)
            ? raw.filters.filter(isRecord)
            : [],
        group: Array.isArray(raw.group)
            ? raw.group.filter(isRecord)
            : [],
        limit: asPositiveInteger(raw.limit, DEFAULT_REMOTE_LIMIT),
        offset: Math.max(0, Math.floor(Number(raw.offset) || 0)),
        search: raw.search == null ? null : String(raw.search),
        sort: Array.isArray(raw.sort)
            ? raw.sort
                .filter(isRecord)
                .map((item) => {
                    const direction: TableSortDirection =
                        item.direction === 'desc' || item.dir === 'desc' ? 'desc' : 'asc';
                    return {
                        columnKey: String(item.columnKey || item.colKey || ''),
                        direction
                    };
                })
                .filter((item) => item.columnKey)
            : []
    };
}

function normalizeRemoteItem(value: unknown, fallbackIndex: number): TableRemoteDisplayItem | null {
    if (!isRecord(value)) return null;
    if (value.kind === 'group') {
        return {
            columnKey: value.columnKey != null
                ? String(value.columnKey)
                : value.column_key != null
                  ? String(value.column_key)
                  : '',
            count: Math.max(0, Math.floor(Number(value.count) || 0)),
            expanded: value.expanded !== false,
            groupId: String(value.groupId || value.group_id || `group_${fallbackIndex}`),
            key: String(value.key || ''),
            kind: 'group',
            level: Math.max(0, Math.floor(Number(value.level) || 0))
        };
    }
    if (value.kind === 'row') {
        return {
            kind: 'row',
            rowId: String(value.rowId || value.row_id || `row_${fallbackIndex}`),
            sourceIndex: Math.max(0, Math.floor(Number(value.sourceIndex ?? value.source_index ?? fallbackIndex) || 0)),
            values: Array.isArray(value.values) ? value.values.slice() : []
        };
    }
    return null;
}

function remoteItemToDataRow(item: TableRemoteDisplayItem, fallbackIndex: number): TableDataRow | null {
    if (item.kind !== 'row') return null;
    return {
        id: item.rowId || `row_${fallbackIndex}`,
        cells: item.values.slice()
    };
}

function createInitialRemoteProviderState(): TableRemoteProviderState {
    return {
        activeAbortController: null,
        activeRequestId: 0,
        activeViewFingerprint: '',
        cellRangeRules: [],
        columnRulesByKey: {},
        directCellOverrides: {},
        formatRules: [],
        globalRules: [],
        itemsByDisplayIndex: {},
        loadedRanges: [],
        mode: 'local-full',
        attr: '',
        page: '',
        provider: 'inline',
        rowItemsById: {},
        rowRangeRules: [],
        selectionExpression: null,
        snapshotVersion: '',
        sourceKey: '',
        tableId: '',
        totalRows: 0,
        view: normalizeView({ limit: DEFAULT_REMOTE_LIMIT, offset: 0 }),
        viewId: ''
    };
}

function normalizeRuntimeProviderConfig(value: unknown): TableRuntimeProviderConfig {
    if (!isRecord(value)) return {};
    return value as TableRuntimeProviderConfig;
}

function createRemoteProviderState(config: TableRuntimeProviderConfig): TableRemoteProviderState {
    const initialWindow = isRecord(config.initialWindow) ? config.initialWindow : {};
    const offset = Math.max(0, Math.floor(Number(initialWindow.offset) || 0));
    const rawItems = Array.isArray(initialWindow.items) ? initialWindow.items : [];
    const itemsByDisplayIndex: Record<number, TableRemoteDisplayItem> = {};
    const rowItemsById: TableRemoteProviderState['rowItemsById'] = {};
    rawItems.forEach((item, index) => {
        const normalized = normalizeRemoteItem(item, offset + index);
        if (normalized) {
            itemsByDisplayIndex[offset + index] = normalized;
            if (normalized.kind === 'row') {
                rowItemsById[normalized.rowId] = normalized;
            }
        }
    });
    const limit = asPositiveInteger(initialWindow.limit, rawItems.length || DEFAULT_REMOTE_LIMIT);
    const totalRows = Math.max(0, Math.floor(Number(initialWindow.total) || rawItems.length || 0));
    return {
        activeAbortController: null,
        activeRequestId: 0,
        activeViewFingerprint: String(initialWindow.view_fingerprint || config.viewFingerprint || ''),
        cellRangeRules: [],
        columnRulesByKey: {},
        directCellOverrides: {},
        formatRules: [],
        globalRules: [],
        itemsByDisplayIndex,
        loadedRanges: rawItems.length ? [{ start: offset, end: offset + rawItems.length }] : [],
        mode: normalizeMode(config.mode),
        attr: String(config.attr || ''),
        page: String(config.page || ''),
        provider: String(config.provider || 'inline'),
        rowItemsById,
        rowRangeRules: [],
        selectionExpression: null,
        snapshotVersion: String(config.snapshotVersion || config.snapshot_version || ''),
        sourceKey: config.sourceKey != null ? String(config.sourceKey) : '',
        tableId: String(config.tableId || ''),
        totalRows,
        view: normalizeView({
            ...(config.initialView || {}),
            limit,
            offset
        }),
        viewId: String(initialWindow.view_id || '')
    };
}

function rowsFromRemoteProviderState(state: TableRemoteProviderState): TableDataRow[] {
    return Object.entries(state.itemsByDisplayIndex)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([index, item]) => remoteItemToDataRow(item, Number(index)))
        .filter((item): item is TableDataRow => item != null);
}

function mergeRemoteWindow(
    state: TableRemoteProviderState,
    payload: {
        items?: unknown[];
        limit?: number;
        offset?: number;
        total?: number;
        viewId?: string;
    }
): TableRemoteProviderState {
    const offset = Math.max(0, Math.floor(Number(payload.offset) || 0));
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const itemsByDisplayIndex = { ...state.itemsByDisplayIndex };
    const rowItemsById = { ...state.rowItemsById };
    rawItems.forEach((item, index) => {
        const normalized = normalizeRemoteItem(item, offset + index);
        if (!normalized) return;
        itemsByDisplayIndex[offset + index] = normalized;
        if (normalized.kind === 'row') rowItemsById[normalized.rowId] = normalized;
    });
    return {
        ...state,
        itemsByDisplayIndex,
        loadedRanges: rawItems.length
            ? state.loadedRanges.concat([{ start: offset, end: offset + rawItems.length }])
            : state.loadedRanges,
        rowItemsById,
        totalRows: Math.max(0, Math.floor(Number(payload.total) || state.totalRows || 0)),
        view: normalizeView({
            ...state.view,
            limit: payload.limit || state.view.limit,
            offset
        }),
        viewId: String(payload.viewId || state.viewId || '')
    };
}

export {
    DEFAULT_REMOTE_LIMIT,
    LOCAL_FULL_MAX_ROWS,
    createInitialRemoteProviderState,
    createRemoteProviderState,
    mergeRemoteWindow,
    normalizeRuntimeProviderConfig,
    rowsFromRemoteProviderState
};
