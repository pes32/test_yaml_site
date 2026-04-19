import { deserializeTsvToMatrix, serializeSelectionToTsv } from './table_clipboard.ts';
import { defineTableRuntimeModule } from './table_method_helpers.ts';
import { getRowCells, normalizeRowToDataRow } from './table_utils.ts';

const ClipboardRuntimeMethods = defineTableRuntimeModule({
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
            this.listMultiFn()
        );
        this.writeClipboardText(tsv);
        if (this.contextMenuOpen) this.hideContextMenu();
    },

    cutSelection(snapshot) {
        if (!this.isEditable || this.groupingActive) return;
        const tsv = serializeSelectionToTsv(
            this.tableData,
            snapshot.rect,
            this.listMultiFn()
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
            const row = this.tableData[rowIndex];
            if (!row) continue;
            const base = [...getRowCells(row)];
            for (let colIndex = c0; colIndex <= c1; colIndex += 1) {
                if (!this.canMutateColumnIndex(colIndex)) continue;
                base[colIndex] = this.emptyCellValueForColumn(colIndex);
            }
            if (row && typeof row === 'object' && row.id != null && !Array.isArray(row)) {
                this.tableData.splice(rowIndex, 1, { id: row.id, cells: base });
            } else {
                this.tableData.splice(rowIndex, 1, { id: `row_${rowIndex}`, cells: base });
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
            r < this.tableData.length &&
            c >= 0 &&
            c < this.tableColumns.length
        );
    },

    applyPasteMatrix(snapshot, matrix) {
        if (this.groupingActive || this.tableUiLocked) return;
        const selectionRect = snapshot.rect;
        const selectionRows = selectionRect.r1 - selectionRect.r0 + 1;
        const selectionCols = selectionRect.c1 - selectionRect.c0 + 1;
        const shouldTileIntoSelection =
            selectionRows > 0 &&
            selectionCols > 0 &&
            (selectionRows > matrix.length ||
                selectionCols > Math.max(...matrix.map((row: unknown) => Array.isArray(row) ? row.length : 0)));
        const pasteMatrix = shouldTileIntoSelection
            ? Array.from({ length: selectionRows }, (_, rowOffset) => {
                const sourceRow = matrix[rowOffset % matrix.length] || [];
                return Array.from({ length: selectionCols }, (_, colOffset) =>
                    sourceRow[colOffset % Math.max(1, sourceRow.length)]
                );
            })
            : matrix;
        const pasteAnchor = shouldTileIntoSelection
            ? { r: selectionRect.r0, c: selectionRect.c0 }
            : snapshot.pasteAnchor;
        const { r: pasteRow, c: pasteCol } = pasteAnchor;
        const numCols = this.tableColumns.length;
        const neededRows = pasteRow + pasteMatrix.length;
        while (this.tableData.length < neededRows) {
            this.tableData.push(this.makeEmptyRow());
        }
        const numRows = this.tableData.length;
        for (let rowOffset = 0; rowOffset < pasteMatrix.length; rowOffset += 1) {
            const rowIndex = pasteRow + rowOffset;
            if (rowIndex < 0 || rowIndex >= numRows) continue;
            const rowData = pasteMatrix[rowOffset];
            if (!Array.isArray(rowData)) continue;
            const previous = this.tableData[rowIndex];
            const row = [...getRowCells(previous)];
            for (let colOffset = 0; colOffset < rowData.length; colOffset += 1) {
                const colIndex = pasteCol + colOffset;
                if (colIndex < 0 || colIndex >= numCols) continue;
                if (!this.canMutateColumnIndex(colIndex)) continue;
                row[colIndex] = rowData[colOffset];
            }
            if (previous && typeof previous === 'object' && previous.id != null && !Array.isArray(previous)) {
                this.tableData.splice(rowIndex, 1, { id: previous.id, cells: row });
            } else {
                this.tableData.splice(rowIndex, 1, { id: `row_${rowIndex}`, cells: row });
            }
        }
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
});

export { ClipboardRuntimeMethods };
export default ClipboardRuntimeMethods;
