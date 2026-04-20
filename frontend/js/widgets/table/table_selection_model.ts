import type {
    TableCellAddress,
    TableCoreCellAddress,
    TableCoreSelectionState,
    TableRuntimeColumn,
    TableSelectionRect,
    TableSelectionState,
    TableViewModel
} from './table_contract.ts';
import { clamp } from './table_utils.ts';
import { columnIndexByKey, columnKeyAt } from './table_state_core.ts';

type TableSelectionIdentity = {
    anchor: TableCoreCellAddress | null;
    focus: TableCoreCellAddress | null;
    fullWidthRowIds: string[] | null;
};

function normalizeDisplayCell(
    cell: TableCellAddress | null | undefined,
    rowCount: number,
    colCount: number
): TableCellAddress {
    return {
        r: clamp(cell?.r || 0, 0, Math.max(0, rowCount - 1)),
        c: clamp(cell?.c || 0, 0, Math.max(0, colCount - 1))
    };
}

function selectionRectFromDisplay(
    selection: TableSelectionState,
    rowCount: number,
    colCount: number
): TableSelectionRect {
    if (selection.fullWidthRows) {
        const r0 = normalizeDisplayCell({ r: selection.fullWidthRows.r0, c: 0 }, rowCount, colCount).r;
        const r1 = normalizeDisplayCell({ r: selection.fullWidthRows.r1, c: 0 }, rowCount, colCount).r;
        return {
            r0: Math.min(r0, r1),
            r1: Math.max(r0, r1),
            c0: 0,
            c1: Math.max(0, colCount - 1)
        };
    }
    const anchor = normalizeDisplayCell(selection.anchor, rowCount, colCount);
    const focus = normalizeDisplayCell(selection.focus, rowCount, colCount);
    return {
        r0: Math.min(anchor.r, focus.r),
        r1: Math.max(anchor.r, focus.r),
        c0: Math.min(anchor.c, focus.c),
        c1: Math.max(anchor.c, focus.c)
    };
}

function rowIdAtDisplayIndex(viewModel: TableViewModel, displayIndex: number): string | null {
    const rowId = viewModel.displayIndexToRowId[displayIndex];
    return rowId ? String(rowId) : null;
}

function displayCellToCore(
    cell: TableCellAddress | null | undefined,
    columns: readonly TableRuntimeColumn[],
    viewModel: TableViewModel
): TableCoreCellAddress | null {
    if (!cell) return null;
    const rowId = rowIdAtDisplayIndex(viewModel, cell.r);
    const colKey = columnKeyAt(columns, cell.c);
    return rowId && colKey ? { rowId, colKey } : null;
}

function fullWidthRowIdsFromDisplay(
    selection: TableSelectionState,
    viewModel: TableViewModel
): string[] | null {
    if (!selection.fullWidthRows) return null;
    const r0 = Math.min(selection.fullWidthRows.r0, selection.fullWidthRows.r1);
    const r1 = Math.max(selection.fullWidthRows.r0, selection.fullWidthRows.r1);
    const rowIds: string[] = [];
    for (let rowIndex = r0; rowIndex <= r1; rowIndex += 1) {
        const rowId = rowIdAtDisplayIndex(viewModel, rowIndex);
        if (rowId) rowIds.push(rowId);
    }
    return rowIds.length ? rowIds : null;
}

function buildCoreSelectionFromDisplay(
    selection: TableSelectionState,
    columns: readonly TableRuntimeColumn[],
    viewModel: TableViewModel
): TableCoreSelectionState {
    return {
        anchor: displayCellToCore(selection.anchor, columns, viewModel),
        focus: displayCellToCore(selection.focus, columns, viewModel),
        fullWidthRowIds: fullWidthRowIdsFromDisplay(selection, viewModel)
    };
}

function coreCellToDisplay(
    cell: TableCoreCellAddress | null | undefined,
    columns: readonly TableRuntimeColumn[],
    viewModel: TableViewModel
): TableCellAddress | null {
    if (!cell) return null;
    const rowIndex = viewModel.rowIdToDisplayIndex.get(cell.rowId);
    const colIndex = columnIndexByKey(columns, cell.colKey);
    if (rowIndex == null || colIndex < 0) return null;
    return { r: rowIndex, c: colIndex };
}

function restoreDisplaySelectionFromCore(
    selection: TableCoreSelectionState,
    columns: readonly TableRuntimeColumn[],
    viewModel: TableViewModel,
    fallback: TableSelectionState
): TableSelectionState {
    const anchor = coreCellToDisplay(selection.anchor, columns, viewModel) || fallback.anchor;
    const focus = coreCellToDisplay(selection.focus, columns, viewModel) || anchor;
    const rowIndexes = (selection.fullWidthRowIds || [])
        .map((rowId) => viewModel.rowIdToDisplayIndex.get(rowId))
        .filter((rowIndex): rowIndex is number => rowIndex != null);
    return {
        anchor,
        focus,
        fullWidthRows: rowIndexes.length
            ? {
                  r0: Math.min(...rowIndexes),
                  r1: Math.max(...rowIndexes)
              }
            : null
    };
}

function captureSelectionIdentity(
    selection: TableSelectionState,
    columns: readonly TableRuntimeColumn[],
    viewModel: TableViewModel
): TableSelectionIdentity {
    return {
        ...buildCoreSelectionFromDisplay(selection, columns, viewModel)
    };
}

function restoreSelectionIdentity(
    identity: TableSelectionIdentity,
    columns: readonly TableRuntimeColumn[],
    viewModel: TableViewModel,
    fallback: TableSelectionState
): TableSelectionState {
    return restoreDisplaySelectionFromCore(identity, columns, viewModel, fallback);
}

export {
    buildCoreSelectionFromDisplay,
    captureSelectionIdentity,
    coreCellToDisplay,
    displayCellToCore,
    fullWidthRowIdsFromDisplay,
    normalizeDisplayCell,
    restoreDisplaySelectionFromCore,
    restoreSelectionIdentity,
    rowIdAtDisplayIndex,
    selectionRectFromDisplay
};
export type { TableSelectionIdentity };
