import tableEngine from './table_core.js';

const Core = tableEngine;

const ClipboardRuntimeMethods = {
    listMultiFn() {
        return (col) => this.listColumnIsMultiselect(this.tableColumns[col]);
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
        const Clipboard = tableEngine.Clipboard;
        if (!Clipboard || typeof Clipboard.serializeSelectionToTsv !== 'function') return;
        const tsv = Clipboard.serializeSelectionToTsv(
            this.tableData,
            this.tableColumns,
            snapshot.rect,
            this.listMultiFn()
        );
        this.writeClipboardText(tsv);
        if (this.contextMenuOpen) this.hideContextMenu();
    },

    cutSelection(snapshot) {
        if (!this.isEditable || this.groupingActive) return;
        const Clipboard = tableEngine.Clipboard;
        if (!Clipboard || typeof Clipboard.serializeSelectionToTsv !== 'function') return;
        const tsv = Clipboard.serializeSelectionToTsv(
            this.tableData,
            this.tableColumns,
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
        const Utils = tableEngine.Utils;
        const getCells = Utils && Utils.getRowCells;
        const { r0, r1, c0, c1 } = rect;
        for (let rowIndex = r0; rowIndex <= r1; rowIndex += 1) {
            const row = this.tableData[rowIndex];
            if (!row) continue;
            const base = getCells ? [...getCells(row)] : [...(Array.isArray(row) ? row : [])];
            for (let colIndex = c0; colIndex <= c1; colIndex += 1) {
                if (!this.canMutateColumnIndex(colIndex)) continue;
                base[colIndex] = this.emptyCellValueForColumn(colIndex);
            }
            if (row && typeof row === 'object' && row.id != null && !Array.isArray(row)) {
                this.tableData.splice(rowIndex, 1, { id: row.id, cells: base });
            } else {
                this.tableData.splice(rowIndex, 1, base);
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
        const Utils = tableEngine.Utils;
        const getCells = Utils && Utils.getRowCells;
        const { r: pasteRow, c: pasteCol } = snapshot.pasteAnchor;
        const numCols = this.tableColumns.length;
        const neededRows = pasteRow + matrix.length;
        while (this.tableData.length < neededRows) {
            this.tableData.push(this.makeEmptyRow());
        }
        const numRows = this.tableData.length;
        for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
            const rowIndex = pasteRow + rowOffset;
            if (rowIndex < 0 || rowIndex >= numRows) continue;
            const rowData = matrix[rowOffset];
            if (!Array.isArray(rowData)) continue;
            const previous = this.tableData[rowIndex];
            const row = getCells ? [...getCells(previous)] : [...(Array.isArray(previous) ? previous : [])];
            for (let colOffset = 0; colOffset < rowData.length; colOffset += 1) {
                const colIndex = pasteCol + colOffset;
                if (colIndex < 0 || colIndex >= numCols) continue;
                if (!this.canMutateColumnIndex(colIndex)) continue;
                row[colIndex] = rowData[colOffset];
            }
            if (previous && typeof previous === 'object' && previous.id != null && !Array.isArray(previous)) {
                this.tableData.splice(rowIndex, 1, { id: previous.id, cells: row });
            } else {
                this.tableData.splice(rowIndex, 1, row);
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
            const Clipboard = tableEngine.Clipboard;
            if (!Clipboard || typeof Clipboard.deserializeTsvToMatrix !== 'function') return;
            const matrix = Clipboard.deserializeTsvToMatrix(
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
};

Core.ClipboardRuntimeMethods = ClipboardRuntimeMethods;

export { ClipboardRuntimeMethods };
export default ClipboardRuntimeMethods;
