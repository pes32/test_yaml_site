/**
 * Table grouping helpers: display tree, path keys, expanded state pruning.
 */
import type {
    TableDataRow,
    TableDisplayRow,
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

function sortGroupKeys(groups: Map<string, number[]>): string[] {
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

function buildDisplayRows(
    tableData: TableDataRow[],
    levels: number[],
    expandedSet: Set<string>,
    columns: TableRuntimeColumn[]
): { displayRows: TableDisplayRow[]; rowMap: Map<string, number>; validPathKeys: Set<string> } {
    const displayRows: TableDisplayRow[] = [];
    const rowMap = new Map<string, number>();
    const validPathKeys = new Set<string>();

    const data = Array.isArray(tableData) ? tableData : [];
    const cols = Array.isArray(columns) ? columns : [];
    const normalizedLevels = normalizeLevels(levels, cols);

    for (let index = 0; index < data.length; index += 1) {
        const row = data[index];
        const id = row && row.id != null ? String(row.id) : '';
        if (id) rowMap.set(id, index);
    }

    if (normalizedLevels.length === 0) {
        for (let index = 0; index < data.length; index += 1) {
            const row = data[index];
            const id = row && row.id != null ? String(row.id) : 'r' + index;
            const pathKey = 'leaf:' + id;
            displayRows.push({
                kind: 'data',
                pathKey,
                dataIndex: index,
                rowId: id,
                depth: 0
            });
            validPathKeys.add(pathKey);
        }
        return { displayRows, rowMap, validPathKeys };
    }

    function walk(rowsIndices: number[], level: number, prefixSegments: string[]) {
        if (level >= normalizedLevels.length) {
            for (const rowIndex of rowsIndices) {
                const row = data[rowIndex];
                const id = row && row.id != null ? String(row.id) : 'r' + rowIndex;
                const pathKey =
                    prefixSegments.length > 0
                        ? buildPathKey(prefixSegments) + '/leaf:' + id
                        : 'leaf:' + id;
                displayRows.push({
                    kind: 'data',
                    pathKey,
                    dataIndex: rowIndex,
                    rowId: id,
                    depth: level
                });
                validPathKeys.add(pathKey);
            }
            return;
        }

        const col = normalizedLevels[level];
        const groups = groupRowsByColumn(data, rowsIndices, col);
        const keysSorted = sortGroupKeys(groups);
        const colMeta = cols[col];
        const columnTitle =
            colMeta &&
            colMeta.label != null &&
            String(colMeta.label).trim() !== ''
                ? String(colMeta.label).trim()
                : 'Столбец ' + (col + 1);

        for (const groupKey of keysSorted) {
            const childSegments = prefixSegments.concat([groupKey]);
            const pathKey = buildPathKey(childSegments);
            validPathKeys.add(pathKey);
            displayRows.push({
                kind: 'group',
                pathKey,
                depth: level,
                level,
                label: columnTitle + ': ' + groupKey,
                colIndex: col,
                value: groupKey,
                columnLabel: columnTitle
            });
            const expanded = expandedSet && expandedSet.has && expandedSet.has(pathKey);
            if (expanded) {
                walk(groups.get(groupKey) || [], level + 1, childSegments);
            }
        }
    }

    walk(
        data.map((_, index) => index),
        0,
        []
    );

    return { displayRows, rowMap, validPathKeys };
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
    buildDisplayRows,
    buildGroupedDataOrder,
    buildPathKey,
    canAddGroupingLevel,
    normalizePathSegment,
    pruneExpanded
};
