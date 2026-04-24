/**
 * Table grouping helpers: display tree, path keys, expanded state pruning.
 */
import type {
    TableDataRow,
    TableRuntimeColumn
} from './table_contract.ts';

const TABLE_LAZY_THRESHOLD = 100;

function normalizePathSegment(value: unknown): string {
    if (value == null) return '';
    return String(value);
}

function buildPathKey(segments: unknown[]): string {
    return segments.map((segment) => encodeURIComponent(normalizePathSegment(segment))).join('/');
}

function sortGroupKeys(groups: ReadonlyMap<string, readonly unknown[]>): string[] {
    return [...groups.keys()].sort((left, right) =>
        String(left).localeCompare(String(right), undefined, {
            numeric: false,
            sensitivity: 'base'
        })
    );
}

function groupRowsByColumn(
    data: Array<{ cells?: unknown[] }>,
    rowsIndices: number[],
    col: number
): Map<string, number[]> {
    const groups = new Map<string, number[]>();
    for (const rowIndex of rowsIndices) {
        const row = data[rowIndex];
        const cells = row && Array.isArray(row.cells) ? row.cells : [];
        const key = normalizePathSegment(cells[col]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(rowIndex);
    }
    return groups;
}

function normalizeLevels(levels: unknown, columns: unknown[]): number[] {
    const cols = Array.isArray(columns) ? columns : [];
    return Array.isArray(levels)
        ? levels.filter((column) => column >= 0 && column < (cols.length || 999))
        : [];
}

function canAddGroupingLevel(totalCols: number, levelsLen: number): boolean {
    const numCols = totalCols | 0;
    if (numCols < 2) return false;
    return levelsLen < numCols - 1;
}

function buildGroupedDataOrder(
    tableData: TableDataRow[],
    levels: number[],
    columns: TableRuntimeColumn[]
): number[] {
    const data = Array.isArray(tableData) ? tableData : [];
    const cols = Array.isArray(columns) ? columns : [];
    const normalizedLevels = normalizeLevels(levels, cols);
    if (normalizedLevels.length === 0) {
        return data.map((_, index) => index);
    }
    const ordered: number[] = [];

    function walk(rowsIndices: number[], level: number) {
        if (level >= normalizedLevels.length) {
            rowsIndices.forEach((rowIndex) => ordered.push(rowIndex));
            return;
        }
        const col = normalizedLevels[level];
        const groups = groupRowsByColumn(data, rowsIndices, col);
        const keysSorted = sortGroupKeys(groups);
        keysSorted.forEach((key) => walk(groups.get(key) || [], level + 1));
    }

    walk(
        data.map((_, index) => index),
        0
    );

    return ordered;
}

function pruneExpanded(expandedSet: Set<string>, validPathKeys: Set<string> | undefined): Set<string> {
    const next = new Set<string>();
    if (!expandedSet || !validPathKeys) return next;
    for (const key of expandedSet) {
        if (validPathKeys.has(key)) next.add(key);
    }
    return next;
}

export {
    TABLE_LAZY_THRESHOLD,
    buildGroupedDataOrder,
    buildPathKey,
    canAddGroupingLevel,
    normalizePathSegment,
    pruneExpanded,
    sortGroupKeys
};
