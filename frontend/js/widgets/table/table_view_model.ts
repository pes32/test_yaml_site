import type {
    TableColumnKey,
    TableCoreCellAddress,
    TableCoreSortState,
    TableDataRow,
    TableRuntimeColumn,
    TableViewModel
} from './table_contract.ts';
import {
    buildFlatDisplayRows,
    buildGroupedDisplayRows,
    buildRowIdToSourceIndex
} from './table_grouping_model.ts';
import { buildOrderedRowIds } from './table_sort_model.ts';

type BuildTableViewModelOptions = {
    expanded?: Set<string>;
    filterRowIds?: Set<string> | string[] | null;
    groupingLevelKeys?: TableColumnKey[];
    lazyWindow?: { limit?: number; offset?: number } | null;
    listColumnIsMultiselect?: (column: Record<string, unknown>) => boolean;
    sortKeys?: TableCoreSortState[];
};

function filterOrderedRowIds(
    rowIds: readonly string[],
    filterRowIds: BuildTableViewModelOptions['filterRowIds']
): string[] {
    if (!filterRowIds) return rowIds.slice();
    const allowed = filterRowIds instanceof Set
        ? filterRowIds
        : new Set((filterRowIds || []).map((rowId) => String(rowId)));
    return rowIds.filter((rowId) => allowed.has(rowId));
}

function buildTableViewModel(
    rows: readonly TableDataRow[],
    columns: readonly TableRuntimeColumn[],
    options: BuildTableViewModelOptions = {}
): TableViewModel {
    const rowIdToSourceIndex = buildRowIdToSourceIndex(rows);
    const orderedRowIds = filterOrderedRowIds(
        buildOrderedRowIds(
            rows,
            columns,
            options.sortKeys || [],
            options.listColumnIsMultiselect
        ),
        options.filterRowIds || null
    );
    const groupingLevelKeys = options.groupingLevelKeys || [];
    const projection = groupingLevelKeys.length
        ? buildGroupedDisplayRows(
              rows,
              columns,
              orderedRowIds,
              rowIdToSourceIndex,
              groupingLevelKeys,
              options.expanded || new Set<string>()
          )
        : buildFlatDisplayRows(orderedRowIds, rowIdToSourceIndex, options.lazyWindow || {});

    return {
        displayIndexToRowId: projection.displayIndexToRowId,
        displayRows: projection.displayRows,
        orderedRowIds,
        rowIdToDisplayIndex: projection.rowIdToDisplayIndex,
        rowIdToSourceIndex,
        validPathKeys: projection.validPathKeys
    };
}

function rowIdAtDisplayIndex(viewModel: TableViewModel, displayIndex: number): string | null {
    const rowId = viewModel.displayIndexToRowId[displayIndex];
    return rowId ? String(rowId) : null;
}

function sourceIndexAtDisplayIndex(viewModel: TableViewModel, displayIndex: number): number {
    const rowId = rowIdAtDisplayIndex(viewModel, displayIndex);
    if (!rowId) return -1;
    const sourceIndex = viewModel.rowIdToSourceIndex.get(rowId);
    return sourceIndex == null ? -1 : sourceIndex;
}

function rowAtDisplayIndex(
    viewModel: TableViewModel,
    rows: readonly TableDataRow[],
    displayIndex: number
): TableDataRow | null {
    const sourceIndex = sourceIndexAtDisplayIndex(viewModel, displayIndex);
    return sourceIndex >= 0 ? rows[sourceIndex] || null : null;
}

function displayIndexForCell(viewModel: TableViewModel, cell: TableCoreCellAddress | null): number {
    if (!cell) return -1;
    const displayIndex = viewModel.rowIdToDisplayIndex.get(cell.rowId);
    return displayIndex == null ? -1 : displayIndex;
}

export {
    buildOrderedRowIds,
    buildTableViewModel,
    displayIndexForCell,
    rowAtDisplayIndex,
    rowIdAtDisplayIndex,
    sourceIndexAtDisplayIndex
};
