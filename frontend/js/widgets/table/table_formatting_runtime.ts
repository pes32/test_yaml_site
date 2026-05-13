import type { Component } from 'vue';
import type {
    TableCellDataType,
    TableCellDisplayAction,
    TableCellMeta,
    TableCellStyleMeta,
    TableCellTypeMeta,
    TableContextMenuSnapshot,
    TableCoreCellAddress,
    TableFormatRule,
    TableSelectionExpression,
    TableToolbarState,
    TableRuntimeColumn,
    TableRuntimeMethodSubset,
    TableRuntimeVm,
    TableSelectionRenderState
} from './table_contract.ts';
import { coerceCellValueForDataType } from './table_cell_type_coercion.ts';
import {
    hasCellMetaEntries,
    normalizeColor,
    normalizeFontSize,
    patchCellMeta,
    patchCellMetaForRowsAndColumns,
    peekCellMeta,
    rawCellMetaMap,
    type TableCellMetaPatch
} from './table_cell_meta.ts';
import {
    columnTypeLockedByYaml,
    columnTypeToTableCellDataType,
    resolveEffectiveCellColumn
} from './table_effective_column.ts';
import {
    createDefaultTableToolbarState,
    displayCellToCore,
    setTableValidationError,
    TABLE_TOOLBAR_DEFAULT_FILL_COLOR,
    TABLE_TOOLBAR_DEFAULT_FONT_SIZE,
    TABLE_TOOLBAR_DEFAULT_TEXT_COLOR
} from './table_internal.ts';
import { getCachedRemoteFormatRuleBuckets } from './table_format_rule_index.ts';
import { dispatchRuntimeCellPatches } from './table_runtime_commands.ts';

const EMPTY_STYLE = Object.freeze({}) as Record<string, string>;
const CELL_CURSOR_STYLE = Object.freeze({ cursor: 'pointer' }) as Record<string, string>;
const TOOLBAR_STYLE_ACTIONS = ['bold', 'italic', 'underline', 'strike'] as const;
const TOOLBAR_DEFAULT_STATE: TableToolbarState = Object.freeze(createDefaultTableToolbarState());
const TD_STYLE_CACHE = new WeakMap<TableCellStyleMeta, Record<string, string>>();
let remoteFormatRuleSeq = 0;

function hasStyle(style: Record<string, string>): boolean {
    return style !== EMPTY_STYLE && Object.keys(style).length > 0;
}

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

function selectedMutableCoreGrid(vm: TableRuntimeVm): { columnKeys: string[]; rowIds: string[] } {
    const rect = vm.getSelRect();
    const columnKeys = vm.runtimeColumnKeys();
    const selectedColumnKeys: string[] = [];
    for (let col = rect.c0; col <= rect.c1; col += 1) {
        if (!vm.canMutateColumnIndex(col)) continue;
        const colKey = columnKeys[col];
        if (colKey) selectedColumnKeys.push(colKey);
    }
    if (!selectedColumnKeys.length) return { columnKeys: [], rowIds: [] };
    const rowIds: string[] = [];
    for (let row = rect.r0; row <= rect.r1; row += 1) {
        const displayRow = vm.displayRows[row];
        if (displayRow && displayRow.kind === 'data') rowIds.push(displayRow.rowId);
    }
    return { columnKeys: selectedColumnKeys, rowIds };
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
        if (meta.strike) style.textDecorationThickness = '2px';
    }
    if (meta.textColor) style.color = meta.textColor;
    if (meta.fontSize) style.fontSize = `${meta.fontSize}px`;
    if (meta.horizontalAlign) style.textAlign = meta.horizontalAlign;
    return Object.keys(style).length ? (Object.freeze(style) as Record<string, string>) : EMPTY_STYLE;
}

function tdStyleFromMeta(meta: TableCellStyleMeta | null | undefined): Record<string, string> {
    if (!meta) return CELL_CURSOR_STYLE;
    const cached = TD_STYLE_CACHE.get(meta);
    if (cached) return cached;
    const style: Record<string, string> = { cursor: 'pointer' };
    if (meta.fillColor) style.backgroundColor = meta.fillColor;
    if (meta.verticalAlign) {
        style.verticalAlign = meta.verticalAlign === 'middle' ? 'middle' : meta.verticalAlign;
    }
    const result = Object.freeze(style) as Record<string, string>;
    TD_STYLE_CACHE.set(meta, result);
    return result;
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

function mergeStyleMeta(
    base: TableCellMeta | null | undefined,
    stylePatch: TableCellStyleMeta | null | undefined
): TableCellMeta | null {
    if (!stylePatch || !Object.keys(stylePatch).length) return base || null;
    return {
        ...(base || {}),
        style: {
            ...((base && base.style) || {}),
            ...stylePatch
        }
    };
}

function remoteRuleMetaForCell(
    vm: TableRuntimeVm,
    rowId: string,
    colKey: string,
    base: TableCellMeta | null
): TableCellMeta | null {
    if (vm.tableRemote?.mode !== 'remote-paged') return base;
    let merged = base;
    const applyRule = (rule: TableFormatRule) => {
        merged = mergeStyleMeta(merged, rule.stylePatch);
    };
    (vm.tableRemote.globalRules || []).forEach(applyRule);
    (vm.tableRemote.columnRulesByKey[colKey] || []).forEach(applyRule);
    const direct = vm.tableRemote.directCellOverrides[`${rowId}::${colKey}`];
    if (direct?.style) {
        merged = mergeStyleMeta(merged, direct.style);
    }
    const item = vm.tableRemote.rowItemsById[rowId];
    if (!item) return merged;
    const colIndex = vm.runtimeColumnKeys().indexOf(colKey);
    const buckets = getCachedRemoteFormatRuleBuckets(vm.tableRemote);
    const rowRules = buckets.bySourceIndex.get(item.sourceIndex);
    if (rowRules) {
        for (const rule of rowRules) {
            if (rule.target.kind === 'row-range') {
                applyRule(rule);
            } else if (rule.target.kind === 'cell-range') {
                const t = rule.target;
                if (colIndex >= t.c0 && colIndex <= t.c1) applyRule(rule);
            }
        }
    }
    for (const rule of buckets.wideRules) {
        if (rule.target.kind === 'row-range') {
            const t = rule.target;
            if (item.sourceIndex >= t.r0 && item.sourceIndex <= t.r1) applyRule(rule);
        } else if (rule.target.kind === 'cell-range') {
            const t = rule.target;
            if (
                item.sourceIndex >= t.r0 &&
                item.sourceIndex <= t.r1 &&
                colIndex >= t.c0 &&
                colIndex <= t.c1
            ) {
                applyRule(rule);
            }
        }
    }
    return merged;
}

function selectionExpressionToRuleTarget(
    expression: TableSelectionExpression | null | undefined,
    state: TableSelectionRenderState,
    columnKeys: string[],
    totalRows: number
): TableFormatRule['target'] {
    if (expression?.kind === 'full-column') {
        return { kind: 'column', columnKey: expression.columnKey };
    }
    if (expression?.kind === 'all-rows') {
        return {
            kind: 'cell-range',
            r0: 0,
            r1: Math.max(0, totalRows - 1),
            c0: 0,
            c1: Math.max(0, columnKeys.length - 1)
        };
    }
    if (expression?.kind === 'cell-range') {
        return {
            kind: 'cell-range',
            r0: expression.r0,
            r1: expression.r1,
            c0: expression.c0,
            c1: expression.c1
        };
    }
    if (state.isFullColumnBlock && state.rect.c0 === state.rect.c1) {
        const columnKey = columnKeys[state.rect.c0] || '';
        if (columnKey) return { kind: 'column', columnKey };
    }
    if (state.isFullRowBlock) {
        return { kind: 'row-range', r0: state.rect.r0, r1: state.rect.r1 };
    }
    return {
        kind: 'cell-range',
        r0: state.rect.r0,
        r1: state.rect.r1,
        c0: state.rect.c0,
        c1: state.rect.c1
    };
}

function addRemoteFormatRule(vm: TableRuntimeVm, patch: TableCellStyleMeta): void {
    const state = vm.selectionRenderState;
    const columnKeys = vm.runtimeColumnKeys();
    const normalizedPatch = { ...patch };
    const before = vm.captureRemoteHistorySnapshot();
    const rules = vm.tableRemote.formatRules.slice();
    const target = selectionExpressionToRuleTarget(
        vm.tableRemote.selectionExpression,
        state,
        columnKeys,
        vm.tableRemote.totalRows
    );
    const rule = {
        id: `remote_format_${++remoteFormatRuleSeq}`,
        scope: vm.tableRemote.selectionExpression &&
            vm.tableRemote.selectionExpression.kind !== 'cell-range'
            ? vm.tableRemote.selectionExpression.scope
            : 'currentView' as const,
        stylePatch: normalizedPatch,
        target
    } satisfies TableFormatRule;
    rules.push(rule);
    const columnRulesByKey = { ...vm.tableRemote.columnRulesByKey };
    const rowRangeRules = vm.tableRemote.rowRangeRules.slice();
    const cellRangeRules = vm.tableRemote.cellRangeRules.slice();
    const globalRules = vm.tableRemote.globalRules.slice();
    if (rule.target.kind === 'column') {
        columnRulesByKey[rule.target.columnKey] = (columnRulesByKey[rule.target.columnKey] || [])
            .concat(rule);
    } else if (
        rule.target.kind === 'cell-range' &&
        rule.target.r0 === 0 &&
        rule.target.r1 >= Math.max(0, vm.tableRemote.totalRows - 1) &&
        rule.target.c0 === 0 &&
        rule.target.c1 >= Math.max(0, columnKeys.length - 1)
    ) {
        globalRules.push(rule);
    } else if (rule.target.kind === 'row-range') {
        rowRangeRules.push(rule);
    } else {
        cellRangeRules.push(rule);
    }
    vm.tableRemote = {
        ...vm.tableRemote,
        cellRangeRules,
        columnRulesByKey,
        formatRules: rules,
        globalRules,
        rowRangeRules
    };
    vm.recordRemoteHistoryEntry('remote format', before, vm.captureRemoteHistorySnapshot(), {
        kind: 'format',
        patch: normalizedPatch,
        target: rule.target
    });
    void vm.submitTableCommands([
        {
            kind: 'format',
            patch: normalizedPatch,
            target: rule.target
        }
    ]);
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

function replaceCellMetaMapIfChanged(vm: TableRuntimeVm, nextMap: ReturnType<typeof patchCellMeta>): void {
    if (nextMap === rawCellMetaMap(vm.tableStore.meta.cellMetaByKey)) return;
    vm.tableStore.meta.cellMetaByKey = nextMap;
    vm.$nextTick(() => {
        vm._scheduleVirtualMeasurement?.();
        vm._scheduleVirtualWindowUpdate?.();
    });
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
        const base = hasCellMetaEntries(metaMap) ? peekCellMeta(metaMap, { rowId, colKey }) : null;
        return remoteRuleMetaForCell(this, rowId, colKey, base);
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
        void fallbackRow;
        void fallbackCol;
        const meta = this.cellMetaByIdentity(rowId, colKey);
        return meta ? tdStyleFromMeta(meta.style) : CELL_CURSOR_STYLE;
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
        if (!hasStyle(baseStyle)) return metaStyle;
        if (!hasStyle(metaStyle)) return baseStyle;
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
        if (this.tableRemote.mode === 'remote-paged') {
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
            addRemoteFormatRule(this, normalized);
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
            return;
        }
        this.runWithCellMetaHistory('format cells', () => {
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
            const grid = selectedMutableCoreGrid(this);
            replaceCellMetaMapIfChanged(
                this,
                patchCellMetaForRowsAndColumns(
                    this.tableStore.meta.cellMetaByKey,
                    grid.rowIds,
                    grid.columnKeys,
                    { style: normalized }
                )
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
                replaceCellMetaMapIfChanged(
                    this,
                    patchCellMeta(this.tableStore.meta.cellMetaByKey, metaPatches)
                );
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
        const rect = this.getSelRect();
        for (let col = rect.c0; col <= rect.c1; col += 1) {
            if (!this.canMutateColumnIndex(col)) continue;
            const column = this.tableColumns[col];
            if (columnTypeLockedByYaml(column)) continue;
            const baseType = columnTypeToToolbarType(column);
            if (baseType === 'float' || baseType === 'exponent') return true;
            const colKey = columnKeys[col];
            if (!colKey) continue;
            for (let row = rect.r0; row <= rect.r1; row += 1) {
                const displayRow = this.displayRows[row];
                if (!displayRow || displayRow.kind !== 'data') continue;
                const type = this.cellMetaByIdentity(displayRow.rowId, colKey)?.dataType?.type;
                if (type === 'float' || type === 'exponent') return true;
            }
        }
        return false;
    },

    applyPrecisionDeltaToSelection(delta: number) {
        this.runWithCellMetaHistory('precision', () => {
            const patches = numericMetaPatchesForSelection(this, (meta) => {
                const current = Number(meta.precision ?? 2);
                return {
                    ...meta,
                    precision: Math.max(0, Math.min(12, current + delta))
                };
            });
            replaceCellMetaMapIfChanged(
                this,
                patchCellMeta(this.tableStore.meta.cellMetaByKey, patches)
            );
        });
    },

    toggleThousandsForSelection() {
        this.runWithCellMetaHistory('thousands', () => {
            const patches = numericMetaPatchesForSelection(this, (meta) => ({
                ...meta,
                thousands: meta.thousands !== true
            }));
            replaceCellMetaMapIfChanged(
                this,
                patchCellMeta(this.tableStore.meta.cellMetaByKey, patches)
            );
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
