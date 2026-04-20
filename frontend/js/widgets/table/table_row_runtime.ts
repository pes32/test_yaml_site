import {
    assignRowLineNumber,
    cloneTableRowDeep,
    nextLineNumber
} from './table_utils.ts';
import { isContextMenuSnapshotCurrent } from './table_context_menu_model.ts';
import type {
    TableContextMenuSnapshot,
    TableRuntimeMethodSubset,
    TableRuntimeVm
} from './table_contract.ts';

function snapshotStillCurrent(
    vm: TableRuntimeVm,
    snapshot: TableContextMenuSnapshot | null | undefined
): boolean {
    if (isContextMenuSnapshotCurrent(snapshot, vm.contextMenuSessionId)) return true;
    vm.hideContextMenu();
    return false;
}

function snapshotSourceIndex(
    vm: TableRuntimeVm,
    snapshot: TableContextMenuSnapshot | null | undefined
): number {
    if (snapshot?.anchorRowId) {
        const sourceIndex = vm.tableViewModelSnapshot().rowIdToSourceIndex.get(snapshot.anchorRowId);
        return sourceIndex == null ? -1 : sourceIndex;
    }
    return vm.resolveDataRowIndex(snapshot?.anchorRow ?? -1);
}

const RowRuntimeMethods = {
    moveTableRowRelative(rowIndex, delta, anchorCol) {
        if (this.groupingActive || this.tableUiLocked) return;
        const length = this.tableData.length;
        const row = this.resolveDataRowIndex(this.normRow(rowIndex));
        const target = row + delta;
        if (target < 0 || target >= length) return;
        const column = this.normCol(
            anchorCol != null ? anchorCol : this.selFocus.c
        );
        const movedRowId = this.tableData[row]?.id != null ? String(this.tableData[row].id) : '';
        this.applyTableMutation(
            () => {
                const [movedRow] = this.tableData.splice(row, 1);
                this.tableData.splice(target, 0, movedRow);
            },
            { skipSort: true }
        );
        if (movedRowId) {
            this.restoreSelectionByRowIds(movedRowId, movedRowId, column, column, false);
        }
    },

    duplicateTableRowRelative(rowIndex, where, anchorCol) {
        if (this.groupingActive || this.tableUiLocked) return;
        const row = this.resolveDataRowIndex(this.normRow(rowIndex));
        const length = this.tableData.length;
        if (row < 0 || row >= length) return;
        const column = this.normCol(
            anchorCol != null ? anchorCol : this.selFocus.c
        );
        const copy = cloneTableRowDeep(this.tableData[row], this.tableColumns);
        const nextLine = nextLineNumber(this.tableData, this.tableColumns) || this.tableData.length + 1;
        Object.assign(copy, assignRowLineNumber(copy, this.tableColumns, nextLine));
        const copyRowId = copy.id != null ? String(copy.id) : '';
        if (where === 'above') {
            this.applyTableMutation(
                () => {
                    this.tableData.splice(row, 0, copy);
                },
                { skipSort: true }
            );
            if (copyRowId) this.restoreSelectionByRowIds(copyRowId, copyRowId, column, column, false);
            return;
        }
        this.applyTableMutation(
            () => {
                this.tableData.splice(row + 1, 0, copy);
            },
            { skipSort: true }
        );
        if (copyRowId) this.restoreSelectionByRowIds(copyRowId, copyRowId, column, column, false);
    },

    moveRowUpFromSnapshot(snapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        const anchorRow = snapshot.anchorRow;
        if (anchorRow <= 0) return;
        this.hideContextMenu();
        this.moveTableRowRelative(anchorRow, -1, snapshot.anchorCol);
    },

    moveRowDownFromSnapshot(snapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        const anchorRow = snapshot.anchorRow;
        if (anchorRow < 0 || anchorRow >= this.tableData.length - 1) return;
        this.hideContextMenu();
        this.moveTableRowRelative(anchorRow, 1, snapshot.anchorCol);
    },

    duplicateRowAboveFromSnapshot(snapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        const anchorRow = snapshot.anchorRow;
        if (anchorRow < 0 || anchorRow >= this.tableData.length) return;
        this.hideContextMenu();
        this.duplicateTableRowRelative(anchorRow, 'above', snapshot.anchorCol);
    },

    duplicateRowBelowFromSnapshot(snapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        const anchorRow = snapshot.anchorRow;
        if (anchorRow < 0 || anchorRow >= this.tableData.length) return;
        this.hideContextMenu();
        this.duplicateTableRowRelative(anchorRow, 'below', snapshot.anchorCol);
    },

    deleteKeyboardSelectedRows() {
        if (this.groupingActive || this.tableUiLocked) return;
        if (!this.selectionIsFullRowBlock()) return;
        const { r0, r1 } = this.getSelRect();
        const column = this.activeCellCol();
        const sourceRows = [];
        for (let row = r0; row <= r1; row += 1) {
            const dataIndex = this.resolveDataRowIndex(row);
            if (dataIndex >= 0) sourceRows.push(dataIndex);
        }
        const uniqueSourceRows = [...new Set(sourceRows)].sort((left, right) => left - right);
        const rowIds = uniqueSourceRows
            .map((sourceRow) => this.tableData[sourceRow]?.id)
            .filter((rowId) => rowId != null)
            .map((rowId) => String(rowId));
        if (this.tableData.length - rowIds.length < 1) {
            rowIds.splice(Math.max(0, this.tableData.length - 1));
        }
        const removed = rowIds.length;
        if (removed === 0) return;
        this.dispatchTableCoreCommand(
            { rowIds, type: 'DELETE_ROWS' },
            'delete row',
            { skipSort: true, skipGrouping: true, skipEditing: true, skipContextMenu: true }
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
        const dataIndex = this.resolveDataRowIndex(r1);
        if (dataIndex < 0) return;
        const newRow = this.makeEmptyRow();
        const newRowId = String(newRow.id);
        this.applyTableMutation(
            () => {
                this.tableData.splice(dataIndex + 1, 0, newRow);
            },
            { skipSort: true }
        );
        const safeColumn = this.normCol(column);
        this.restoreSelectionByRowIds(newRowId, newRowId, safeColumn, safeColumn, true);
    },

    addNewRow() {
        if (this.groupingActive || this.tableUiLocked) return;
        const newRow = this.makeEmptyRow();
        const newRowId = String(newRow.id);
        this.applyTableMutation(
            () => {
                this.tableData.push(newRow);
            },
            { skipSort: true }
        );
        this.restoreSelectionByRowIds(newRowId, newRowId, 0, 0, false);
    },

    addRowAboveFromSnapshot(snapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        if (this.tableData.length === 0) {
            const newRow = this.makeEmptyRow();
            const newRowId = String(newRow.id);
            this.applyTableMutation(
                () => {
                    this.tableData.splice(0, 0, newRow);
                },
                { skipSort: true }
            );
            this.hideContextMenu();
            this.restoreSelectionByRowIds(newRowId, newRowId, snapshot.anchorCol || 0, snapshot.anchorCol || 0, false);
            return;
        }
        const dataIndex = snapshotSourceIndex(this, snapshot);
        if (dataIndex < 0 || dataIndex > this.tableData.length) return;
        const newRow = this.makeEmptyRow();
        const newRowId = String(newRow.id);
        this.applyTableMutation(
            () => {
                this.tableData.splice(dataIndex, 0, newRow);
            },
            { skipSort: true }
        );
        this.hideContextMenu();
        this.restoreSelectionByRowIds(newRowId, newRowId, snapshot.anchorCol || 0, snapshot.anchorCol || 0, false);
    },

    addRowBelowFromSnapshot(snapshot) {
        if (!snapshotStillCurrent(this, snapshot)) return;
        if (this.tableData.length === 0) {
            const newRow = this.makeEmptyRow();
            const newRowId = String(newRow.id);
            this.applyTableMutation(
                () => {
                    this.tableData.push(newRow);
                },
                { skipSort: true }
            );
            this.hideContextMenu();
            this.restoreSelectionByRowIds(newRowId, newRowId, snapshot.anchorCol || 0, snapshot.anchorCol || 0, false);
            return;
        }
        const dataIndex = snapshotSourceIndex(this, snapshot);
        if (dataIndex < 0 || dataIndex >= this.tableData.length) return;
        const newRow = this.makeEmptyRow();
        const newRowId = String(newRow.id);
        this.applyTableMutation(
            () => {
                this.tableData.splice(dataIndex + 1, 0, newRow);
            },
            { skipSort: true }
        );
        this.hideContextMenu();
        this.restoreSelectionByRowIds(newRowId, newRowId, snapshot.anchorCol || 0, snapshot.anchorCol || 0, false);
    },

    deleteRowFromSnapshot(snapshot) {
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
            { skipSort: true, skipGrouping: true, skipEditing: true, skipContextMenu: true }
        );
        const selectedColumn = this.normCol(this.selFocus.c);
        this.hideContextMenu();
        if (nextRowId) {
            this.restoreSelectionByRowIds(nextRowId, nextRowId, selectedColumn, selectedColumn, false);
        }
    }
} satisfies TableRuntimeMethodSubset;

export { RowRuntimeMethods };
export default RowRuntimeMethods;
