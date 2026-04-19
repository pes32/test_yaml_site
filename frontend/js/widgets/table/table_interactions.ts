import type { TableRuntimeVm, TableRuntimeColumn } from './table_contract.ts';
import { defineTableRuntimeModule } from './table_method_helpers.ts';
import { TableWidgetHandleKeydown } from './table_keyboard.ts';

type CellEditorActionKind = string;

function getElement(value: EventTarget | null | undefined): HTMLElement | null {
    return value instanceof HTMLElement ? value : null;
}

function getContainedCell(vm: TableRuntimeVm, target: EventTarget | null | undefined): HTMLElement | null {
    const element = getElement(target);
    const cell = element?.closest('tbody td');
    return cell && vm.$el?.contains(cell) ? cell as HTMLElement : null;
}

const InteractionRuntimeMethods = defineTableRuntimeModule({
    onTableCellClick(this: TableRuntimeVm, event: MouseEvent, row: number, col: number) {
        if (!this.isEditable) return;
        this._shiftAnchorLocked = false;
        if (event.shiftKey) {
            this._shiftSelectGesture = false;
            return;
        }
        if (this._shiftSelectGesture) {
            this._shiftSelectGesture = false;
            return;
        }
        if (event.button !== 0) return;

        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this.setSelectionSingle(normalizedRow, normalizedCol);
        this.exitCellEdit();
        this.$nextTick?.(() => this.focusSelectionCell(normalizedRow, normalizedCol));
    },

    onTableCellDblClick(this: TableRuntimeVm, row: number, col: number) {
        if (!this.isEditable) return;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this.setSelectionSingle(normalizedRow, normalizedCol);
        if (!this.canMutateColumnIndex(normalizedCol)) {
            this.$nextTick?.(() => this.focusSelectionCell(normalizedRow, normalizedCol));
            return;
        }
        this.enterCellEditAt(normalizedRow, normalizedCol, { caretEnd: true });
    },

    onCellDisplayAction(
        this: TableRuntimeVm,
        row: number,
        col: number,
        actionKind: CellEditorActionKind
    ) {
        if (!this.isEditable) return;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this.setSelectionSingle(normalizedRow, normalizedCol);
        if (!this.canMutateColumnIndex(normalizedCol)) {
            this.$nextTick?.(() => this.focusSelectionCell(normalizedRow, normalizedCol));
            return;
        }
        this.enterCellEditAt(normalizedRow, normalizedCol, { caretEnd: true });
        this.activateCellEditorAction(normalizedRow, normalizedCol, actionKind);
    },

    navigateTableByTabFromCell(this: TableRuntimeVm, row: number, col: number, shiftKey: boolean) {
        const lastRow = this.tbodyRowCount() - 1;
        const lastCol = this.tableColumns.length - 1;
        if (lastRow < 0 || lastCol < 0) return false;

        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        let nextRow = normalizedRow;
        let nextCol = normalizedCol;

        if (shiftKey) {
            if (normalizedCol > 0) {
                nextCol = normalizedCol - 1;
            } else if (normalizedRow > 0) {
                nextRow = normalizedRow - 1;
                nextCol = lastCol;
            } else {
                return false;
            }
        } else if (normalizedCol < lastCol) {
            nextCol = normalizedCol + 1;
        } else if (normalizedRow < lastRow) {
            nextRow = normalizedRow + 1;
            nextCol = 0;
        } else {
            return false;
        }

        this.exitCellEdit();
        this.setSelectionSingle(nextRow, nextCol);
        this.$nextTick?.(() => this.focusSelectionCell(nextRow, nextCol));
        return true;
    },

    onNativeCellBlur(this: TableRuntimeVm, row: number, col: number) {
        this.$nextTick?.(() => {
            if (this._tableProgrammaticFocus) return;

            const activeCell = getContainedCell(this, document.activeElement);
            if (activeCell) {
                const tableRow = Number.parseInt(activeCell.getAttribute('data-row') || '', 10);
                const tableCol = Number.parseInt(activeCell.getAttribute('data-col') || '', 10);
                if (tableRow === row && tableCol === col) {
                    return;
                }
            }

            if (this.isCellEditing(row, col)) {
                this.exitCellEdit();
            }
        });
    },

    onTextCellBlur(
        this: TableRuntimeVm,
        row: number,
        col: number,
        _column: TableRuntimeColumn | null | undefined
    ) {
        this.onNativeCellBlur(row, col);
    },

    isPrintableCellKey(this: TableRuntimeVm, event: KeyboardEvent) {
        if (event.ctrlKey || event.metaKey || event.altKey) return false;
        if (event.key.length !== 1) return false;
        return event.key !== '\r' && event.key !== '\n';
    },

    startTypingReplacingCell(this: TableRuntimeVm, row: number, col: number, character: string) {
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        if (!this.canMutateColumnIndex(normalizedCol)) return;

        const column = this.tableColumns[normalizedCol];
        const isEmbedded = this.cellUsesEmbeddedWidget(column);

        if (isEmbedded) {
            this.patchCellValue(
                normalizedRow,
                normalizedCol,
                this.emptyCellValueForColumn(normalizedCol)
            );
            this.setSelectionSingle(normalizedRow, normalizedCol);
            this.editingCell = { r: normalizedRow, c: normalizedCol };
            this._tableProgrammaticFocus = true;
            this.$nextTick?.(() => {
                this.$nextTick?.(() => {
                    const editor = this.getCellEditorElement(normalizedRow, normalizedCol);
                    if (!editor) {
                        this.exitCellEdit();
                        this.endProgrammaticFocusSoon();
                        return;
                    }
                    if (!(editor instanceof HTMLInputElement)) {
                        editor.focus();
                        this.endProgrammaticFocusSoon();
                        return;
                    }
                    editor.focus();
                    editor.value = character;
                    try {
                        editor.dispatchEvent(
                            new InputEvent('input', {
                                bubbles: true,
                                data: character,
                                inputType: 'insertText'
                            })
                        );
                    } catch {
                        editor.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    this.endProgrammaticFocusSoon();
                });
            });
            return;
        }

        this.patchCellValue(normalizedRow, normalizedCol, character);
        this.enterCellEditAt(normalizedRow, normalizedCol, { caretEnd: true });
    },

    onTableCellMouseDown(this: TableRuntimeVm, event: MouseEvent, row: number, col: number) {
        if (!this.isEditable || !event.shiftKey) return;
        event.preventDefault();
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this._shiftSelectGesture = true;
        this.selFullWidthRows = null;
        if (!this._shiftAnchorLocked && this.selFocus) {
            this.selAnchor = { r: this.selFocus.r, c: this.selFocus.c };
            this._shiftAnchorLocked = true;
        }
        this.selFocus = { r: normalizedRow, c: normalizedCol };
        this.focusSelectionCell(normalizedRow, normalizedCol);
    },

    onTableContainerFocusIn(this: TableRuntimeVm, event: FocusEvent) {
        if (!this.isEditable) return;
        const target = getElement(event.target);
        const td = getContainedCell(this, target);
        if (!td || !target) return;

        this._tableFocusWithin = true;
        if (this._tableProgrammaticFocus) return;

        const row = Number.parseInt(td.getAttribute('data-row') || '', 10);
        const col = Number.parseInt(td.getAttribute('data-col') || '', 10);
        if (Number.isNaN(row) || Number.isNaN(col)) return;

        if (target === td) {
            const keepForMenu = Boolean(
                this._tableContextMenuMouseDown &&
                    this.isCellInSelection(row, col) &&
                    (this.selectionIsFullRowBlock() || this.getSelectionCellCount() > 1)
            );
            if (keepForMenu) {
                this.exitCellEdit();
                return;
            }
            this.setSelectionSingle(row, col);
            this.exitCellEdit();
            return;
        }

        if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
            if (target.tagName === 'INPUT' && (target as HTMLInputElement).readOnly) {
                return;
            }
            const editing = this.editingCell;
            if (editing && (editing.r !== row || editing.c !== col)) {
                this.exitCellEdit();
            }
            this.setSelectionSingle(row, col);
            this.editingCell = { r: row, c: col };
        }
    },

    onTableContainerFocusOut(this: TableRuntimeVm, event: FocusEvent) {
        if (!this.isEditable) return;
        const related = getElement(event.relatedTarget);
        if (related && this.$el?.contains(related)) return;
        this._tableFocusWithin = false;
    },

    onTableEditableKeydown(this: TableRuntimeVm, event: KeyboardEvent) {
        TableWidgetHandleKeydown(this, event);
    },

    applyJumpNavigate(this: TableRuntimeVm, target: { c: number; r: number } | null | undefined) {
        if (!target) return;
        this.exitCellEdit();
        this.setSelectionSingle(target.r, target.c);
        this.$nextTick?.(() => this.focusSelectionCell(target.r, target.c));
    },

    applyJumpExtendSelection(
        this: TableRuntimeVm,
        target: { c: number; r: number } | null | undefined,
        anchorRow: number,
        dr: number,
        dc: number
    ) {
        if (!target) return;
        this.selFocus = { r: target.r, c: target.c };
        if (this.selFullWidthRows && dr !== 0 && dc === 0) {
            this.setSelFullWidthRowSpan(anchorRow, target.r);
        } else if (this.selFullWidthRows && dc !== 0) {
            this.selFullWidthRows = null;
        }
        this.exitCellEdit();
        this.$nextTick?.(() => this.focusSelectionCell(this.selFocus!.r, this.selFocus!.c));
    },

    activeCellCol(this: TableRuntimeVm) {
        const td = getContainedCell(this, document.activeElement);
        if (!td) return 0;
        const col = Number.parseInt(td.getAttribute('data-col') || '', 10);
        return Number.isNaN(col) ? 0 : col;
    }
});

export { InteractionRuntimeMethods };
export default InteractionRuntimeMethods;
