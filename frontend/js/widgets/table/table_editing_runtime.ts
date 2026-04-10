import { getRowCells } from './table_utils.ts';
import { tableDebugState, tableLog } from './table_debug.ts';
import { defineTableRuntimeModule } from './table_method_helpers.ts';

const EditingRuntimeMethods = defineTableRuntimeModule({
    onCellInput(rowIndex, cellIndex, event) {
        if (!this.canMutateColumnIndex(cellIndex)) return;
        const newValue = event.target ? event.target.value : event;
        const dataIndex = this.resolveDataRowIndex(rowIndex);
        if (dataIndex < 0) return;
        const rowObject = this.tableData[dataIndex];
        const cells = [...getRowCells(rowObject)];
        cells[cellIndex] = newValue;
        this.applyTableMutation(
            () => {
                this.tableData.splice(dataIndex, 1, { id: rowObject.id, cells });
            },
            { skipSort: true, skipGroupingViewRefresh: true }
        );
        tableLog('cell input', dataIndex, cellIndex);
    },

    onIpInput(rowIndex, cellIndex, event) {
        if (!this.canMutateColumnIndex(cellIndex)) return;
        const raw = event.target.value || '';
        let filtered = raw.replace(/[^\d.]/g, '');
        const parts = filtered
            .split('.')
            .slice(0, 4)
            .map((part) => part.replace(/\D/g, '').slice(0, 3));
        filtered = parts.join('.');
        const dataIndex = this.resolveDataRowIndex(rowIndex);
        if (dataIndex < 0) return;
        const rowObject = this.tableData[dataIndex];
        const cells = [...getRowCells(rowObject)];
        cells[cellIndex] = filtered;
        this.applyTableMutation(
            () => {
                this.tableData.splice(dataIndex, 1, { id: rowObject.id, cells });
            },
            { skipSort: true, skipGroupingViewRefresh: true }
        );
        tableLog('cell ip input', dataIndex, cellIndex);
    },

    onCellFormat(rowIndex, cellIndex, column) {
        try {
            if (!column) return;
            if (!column.format && column.type !== 'int' && column.type !== 'float') return;
            const dataIndex = this.resolveDataRowIndex(rowIndex);
            if (dataIndex < 0) return;
            const rowObject = this.tableData[dataIndex];
            const raw = this.safeCell(rowObject, cellIndex);
            if (raw === '') return;
            const formatted = this.formatCellValue(raw, column);
            if (formatted !== raw) {
                const cells = [...getRowCells(rowObject)];
                cells[cellIndex] = formatted;
                this.applyTableMutation(
                    () => {
                        this.tableData.splice(dataIndex, 1, { id: rowObject.id, cells });
                    },
                    { skipSort: true, skipGroupingViewRefresh: true }
                );
            }
        } catch (error) {}
    },

    onCellInputViewMouseDown(event, row, col) {
        if (!this.isCellEditing(row, col)) event.preventDefault();
    },

    endProgrammaticFocusSoon() {
        this.$nextTick(() => {
            requestAnimationFrame(() => {
                this._tableProgrammaticFocus = false;
            });
        });
    },

    isCellEditing(row, col) {
        const editing = this.editingCell;
        return !!(editing && editing.r === row && editing.c === col);
    },

    exitCellEdit() {
        const editing = this.editingCell;
        if (editing) {
            const row = editing.r;
            const col = editing.c;
            const active = document.activeElement;
            const tableEl = this.getTableEl();
            const cell = tableEl
                ? tableEl.querySelector(`tbody td[data-row="${this.normRow(row)}"][data-col="${this.normCol(col)}"]`)
                : null;
            if (
                active &&
                cell &&
                active !== cell &&
                cell.contains(active) &&
                typeof active.blur === 'function'
            ) {
                active.blur();
            }
            const columnDef = this.tableColumns[col];
            this.applyTrimToEditedTextCell(row, col);
            if (columnDef) this.onCellFormat(row, col, columnDef);
        }
        this.editingCell = null;
    },

    applyTrimToEditedTextCell(row, col) {
        const column = this.tableColumns[col];
        if (!column) return;
        if (this.cellUsesEmbeddedWidget(column)) return;
        const editor = this.getCellEditorElement(row, col);
        if (!editor || editor.tagName !== 'INPUT') return;
        const raw = String(editor.value ?? '');
        const trimmed = raw.trim();
        if (trimmed === raw) return;
        editor.value = trimmed;
        this.patchCellValue(row, col, trimmed);
    },

    patchCellValue(row, col, value) {
        if (this.tableUiLocked) return;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        if (!this.canMutateColumnIndex(normalizedCol)) return;
        const dataIndex = this.resolveDataRowIndex(normalizedRow);
        if (dataIndex < 0) return;
        const rowObject = this.tableData[dataIndex];
        const cells = [...getRowCells(rowObject)];
        cells[normalizedCol] = value;
        this.applyTableMutation(
            () => {
                this.tableData.splice(dataIndex, 1, { id: rowObject.id, cells });
            },
            { skipSort: true, skipGroupingViewRefresh: true }
        );
    },

    getCellEditorElement(row, col) {
        const tableEl = this.getTableEl();
        if (!tableEl) return null;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        const td = tableEl.querySelector(
            `tbody td[data-row="${normalizedRow}"][data-col="${normalizedCol}"]`
        );
        if (!td) return null;
        return td.querySelector(
            '[data-table-editor-target="true"]:not([disabled]), input.cell-input:not([disabled]), select:not([disabled])'
        );
    },

    getCellEditorActionElement(row, col, kind) {
        const tableEl = this.getTableEl();
        if (!tableEl) return null;
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        const td = tableEl.querySelector(
            `tbody td[data-row="${normalizedRow}"][data-col="${normalizedCol}"]`
        );
        if (!td) return null;
        if (!kind) {
            return td.querySelector('[data-table-action-trigger]:not([disabled])');
        }
        return td.querySelector(
            `[data-table-action-trigger="${String(kind)}"]:not([disabled])`
        );
    },

    focusSelectionCell(row, col) {
        this.exitCellEdit();
        const tableEl = this.getTableEl();
        if (!tableEl) return;
        const normalizedCol = this.normCol(col);
        const normalizedRow = this.normRow(row);
        const td = tableEl.querySelector(
            `tbody td[data-row="${normalizedRow}"][data-col="${normalizedCol}"]`
        );
        if (!td || typeof td.focus !== 'function') return;
        this._tableProgrammaticFocus = true;
        td.focus();
        this.endProgrammaticFocusSoon();
    },

    focusSelectionCellWithRetry(row, col) {
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        const attempt = () => {
            this.exitCellEdit();
            const tableEl = this.getTableEl();
            if (!tableEl) return false;
            const td = tableEl.querySelector(
                `tbody td[data-row="${normalizedRow}"][data-col="${normalizedCol}"]`
            );
            if (!td || typeof td.focus !== 'function') return false;
            this._tableProgrammaticFocus = true;
            td.focus();
            this.endProgrammaticFocusSoon();
            return true;
        };
        this.$nextTick(() => {
            if (attempt()) return;
            this.$nextTick(() => {
                if (attempt()) return;
                if (tableDebugState.enabled) {
                    console.warn(
                        '[TableWidget] focusSelectionCellWithRetry failed',
                        normalizedRow,
                        normalizedCol
                    );
                }
            });
        });
    },

    enterCellEditAt(row, col, options) {
        const normalizedOptions = options || {};
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        if (!this.canMutateColumnIndex(normalizedCol)) {
            this.editingCell = null;
            return;
        }
        this.editingCell = { r: normalizedRow, c: normalizedCol };
        this._tableProgrammaticFocus = true;
        this.$nextTick(() => {
            const editor = this.getCellEditorElement(normalizedRow, normalizedCol);
            if (!editor || typeof editor.focus !== 'function') {
                this.exitCellEdit();
                this.endProgrammaticFocusSoon();
                return;
            }
            editor.focus();
            if (editor.setSelectionRange) {
                const length = (editor.value != null ? String(editor.value) : '').length;
                if (normalizedOptions.caretEnd === false) {
                    editor.setSelectionRange(0, 0);
                } else {
                    editor.setSelectionRange(length, length);
                }
            }
            this.endProgrammaticFocusSoon();
        });
    },

    getCellWidgetInstance(row, col) {
        const name = this.cellWidgetRefName(row, col);
        const ref = this.$refs ? this.$refs[name] : null;
        if (Array.isArray(ref)) return ref[0] || null;
        return ref || null;
    },

    invokeCellWidgetAction(row, col, actionKind) {
        const widget = this.getCellWidgetInstance(row, col);
        if (!widget) return false;
        const kind = String(actionKind || '').trim();
        let methodName = '';
        if (kind === 'list') {
            methodName =
                typeof widget.onArrowClick === 'function'
                    ? 'onArrowClick'
                    : typeof widget.toggleDropdown === 'function'
                      ? 'toggleDropdown'
                      : '';
        } else if (kind === 'date') {
            methodName =
                typeof widget.openDatePicker === 'function'
                    ? 'openDatePicker'
                    : typeof widget.openPicker === 'function'
                      ? 'openPicker'
                      : '';
        } else if (kind === 'time') {
            methodName =
                typeof widget.openTimePicker === 'function'
                    ? 'openTimePicker'
                    : typeof widget.openPicker === 'function'
                      ? 'openPicker'
                      : '';
        }
        if (!methodName || typeof widget[methodName] !== 'function') {
            return false;
        }
        widget[methodName]();
        return true;
    },

    activateCellEditorAction(row, col, actionKind, attempt = 0) {
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this.$nextTick(() => {
            if (this.invokeCellWidgetAction(normalizedRow, normalizedCol, actionKind)) {
                return;
            }
            const trigger = this.getCellEditorActionElement(
                normalizedRow,
                normalizedCol,
                actionKind
            );
            if (trigger && typeof trigger.click === 'function') {
                trigger.click();
                return;
            }
            if (attempt >= 3) {
                const input = this.getCellEditorElement(normalizedRow, normalizedCol);
                if (input && typeof input.focus === 'function') {
                    input.focus();
                }
                return;
            }
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() =>
                    this.activateCellEditorAction(
                        normalizedRow,
                        normalizedCol,
                        actionKind,
                        attempt + 1
                    )
                );
                return;
            }
            this.activateCellEditorAction(
                normalizedRow,
                normalizedCol,
                actionKind,
                attempt + 1
            );
        });
    }
});

export { EditingRuntimeMethods };
export default EditingRuntimeMethods;
