import type {
    TableCoreSortState,
    TableDataRow,
    TableRuntimeColumn,
    TableSortState
} from './table_contract.ts';
import { columnIndexByKey } from './table_state_core.ts';
import { compareRowsComposite } from './table_sort.ts';

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
    const source = rows.map((row, index) => ({ index, row }));
    if (runtimeSortKeys.length > 0) {
        source.sort((left, right) =>
            compareRowsComposite(
                left.row,
                right.row,
                runtimeSortKeys,
                columns as Array<Record<string, unknown>>,
                listColumnIsMultiselect
            )
        );
    }
    return source.map((item) => String(item.row.id));
}

export { buildOrderedRowIds, coreSortToRuntimeSort };
