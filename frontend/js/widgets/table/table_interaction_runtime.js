import tableEngine from './table_core.js';

const Core = tableEngine;

const InteractionRuntimeMethods = {
    onTableCellClick(event, row, col) {
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
        this.$nextTick(() => this.focusSelectionCell(normalizedRow, normalizedCol));
    },

    onTableCellDblClick(row, col) {
        if (!this.isEditable) return;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this.setSelectionSingle(normalizedRow, normalizedCol);
        if (!this.canMutateColumnIndex(normalizedCol)) {
            this.$nextTick(() => this.focusSelectionCell(normalizedRow, normalizedCol));
            return;
        }
        this.enterCellEditAt(normalizedRow, normalizedCol, { caretEnd: true });
    },

    onCellDisplayAction(row, col, actionKind) {
        if (!this.isEditable) return;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this.setSelectionSingle(normalizedRow, normalizedCol);
        if (!this.canMutateColumnIndex(normalizedCol)) {
            this.$nextTick(() => this.focusSelectionCell(normalizedRow, normalizedCol));
            return;
        }
        this.enterCellEditAt(normalizedRow, normalizedCol, { caretEnd: true });
        this.activateCellEditorAction(normalizedRow, normalizedCol, actionKind);
    },

    navigateTableByTabFromCell(row, col, shiftKey) {
        const lastRow = this.tbodyRowCount() - 1;
        const lastCol = this.tableColumns.length - 1;
        if (lastRow < 0 || lastCol < 0) return false;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        let nextRow;
        let nextCol;
        if (shiftKey) {
            if (normalizedCol > 0) {
                nextRow = normalizedRow;
                nextCol = normalizedCol - 1;
            } else if (normalizedRow > 0) {
                nextRow = normalizedRow - 1;
                nextCol = lastCol;
            } else {
                return false;
            }
        } else if (normalizedCol < lastCol) {
            nextRow = normalizedRow;
            nextCol = normalizedCol + 1;
        } else if (normalizedRow < lastRow) {
            nextRow = normalizedRow + 1;
            nextCol = 0;
        } else {
            return false;
        }
        this.exitCellEdit();
        this.setSelectionSingle(nextRow, nextCol);
        this.$nextTick(() => this.focusSelectionCell(nextRow, nextCol));
        return true;
    },

    onNativeCellBlur(row, col) {
        this.$nextTick(() => {
            if (this._tableProgrammaticFocus) return;
            const activeElement = document.activeElement;
            const td = activeElement && activeElement.closest ? activeElement.closest('tbody td') : null;
            if (td && this.$el.contains(td)) {
                const tableRow = parseInt(td.getAttribute('data-row'), 10);
                const tableCol = parseInt(td.getAttribute('data-col'), 10);
                if (tableRow === row && tableCol === col) return;
            }
            if (this.isCellEditing(row, col)) this.exitCellEdit();
        });
    },

    onTextCellBlur(row, col, column) {
        void column;
        this.onNativeCellBlur(row, col);
    },

    isPrintableCellKey(event) {
        if (event.ctrlKey || event.metaKey || event.altKey) return false;
        if (event.key.length !== 1) return false;
        const key = event.key;
        if (key === '\r' || key === '\n') return false;
        return true;
    },

    startTypingReplacingCell(row, col, character) {
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
            this.$nextTick(() => {
                this.$nextTick(() => {
                    const editor = this.getCellEditorElement(normalizedRow, normalizedCol);
                    if (!editor) {
                        this.exitCellEdit();
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
                    } catch (error) {
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

    onTableCellMouseDown(event, row, col) {
        if (!this.isEditable) return;
        if (!event.shiftKey) return;
        event.preventDefault();
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this._shiftSelectGesture = true;
        this.selFullWidthRows = null;
        if (!this._shiftAnchorLocked) {
            this.selAnchor = { r: this.selFocus.r, c: this.selFocus.c };
            this._shiftAnchorLocked = true;
        }
        this.selFocus = { r: normalizedRow, c: normalizedCol };
        this.focusSelectionCell(normalizedRow, normalizedCol);
    },

    onTableContainerFocusIn(event) {
        if (!this.isEditable) return;
        const target = event.target;
        const td = target.closest?.('tbody td');
        if (!td || !this.$el.contains(td)) return;
        this._tableFocusWithin = true;
        if (this._tableProgrammaticFocus) return;
        const row = parseInt(td.getAttribute('data-row'), 10);
        const col = parseInt(td.getAttribute('data-col'), 10);
        if (Number.isNaN(row) || Number.isNaN(col)) return;
        if (target === td) {
            const contextMenuMouseDown = this._tableContextMenuMouseDown;
            const keepForMenu =
                contextMenuMouseDown &&
                this.isCellInSelection(row, col) &&
                (this.selectionIsFullRowBlock() || this.getSelectionCellCount() > 1);
            if (keepForMenu) {
                this.exitCellEdit();
                return;
            }
            this.setSelectionSingle(row, col);
            this.exitCellEdit();
            return;
        }
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
            if (target.tagName === 'INPUT' && target.readOnly) return;
            const editing = this.editingCell;
            if (editing && (editing.r !== row || editing.c !== col)) {
                this.exitCellEdit();
            }
            this.setSelectionSingle(row, col);
            this.editingCell = { r: row, c: col };
        }
    },

    onTableContainerFocusOut(event) {
        if (!this.isEditable) return;
        const related = event.relatedTarget;
        if (related && this.$el && this.$el.contains(related)) return;
        this._tableFocusWithin = false;
    },

    onTableEditableKeydown(event) {
        const Keyboard = tableEngine.Keyboard;
        const handleKeydown = Keyboard && Keyboard.handleKeydown;
        if (typeof handleKeydown === 'function') handleKeydown(this, event);
    },

    applyJumpNavigate(jumpTarget) {
        if (!jumpTarget) return;
        this.exitCellEdit();
        this.setSelectionSingle(jumpTarget.r, jumpTarget.c);
        this.$nextTick(() => this.focusSelectionCell(jumpTarget.r, jumpTarget.c));
    },

    applyJumpExtendSelection(jumpTarget, anchorRow, dr, dc) {
        if (!jumpTarget) return;
        const jumpRow = jumpTarget.r;
        const jumpCol = jumpTarget.c;
        this.selFocus = { r: jumpRow, c: jumpCol };
        if (this.selFullWidthRows && dr !== 0 && dc === 0) {
            this.setSelFullWidthRowSpan(anchorRow, jumpRow);
        } else if (this.selFullWidthRows && dc !== 0) {
            this.selFullWidthRows = null;
        }
        this.exitCellEdit();
        this.$nextTick(() =>
            this.focusSelectionCell(this.selFocus.r, this.selFocus.c)
        );
    },

    activeCellCol() {
        const active = document.activeElement;
        const td = active?.closest?.('tbody td');
        if (!td || !this.$el.contains(td)) return 0;
        const col = parseInt(td.getAttribute('data-col'), 10);
        return Number.isNaN(col) ? 0 : col;
    }
};

Core.InteractionRuntimeMethods = InteractionRuntimeMethods;

export { InteractionRuntimeMethods };
export default InteractionRuntimeMethods;
