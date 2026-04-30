import type { Component } from 'vue';
import type {
    TableCellDataType,
    TableCellDisplayAction,
    TableCellStyleMeta,
    TableCellTypeMeta,
    TableContextMenuSnapshot,
    TableCoreCellAddress,
    TableToolbarState,
    TableRuntimeColumn,
    TableRuntimeMethodSubset,
    TableRuntimeVm
} from './table_contract.ts';
import { coerceCellValueForDataType } from './table_cell_type_coercion.ts';
import {
    hasCellMetaEntries,
    normalizeColor,
    normalizeFontSize,
    patchCellMeta,
    peekCellMeta,
    type TableCellMetaPatch
} from './table_cell_meta.ts';
import {
    columnTypeLockedByYaml,
    columnTypeToTableCellDataType,
    resolveEffectiveCellColumn
} from './table_effective_column.ts';
import { dispatchRuntimeCellPatches } from './table_runtime_commands.ts';
import { displayCellToCore } from './table_selection_model.ts';
import {
    createDefaultTableToolbarState,
    TABLE_TOOLBAR_DEFAULT_FILL_COLOR,
    TABLE_TOOLBAR_DEFAULT_FONT_SIZE,
    TABLE_TOOLBAR_DEFAULT_TEXT_COLOR
} from './table_toolbar_model.ts';
import { setTableValidationError } from './table_validation_model.ts';

const EMPTY_STYLE = Object.freeze({}) as Record<string, string>;
const CELL_CURSOR_STYLE = Object.freeze({ cursor: 'pointer' }) as Record<string, string>;
const TOOLBAR_STYLE_ACTIONS = ['bold', 'italic', 'underline', 'strike'] as const;
const TOOLBAR_DEFAULT_STATE: TableToolbarState = Object.freeze(createDefaultTableToolbarState());

function selectedMutableCoreCells(vm: TableRuntimeVm): TableCoreCellAddress[] {
    const rect = vm.getSelRect();
    const viewModel = vm.tableViewModelSnapshot();
    const cells: TableCoreCellAddress[] = [];
    for (let row = rect.r0; row <= rect.r1; row += 1) {
        const displayRow = vm.displayRows[row];
        if (displayRow && displayRow.kind !== 'data') continue;
        for (let col = rect.c0; col <= rect.c1; col += 1) {
            if (!vm.canMutateColumnIndex(col)) continue;
            const cell = displayCellToCore({ r: row, c: col }, vm.tableColumns, viewModel);
            if (cell) cells.push(cell);
        }
    }
    return cells;
}

function styleFromMeta(meta: TableCellStyleMeta | null | undefined): Record<string, string> {
    if (!meta) return EMPTY_STYLE;
    const style: Record<string, string> = {};
    if (meta.bold != null) style.fontWeight = meta.bold ? '700' : '400';
    if (meta.italic != null) style.fontStyle = meta.italic ? 'italic' : 'normal';
    if (meta.underline || meta.strike) {
        style.textDecoration = [
            meta.underline ? 'underline' : '',
            meta.strike ? 'line-through' : ''
        ].filter(Boolean).join(' ');
    }
    if (meta.textColor) style.color = meta.textColor;
    if (meta.fontSize) style.fontSize = `${meta.fontSize}px`;
    if (meta.horizontalAlign) style.textAlign = meta.horizontalAlign;
    return style;
}

function tdStyleFromMeta(meta: TableCellStyleMeta | null | undefined): Record<string, string> {
    if (!meta) return CELL_CURSOR_STYLE;
    const style: Record<string, string> = { cursor: 'pointer' };
    if (meta.fillColor) style.backgroundColor = meta.fillColor;
    if (meta.verticalAlign) {
        style.verticalAlign = meta.verticalAlign === 'middle' ? 'middle' : meta.verticalAlign;
    }
    return style;
}

function effectiveColumnForIdentity(
    vm: TableRuntimeVm,
    rowId: string,
    colKey: string,
    column: TableRuntimeColumn | null | undefined
): TableRuntimeColumn | null {
    const meta = vm.cellMetaByIdentity(rowId, colKey);
    return meta ? resolveEffectiveCellColumn(column, meta) : column || null;
}

function forwardEffectiveColumn<TResult>(
    methodName: keyof TableRuntimeVm
) {
    return function (
        this: TableRuntimeVm,
        rowId: string,
        colKey: string,
        fallbackCol: number,
        column: TableRuntimeColumn
    ): TResult {
        void fallbackCol;
        const method = this[methodName] as (column: TableRuntimeColumn | null) => TResult;
        return method.call(this, effectiveColumnForIdentity(this, rowId, colKey, column));
    };
}

function focusedCoreCell(vm: TableRuntimeVm): TableCoreCellAddress | null {
    const viewModel = vm.tableViewModelSnapshot();
    return displayCellToCore(vm.selFocus, vm.tableColumns, viewModel);
}

function columnTypeToToolbarType(column: TableRuntimeColumn | null | undefined): TableToolbarState['type'] {
    return columnTypeToTableCellDataType(column?.type);
}

function toolbarStateFromFocusedCell(vm: TableRuntimeVm): TableToolbarState {
    const cell = focusedCoreCell(vm);
    if (!cell) return { ...TOOLBAR_DEFAULT_STATE };
    const colIndex = vm.runtimeColumnKeys().indexOf(cell.colKey);
    const column = colIndex >= 0 ? vm.tableColumns[colIndex] : null;
    const meta = vm.cellMetaByIdentity(cell.rowId, cell.colKey);
    const style = meta?.style || {};
    const typeMeta = meta?.dataType || {};
    const activeButtons: string[] = TOOLBAR_STYLE_ACTIONS.filter((action) => style[action] === true);
    const horizontalAlign = style.horizontalAlign;
    const verticalAlign = style.verticalAlign;
    if (horizontalAlign) activeButtons.push(`align-${horizontalAlign}`);
    if (verticalAlign) activeButtons.push(`align-${verticalAlign}`);
    if (typeMeta.thousands === true) activeButtons.push('thousands');
    if (vm.lineNumbersRuntimeEnabled) activeButtons.push('toggle-line-numbers');
    if (vm.stickyHeaderEnabled) activeButtons.push('toggle-sticky-header');
    if (vm.wordWrapEnabled) activeButtons.push('toggle-word-wrap');

    return {
        activeButtons,
        canApplyNumericFormat: vm.canApplyNumericFormatToSelection(),
        fontSize: normalizeFontSize(style.fontSize) || TABLE_TOOLBAR_DEFAULT_FONT_SIZE,
        precision: typeof typeMeta.precision === 'number' ? typeMeta.precision : null,
        thousands: typeMeta.thousands === true,
        type: typeMeta.type || columnTypeToToolbarType(column),
        typeLocked: columnTypeLockedByYaml(column)
    };
}

function styleBooleanPatchForAction(action: string, toolbarState: TableToolbarState): TableCellStyleMeta | null {
    if (!TOOLBAR_STYLE_ACTIONS.includes(action as (typeof TOOLBAR_STYLE_ACTIONS)[number])) {
        return null;
    }
    return { [action]: !toolbarState.activeButtons.includes(action) } as TableCellStyleMeta;
}

function toolbarContextSnapshot(vm: TableRuntimeVm): TableContextMenuSnapshot {
    return {
        anchorCol: vm.selFocus.c,
        anchorColumnKey: vm.runtimeColumnKey(vm.selFocus.c),
        anchorRow: vm.selFocus.r,
        anchorRowId: vm.selectedDataRowIdFromViewRow(vm.selFocus.r),
        anchorSourceRow: null,
        bodyMode: vm.computeBodyModeForMenu(),
        groupingLevelKeysSnapshot: (vm.groupingState.levels || [])
            .map((col: number) => vm.runtimeColumnKey(col))
            .filter(Boolean),
        groupingLevelsSnapshot: (vm.groupingState.levels || []).slice(),
        headerCol: null,
        headerColumnKey: null,
        lineNumbersEnabled: vm.lineNumbersRuntimeEnabled,
        pasteAnchor: { r: vm.selFocus.r, c: vm.selFocus.c },
        pasteAnchorColumnKey: vm.runtimeColumnKey(vm.selFocus.c),
        pasteAnchorRowId: vm.selectedDataRowIdFromViewRow(vm.selFocus.r),
        rect: vm.getSelRect(),
        selectionSnapshot: vm.buildSelectionSnapshotFromDisplay(),
        sessionId: vm.contextMenuSessionId,
        sortKeyColumnsSnapshot: vm.runtimeSortKeySnapshots(),
        sortKeys: (vm.sortKeys || []).slice(),
        stickyHeaderEnabled: vm.stickyHeaderEnabled,
        wordWrapEnabled: vm.wordWrapEnabled
    };
}

function numericMetaPatchesForSelection(
    vm: TableRuntimeVm,
    transform: (meta: TableCellTypeMeta) => TableCellTypeMeta
): TableCellMetaPatch[] {
    const columnKeys = vm.runtimeColumnKeys();
    return vm.selectedMutableCoreCells()
        .map<TableCellMetaPatch | null>((cell: TableCoreCellAddress) => {
            const col = columnKeys.indexOf(cell.colKey);
            if (columnTypeLockedByYaml(vm.tableColumns[col])) return null;
            const meta = vm.cellMetaByIdentity(cell.rowId, cell.colKey);
            return {
                cell,
                meta: {
                    dataType: transform({
                        ...meta?.dataType,
                        type: meta?.dataType?.type === 'exponent' ? 'exponent' : 'float'
                    })
                }
            };
        })
        .filter((patch: TableCellMetaPatch | null): patch is TableCellMetaPatch => patch != null);
}

const FormattingRuntimeMethods = {
    cellMetaByIdentity(rowId: string, colKey: string) {
        const metaMap = this.tableStore.meta.cellMetaByKey;
        if (!hasCellMetaEntries(metaMap)) return null;
        return peekCellMeta(metaMap, { rowId, colKey });
    },

    effectiveCellColumnByIdentity(
        rowId: string,
        colKey: string,
        fallbackCol: number,
        column: TableRuntimeColumn | null | undefined
    ) {
        void fallbackCol;
        return effectiveColumnForIdentity(this, rowId, colKey, column);
    },

    cellTdStyleByIdentity(rowId: string, colKey: string, fallbackRow: number, fallbackCol: number) {
        const meta = this.cellMetaByIdentity(rowId, colKey);
        const outlineStyle = this.cellSelectionOutlineStyle(fallbackRow, fallbackCol);
        if (!meta && !Object.keys(outlineStyle).length) return CELL_CURSOR_STYLE;
        return {
            ...tdStyleFromMeta(meta?.style),
            ...outlineStyle
        };
    },

    cellVisualTextStyleByIdentity(
        rowId: string,
        colKey: string,
        fallbackCol: number,
        column: TableRuntimeColumn | null | undefined
    ) {
        void fallbackCol;
        const meta = this.cellMetaByIdentity(rowId, colKey);
        const effectiveColumn = meta ? resolveEffectiveCellColumn(column, meta) : column;
        const baseStyle = this.cellDisplayTextStyle(effectiveColumn);
        const metaStyle = styleFromMeta(meta?.style);
        if (!Object.keys(baseStyle).length && !Object.keys(metaStyle).length) return EMPTY_STYLE;
        return {
            ...baseStyle,
            ...metaStyle
        };
    },

    cellUsesEmbeddedWidgetByIdentity: forwardEffectiveColumn<boolean>('cellUsesEmbeddedWidget'),

    cellUsesNativeInputByIdentity: forwardEffectiveColumn<boolean>('cellUsesNativeInput'),

    cellWidgetComponentByIdentity: forwardEffectiveColumn<Component | null>('cellWidgetComponent'),

    cellDisplayClassByIdentity: forwardEffectiveColumn<unknown>('cellDisplayClass'),

    cellDisplayTextClassByIdentity: forwardEffectiveColumn<unknown>('cellDisplayTextClass'),

    cellDisplayActionsByIdentity: forwardEffectiveColumn<TableCellDisplayAction[]>('cellDisplayActions'),

    cellDisplayActionsClassByIdentity: forwardEffectiveColumn<unknown>('cellDisplayActionsClass'),

    effectiveCellTypeByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn) {
        void fallbackCol;
        return effectiveColumnForIdentity(this, rowId, colKey, column)?.type || '';
    },

    selectedMutableCoreCells() {
        return selectedMutableCoreCells(this);
    },

    tableToolbarState(): TableToolbarState {
        return toolbarStateFromFocusedCell(this);
    },

    applyCellStylePatchToSelection(patch: TableCellStyleMeta) {
        this.runWithHistory('format cells', () => {
            const normalized: TableCellStyleMeta = { ...patch };
            if (Object.prototype.hasOwnProperty.call(normalized, 'fillColor')) {
                normalized.fillColor = normalizeColor(normalized.fillColor) || null;
            }
            if (Object.prototype.hasOwnProperty.call(normalized, 'textColor')) {
                normalized.textColor = normalizeColor(normalized.textColor) || null;
            }
            if (Object.prototype.hasOwnProperty.call(normalized, 'fontSize')) {
                normalized.fontSize = normalizeFontSize(normalized.fontSize);
            }
            this.tableStore.meta.cellMetaByKey = patchCellMeta(
                this.tableStore.meta.cellMetaByKey,
                this.selectedMutableCoreCells().map((cell: TableCoreCellAddress) => ({
                    cell,
                    meta: { style: normalized }
                }))
            );
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
        });
    },

    applyCellDataTypeToSelection(type: TableCellDataType) {
        this.runWithHistory('set cell type', () => {
            const metaPatches = [];
            const valuePatches = [];
            let errors = { ...this.cellValidationErrors };
            const columnKeys = this.runtimeColumnKeys();
            for (const cell of this.selectedMutableCoreCells()) {
                const col = columnKeys.indexOf(cell.colKey);
                const column = this.tableColumns[col];
                if (columnTypeLockedByYaml(column)) continue;
                const value = this.safeCell(this.dataRowByIdentity(cell.rowId), col);
                const result = coerceCellValueForDataType(value, type);
                metaPatches.push({ cell, meta: { dataType: { type, precision: 2, thousands: false } } });
                if (result.valid) valuePatches.push({ cell, value: result.value });
                errors = setTableValidationError(errors, cell, result.valid ? '' : result.message);
            }
            if (metaPatches.length) {
                this.tableStore.meta.cellMetaByKey = patchCellMeta(this.tableStore.meta.cellMetaByKey, metaPatches);
            }
            this.cellValidationErrors = errors;
            this.tableStore.validation.cellErrors = { ...errors };
            dispatchRuntimeCellPatches(this, valuePatches, 'set cell type', {
                skipEmit: false,
                skipHistory: true
            });
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
        });
    },

    canApplyNumericFormatToSelection() {
        const columnKeys = this.runtimeColumnKeys();
        return this.selectedMutableCoreCells().some((cell: TableCoreCellAddress) => {
            const col = columnKeys.indexOf(cell.colKey);
            const meta = this.cellMetaByIdentity(cell.rowId, cell.colKey);
            const type = meta?.dataType?.type || columnTypeToToolbarType(this.tableColumns[col]);
            return !columnTypeLockedByYaml(this.tableColumns[col]) && (type === 'float' || type === 'exponent');
        });
    },

    applyPrecisionDeltaToSelection(delta: number) {
        this.runWithHistory('precision', () => {
            const patches = numericMetaPatchesForSelection(this, (meta) => {
                const current = Number(meta.precision ?? 2);
                return {
                    ...meta,
                    precision: Math.max(0, Math.min(12, current + delta))
                };
            });
            this.tableStore.meta.cellMetaByKey = patchCellMeta(this.tableStore.meta.cellMetaByKey, patches);
        });
    },

    toggleThousandsForSelection() {
        this.runWithHistory('thousands', () => {
            const patches = numericMetaPatchesForSelection(this, (meta) => ({
                ...meta,
                thousands: meta.thousands !== true
            }));
            this.tableStore.meta.cellMetaByKey = patchCellMeta(this.tableStore.meta.cellMetaByKey, patches);
        });
    },

    onTableToolbarAction(action: string, value?: unknown) {
        switch (action) {
            case 'undo':
                this.undoTableAction();
                return;
            case 'redo':
                this.redoTableAction();
                return;
            case 'bold':
            case 'italic':
            case 'underline':
            case 'strike': {
                const patch = styleBooleanPatchForAction(action, this.tableToolbarState());
                if (patch) this.applyCellStylePatchToSelection(patch);
                return;
            }
            case 'fill':
                this.applyCellStylePatchToSelection({
                    fillColor: normalizeColor(value) || TABLE_TOOLBAR_DEFAULT_FILL_COLOR
                });
                return;
            case 'text-color':
                this.applyCellStylePatchToSelection({
                    textColor: normalizeColor(value) || TABLE_TOOLBAR_DEFAULT_TEXT_COLOR
                });
                return;
            case 'font-size':
                this.applyCellStylePatchToSelection({ fontSize: Number(value) || 12 });
                return;
            case 'font-increase':
            case 'font-decrease':
                this.applyCellStylePatchToSelection({
                    fontSize: normalizeFontSize(
                        this.tableToolbarState().fontSize + (action === 'font-increase' ? 1 : -1)
                    )
                });
                return;
            case 'align-left':
            case 'align-center':
            case 'align-right':
                this.applyCellStylePatchToSelection({
                    horizontalAlign: action.replace('align-', '') as TableCellStyleMeta['horizontalAlign']
                });
                return;
            case 'align-top':
            case 'align-middle':
            case 'align-bottom':
                this.applyCellStylePatchToSelection({
                    verticalAlign: action.replace('align-', '') as TableCellStyleMeta['verticalAlign']
                });
                return;
            case 'type':
                this.applyCellDataTypeToSelection(String(value || 'general') as TableCellDataType);
                return;
            case 'decimal-increase':
                this.applyPrecisionDeltaToSelection(1);
                return;
            case 'decimal-decrease':
                this.applyPrecisionDeltaToSelection(-1);
                return;
            case 'thousands':
                this.toggleThousandsForSelection();
                return;
            case 'auto-width':
                this.applyTableAutoWidthToSelection();
                return;
            case 'reset-width':
                this.resetTableWidthsForSelection();
                return;
            case 'toggle-line-numbers':
                this.toggleLineNumbersFromSnapshot(toolbarContextSnapshot(this));
                return;
            case 'toggle-sticky-header':
                this.stickyHeaderRuntimeEnabled = !this.stickyHeaderEnabled;
                this.$nextTick(() => this._scheduleStickyTheadUpdate());
                return;
            case 'toggle-word-wrap':
                this.wordWrapRuntimeEnabled = !this.wordWrapEnabled;
                if (this.wordWrapEnabled) {
                    this.$nextTick(() => this.clearAllCellOverflowHints());
                }
                return;
            default:
                return;
        }
    }
} satisfies TableRuntimeMethodSubset<TableRuntimeVm>;

export { FormattingRuntimeMethods };
