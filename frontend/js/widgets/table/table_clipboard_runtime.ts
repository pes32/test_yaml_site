import {
    deserializeTsvToMatrix,
    preparePasteMatrix,
    serializeSelectionToTsv
} from './table_clipboard.ts';
import {
    coreCellToDisplay,
    displayCellFromCoreIdentity,
    selectionRectFromSnapshot
} from './table_selection_model.ts';
import { buildClearCellPatchesForRuntime } from './table_selection.ts';
import { TABLE_RUNTIME_SYNC } from './table_runtime_state.ts';
import { rowAtDisplayIndex, rowIdAtDisplayIndex } from './table_view_model.ts';
import type {
    TableColumnKey,
    TableContextMenuSnapshot,
    TableCoreCellAddress,
    TableDataRow,
    TableRuntimeMethodSubset,
    TableRuntimeVm,
    TableRowId,
    TableSelectionRect,
    TableViewModel
} from './table_contract.ts';

type TableClipboardRuntimeSurface = TableRuntimeVm;

function rectFromSnapshot(
    vm: TableClipboardRuntimeSurface,
    snapshot: TableContextMenuSnapshot
): TableSelectionRect {
    return selectionRectFromSnapshot(
        snapshot,
        vm.tableColumns,
        vm.tableViewModelSnapshot(),
        vm.tbodyRowCount ? vm.tbodyRowCount() : vm.tableData.length,
    );
}

function pasteAnchorFromSnapshot(
    vm: TableClipboardRuntimeSurface,
    snapshot: TableContextMenuSnapshot
) {
    const cell = snapshot.pasteAnchorRowId && snapshot.pasteAnchorColumnKey
        ? { colKey: snapshot.pasteAnchorColumnKey, rowId: snapshot.pasteAnchorRowId }
        : null;
    return displayCellFromCoreIdentity(cell, vm.tableColumns, vm.tableViewModelSnapshot(), snapshot.pasteAnchor);
}

function clipboardSnapshotFromIdentity(
    vm: TableClipboardRuntimeSurface,
    snapshot: TableContextMenuSnapshot
): TableContextMenuSnapshot {
    return {
        ...snapshot,
        pasteAnchor: pasteAnchorFromSnapshot(vm, snapshot),
        rect: rectFromSnapshot(vm, snapshot)
    };
}

function createPasteAppendRows(
    vm: TableClipboardRuntimeSurface,
    neededRows: number
): TableDataRow[] {
    const rows: TableDataRow[] = [];
    for (let rowIndex = vm.tbodyRowCount(); rowIndex < neededRows; rowIndex += 1) {
        rows.push(vm.makeEmptyRow());
    }
    return rows;
}

function displayDataRowAt(
    vm: TableClipboardRuntimeSurface,
    viewModel: TableViewModel,
    displayRowIndex: number
): TableDataRow | null {
    return rowAtDisplayIndex(viewModel, vm.tableData, displayRowIndex);
}

function pasteAnchorCoreFromSnapshot(
    vm: TableClipboardRuntimeSurface,
    snapshot: TableContextMenuSnapshot
): TableCoreCellAddress | null {
    if (snapshot.pasteAnchorRowId && snapshot.pasteAnchorColumnKey) {
        return {
            colKey: snapshot.pasteAnchorColumnKey,
            rowId: snapshot.pasteAnchorRowId
        };
    }
    const rowId = rowIdAtDisplayIndex(
        vm.tableViewModelSnapshot(),
        snapshot.pasteAnchor.r
    );
    const colKey = vm.runtimeColumnKeys()[snapshot.pasteAnchor.c];
    return rowId && colKey ? { colKey, rowId } : null;
}

function pasteTargetRowIds(
    vm: TableClipboardRuntimeSurface,
    appendedRows: readonly TableDataRow[],
    displayRowIndex: number,
    rowCount: number
): TableRowId[] {
    const viewModel = vm.tableViewModelSnapshot();
    const rowIds: TableRowId[] = [];
    for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
        const targetDisplayRow = displayRowIndex + rowOffset;
        const rowId = rowIdAtDisplayIndex(viewModel, targetDisplayRow);
        if (rowId) {
            rowIds.push(rowId);
            continue;
        }
        const appended = appendedRows[targetDisplayRow - vm.tbodyRowCount()];
        if (appended?.id != null) rowIds.push(String(appended.id));
    }
    return rowIds;
}

function mutablePasteColumnKeys(
    vm: TableClipboardRuntimeSurface,
    colIndex: number,
    matrix: readonly unknown[][]
): TableColumnKey[] {
    const columnKeys = vm.runtimeColumnKeys();
    const width = Math.max(0, ...matrix.map((row) => (Array.isArray(row) ? row.length : 0)));
    const keys: TableColumnKey[] = [];
    for (let colOffset = 0; colOffset < width; colOffset += 1) {
        const targetCol = colIndex + colOffset;
        const colKey = columnKeys[targetCol];
        if (colKey && vm.canMutateColumnIndex(targetCol)) keys.push(colKey);
    }
    return keys;
}

function dispatchClipboardClear(
    vm: TableClipboardRuntimeSurface,
    rect: TableSelectionRect
): void {
    const patches = buildClearCellPatchesForRuntime(vm, rect);
    if (!patches.length) return;
    vm.dispatchTableCommand(
        { patches, type: 'PATCH_CELLS' },
        {},
        'clear cells',
        TABLE_RUNTIME_SYNC.ROWS_AND_SELECTION
    );
    finalizeClipboardMutation(vm);
}

function finalizeClipboardMutation(vm: TableClipboardRuntimeSurface): void {
    if (vm.groupingActive && vm.isFullyLoaded) vm.refreshGroupingViewFromData();
    vm.onInput();
}

function isPasteAnchorInTable(
    vm: TableClipboardRuntimeSurface,
    snapshot: TableContextMenuSnapshot
): boolean {
    const anchor = pasteAnchorCoreFromSnapshot(vm, snapshot);
    if (!anchor) return false;
    const displayCell = coreCellToDisplay(anchor, vm.tableColumns, vm.tableViewModelSnapshot());
    return (
        !!displayCell &&
        displayCell.r >= 0 &&
        displayCell.r < vm.tbodyRowCount() &&
        displayCell.c >= 0 &&
        displayCell.c < vm.tableColumns.length
    );
}

function applyPasteMatrix(
    vm: TableClipboardRuntimeSurface,
    snapshot: TableContextMenuSnapshot,
    matrix: unknown[][]
): void {
    if (vm.groupingActive || vm.tableUiLocked) return;
    const resolvedSnapshot = clipboardSnapshotFromIdentity(vm, snapshot);
    const prepared = preparePasteMatrix(
        matrix,
        resolvedSnapshot.rect,
        resolvedSnapshot.pasteAnchor
    );
    const anchor = pasteAnchorCoreFromSnapshot(vm, resolvedSnapshot);
    if (!anchor) return;
    const neededRows = prepared.pasteAnchor.r + prepared.matrix.length;
    const appendRows = createPasteAppendRows(vm, neededRows);
    const targetRowIds = pasteTargetRowIds(
        vm,
        appendRows,
        prepared.pasteAnchor.r,
        prepared.matrix.length
    );
    const mutableColKeys = mutablePasteColumnKeys(
        vm,
        prepared.pasteAnchor.c,
        prepared.matrix
    );
    if (!targetRowIds.length || !mutableColKeys.length) return;
    vm.dispatchTableCommand(
        {
            anchor,
            appendRows,
            matrix: prepared.matrix,
            mutableColKeys,
            targetRowIds,
            type: 'PASTE_TSV'
        },
        {},
        'paste cells',
        TABLE_RUNTIME_SYNC.ROWS_AND_SELECTION
    );
    finalizeClipboardMutation(vm);
}

const ClipboardRuntimeMethods = {
    listMultiFn() {
        return (col: number) => this.listColumnIsMultiselect(this.tableColumns[col]);
    },

    selectionTsvFromSnapshot(snapshot: TableContextMenuSnapshot) {
        const resolvedSnapshot = clipboardSnapshotFromIdentity(this, snapshot);
        const viewModel = this.tableViewModelSnapshot();
        return serializeSelectionToTsv(
            this.tableData,
            resolvedSnapshot.rect,
            this.listMultiFn(),
            (rowIndex: number) => displayDataRowAt(this, viewModel, rowIndex),
            {
                includeColumn: (colIndex: number) =>
                    !this.isLineNumberColumn(this.tableColumns[colIndex])
            }
        );
    },

    async writeClipboardText(text: string) {
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

    copySelection(snapshot: TableContextMenuSnapshot) {
        if (!this.isEditable || this.groupingActive) return;
        this.writeClipboardText(this.selectionTsvFromSnapshot(snapshot));
        if (this.contextMenuOpen) this.hideContextMenu();
    },

    cutSelection(snapshot: TableContextMenuSnapshot) {
        if (!this.isEditable || this.groupingActive) return;
        const resolvedSnapshot = clipboardSnapshotFromIdentity(this, snapshot);
        this.writeClipboardText(this.selectionTsvFromSnapshot(snapshot));
        dispatchClipboardClear(this, resolvedSnapshot.rect);
        if (this.contextMenuOpen) this.hideContextMenu();
    },

    clearSelectionFromSnapshot(snapshot: TableContextMenuSnapshot) {
        if (!this.isEditable || this.groupingActive) return;
        dispatchClipboardClear(this, clipboardSnapshotFromIdentity(this, snapshot).rect);
        this.hideContextMenu();
    },

    async pasteFromClipboard(snapshot: TableContextMenuSnapshot) {
        if (!this.isEditable || this.groupingActive) return;
        if (this._pasteInProgress) return;
        if (!isPasteAnchorInTable(this, snapshot)) return;
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
            if (!isPasteAnchorInTable(this, snapshot)) return;
            applyPasteMatrix(this, snapshot, matrix);
        } finally {
            this._pasteInProgress = false;
            if (hadMenu) this.hideContextMenu();
        }
    }
} satisfies TableRuntimeMethodSubset<TableClipboardRuntimeSurface>;

export { ClipboardRuntimeMethods };
export default ClipboardRuntimeMethods;
