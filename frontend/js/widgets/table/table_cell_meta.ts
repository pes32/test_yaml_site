import type {
    TableCellMeta,
    TableCellMetaBucket,
    TableCellMetaMap,
    TableCoreCellAddress,
    TableColumnKey,
    TableRowId
} from './table_contract.ts';

type TableCellMetaPatch = {
    cell: TableCoreCellAddress;
    meta: TableCellMeta | null;
};

const STYLE_BOOLEAN_KEYS = new Set(['bold', 'italic', 'underline', 'strike']);

function cellMetaKey(cell: TableCoreCellAddress): string {
    return `${encodeURIComponent(cell.rowId)}:${encodeURIComponent(cell.colKey)}`;
}

function unwrapVueRaw<T>(value: T): T {
    let current = value;
    for (let index = 0; index < 4; index += 1) {
        if (!current || typeof current !== 'object') return current;
        const raw = (current as { __v_raw?: T }).__v_raw;
        if (!raw || raw === current) return current;
        current = raw;
    }
    return current;
}

function rawCellMeta(meta: TableCellMeta | null | undefined): TableCellMeta | null {
    return unwrapVueRaw(meta || null);
}

function rawCellMetaBucket(bucket: TableCellMetaBucket | null | undefined): TableCellMetaBucket {
    return unwrapVueRaw(bucket || {});
}

function rawCellMetaMap(meta: TableCellMetaMap | null | undefined): TableCellMetaMap {
    return unwrapVueRaw(meta || {});
}

function ownEntries<TValue>(record: Record<string, TValue> | null | undefined): Array<[string, TValue]> {
    return Object.entries(unwrapVueRaw(record || {}) as Record<string, TValue>);
}

function sectionHasEntries(section: Record<string, unknown> | null | undefined): boolean {
    if (!section) return false;
    for (const key in section) {
        if (Object.prototype.hasOwnProperty.call(section, key)) return true;
    }
    return false;
}

function cleanSection<TSection extends Record<string, unknown>>(
    section: TSection | null | undefined
): TSection | undefined {
    const rawSection = unwrapVueRaw(section || null);
    if (!rawSection) return undefined;
    const out: Record<string, unknown> = {};
    Object.entries(rawSection).forEach(([key, value]) => {
        if (value == null) return;
        if (STYLE_BOOLEAN_KEYS.has(key) && value === false) return;
        out[key] = value;
    });
    return sectionHasEntries(out) ? (out as TSection) : undefined;
}

function cleanCellMeta(meta: TableCellMeta | null | undefined): TableCellMeta | null {
    const rawMeta = rawCellMeta(meta);
    if (!rawMeta) return null;
    const dataType = cleanSection(rawMeta.dataType);
    const style = cleanSection(rawMeta.style);
    return dataType || style ? { dataType, style } : null;
}

function cloneCellMeta(meta: TableCellMeta | null | undefined): TableCellMeta {
    const cleaned = cleanCellMeta(meta);
    return {
        dataType: cleaned?.dataType ? { ...cleaned.dataType } : undefined,
        style: cleaned?.style ? { ...cleaned.style } : undefined
    };
}

function bucketHasEntries(bucket: TableCellMetaBucket | null | undefined): boolean {
    const rawBucket = rawCellMetaBucket(bucket);
    for (const _key in rawBucket) return true;
    return false;
}

function cloneCellMetaBucket(bucket: TableCellMetaBucket | null | undefined): TableCellMetaBucket {
    const out: TableCellMetaBucket = {};
    ownEntries(rawCellMetaBucket(bucket)).forEach(([colKey, value]) => {
        const cleaned = cleanCellMeta(value);
        if (cleaned) out[colKey] = cleaned;
    });
    return out;
}

function cloneCellMetaMap(meta: TableCellMetaMap | null | undefined): TableCellMetaMap {
    const out: TableCellMetaMap = {};
    ownEntries(rawCellMetaMap(meta)).forEach(([rowId, bucket]) => {
        const clonedBucket = cloneCellMetaBucket(bucket);
        if (bucketHasEntries(clonedBucket)) out[rowId] = clonedBucket;
    });
    return out;
}

function hasCellMetaEntries(metaMap: TableCellMetaMap | null | undefined): boolean {
    const rawMap = rawCellMetaMap(metaMap);
    for (const rowId in rawMap) {
        if (bucketHasEntries(rawMap[rowId])) return true;
    }
    return false;
}

function peekCellMeta(
    metaMap: TableCellMetaMap | null | undefined,
    cell: TableCoreCellAddress | null | undefined
): TableCellMeta | null {
    if (!cell || !hasCellMetaEntries(metaMap)) return null;
    const bucket = rawCellMetaMap(metaMap)[String(cell.rowId || '')];
    return rawCellMeta(rawCellMetaBucket(bucket)[String(cell.colKey || '')]);
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
    const base = cleanCellMeta(current);
    const patchMeta = rawCellMeta(patch);
    const dataType = patchMeta?.dataType
        ? cleanSection({ ...(base?.dataType || {}), ...unwrapVueRaw(patchMeta.dataType) })
        : base?.dataType
          ? { ...base.dataType }
          : undefined;
    const style = patchMeta?.style
        ? cleanSection({ ...(base?.style || {}), ...unwrapVueRaw(patchMeta.style) })
        : base?.style
          ? { ...base.style }
          : undefined;
    return dataType || style ? { dataType, style } : null;
}

function cellMetaEqual(
    left: TableCellMeta | null | undefined,
    right: TableCellMeta | null | undefined
): boolean {
    const leftClean = cleanCellMeta(left);
    const rightClean = cleanCellMeta(right);
    if (!leftClean || !rightClean) return leftClean === rightClean;
    const sections: Array<keyof TableCellMeta> = ['dataType', 'style'];
    return sections.every((sectionName) => {
        const leftSection = leftClean[sectionName] || {};
        const rightSection = rightClean[sectionName] || {};
        const leftKeys = Object.keys(leftSection);
        const rightKeys = Object.keys(rightSection);
        return (
            leftKeys.length === rightKeys.length &&
            leftKeys.every((key) =>
                Object.prototype.hasOwnProperty.call(rightSection, key) &&
                Object.is(
                    (leftSection as Record<string, unknown>)[key],
                    (rightSection as Record<string, unknown>)[key]
                )
            )
        );
    });
}

function cellMetaIsCanonical(meta: TableCellMeta | null | undefined): boolean {
    const rawMeta = rawCellMeta(meta);
    if (!rawMeta) return true;
    const cleaned = cleanCellMeta(rawMeta);
    if (!cleaned) return false;
    const sections: Array<keyof TableCellMeta> = ['dataType', 'style'];
    return sections.every((sectionName) => {
        const rawSection = unwrapVueRaw(rawMeta[sectionName] || {});
        const cleanSectionValue = cleaned[sectionName] || {};
        const rawKeys = Object.keys(rawSection);
        const cleanKeys = Object.keys(cleanSectionValue);
        return (
            rawKeys.length === cleanKeys.length &&
            rawKeys.every((key) =>
                Object.prototype.hasOwnProperty.call(cleanSectionValue, key) &&
                Object.is(
                    (rawSection as Record<string, unknown>)[key],
                    (cleanSectionValue as Record<string, unknown>)[key]
                )
            )
        );
    });
}

function patchCellMeta(
    metaMap: TableCellMetaMap | null | undefined,
    patches: readonly TableCellMetaPatch[]
): TableCellMetaMap {
    const base = rawCellMetaMap(metaMap);
    let out: TableCellMetaMap | null = null;
    const bucketCopies = new Map<string, TableCellMetaBucket>();
    patches.forEach((patch) => {
        const rowId = String(patch.cell.rowId || '');
        const colKey = String(patch.cell.colKey || '');
        if (!rowId || !colKey) return;
        const currentRoot = out || base;
        const currentBucket = rawCellMetaBucket(bucketCopies.get(rowId) || currentRoot[rowId]);
        const currentMeta = rawCellMeta(currentBucket[colKey]);
        const nextMeta = mergeCellMeta(currentMeta, patch.meta);
        if (cellMetaEqual(currentMeta, nextMeta) && cellMetaIsCanonical(currentMeta)) return;
        if (!out) out = { ...base };
        let nextBucket = bucketCopies.get(rowId);
        if (!nextBucket) {
            nextBucket = { ...currentBucket };
            bucketCopies.set(rowId, nextBucket);
        }
        if (nextMeta) nextBucket[colKey] = nextMeta;
        else delete nextBucket[colKey];
        if (bucketHasEntries(nextBucket)) out[rowId] = nextBucket;
        else delete out[rowId];
    });
    if (out) return out;
    return metaMap ? base : {};
}

function patchCellMetaForRowsAndColumns(
    metaMap: TableCellMetaMap | null | undefined,
    rowIds: readonly TableRowId[],
    columnKeys: readonly TableColumnKey[],
    metaPatch: TableCellMeta | null
): TableCellMetaMap {
    const base = rawCellMetaMap(metaMap);
    let out: TableCellMetaMap | null = null;
    const emptyBucket: TableCellMetaBucket = {};
    const bucketCache = new WeakMap<
        TableCellMetaBucket,
        { bucket: TableCellMetaBucket; changed: boolean }
    >();
    let emptyMergeComputed = false;
    let emptyMergeResult: TableCellMeta | null = null;
    const mergeCache = new WeakMap<TableCellMeta, TableCellMeta | null>();
    const changedCache = new WeakMap<TableCellMeta, boolean>();
    const nextMetaFor = (currentMeta: TableCellMeta | null): TableCellMeta | null => {
        if (!currentMeta) {
            if (!emptyMergeComputed) {
                emptyMergeResult = mergeCellMeta(null, metaPatch);
                emptyMergeComputed = true;
            }
            return emptyMergeResult;
        }
        const rawMeta = rawCellMeta(currentMeta);
        if (!rawMeta) return nextMetaFor(null);
        const cached = mergeCache.get(rawMeta);
        if (mergeCache.has(rawMeta)) return cached || null;
        const merged = mergeCellMeta(rawMeta, metaPatch);
        mergeCache.set(rawMeta, merged);
        return merged;
    };
    const metaChanged = (
        currentMeta: TableCellMeta | null,
        nextMeta: TableCellMeta | null
    ): boolean => {
        if (!currentMeta && !nextMeta) return false;
        if (!currentMeta || !nextMeta) return true;
        const rawMeta = rawCellMeta(currentMeta);
        if (rawMeta && changedCache.has(rawMeta)) return changedCache.get(rawMeta) === true;
        const changed = !(cellMetaEqual(currentMeta, nextMeta) && cellMetaIsCanonical(currentMeta));
        if (rawMeta) changedCache.set(rawMeta, changed);
        return changed;
    };

    const patchBucket = (currentBucket: TableCellMetaBucket) => {
        const cached = bucketCache.get(currentBucket);
        if (cached) return cached;
        let nextBucket: TableCellMetaBucket | null = null;
        columnKeys.forEach((rawColKey) => {
            const colKey = String(rawColKey || '');
            if (!colKey) return;
            const currentMeta = rawCellMeta((nextBucket || currentBucket)[colKey]);
            const nextMeta = nextMetaFor(currentMeta);
            if (!metaChanged(currentMeta, nextMeta)) return;
            if (!nextBucket) nextBucket = { ...currentBucket };
            if (nextMeta) nextBucket[colKey] = nextMeta;
            else delete nextBucket[colKey];
        });
        const result = {
            bucket: nextBucket || currentBucket,
            changed: !!nextBucket
        };
        bucketCache.set(currentBucket, result);
        return result;
    };

    rowIds.forEach((rawRowId) => {
        const rowId = String(rawRowId || '');
        if (!rowId) return;
        const currentBucket = base[rowId] ? rawCellMetaBucket(base[rowId]) : emptyBucket;
        const patched = patchBucket(currentBucket);
        if (!patched.changed) return;
        if (!out) out = { ...base };
        if (bucketHasEntries(patched.bucket)) out[rowId] = patched.bucket;
        else delete out[rowId];
    });
    if (out) return out;
    return metaMap ? base : {};
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
    const rowSet = new Set(rowIds.map((rowId) => String(rowId || '')));
    const columnSet = new Set(columnKeys.map((colKey) => String(colKey || '')));
    const out: TableCellMetaMap = {};
    ownEntries(rawCellMetaMap(metaMap)).forEach(([rowId, bucket]) => {
        if (!rowSet.has(rowId)) return;
        const nextBucket: TableCellMetaBucket = {};
        ownEntries(rawCellMetaBucket(bucket)).forEach(([colKey, value]) => {
            if (!columnSet.has(colKey)) return;
            const cloned = cleanCellMeta(value);
            if (cloned) nextBucket[colKey] = cloned;
        });
        if (bucketHasEntries(nextBucket)) out[rowId] = nextBucket;
    });
    return out;
}

function copyRowCellMeta(
    metaMap: TableCellMetaMap | null | undefined,
    sourceRowId: TableRowId,
    targetRowId: TableRowId,
    columnKeys: readonly TableColumnKey[]
): TableCellMetaMap {
    const base = rawCellMetaMap(metaMap);
    const sourceId = String(sourceRowId || '');
    const targetId = String(targetRowId || '');
    if (!sourceId || !targetId) return metaMap ? base : {};
    const sourceBucket = rawCellMetaBucket(base[sourceId]);
    const targetBucket = rawCellMetaBucket(base[targetId]);
    let out: TableCellMetaMap | null = null;
    let nextTargetBucket: TableCellMetaBucket | null = null;
    columnKeys.forEach((columnKey) => {
        const colKey = String(columnKey || '');
        if (!colKey) return;
        const sourceMeta = cleanCellMeta(sourceBucket[colKey]);
        const targetMeta = rawCellMeta((nextTargetBucket || targetBucket)[colKey]);
        const nextMeta = sourceMeta ? cloneCellMeta(sourceMeta) : null;
        if (cellMetaEqual(targetMeta, nextMeta) && cellMetaIsCanonical(targetMeta)) return;
        if (!out) out = { ...base };
        if (!nextTargetBucket) nextTargetBucket = { ...targetBucket };
        if (nextMeta) nextTargetBucket[colKey] = nextMeta;
        else delete nextTargetBucket[colKey];
        if (bucketHasEntries(nextTargetBucket)) out[targetId] = nextTargetBucket;
        else delete out[targetId];
    });
    if (out) return out;
    return metaMap ? base : {};
}

export {
    cellMetaKey,
    cellMetaEqual,
    cloneCellMeta,
    cloneCellMetaBucket,
    cloneCellMetaMap,
    copyRowCellMeta,
    getCellMeta,
    hasCellMetaEntries,
    normalizeColor,
    normalizeFontSize,
    patchCellMeta,
    patchCellMetaForRowsAndColumns,
    peekCellMeta,
    pruneCellMeta,
    rawCellMetaBucket,
    rawCellMetaMap
};
export type { TableCellMetaPatch };
