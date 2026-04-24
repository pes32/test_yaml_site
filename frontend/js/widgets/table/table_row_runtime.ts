import {
    assignRowLineNumber,
    cloneTableRowDeep,
    nextLineNumber
} from './table_utils.ts';
import { isContextMenuSnapshotCurrent } from './table_context_menu_model.ts';
import type {
    TableContextMenuSnapshot,
    TableDataRow,
    TableRuntimeMethodSubset,
    TableRuntimeVm
} from './table_contract.ts';
import { TABLE_RUNTIME_SYNC } from './table_runtime_state.ts';
import { rowIdAtDisplayIndex } from './table_view_model.ts';

type TableRowRuntimeSurface = TableRuntimeVm;

function snapshotStillCurrent(
    vm: TableRowRuntimeSurface,
    snapshot: TableContextMenuSnapshot | null | undefined
): boolean {
    if (isContextMenuSnapshotCurrent(snapshot, vm.contextMenuSessionId)) return true;
    vm.hideContextMenu();
    return false;
}

function snapshotSourceIndex(
    vm: TableRowRuntimeSurface,
    snapshot: TableContextMenuSnapshot | null | undefined
): number {
    if (snapshot?.anchorRowId) {
        const sourceIndex = vm.tableViewModelSnapshot().rowIdToSourceIndex.get(snapshot.anchorRowId);
        return sourceIndex == null ? -1 : sourceIndex;
    }
    return vm.resolveDataRowIndex(snapshot?.anchorRow ?? -1);
}

function insertRowsFromCommand(
    vm: TableRowRuntimeSurface,
    rows: Array<{ id: string; cells: unknown[] }>,
    placement: { afterRowId?: string | null; beforeRowId?: string | null } = {}
): void {
    vm.dispatchTableCommand(
        {
            ...placement,
            rows,
            type: 'INSERT_ROWS'
        },
        {},
        'insert row',
        TABLE_RUNTIME_SYNC.ROWS_AND_SELECTION
    );
    vm.refreshGroupingViewFromData();
    vm.onInput();
}

function rowIdAtSourceIndex(vm: TableRowRuntimeSurface, sourceIndex: number): string | null {
    const row = vm.tableData[sourceIndex];
    return row && row.id != null ? String(row.id) : null;
}

function restoreSnapshotRowSelection(
    vm: TableRowRuntimeSurface,
    snapshot: TableContextMenuSnapshot,
    rowId: string
): void {
    vm.hideContextMenu();
    vm.restoreSelectionByRowIds(
        rowId,
        rowId,
        snapshot.anchorCol || 0,
        snapshot.anchorCol || 0,
        false
    );
}

function insertFirstRowFromSnapshot(
    vm: TableRowRuntimeSurface,
    snapshot: TableContextMenuSnapshot
): void {
    const newRow = vm.makeEmptyRow();
    const newRowId = String(newRow.id);
    insertRowsFromCommand(vm, [newRow]);
    restoreSnapshotRowSelection(vm, snapshot, newRowId);
}

function duplicateRowFromSnapshot(
    vm: TableRowRuntimeSurface,
    snapshot: TableContextMenuSnapshot,
    where: 'above' | 'below'
): void {
    if (!snapshotStillCurrent(vm, snapshot)) return;
    const rowId = snapshot.anchorRowId || '';
    const sourceIndex = snapshotSourceIndex(vm, snapshot);
    if (!rowId || sourceIndex < 0 || sourceIndex >= vm.tableData.length) return;
    vm.hideContextMenu();
    vm.duplicateTableRowByIdRelative(rowId, where, snapshot.anchorCol);
}

function addRowFromSnapshot(
    vm: TableRowRuntimeSurface,
    snapshot: TableContextMenuSnapshot,
    placement: 'above' | 'below'
): void {
    if (!snapshotStillCurrent(vm, snapshot)) return;
    if (vm.tableData.length === 0) {
        insertFirstRowFromSnapshot(vm, snapshot);
        return;
    }
    const dataIndex = snapshotSourceIndex(vm, snapshot);
    const isAbove = placement === 'above';
    const inRange = isAbove
        ? dataIndex >= 0 && dataIndex <= vm.tableData.length
        : dataIndex >= 0 && dataIndex < vm.tableData.length;
    if (!inRange) return;
    const newRow = vm.makeEmptyRow();
    const newRowId = String(newRow.id);
    const rowPlacement = isAbove
        ? { beforeRowId: rowIdAtSourceIndex(vm, dataIndex) }
        : { afterRowId: rowIdAtSourceIndex(vm, dataIndex) };
    insertRowsFromCommand(vm, [newRow], rowPlacement);
    restoreSnapshotRowSelection(vm, snapshot, newRowId);
}

const RowRuntimeMethods = {
    moveTableRowByIdRelative(rowId: string, delta: number, anchorCol?: number | null) {
        if (this.groupingActive || this.tableUiLocked) return;
        const length = this.tableData.length;
        const sourceIndex = this.tableViewModelSnapshot().rowIdToSourceIndex.get(rowId) ?? -1;
        const row = rowIdAtSourceIndex(this, sourceIndex) === rowId ? sourceIndex : -1;
        if (row == null || row < 0) return;
        const target = row + delta;
        if (target < 0 || target >= length) return;
        const column = this.normCol(
            anchorCol != null ? anchorCol : this.selFocus.c
        );
        this.dispatchTableCoreCommand(
            { delta, rowId, type: 'MOVE_ROW' },
            'move row',
            TABLE_RUNTIME_SYNC.ROWS_AND_SELECTION
        );
        this.refreshGroupingViewFromData();
        this.onInput();
        this.restoreSelectionByRowIds(rowId, rowId, column, column, false);
    },

    moveTableRowRelative(rowIndex: number, delta: number, anchorCol?: number | null) {
        if (this.groupingActive || this.tableUiLocked) return;
        const movedRowId = rowIdAtDisplayIndex(
            this.tableViewModelSnapshot(),
            this.normRow(rowIndex)
        ) || '';
        if (!movedRowId) return;
        this.moveTableRowByIdRelative(movedRowId, delta, anchorCol);
    },

    duplicateTableRowRelative(
        rowIndex: number,
        where: 'above' | 'below',
        anchorCol?: number | null
    ) {
        if (this.groupingActive || this.tableUiLocked) return;
        const rowId = rowIdAtDisplayIndex(
            this.tableViewModelSnapshot(),
            this.normRow(rowIndex)
        );
        if (!rowId) return;
        this.duplicateTableRowByIdRelative(rowId, where, anchorCol);
    },

    duplicateTableRowByIdRelative(
        rowId: string,
        where: 'above' | 'below',
        anchorCol?: number | null
    ) {
        if (this.groupingActive || this.tableUiLocked) return;
        const row = this.tableViewModelSnapshot().rowIdToSourceIndex.get(rowId) ?? -1;
        const length = this.tableData.length;
        if (row < 0 || row >= length) return;
        const column = this.normCol(
            anchorCol != null ? anchorCol : this.selFocus.c
        );
        const copy = cloneTableRowDeep(this.tableData[row], this.tableColumns);
        const nextLine = nextLineNumber(this.tableData, this.tableColumns) || this.tableData.length + 1;
        Object.assign(copy, assignRowLineNumber(copy, this.tableColumns, nextLine));
        const copyRowId = copy.id != null ? String(copy.id) : '';
        const sourceRowId = rowIdAtSourceIndex(this, row);
        if (where === 'above') {
            insertRowsFromCommand(this, [copy], { beforeRowId: sourceRowId });
            if (copyRowId) this.restoreSelectionByRowIds(copyRowId, copyRowId, column, column, false);
            return;
        }
        insertRowsFromCommand(this, [copy], { afterRowId: sourceRowId });
        if (copyRowId) this.restoreSelectionByRowIds(copyRowId, copyRowId, column, column, false);
    },

    moveRowUpFromSnapshot(snapshot: TableContextMenuSnapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        const rowId = snapshot.anchorRowId || '';
        const sourceIndex = snapshotSourceIndex(this, snapshot);
        if (!rowId || sourceIndex <= 0) return;
        this.hideContextMenu();
        this.moveTableRowByIdRelative(rowId, -1, snapshot.anchorCol);
    },

    moveRowDownFromSnapshot(snapshot: TableContextMenuSnapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        const rowId = snapshot.anchorRowId || '';
        const sourceIndex = snapshotSourceIndex(this, snapshot);
        if (!rowId || sourceIndex < 0 || sourceIndex >= this.tableData.length - 1) return;
        this.hideContextMenu();
        this.moveTableRowByIdRelative(rowId, 1, snapshot.anchorCol);
    },

    duplicateRowAboveFromSnapshot(snapshot: TableContextMenuSnapshot) {
        duplicateRowFromSnapshot(this, snapshot, 'above');
    },

    duplicateRowBelowFromSnapshot(snapshot: TableContextMenuSnapshot) {
        duplicateRowFromSnapshot(this, snapshot, 'below');
    },

    deleteKeyboardSelectedRows() {
        if (this.groupingActive || this.tableUiLocked) return;
        if (!this.selectionIsFullRowBlock()) return;
        const { r0, r1 } = this.getSelRect();
        const column = this.activeCellCol();
        const rowIds = [];
        const viewModel = this.tableViewModelSnapshot();
        for (let row = r0; row <= r1; row += 1) {
            const rowId = viewModel.displayIndexToRowId[row];
            if (rowId) rowIds.push(String(rowId));
        }
        const uniqueRowIds = [...new Set(rowIds)];
        if (this.tableData.length - uniqueRowIds.length < 1) {
            uniqueRowIds.splice(Math.max(0, this.tableData.length - 1));
        }
        const removed = uniqueRowIds.length;
        if (removed === 0) return;
        this.dispatchTableCoreCommand(
            { rowIds: uniqueRowIds, type: 'DELETE_ROWS' },
            'delete row',
            TABLE_RUNTIME_SYNC.ROWS_AND_SELECTION
        );
        this.refreshGroupingViewFromData();
        this.onInput();
        const nextLength = this.tableData.length;
        const nextRow = Math.min(r0, nextLength - 1);
        const safeColumn = this.normCol(column);
        this.setSelectionSingle(nextRow, safeColumn);
        this.$nextTick(() => this.focusSelectionCell(nextRow, safeColumn));
    },

    insertRowBelowFullSelection() {
        if (this.groupingActive || this.tableUiLocked) return;
        if (!this.selectionIsFullRowBlock()) return;
        const column = this.activeCellCol();
        const { r1 } = this.getSelRect();
        const anchorRowId = rowIdAtDisplayIndex(this.tableViewModelSnapshot(), r1);
        if (!anchorRowId) return;
        const newRow = this.makeEmptyRow();
        const newRowId = String(newRow.id);
        insertRowsFromCommand(this, [newRow], { afterRowId: anchorRowId });
        const safeColumn = this.normCol(column);
        this.restoreSelectionByRowIds(newRowId, newRowId, safeColumn, safeColumn, true);
    },

    addNewRow() {
        if (this.groupingActive || this.tableUiLocked) return;
        const newRow = this.makeEmptyRow();
        const newRowId = String(newRow.id);
        insertRowsFromCommand(this, [newRow]);
        this.restoreSelectionByRowIds(newRowId, newRowId, 0, 0, false);
    },

    addRowAboveFromSnapshot(snapshot: TableContextMenuSnapshot) {
        addRowFromSnapshot(this, snapshot, 'above');
    },

    addRowBelowFromSnapshot(snapshot: TableContextMenuSnapshot) {
        addRowFromSnapshot(this, snapshot, 'below');
    },

    deleteRowFromSnapshot(snapshot: TableContextMenuSnapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        if (snapshot.bodyMode !== 'row') return;
        const anchorRow = snapshot.anchorRow;
        const dataIndex = snapshotSourceIndex(this, snapshot);
        if (this.tableData.length <= 1) return;
        if (dataIndex < 0 || dataIndex >= this.tableData.length) return;
        const viewModel = this.tableViewModelSnapshot();
        const deletedRowId = snapshot.anchorRowId || String(this.tableData[dataIndex].id);
        const nextRowId =
            viewModel.displayIndexToRowId[anchorRow + 1] ||
            viewModel.displayIndexToRowId[anchorRow - 1] ||
            '';
        this.dispatchTableCoreCommand(
            { rowIds: [deletedRowId], type: 'DELETE_ROWS' },
            'delete row',
            TABLE_RUNTIME_SYNC.ROWS_AND_SELECTION
        );
        const selectedColumn = this.normCol(this.selFocus.c);
        this.hideContextMenu();
        if (nextRowId) {
            this.restoreSelectionByRowIds(nextRowId, nextRowId, selectedColumn, selectedColumn, false);
        }
    }
} satisfies TableRuntimeMethodSubset<TableRowRuntimeSurface>;

export { RowRuntimeMethods };
export default RowRuntimeMethods;
