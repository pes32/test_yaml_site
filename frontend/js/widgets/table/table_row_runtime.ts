import {
    assignRowLineNumber,
    cloneTableRowDeep,
    nextLineNumber
} from './table_utils.ts';
import { defineTableRuntimeModule } from './table_method_helpers.ts';

const RowRuntimeMethods = defineTableRuntimeModule({
    moveTableRowRelative(rowIndex, delta, anchorCol) {
        if (this.groupingActive || this.tableUiLocked) return;
        const length = this.tableData.length;
        const row = this.normRow(rowIndex);
        const target = row + delta;
        if (target < 0 || target >= length) return;
        const column = this.normCol(
            anchorCol != null ? anchorCol : this.selFocus.c
        );
        this.applyTableMutation(
            () => {
                const [movedRow] = this.tableData.splice(row, 1);
                this.tableData.splice(target, 0, movedRow);
            },
            { skipSort: true }
        );
        this.setSelectionSingle(target, column);
        this.focusSelectionCellWithRetry(target, column);
    },

    duplicateTableRowRelative(rowIndex, where, anchorCol) {
        if (this.groupingActive || this.tableUiLocked) return;
        const row = this.normRow(rowIndex);
        const length = this.tableData.length;
        if (row < 0 || row >= length) return;
        const column = this.normCol(
            anchorCol != null ? anchorCol : this.selFocus.c
        );
        const copy = cloneTableRowDeep(this.tableData[row], this.tableColumns);
        const nextLine = nextLineNumber(this.tableData, this.tableColumns) || this.tableData.length + 1;
        Object.assign(copy, assignRowLineNumber(copy, this.tableColumns, nextLine));
        if (where === 'above') {
            this.applyTableMutation(
                () => {
                    this.tableData.splice(row, 0, copy);
                },
                { skipSort: true }
            );
            this.setSelectionSingle(row, column);
            this.focusSelectionCellWithRetry(row, column);
            return;
        }
        this.applyTableMutation(
            () => {
                this.tableData.splice(row + 1, 0, copy);
            },
            { skipSort: true }
        );
        this.setSelectionSingle(row + 1, column);
        this.focusSelectionCellWithRetry(row + 1, column);
    },

    moveRowUpFromSnapshot(snapshot) {
        if (snapshot.sessionId !== this.contextMenuSessionId) {
            this.hideContextMenu();
            return;
        }
        const anchorRow = snapshot.anchorRow;
        if (anchorRow <= 0) return;
        this.hideContextMenu();
        this.moveTableRowRelative(anchorRow, -1, snapshot.anchorCol);
    },

    moveRowDownFromSnapshot(snapshot) {
        if (snapshot.sessionId !== this.contextMenuSessionId) {
            this.hideContextMenu();
            return;
        }
        const anchorRow = snapshot.anchorRow;
        if (anchorRow < 0 || anchorRow >= this.tableData.length - 1) return;
        this.hideContextMenu();
        this.moveTableRowRelative(anchorRow, 1, snapshot.anchorCol);
    },

    duplicateRowAboveFromSnapshot(snapshot) {
        if (snapshot.sessionId !== this.contextMenuSessionId) {
            this.hideContextMenu();
            return;
        }
        const anchorRow = snapshot.anchorRow;
        if (anchorRow < 0 || anchorRow >= this.tableData.length) return;
        this.hideContextMenu();
        this.duplicateTableRowRelative(anchorRow, 'above', snapshot.anchorCol);
    },

    duplicateRowBelowFromSnapshot(snapshot) {
        if (snapshot.sessionId !== this.contextMenuSessionId) {
            this.hideContextMenu();
            return;
        }
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
        let removed = 0;
        for (let row = r1; row >= r0; row -= 1) {
            if (this.tableData.length <= 1) break;
            this.tableData.splice(row, 1);
            removed += 1;
        }
        if (removed === 0) return;
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
        const newRow = this.makeEmptyRow();
        this.applyTableMutation(
            () => {
                this.tableData.splice(r1 + 1, 0, newRow);
            },
            { skipSort: true }
        );
        this.$nextTick(() => {
            const safeColumn = this.normCol(column);
            this.focusSelectionCell(this.normRow(this.selFocus.r), safeColumn);
        });
    },

    addNewRow() {
        if (this.groupingActive || this.tableUiLocked) return;
        const newRow = this.makeEmptyRow();
        this.applyTableMutation(
            () => {
                this.tableData.push(newRow);
            },
            { skipSort: true }
        );
        const lastRow = this.tableData.length - 1;
        this.setSelectionSingle(lastRow, 0);
        this.$nextTick(() => this.focusSelectionCell(lastRow, 0));
    },

    addRowAboveFromSnapshot(snapshot) {
        if (this.tableData.length === 0) {
            const newRow = this.makeEmptyRow();
            this.applyTableMutation(
                () => {
                    this.tableData.splice(0, 0, newRow);
                },
                { skipSort: true }
            );
            this.hideContextMenu();
            return;
        }
        const anchorRow = snapshot.anchorRow;
        if (anchorRow < 0 || anchorRow > this.tableData.length) return;
        const newRow = this.makeEmptyRow();
        this.applyTableMutation(
            () => {
                this.tableData.splice(anchorRow, 0, newRow);
            },
            { skipSort: true }
        );
        this.hideContextMenu();
    },

    addRowBelowFromSnapshot(snapshot) {
        if (this.tableData.length === 0) {
            const newRow = this.makeEmptyRow();
            this.applyTableMutation(
                () => {
                    this.tableData.push(newRow);
                },
                { skipSort: true }
            );
            this.hideContextMenu();
            return;
        }
        const anchorRow = snapshot.anchorRow;
        if (anchorRow < 0 || anchorRow >= this.tableData.length) return;
        const newRow = this.makeEmptyRow();
        this.applyTableMutation(
            () => {
                this.tableData.splice(anchorRow + 1, 0, newRow);
            },
            { skipSort: true }
        );
        this.hideContextMenu();
    },

    deleteRowFromSnapshot(snapshot) {
        if (snapshot.bodyMode !== 'row') return;
        const anchorRow = snapshot.anchorRow;
        if (this.tableData.length <= 1) return;
        if (anchorRow < 0 || anchorRow >= this.tableData.length) return;
        this.applyTableMutation(
            () => {
                this.tableData.splice(anchorRow, 1);
            },
            { skipSort: true }
        );
        const nextLength = this.tableData.length;
        const nextRow = Math.min(anchorRow, nextLength - 1);
        const selectedColumn = this.normCol(this.selFocus.c);
        this.setSelectionSingle(nextRow, selectedColumn);
        this.hideContextMenu();
        this.$nextTick(() => this.focusSelectionCell(nextRow, selectedColumn));
    }
});

export { RowRuntimeMethods };
export default RowRuntimeMethods;
