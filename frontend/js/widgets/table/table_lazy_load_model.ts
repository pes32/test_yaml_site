import type { TableDataRow } from './table_contract.ts';

type LazyAppendResult = {
    duplicateRowIds: string[];
    rows: TableDataRow[];
};

function normalizeLazyChunkSize(rawValue: unknown, fallback: number): number {
    const parsed = typeof rawValue === 'number' ? rawValue : parseInt(String(rawValue || ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    return Math.max(1, Math.floor(fallback || 1));
}

function takeLazyChunk<T>(
    pendingRows: readonly T[],
    chunkSize: number
): { chunk: T[]; remaining: T[] } {
    const safeSize = Math.max(1, Math.floor(chunkSize || 1));
    const source = Array.isArray(pendingRows) ? pendingRows : [];
    return {
        chunk: source.slice(0, safeSize),
        remaining: source.slice(safeSize)
    };
}

function appendRowsDedup(
    currentRows: readonly TableDataRow[],
    incomingRows: readonly TableDataRow[]
): LazyAppendResult {
    const seen = new Set((currentRows || []).map((row) => String(row.id)));
    const duplicateRowIds: string[] = [];
    const rows = (currentRows || []).map((row) => ({
        id: String(row.id),
        cells: Array.isArray(row.cells) ? row.cells.slice() : []
    }));
    for (const row of incomingRows || []) {
        const id = String(row.id);
        if (seen.has(id)) {
            duplicateRowIds.push(id);
            continue;
        }
        seen.add(id);
        rows.push({
            id,
            cells: Array.isArray(row.cells) ? row.cells.slice() : []
        });
    }
    return { duplicateRowIds, rows };
}

function splitLazyInitialRows<T>(
    rows: readonly T[],
    options: { enabled: boolean; threshold: number }
): { isFullyLoaded: boolean; pendingRows: T[]; visibleRows: T[] } {
    const source = Array.isArray(rows) ? rows : [];
    const threshold = Math.max(0, Math.floor(options.threshold || 0));
    if (!options.enabled || source.length <= threshold) {
        return {
            isFullyLoaded: true,
            pendingRows: [],
            visibleRows: source.slice()
        };
    }
    return {
        isFullyLoaded: false,
        pendingRows: source.slice(threshold),
        visibleRows: source.slice(0, threshold)
    };
}

export {
    appendRowsDedup,
    normalizeLazyChunkSize,
    splitLazyInitialRows,
    takeLazyChunk
};
export type { LazyAppendResult };
