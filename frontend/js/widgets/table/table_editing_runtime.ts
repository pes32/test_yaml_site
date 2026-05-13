import { tableDebugState, tableLog } from './table_debug.ts';
import { commitEditorHandle, createDomTableEditorHandle, isTableEditorHandle } from './table_internal.ts';
import {
    dispatchRuntimeCellPatches,
    type RuntimePatchOptions
} from './table_runtime_commands.ts';
import { TABLE_RUNTIME_SYNC } from './table_runtime_state.ts';
import { getCellByDisplayAddress } from './table_dom.ts';
import type {
    TableCellAddress,
    TableEditorHandle,
    TableCellWidgetInstance,
    TableCoreCellAddress,
    TableRuntimeColumn,
    TableRuntimeMethodSubset,
    TableRuntimeVm
} from './table_contract.ts';

function readEventValue(event: Event | { target?: { value?: unknown } } | unknown): unknown {
    if (event instanceof Event) {
        const target = event.target;
        return target && 'value' in target ? (target as { value?: unknown }).value : event;
    }
    if (event && typeof event === 'object' && 'target' in event) {
        const target = (event as { target?: unknown }).target;
        if (target && typeof target === 'object' && 'value' in target) {
            return (target as { value?: unknown }).value;
        }
    }
    return event;
}

function writeEventTargetValue(event: Event | { target?: { value?: unknown } } | unknown, value: unknown): void {
    const nextValue = value == null ? '' : String(value);
    if (event instanceof Event) {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            if (target.value !== nextValue) target.value = nextValue;
        }
        return;
    }
    if (event && typeof event === 'object' && 'target' in event) {
        const target = (event as { target?: unknown }).target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            if (target.value !== nextValue) target.value = nextValue;
        }
    }
}

function normalizeIpInputValue(value: unknown): string {
    const filtered = String(value || '')
        .replace(/[,\s|\\/]+/g, '.')
        .replace(/[^\d.]/g, '');
    return filtered
        .split('.')
        .slice(0, 4)
        .map((part: string) => part.replace(/\D/g, '').slice(0, 3))
        .join('.');
}

function normalizeIntInputValue(value: unknown): string {
    const compact = String(value ?? '').replace(/\s+/g, '');
    const sign = compact.startsWith('-') ? '-' : '';
    return sign + compact.replace(/\D+/g, '');
}

function normalizeFloatInputValue(value: unknown): string {
    const compact = String(value ?? '').replace(/,/g, '.').replace(/\s+/g, '');
    const sign = compact.startsWith('-') ? '-' : '';
    const unsigned = compact.replace(/-/g, '');
    let hasDot = false;
    let output = '';
    for (const char of unsigned) {
        if (char >= '0' && char <= '9') {
            output += char;
            continue;
        }
        if (char === '.' && !hasDot) {
            output += char;
            hasDot = true;
        }
    }
    return sign + output;
}

function normalizeCellTextInputValue(
    runtime: CellIdentityRuntime,
    rowId: string,
    colKey: string,
    fallbackCol: number,
    value: unknown
): unknown {
    const colIndex = columnIndexFromIdentityFallback(runtime, colKey, fallbackCol);
    const column = runtime.tableColumns[colIndex];
    const type =
        typeof runtime.effectiveCellTypeByIdentity === 'function' && column
            ? runtime.effectiveCellTypeByIdentity(rowId, colKey, colIndex, column)
            : column?.type;
    if (type === 'int') return normalizeIntInputValue(value);
    if (type === 'float') return normalizeFloatInputValue(value);
    if (type === 'ip') return normalizeIpInputValue(value);
    return value;
}

function isTableCellWidgetInstance(value: unknown): value is TableCellWidgetInstance {
    return !!value && typeof value === 'object' && '$' in value;
}

type CellIdentityRuntime = TableRuntimeVm;

type EnterCellEditOptions = {
    caretEnd?: boolean;
};

function displayCellFromIdentityFallback(
    runtime: CellIdentityRuntime,
    rowId: string,
    colKey: string,
    fallbackRow: number,
    fallbackCol: number
): TableCellAddress {
    return runtime.displayCellFromIdentity(rowId, colKey, {
        r: fallbackRow,
        c: fallbackCol
    });
}

function columnIndexFromIdentityFallback(
    runtime: CellIdentityRuntime,
    colKey: string,
    fallbackCol: number
): number {
    const colIndex = runtime.runtimeColumnKeys().indexOf(String(colKey || ''));
    return colIndex >= 0 ? colIndex : runtime.normCol(fallbackCol);
}

function patchCellByCoreAddress(
    runtime: {
        canMutateColumnIndex(colIndex: number): boolean;
        runtimeColumnKeys(): string[];
        tableUiLocked: boolean;
    } & Parameters<typeof dispatchRuntimeCellPatches>[0],
    cell: TableCoreCellAddress | null | undefined,
    value: unknown,
    options: RuntimePatchOptions = {}
): void {
    if (runtime.tableUiLocked || !cell?.rowId || !cell.colKey) return;
    const colIndex = runtime.runtimeColumnKeys().indexOf(cell.colKey);
    if (colIndex < 0 || !runtime.canMutateColumnIndex(colIndex)) return;
    dispatchRuntimeCellPatches(
        runtime,
        [{ cell, value }],
        'patch cell',
        { skipGroupingViewRefresh: true, ...(options || {}) }
    );
}

function patchCellByDisplayAddress(
    runtime: {
        coreCellFromDisplay(rowIndex: number, colIndex: number): TableCoreCellAddress | null;
        normCol(col: number): number;
        normRow(row: number): number;
    } & Parameters<typeof patchCellByCoreAddress>[0],
    row: number,
    col: number,
    value: unknown,
    options: RuntimePatchOptions = {}
): void {
    const normalizedRow = runtime.normRow(row);
    const normalizedCol = runtime.normCol(col);
    patchCellByCoreAddress(
        runtime,
        runtime.coreCellFromDisplay(normalizedRow, normalizedCol),
        value,
        options
    );
}

function patchCellByIdentity(
    runtime: Parameters<typeof patchCellByCoreAddress>[0],
    rowId: string,
    colKey: string,
    value: unknown,
    options: RuntimePatchOptions = {}
): void {
    patchCellByCoreAddress(
        runtime,
        { colKey: String(colKey || ''), rowId: String(rowId || '') },
        value,
        options
    );
}

const EditingRuntimeMethods = {
    onCellInput(rowIndex: number, cellIndex: number, event: Event | { target?: { value?: unknown } } | unknown) {
        const cell = this.coreCellFromDisplay(this.normRow(rowIndex), this.normCol(cellIndex));
        const newValue = cell
            ? normalizeCellTextInputValue(this, cell.rowId, cell.colKey, cellIndex, readEventValue(event))
            : readEventValue(event);
        writeEventTargetValue(event, newValue);
        patchCellByCoreAddress(this, cell, newValue, {
            skipGroupingViewRefresh: true
        });
        tableLog('cell input', rowIndex, cellIndex);
    },

    onCellInputByIdentity(
        rowId: string,
        colKey: string,
        event: Event | { target?: { value?: unknown } } | unknown
    ) {
        const colIndex = columnIndexFromIdentityFallback(this, colKey, 0);
        const newValue = normalizeCellTextInputValue(this, rowId, colKey, colIndex, readEventValue(event));
        writeEventTargetValue(event, newValue);
        patchCellByIdentity(this, rowId, colKey, newValue, {
            skipGroupingViewRefresh: true
        });
        tableLog('cell input', rowId, colKey);
    },

    onIpInput(rowIndex: number, cellIndex: number, event: Event | { target?: { value?: unknown } } | unknown) {
        const filtered = normalizeIpInputValue(readEventValue(event));
        writeEventTargetValue(event, filtered);
        patchCellByDisplayAddress(this, rowIndex, cellIndex, filtered, {
            skipGroupingViewRefresh: true
        });
        tableLog('cell ip input', rowIndex, cellIndex);
    },

    onIpInputByIdentity(
        rowId: string,
        colKey: string,
        event: Event | { target?: { value?: unknown } } | unknown
    ) {
        const filtered = normalizeIpInputValue(readEventValue(event));
        writeEventTargetValue(event, filtered);
        patchCellByIdentity(this, rowId, colKey, filtered, {
            skipGroupingViewRefresh: true
        });
        tableLog('cell ip input', rowId, colKey);
    },

    onCellFormat(rowIndex: number, cellIndex: number, column: TableRuntimeColumn | null | undefined) {
        try {
            const coreCell = this.coreCellFromDisplay(rowIndex, cellIndex);
            if (!coreCell) return;
            this.onCellFormatByIdentity(coreCell.rowId, coreCell.colKey, cellIndex, column);
        } catch (error) {}
    },

    onCellFormatByIdentity(
        rowId: string,
        colKey: string,
        fallbackCol: number,
        column: TableRuntimeColumn | null | undefined
    ) {
        try {
            const effectiveColumn =
                typeof this.effectiveCellColumnByIdentity === 'function'
                    ? this.effectiveCellColumnByIdentity(rowId, colKey, fallbackCol, column)
                    : column;
            if (!effectiveColumn) return;
            if (!effectiveColumn.format && effectiveColumn.type !== 'int' && effectiveColumn.type !== 'float') return;
            const colIndex = columnIndexFromIdentityFallback(this, colKey, fallbackCol);
            const raw = this.safeCell(this.dataRowByIdentity(rowId), colIndex);
            if (raw === '') return;
            const formatted = this.formatCellValue(raw, effectiveColumn);
            if (formatted !== raw) {
                patchCellByIdentity(this, rowId, colKey, formatted, {
                    skipGroupingViewRefresh: true
                });
            }
        } catch (error) {}
    },

    onCellInputViewMouseDown(event: MouseEvent, row: number, col: number) {
        if (!this.isCellEditing(row, col)) event.preventDefault();
    },

    endProgrammaticFocusSoon() {
        this.$nextTick(() => {
            requestAnimationFrame(() => {
                this._tableProgrammaticFocus = false;
            });
        });
    },

    isCellEditing(row: number, col: number) {
        const editing = this.editingCell;
        return !!(editing && editing.r === row && editing.c === col);
    },

    exitCellEdit() {
        const editing = this.editingCell;
        if (editing) {
            const row = editing.r;
            const col = editing.c;
            const active = document.activeElement;
            const cell = getCellByDisplayAddress(this, this.normRow(row), this.normCol(col));
            if (
            active instanceof HTMLElement &&
            cell &&
            active !== cell &&
            cell.contains(active) &&
            typeof active.blur === 'function'
            ) {
                active.blur();
            }
            const columnDef = this.tableColumns[col];
            const coreCell = this.coreCellFromDisplay(row, col);
            if (coreCell) {
                this.commitCellEditorHandleByIdentity(coreCell.rowId, coreCell.colKey, row, col);
                this.applyTrimToEditedTextCellByIdentity(coreCell.rowId, coreCell.colKey, row, col);
                if (columnDef) this.onCellFormatByIdentity(coreCell.rowId, coreCell.colKey, col, columnDef);
            }
        }
        this.dispatchTableCoreCommand(
            { type: 'CANCEL_EDIT' },
            'close editor',
            TABLE_RUNTIME_SYNC.EDITING_ONLY
        );
        this.$nextTick(() => this._scheduleVirtualMeasurement?.());
    },

    applyTrimToEditedTextCell(row: number, col: number) {
        const coreCell = this.coreCellFromDisplay(row, col);
        if (!coreCell) return;
        this.applyTrimToEditedTextCellByIdentity(coreCell.rowId, coreCell.colKey, row, col);
    },

    applyTrimToEditedTextCellByIdentity(
        rowId: string,
        colKey: string,
        fallbackRow: number,
        fallbackCol: number
    ) {
        const displayCell = displayCellFromIdentityFallback(this, rowId, colKey, fallbackRow, fallbackCol);
        const column = this.tableColumns[displayCell.c];
        if (!column) return;
        if (this.cellUsesEmbeddedWidget(column)) return;
        const editor = this.getCellEditorElement(displayCell.r, displayCell.c);
        if (!(editor instanceof HTMLInputElement)) return;
        const raw = String(editor.value ?? '');
        const trimmed = raw.trim();
        if (trimmed === raw) return;
        editor.value = trimmed;
        patchCellByIdentity(this, rowId, colKey, trimmed);
    },

    getCellEditorElement(row: number, col: number) {
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        const td = getCellByDisplayAddress(this, normalizedRow, normalizedCol);
        if (!td) return null;
        const editor = td.querySelector(
            '[data-table-editor-target="true"]:not([disabled]), input.cell-input:not([disabled]), select:not([disabled])'
        );
        return editor instanceof HTMLElement ? editor : null;
    },

    getCellEditorHandle(row: number, col: number): TableEditorHandle | null {
        const coreCell = this.coreCellFromDisplay(row, col);
        if (!coreCell) return null;
        return this.getCellEditorHandleByIdentity(coreCell.rowId, coreCell.colKey, row, col);
    },

    getCellEditorHandleByIdentity(
        rowId: string,
        colKey: string,
        fallbackRow: number,
        fallbackCol: number
    ): TableEditorHandle | null {
        const displayCell = displayCellFromIdentityFallback(this, rowId, colKey, fallbackRow, fallbackCol);
        const widget = this.getCellWidgetInstance(displayCell.r, displayCell.c);
        if (isTableEditorHandle(widget)) return widget;
        const editor = this.getCellEditorElement(displayCell.r, displayCell.c);
        if (!editor) return null;
        return createDomTableEditorHandle(editor, {
            commitValue: (value) => patchCellByIdentity(this, rowId, colKey, value)
        });
    },

    commitCellEditorHandle(row: number, col: number) {
        const coreCell = this.coreCellFromDisplay(row, col);
        if (!coreCell) return undefined;
        return this.commitCellEditorHandleByIdentity(coreCell.rowId, coreCell.colKey, row, col);
    },

    commitCellEditorHandleByIdentity(
        rowId: string,
        colKey: string,
        fallbackRow: number,
        fallbackCol: number
    ) {
        const handle = this.getCellEditorHandleByIdentity(rowId, colKey, fallbackRow, fallbackCol);
        if (!handle) return undefined;
        return commitEditorHandle(handle, {
            colKey: String(colKey || ''),
            rowId: String(rowId || '')
        });
    },

    getCellEditorActionElement(row: number, col: number, kind: string | null | undefined) {
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        const td = getCellByDisplayAddress(this, normalizedRow, normalizedCol);
        if (!td) return null;
        if (!kind) {
            const trigger = td.querySelector('[data-table-action-trigger]:not([disabled])');
            return trigger instanceof HTMLElement ? trigger : null;
        }
        const trigger = td.querySelector(
            `[data-table-action-trigger="${String(kind)}"]:not([disabled])`
        );
        return trigger instanceof HTMLElement ? trigger : null;
    },

    _flushFocusSelectionCellNow(normalizedRow: number, normalizedCol: number) {
        this.ensureDisplayRowVisible?.(normalizedRow);
        const td = getCellByDisplayAddress(this, normalizedRow, normalizedCol);
        if (!td) {
            this.$nextTick(() => {
                const nextTd = getCellByDisplayAddress(this, normalizedRow, normalizedCol);
                if (!nextTd) return;
                this._tableProgrammaticFocus = true;
                nextTd.focus({ preventScroll: true });
                this.endProgrammaticFocusSoon();
            });
            return;
        }
        this._tableProgrammaticFocus = true;
        td.focus({ preventScroll: true });
        this.endProgrammaticFocusSoon();
    },

    focusSelectionCell(row: number, col: number) {
        const normalizedCol = this.normCol(col);
        const normalizedRow = this.normRow(row);
        this._pendingFocusSelectionCell = { c: normalizedCol, r: normalizedRow };
        if (this._focusSelectionScheduledRaf) return;
        const schedule =
            typeof requestAnimationFrame === 'function'
                ? requestAnimationFrame.bind(globalThis)
                : (callback: FrameRequestCallback) => {
                      return typeof globalThis === 'undefined'
                          ? setTimeout(callback, 16)
                          : setTimeout(callback, 16);
                  };
        const token = schedule(() => {
            this._focusSelectionScheduledRaf = 0;
            const queued = this._pendingFocusSelectionCell;
            this._pendingFocusSelectionCell = null;
            if (!queued) return;
            if (
                this.editingCell &&
                this.editingCell.r === queued.r &&
                this.editingCell.c === queued.c
            ) {
                return;
            }
            this.exitCellEdit();
            this._flushFocusSelectionCellNow(queued.r, queued.c);
        });
        this._focusSelectionScheduledRaf = typeof token === 'number' ? token : 0;
    },

    focusSelectionCellWithRetry(row: number, col: number) {
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        this.ensureDisplayRowVisible?.(normalizedRow);
        const attempt = () => {
            this.exitCellEdit();
            const td = getCellByDisplayAddress(this, normalizedRow, normalizedCol);
            if (!td) return false;
            this._tableProgrammaticFocus = true;
            td.focus({ preventScroll: true });
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

    enterCellEditAt(row: number, col: number, options?: EnterCellEditOptions) {
        const normalizedOptions = options || {};
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        if (!this.canMutateColumnIndex(normalizedCol)) {
            this.editingCell = null;
            return;
        }
        this.ensureDisplayRowVisible?.(normalizedRow);
        const coreCell = this.coreCellFromDisplay(normalizedRow, normalizedCol);
        if (!coreCell) return;
        const sourceRow = this.dataRowByIdentity(coreCell.rowId);
        const draftValue = this.safeCell(sourceRow, normalizedCol);
        this.dispatchTableCoreCommand(
            { cell: coreCell, draftValue, type: 'ENTER_EDIT_MODE' },
            'open editor',
            TABLE_RUNTIME_SYNC.EDITING_ONLY
        );
        this.$nextTick(() => this._scheduleVirtualMeasurement?.());
        this._tableProgrammaticFocus = true;
        this.$nextTick(() => {
            const editor = this.getCellEditorElement(normalizedRow, normalizedCol);
            if (!editor || typeof editor.focus !== 'function') {
                this.exitCellEdit();
                this.endProgrammaticFocusSoon();
                return;
            }
            editor.focus();
            if (editor instanceof HTMLInputElement && typeof editor.setSelectionRange === 'function') {
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

    getCellWidgetInstance(row: number, col: number) {
        const name = this.cellWidgetRefName(row, col);
        const ref = this.$refs ? this.$refs[name] : null;
        const candidate = Array.isArray(ref) ? ref[0] : ref;
        return isTableCellWidgetInstance(candidate) ? candidate : null;
    },

    invokeCellWidgetAction(row: number, col: number, actionKind: string) {
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
        const action = methodName ? widget[methodName] : null;
        if (typeof action !== 'function') {
            return false;
        }
        action.call(widget);
        return true;
    },

    activateCellEditorAction(row: number, col: number, actionKind: string, attempt = 0) {
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
            if (attempt >= 60) {
                const input = this.getCellEditorElement(normalizedRow, normalizedCol);
                if (input && typeof input.focus === 'function') {
                    input.focus();
                }
                return;
            }
            const retry = () =>
                this.activateCellEditorAction(
                    normalizedRow,
                    normalizedCol,
                    actionKind,
                    attempt + 1
                );
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(retry);
                return;
            }
            retry();
        });
    }
} satisfies TableRuntimeMethodSubset;

export { EditingRuntimeMethods };
export default EditingRuntimeMethods;
