import type {
    TableCellMeta,
    TableCellMetaMap,
    TableCoreCellAddress,
    TableColumnKey,
    TableRowId
} from './table_contract.ts';

type TableCellMetaPatch = {
    cell: TableCoreCellAddress;
    meta: TableCellMeta | null;
};

function cellMetaKey(cell: TableCoreCellAddress): string {
    return `${encodeURIComponent(cell.rowId)}:${encodeURIComponent(cell.colKey)}`;
}

function cloneCellMeta(meta: TableCellMeta | null | undefined): TableCellMeta {
    return {
        dataType: meta && meta.dataType ? { ...meta.dataType } : undefined,
        style: meta && meta.style ? { ...meta.style } : undefined
    };
}

function cloneCellMetaMap(meta: TableCellMetaMap | null | undefined): TableCellMetaMap {
    const out: TableCellMetaMap = {};
    Object.entries(meta || {}).forEach(([key, value]) => {
        out[key] = cloneCellMeta(value);
    });
    return out;
}

function hasCellMetaEntries(metaMap: TableCellMetaMap | null | undefined): boolean {
    if (!metaMap) return false;
    for (const _key in metaMap) return true;
    return false;
}

function peekCellMeta(
    metaMap: TableCellMetaMap | null | undefined,
    cell: TableCoreCellAddress | null | undefined
): TableCellMeta | null {
    if (!cell || !hasCellMetaEntries(metaMap)) return null;
    return metaMap?.[cellMetaKey(cell)] || null;
}

function getCellMeta(
    metaMap: TableCellMetaMap | null | undefined,
    cell: TableCoreCellAddress | null | undefined
): TableCellMeta | null {
    const meta = peekCellMeta(metaMap, cell);
    return meta ? cloneCellMeta(meta) : null;
}

function mergeCellMeta(
    current: TableCellMeta | null | undefined,
    patch: TableCellMeta | null
): TableCellMeta | null {
    if (!patch) return null;
    const dataType = patch.dataType
        ? { ...(current?.dataType || {}), ...patch.dataType }
        : current?.dataType
          ? { ...current.dataType }
          : undefined;
    const style = patch.style
        ? { ...(current?.style || {}), ...patch.style }
        : current?.style
          ? { ...current.style }
          : undefined;
    return dataType || style ? { dataType, style } : null;
}

function patchCellMeta(
    metaMap: TableCellMetaMap | null | undefined,
    patches: readonly TableCellMetaPatch[]
): TableCellMetaMap {
    const out = cloneCellMetaMap(metaMap);
    patches.forEach((patch) => {
        const key = cellMetaKey(patch.cell);
        const nextMeta = mergeCellMeta(out[key], patch.meta);
        if (nextMeta) {
            out[key] = nextMeta;
        } else {
            delete out[key];
        }
    });
    return out;
}

function normalizeColor(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(raw)) return raw;
    if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(raw)) return raw;
    return null;
}

function normalizeFontSize(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(8, Math.min(36, Math.floor(parsed)));
}

function pruneCellMeta(
    metaMap: TableCellMetaMap | null | undefined,
    rowIds: readonly TableRowId[],
    columnKeys: readonly TableColumnKey[]
): TableCellMetaMap {
    const rowSet = new Set(rowIds);
    const columnSet = new Set(columnKeys);
    const out: TableCellMetaMap = {};
    Object.entries(metaMap || {}).forEach(([key, value]) => {
        const [encodedRowId, encodedColKey] = key.split(':');
        const rowId = decodeURIComponent(encodedRowId || '');
        const colKey = decodeURIComponent(encodedColKey || '');
        if (rowSet.has(rowId) && columnSet.has(colKey)) {
            out[key] = cloneCellMeta(value);
        }
    });
    return out;
}

function copyRowCellMeta(
    metaMap: TableCellMetaMap | null | undefined,
    sourceRowId: TableRowId,
    targetRowId: TableRowId,
    columnKeys: readonly TableColumnKey[]
): TableCellMetaMap {
    const out = cloneCellMetaMap(metaMap);
    const sourceId = String(sourceRowId || '');
    const targetId = String(targetRowId || '');
    if (!sourceId || !targetId) return out;

    columnKeys.forEach((columnKey) => {
        const colKey = String(columnKey || '');
        if (!colKey) return;
        const sourceKey = cellMetaKey({ rowId: sourceId, colKey });
        const meta = metaMap?.[sourceKey];
        if (!meta) return;
        out[cellMetaKey({ rowId: targetId, colKey })] = cloneCellMeta(meta);
    });
    return out;
}

export {
    cellMetaKey,
    cloneCellMeta,
    cloneCellMetaMap,
    copyRowCellMeta,
    getCellMeta,
    hasCellMetaEntries,
    normalizeColor,
    normalizeFontSize,
    patchCellMeta,
    peekCellMeta,
    pruneCellMeta
};
export type { TableCellMetaPatch };
