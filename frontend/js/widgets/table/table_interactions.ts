import type { TableRuntimeVm, TableRuntimeColumn, TableRuntimeMethodSubset } from './table_contract.ts';
import { readCellDisplayAddress } from './table_dom.ts';
import { TableWidgetHandleKeydown } from './table_keyboard.ts';
import { dispatchRuntimeCellPatches } from './table_runtime_commands.ts';
import { TABLE_RUNTIME_SYNC } from './table_runtime_state.ts';
import { displayCellToCore } from './table_selection_model.ts';

type CellEditorActionKind = string;
type CellIdentityArgs = [
    rowId: string,
    colKey: string,
    fallbackRow: number,
    fallbackCol: number
];

function getElement(value: EventTarget | null | undefined): HTMLElement | null {
    return value instanceof HTMLElement ? value : null;
}

function getContainedCell(vm: TableRuntimeVm, target: EventTarget | null | undefined): HTMLElement | null {
    const element = getElement(target);
    const cell = element?.closest('tbody td');
    return cell && vm.$el?.contains(cell) ? cell as HTMLElement : null;
}

function displayCellByIdentity(
    vm: TableRuntimeVm,
    [rowId, colKey, fallbackRow, fallbackCol]: CellIdentityArgs
) {
    return vm.displayCellFromIdentity(rowId, colKey, {
        r: fallbackRow,
        c: fallbackCol
    });
}

function coreCellAtDisplay(vm: TableRuntimeVm, row: number, col: number) {
    return displayCellToCore(
        { r: row, c: col },
        vm.tableColumns,
        vm.tableViewModelSnapshot()
    );
}

function patchDisplayCellForTyping(
    vm: TableRuntimeVm,
    row: number,
    col: number,
    value: unknown,
    phase: string
) {
    const coreCell = coreCellAtDisplay(vm, row, col);
    if (!coreCell) return null;
    dispatchRuntimeCellPatches(
        vm,
        [{ cell: coreCell, value }],
        phase,
        { skipGroupingViewRefresh: true }
    );
    return coreCell;
}

const InteractionRuntimeMethods = {
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
        const cell = this.selectCellForEdit(row, col);
        if (!cell) return;
        this.enterCellEditAt(cell.r, cell.c, { caretEnd: true });
    },

    selectCellForEdit(this: TableRuntimeVm, row: number, col: number) {
        if (!this.isEditable) return null;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this.setSelectionSingle(normalizedRow, normalizedCol);
        if (!this.canMutateColumnIndex(normalizedCol)) {
            this.$nextTick?.(() => this.focusSelectionCell(normalizedRow, normalizedCol));
            return null;
        }
        return { c: normalizedCol, r: normalizedRow };
    },

    onCellDisplayAction(
        this: TableRuntimeVm,
        row: number,
        col: number,
        actionKind: CellEditorActionKind
    ) {
        const cell = this.selectCellForEdit(row, col);
        if (!cell) return;
        this.enterCellEditAt(cell.r, cell.c, { caretEnd: true });
        this.activateCellEditorAction(cell.r, cell.c, actionKind);
    },

    onCellDisplayActionByIdentity(
        this: TableRuntimeVm,
        rowId: string,
        colKey: string,
        fallbackRow: number,
        fallbackCol: number,
        actionKind: CellEditorActionKind
    ) {
        const cell = displayCellByIdentity(this, [rowId, colKey, fallbackRow, fallbackCol]);
        this.onCellDisplayAction(cell.r, cell.c, actionKind);
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
                const address = readCellDisplayAddress(activeCell);
                if (address?.row === row && address.col === col) {
                    return;
                }
            }

            if (this.isCellEditing(row, col)) {
                this.exitCellEdit();
            }
        });
    },

    onNativeCellBlurByIdentity(this: TableRuntimeVm, ...cellArgs: CellIdentityArgs) {
        const cell = displayCellByIdentity(this, cellArgs);
        this.onNativeCellBlur(cell.r, cell.c);
    },

    onTextCellBlur(
        this: TableRuntimeVm,
        row: number,
        col: number,
        _column: TableRuntimeColumn | null | undefined
    ) {
        this.onNativeCellBlur(row, col);
    },

    onTextCellBlurByIdentity(
        this: TableRuntimeVm,
        ...args: [...CellIdentityArgs, _column: TableRuntimeColumn | null | undefined]
    ) {
        const cellArgs = args.slice(0, 4) as CellIdentityArgs;
        this.onNativeCellBlurByIdentity(...cellArgs);
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
            const coreCell = patchDisplayCellForTyping(
                this,
                normalizedRow,
                normalizedCol,
                this.emptyCellValueForColumn(normalizedCol),
                'start typing clear cell'
            );
            if (!coreCell) return;
            this.setSelectionSingle(normalizedRow, normalizedCol);
                this.dispatchTableCoreCommand(
                    { cell: coreCell, draftValue: character, type: 'ENTER_EDIT_MODE' },
                    'open editor',
                    TABLE_RUNTIME_SYNC.EDITING_ONLY
                );
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

        const coreCell = patchDisplayCellForTyping(
            this,
            normalizedRow,
            normalizedCol,
            character,
            'start typing replace cell'
        );
        if (!coreCell) return;
        this.enterCellEditAt(normalizedRow, normalizedCol, { caretEnd: true });
    },

    onTableCellMouseDown(this: TableRuntimeVm, event: MouseEvent, row: number, col: number) {
        if (!this.isEditable || !event.shiftKey) return;
        event.preventDefault();
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this._shiftSelectGesture = true;
        const anchor = !this._shiftAnchorLocked && this.selFocus
            ? { r: this.selFocus.r, c: this.selFocus.c }
            : this.selAnchor;
        if (!this._shiftAnchorLocked && this.selFocus) {
            this._shiftAnchorLocked = true;
        }
        this.setDisplaySelection(
            {
                anchor,
                focus: { r: normalizedRow, c: normalizedCol },
                fullWidthRows: null
            },
            'shift mouse selection'
        );
        this.focusSelectionCell(normalizedRow, normalizedCol);
    },

    onTableContainerFocusIn(this: TableRuntimeVm, event: FocusEvent) {
        if (!this.isEditable) return;
        const target = getElement(event.target);
        const td = getContainedCell(this, target);
        if (!td || !target) return;

        this._tableFocusWithin = true;
        if (this._tableProgrammaticFocus) return;

        const address = readCellDisplayAddress(td);
        if (!address) return;
        const { row, col } = address;

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
            const coreCell = coreCellAtDisplay(this, row, col);
            if (coreCell) {
                this.dispatchTableCoreCommand(
                    {
                        cell: coreCell,
                        draftValue: this.safeCell(this.dataRowByIdentity(coreCell.rowId), col),
                        type: 'ENTER_EDIT_MODE'
                    },
                    'open editor',
                    TABLE_RUNTIME_SYNC.EDITING_ONLY
                );
            }
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
        const nextSelection = {
            anchor: this.selAnchor,
            focus: { r: target.r, c: target.c },
            fullWidthRows: this.selFullWidthRows
        };
        if (this.selFullWidthRows && dr !== 0 && dc === 0) {
            nextSelection.fullWidthRows = {
                r0: Math.min(anchorRow, target.r),
                r1: Math.max(anchorRow, target.r)
            };
        } else if (this.selFullWidthRows && dc !== 0) {
            nextSelection.fullWidthRows = null;
        }
        this.setDisplaySelection(nextSelection, 'jump extend selection');
        this.exitCellEdit();
        this.$nextTick?.(() => this.focusSelectionCell(this.selFocus!.r, this.selFocus!.c));
    },

    activeCellCol(this: TableRuntimeVm) {
        const td = getContainedCell(this, document.activeElement);
        if (!td) return 0;
        return readCellDisplayAddress(td)?.col ?? 0;
    }
} satisfies TableRuntimeMethodSubset;

export { InteractionRuntimeMethods };
export default InteractionRuntimeMethods;
