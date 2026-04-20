import {
    applyPasteMatrixToTableState,
    deserializeTsvToMatrix,
    serializeSelectionToTsv
} from './table_clipboard.ts';
import { getRowCells } from './table_utils.ts';
import type { TableRuntimeMethodSubset } from './table_contract.ts';

const ClipboardRuntimeMethods = {
    listMultiFn() {
        return (col: number) => this.listColumnIsMultiselect(this.tableColumns[col]);
    },

    async writeClipboardText(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            }
        } catch (error) {
            this.showTableError('Не удалось скопировать данные в буфер обмена.', {
                cause: error,
                details: {
                    action: 'clipboard_write'
                }
            });
        }
    },

    copySelection(snapshot) {
        if (!this.isEditable || this.groupingActive) return;
        const tsv = serializeSelectionToTsv(
            this.tableData,
            snapshot.rect,
            this.listMultiFn(),
            (rowIndex: number) => this.dataRowByDisplayIndex(rowIndex)
        );
        this.writeClipboardText(tsv);
        if (this.contextMenuOpen) this.hideContextMenu();
    },

    cutSelection(snapshot) {
        if (!this.isEditable || this.groupingActive) return;
        const tsv = serializeSelectionToTsv(
            this.tableData,
            snapshot.rect,
            this.listMultiFn(),
            (rowIndex: number) => this.dataRowByDisplayIndex(rowIndex)
        );
        this.writeClipboardText(tsv);
        this.clearRectangleValues(snapshot.rect);
        this.onInput();
        if (this.contextMenuOpen) this.hideContextMenu();
    },

    clearRectangleValues(rect) {
        if (this.groupingActive || this.tableUiLocked) return;
        const { r0, r1, c0, c1 } = rect;
        for (let rowIndex = r0; rowIndex <= r1; rowIndex += 1) {
            const dataIndex = this.resolveDataRowIndex(rowIndex);
            if (dataIndex < 0) continue;
            const row = this.tableData[dataIndex];
            if (!row) continue;
            const base = [...getRowCells(row)];
            for (let colIndex = c0; colIndex <= c1; colIndex += 1) {
                if (!this.canMutateColumnIndex(colIndex)) continue;
                base[colIndex] = this.emptyCellValueForColumn(colIndex);
            }
            if (row && typeof row === 'object' && row.id != null && !Array.isArray(row)) {
                this.tableData.splice(dataIndex, 1, { id: row.id, cells: base });
            } else {
                this.tableData.splice(dataIndex, 1, { id: `row_${dataIndex}`, cells: base });
            }
        }
    },

    clearSelectionFromSnapshot(snapshot) {
        if (!this.isEditable || this.groupingActive) return;
        this.clearRectangleValues(snapshot.rect);
        this.onInput();
        this.hideContextMenu();
    },

    isPasteAnchorInTable(snapshot) {
        const { r, c } = snapshot.pasteAnchor;
        return (
            r >= 0 &&
            r < this.tbodyRowCount() &&
            c >= 0 &&
            c < this.tableColumns.length
        );
    },

    applyPasteMatrix(snapshot, matrix) {
        if (this.groupingActive || this.tableUiLocked) return;
        const result = applyPasteMatrixToTableState(matrix, {
            canMutateColumnIndex: (colIndex: number) => this.canMutateColumnIndex(colIndex),
            createEmptyRow: () => this.makeEmptyRow(),
            pasteAnchor: snapshot.pasteAnchor,
            rect: snapshot.rect,
            resolveSourceRowIndex: (displayRowIndex: number) =>
                this.resolveDataRowIndex(displayRowIndex),
            tableColumns: this.tableColumns,
            tableData: this.tableData
        });
        this.tableData.splice(0, this.tableData.length, ...result.rows);
        this.checkTableInvariants?.('paste');
        this.onInput();
    },

    async pasteFromClipboard(snapshot) {
        if (!this.isEditable || this.groupingActive) return;
        if (this._pasteInProgress) return;
        if (!this.isPasteAnchorInTable(snapshot)) return;
        const sessionId = snapshot.sessionId;
        const hadMenu = this.contextMenuOpen;
        this._pasteInProgress = true;
        try {
            let text = '';
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    text = await navigator.clipboard.readText();
                }
            } catch (error) {
                this.showTableError('Не удалось прочитать данные из буфера обмена.', {
                    cause: error,
                    details: {
                        action: 'clipboard_read'
                    }
                });
                return;
            }
            if (text == null || text === '') return;
            if (sessionId !== this.contextMenuSessionId) return;
            const matrix = deserializeTsvToMatrix(
                text,
                this.tableColumns,
                this.listMultiFn()
            );
            if (!matrix.length) return;
            if (!this.isPasteAnchorInTable(snapshot)) return;
            this.applyPasteMatrix(snapshot, matrix);
        } finally {
            this._pasteInProgress = false;
            if (hadMenu) this.hideContextMenu();
        }
    }
} satisfies TableRuntimeMethodSubset;

export { ClipboardRuntimeMethods };
export default ClipboardRuntimeMethods;
