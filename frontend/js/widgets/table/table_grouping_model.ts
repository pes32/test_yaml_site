import type {
    TableColumnKey,
    TableDataRow,
    TableDisplayRow,
    TableRuntimeColumn
} from './table_contract.ts';
import {
    buildPathKey,
    normalizePathSegment,
    sortGroupKeys as sortedGroupKeys
} from './table_grouping.ts';
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

function createDisplayProjection(): TableDisplayProjection {
    return {
        displayIndexToRowId: [],
        displayRows: [],
        rowIdToDisplayIndex: new Map<string, number>(),
        validPathKeys: new Set<string>()
    };
}

function pushDataDisplayRow(
    projection: TableDisplayProjection,
    rowId: string,
    dataIndex: number,
    depth: number,
    pathKey: string
): void {
    projection.rowIdToDisplayIndex.set(rowId, projection.displayRows.length);
    projection.displayIndexToRowId.push(rowId);
    projection.displayRows.push({
        dataIndex,
        depth,
        kind: 'data',
        pathKey,
        rowId
    });
    projection.validPathKeys.add(pathKey);
}

function buildFlatDisplayRows(
    orderedRowIds: readonly string[],
    rowIdToSourceIndex: Map<string, number>,
    options: { limit?: number; offset?: number } = {}
): TableDisplayProjection {
    const projection = createDisplayProjection();
    const start = Math.max(0, Math.floor(options.offset || 0));
    const limit = options.limit == null ? orderedRowIds.length : Math.max(0, Math.floor(options.limit));
    const visibleRowIds = orderedRowIds.slice(start, start + limit);
    visibleRowIds.forEach((rowId) => {
        const dataIndex = rowIdToSourceIndex.get(rowId);
        if (dataIndex == null) return;
        pushDataDisplayRow(projection, rowId, dataIndex, 0, `leaf:${rowId}`);
    });
    return projection;
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

function buildGroupedDisplayRows(
    rows: readonly TableDataRow[],
    columns: readonly TableRuntimeColumn[],
    orderedRowIds: readonly string[],
    rowIdToSourceIndex: Map<string, number>,
    groupingLevelKeys: readonly TableColumnKey[],
    expanded: Set<string>
): TableDisplayProjection {
    const projection = createDisplayProjection();
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
        pushDataDisplayRow(projection, rowId, dataIndex, depth, pathKey);
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
            projection.validPathKeys.add(pathKey);
            projection.displayIndexToRowId.push(null);
            projection.displayRows.push({
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
    return projection;
}

export {
    buildFlatDisplayRows,
    buildGroupedDisplayRows,
    buildRowIdToSourceIndex,
    groupRowIdsByColumn,
    sortedGroupKeys
};
export type { TableDisplayProjection };
