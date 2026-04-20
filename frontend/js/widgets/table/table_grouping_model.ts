import type {
    TableColumnKey,
    TableDataRow,
    TableDisplayRow,
    TableRuntimeColumn
} from './table_contract.ts';
import { buildPathKey, normalizePathSegment } from './table_grouping.ts';
import { withUniqueColumnKeys } from './table_state_core.ts';
import { getRowCells } from './table_utils.ts';

type TableDisplayProjection = {
    displayIndexToRowId: Array<string | null>;
    displayRows: TableDisplayRow[];
    rowIdToDisplayIndex: Map<string, number>;
    validPathKeys: Set<string>;
};

function buildRowIdToSourceIndex(rows: readonly TableDataRow[]): Map<string, number> {
    const map = new Map<string, number>();
    rows.forEach((row, index) => {
        if (row && row.id != null) map.set(String(row.id), index);
    });
    return map;
}

function buildFlatDisplayRows(
    orderedRowIds: readonly string[],
    rowIdToSourceIndex: Map<string, number>,
    options: { limit?: number; offset?: number } = {}
): TableDisplayProjection {
    const displayRows: TableDisplayRow[] = [];
    const displayIndexToRowId: Array<string | null> = [];
    const rowIdToDisplayIndex = new Map<string, number>();
    const validPathKeys = new Set<string>();
    const start = Math.max(0, Math.floor(options.offset || 0));
    const limit = options.limit == null ? orderedRowIds.length : Math.max(0, Math.floor(options.limit));
    const visibleRowIds = orderedRowIds.slice(start, start + limit);
    visibleRowIds.forEach((rowId) => {
        const dataIndex = rowIdToSourceIndex.get(rowId);
        if (dataIndex == null) return;
        const pathKey = `leaf:${rowId}`;
        rowIdToDisplayIndex.set(rowId, displayRows.length);
        displayIndexToRowId.push(rowId);
        displayRows.push({
            dataIndex,
            depth: 0,
            kind: 'data',
            pathKey,
            rowId
        });
        validPathKeys.add(pathKey);
    });
    return { displayIndexToRowId, displayRows, rowIdToDisplayIndex, validPathKeys };
}

function groupRowIdsByColumn(
    rows: readonly TableDataRow[],
    rowIds: readonly string[],
    rowIdToSourceIndex: Map<string, number>,
    colIndex: number
): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const rowId of rowIds) {
        const sourceIndex = rowIdToSourceIndex.get(rowId);
        if (sourceIndex == null) continue;
        const row = rows[sourceIndex];
        const key = normalizePathSegment(getRowCells(row)[colIndex]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(rowId);
    }
    return groups;
}

function sortedGroupKeys(groups: Map<string, string[]>): string[] {
    return [...groups.keys()].sort((left, right) =>
        String(left).localeCompare(String(right), undefined, {
            numeric: false,
            sensitivity: 'base'
        })
    );
}

function buildGroupedDisplayRows(
    rows: readonly TableDataRow[],
    columns: readonly TableRuntimeColumn[],
    orderedRowIds: readonly string[],
    rowIdToSourceIndex: Map<string, number>,
    groupingLevelKeys: readonly TableColumnKey[],
    expanded: Set<string>
): TableDisplayProjection {
    const displayRows: TableDisplayRow[] = [];
    const displayIndexToRowId: Array<string | null> = [];
    const rowIdToDisplayIndex = new Map<string, number>();
    const validPathKeys = new Set<string>();
    const coreColumns = withUniqueColumnKeys(columns);
    const levelColumnIndexes = groupingLevelKeys
        .map((colKey) => coreColumns.findIndex((column) => column.columnKey === colKey))
        .filter((index) => index >= 0);

    const pushDataRow = (rowId: string, depth: number, prefixSegments: string[]) => {
        const dataIndex = rowIdToSourceIndex.get(rowId);
        if (dataIndex == null) return;
        const pathKey =
            prefixSegments.length > 0
                ? `${buildPathKey(prefixSegments)}/leaf:${rowId}`
                : `leaf:${rowId}`;
        rowIdToDisplayIndex.set(rowId, displayRows.length);
        displayIndexToRowId.push(rowId);
        displayRows.push({
            dataIndex,
            depth,
            kind: 'data',
            pathKey,
            rowId
        });
        validPathKeys.add(pathKey);
    };

    const walk = (rowIds: readonly string[], level: number, prefixSegments: string[]) => {
        if (level >= levelColumnIndexes.length) {
            rowIds.forEach((rowId) => pushDataRow(rowId, level, prefixSegments));
            return;
        }
        const colIndex = levelColumnIndexes[level];
        const groups = groupRowIdsByColumn(rows, rowIds, rowIdToSourceIndex, colIndex);
        const column = columns[colIndex];
        const columnTitle =
            column?.label != null && String(column.label).trim() !== ''
                ? String(column.label).trim()
                : `Столбец ${colIndex + 1}`;
        for (const groupKey of sortedGroupKeys(groups)) {
            const childSegments = prefixSegments.concat([groupKey]);
            const pathKey = buildPathKey(childSegments);
            validPathKeys.add(pathKey);
            displayIndexToRowId.push(null);
            displayRows.push({
                colIndex,
                columnLabel: columnTitle,
                depth: level,
                kind: 'group',
                label: `${columnTitle}: ${groupKey}`,
                level,
                pathKey,
                value: groupKey
            });
            if (expanded.has(pathKey)) {
                walk(groups.get(groupKey) || [], level + 1, childSegments);
            }
        }
    };

    walk(orderedRowIds, 0, []);
    return { displayIndexToRowId, displayRows, rowIdToDisplayIndex, validPathKeys };
}

export {
    buildFlatDisplayRows,
    buildGroupedDisplayRows,
    buildRowIdToSourceIndex,
    groupRowIdsByColumn,
    sortedGroupKeys
};
export type { TableDisplayProjection };
