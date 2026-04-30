import type {
    TableCoreSortState,
    TableDataRow,
    TableRuntimeColumn,
    TableSortState
} from './table_contract.ts';
import { columnIndexByKey } from './table_state_core.ts';
import {
    comparePreparedCellSortValues,
    prepareCellSortValue,
    type PreparedCellSortValue
} from './table_sort.ts';
import { getRowCells } from './table_utils.ts';

type PreparedRowSortItem = {
    id: string;
    keys: PreparedCellSortValue[];
};

function coreSortToRuntimeSort(
    columns: readonly TableRuntimeColumn[],
    sortKeys: readonly TableCoreSortState[]
): TableSortState[] {
    return sortKeys
        .map((item) => {
            const col = columnIndexByKey(columns, item.colKey);
            return col >= 0 ? { col, dir: item.dir === 'desc' ? 'desc' : 'asc' } : null;
        })
        .filter((item): item is TableSortState => item != null);
}

function buildOrderedRowIds(
    rows: readonly TableDataRow[],
    columns: readonly TableRuntimeColumn[],
    sortKeys: readonly TableCoreSortState[],
    listColumnIsMultiselect?: (column: Record<string, unknown>) => boolean
): string[] {
    const runtimeSortKeys = coreSortToRuntimeSort(columns, sortKeys);
    if (runtimeSortKeys.length === 0) {
        return rows.map((row) => String(row.id));
    }
    const source: PreparedRowSortItem[] = rows.map((row) => {
        const cells = getRowCells(row);
        return {
            id: String(row.id),
            keys: runtimeSortKeys.map((sortKey) =>
                prepareCellSortValue(
                    cells[sortKey.col],
                    columns[sortKey.col] as Record<string, unknown> | undefined,
                    listColumnIsMultiselect
                )
            )
        };
    });
    source.sort((left, right) => {
        for (let index = 0; index < runtimeSortKeys.length; index += 1) {
            const sortKey = runtimeSortKeys[index];
            const dir = sortKey.dir === 'desc' ? -1 : 1;
            const compared = comparePreparedCellSortValues(left.keys[index], right.keys[index]);
            if (compared !== 0) return dir * compared;
        }
        return left.id.localeCompare(right.id, undefined, { numeric: false, sensitivity: 'base' });
    });
    return source.map((item) => item.id);
}

export { buildOrderedRowIds, coreSortToRuntimeSort };
