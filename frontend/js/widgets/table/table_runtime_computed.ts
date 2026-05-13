import type {
    TableDataDisplayRow,
    TableDisplayRow,
    TableRuntimeColumn,
    TableToolbarState,
    TableVisibleCellGridRow,
    TableRuntimeComputedDefinitions,
    TableRuntimeVm
} from './table_contract.ts';

import { canAddGroupingLevel } from './table_grouping.ts';
import {
    buildTableViewModel,
    columnLettersForRuntimeColumns,
    createDefaultTableToolbarState,
    emptyTableViewModel,
    runtimeDisplaySelection,
    selectionRectFromDisplay
} from './table_internal.ts';
import { buildMenuItems } from './table_menu_runtime.ts';
import { isApplePlatform } from './table_platform.ts';
import {
    groupingKeysFromRuntime,
    sortKeysFromRuntime,
    withUniqueColumnKeys
} from './table_state_core.ts';

function runtimeAccessor<TValue>(
    getValue: (vm: TableRuntimeVm) => TValue,
    setValue: (vm: TableRuntimeVm, value: unknown) => void
) {
    return {
        get(this: TableRuntimeVm) {
            return getValue(this);
        },
        set(this: TableRuntimeVm, value: unknown) {
            setValue(this, value);
        }
    };
}

function booleanRuntimeAccessor(
    getValue: (vm: TableRuntimeVm) => unknown,
    setValue: (vm: TableRuntimeVm, value: boolean) => void
) {
    return runtimeAccessor((vm) => !!getValue(vm), (vm, value) => setValue(vm, !!value));
}

function valueClassFromConfig(config: unknown, value: unknown): string {
    const map = (config as { value_class_map?: Record<string, string> } | null)?.value_class_map;
    if (!map || typeof map !== 'object') return '';
    const key = String(value ?? '');
    const className = map[key];
    return typeof className === 'string' ? className : '';
}

/** Тяжёлая часть visible grid; `stubIsEditing` исключает подписку на editing/focus state. */
function buildVisibleCellGridRows(
    vm: TableRuntimeVm,
    options: { countStableBuilds: boolean; stubIsEditing: boolean }
): TableVisibleCellGridRow[] {
    if (options.countStableBuilds && typeof window !== 'undefined') {
        const counter = window as Window & { __tableVisibleCellGridBuildCount?: number };
        counter.__tableVisibleCellGridBuildCount =
            (counter.__tableVisibleCellGridBuildCount ?? 0) + 1;
    }

    const colKeys = vm.runtimeColumnKeyList || [];
    return vm.visibleDisplayRows.map((visibleRow): TableVisibleCellGridRow => {
        const displayRow = visibleRow.row;
        if (displayRow.kind === 'group') {
            return {
                displayIndex: visibleRow.displayIndex,
                groupRow: displayRow,
                kind: 'group',
                pathKey: visibleRow.pathKey
            };
        }
        const cells = vm.tableColumns
            .map((column, colIndex) => {
                const colKey = colKeys[colIndex] || vm.runtimeColumnKey(colIndex);
                const rowId = displayRow.rowId;
                const displayIndex = visibleRow.displayIndex;
                const formattedValue = vm.formatCellValueByIdentity(rowId, colKey, column, colIndex);
                const actions = vm
                    .cellDisplayActionsByIdentity(rowId, colKey, colIndex, column)
                    .map((action) => ({
                        ...action,
                        actionClass: vm.cellDisplayActionClass(action)
                    }));
                const usesEmbeddedWidget = vm.cellUsesEmbeddedWidgetByIdentity(
                    rowId,
                    colKey,
                    colIndex,
                    column
                );
                return {
                    actions,
                    actionsClass: vm.cellDisplayActionsClassByIdentity(rowId, colKey, colIndex, column),
                    allowsEditing: vm.cellAllowsEditing(displayIndex, colIndex),
                    colIndex,
                    colKey,
                    column,
                    displayClass: vm.cellDisplayClassByIdentity(rowId, colKey, colIndex, column),
                    displayIndex,
                    displayTextClass: vm.cellDisplayTextClassByIdentity(rowId, colKey, colIndex, column),
                    effectiveType: vm.effectiveCellTypeByIdentity(rowId, colKey, colIndex, column),
                    formattedValue,
                    isEditing: options.stubIsEditing ? false : vm.isCellEditing(displayIndex, colIndex),
                    rawValue: vm.cellValueByIdentity(rowId, colKey, colIndex),
                    rowId,
                    tabindex: -1,
                    tdClass: {
                        'widget-table__cell--line-number': vm.isLineNumberColumn(column)
                    },
                    tdStyle: vm.cellTdStyleByIdentity(rowId, colKey, displayIndex, colIndex),
                    textStyle: vm.cellVisualTextStyleByIdentity(rowId, colKey, colIndex, column),
                    usesEmbeddedWidget,
                    usesNativeInput: vm.cellUsesNativeInputByIdentity(rowId, colKey, colIndex, column),
                    valueClass: valueClassFromConfig(vm.widgetConfig, formattedValue),
                    widgetComponent: usesEmbeddedWidget
                        ? vm.cellWidgetComponentByIdentity(rowId, colKey, colIndex, column)
                        : null,
                    widgetConfig: usesEmbeddedWidget
                        ? vm.cellWidgetConfigByIdentity(rowId, colKey, displayIndex, colIndex, column)
                        : undefined,
                    widgetName: usesEmbeddedWidget
                        ? vm.cellWidgetNameByIdentity(rowId, colKey, displayIndex, colIndex, column)
                        : '',
                    widgetRefName: usesEmbeddedWidget
                        ? vm.cellWidgetRefNameByIdentity(rowId, colKey, displayIndex, colIndex, column)
                        : ''
                };
            });
        return {
            cells,
            dataRow: displayRow,
            displayIndex: visibleRow.displayIndex,
            kind: 'data',
            pathKey: visibleRow.pathKey
        };
    });
}

const tableRuntimeComputed: TableRuntimeComputedDefinitions = {
    sortKeys: runtimeAccessor(
        (vm) => vm.tableStore.sorting.sortKeys,
        (vm, value) => {
            vm.tableStore.sorting.sortKeys = Array.isArray(value) ? value : [];
        }
    ),
    groupingState: runtimeAccessor(
        (vm) => vm.tableStore.grouping.state,
        (vm, value) => {
            vm.tableStore.grouping.state = value && typeof value === 'object'
                ? (value as NonNullable<TableRuntimeVm['groupingState']>)
                : { levels: [], expanded: new Set() };
        }
    ),
    isFullyLoaded: booleanRuntimeAccessor(
        (vm) => vm.tableStore.loading.isFullyLoaded,
        (vm, value) => { vm.tableStore.loading.isFullyLoaded = value; }
    ),
    lazySessionId: runtimeAccessor(
        (vm) => vm.tableStore.loading.lazySessionId,
        (vm, value) => { vm.tableStore.loading.lazySessionId = Number(value) || 0; }
    ),
    isLoadingChunk: booleanRuntimeAccessor(
        (vm) => vm.tableStore.loading.isLoadingChunk,
        (vm, value) => { vm.tableStore.loading.isLoadingChunk = value; }
    ),
    tableUiLocked: booleanRuntimeAccessor(
        (vm) => vm.tableStore.loading.tableUiLocked,
        (vm, value) => { vm.tableStore.loading.tableUiLocked = value; }
    ),
    lazyEnabled: booleanRuntimeAccessor(
        (vm) => vm.tableStore.loading.lazyEnabled,
        (vm, value) => { vm.tableStore.loading.lazyEnabled = value; }
    ),
    _lazyPendingRows: runtimeAccessor(
        (vm) => vm.tableStore.loading.lazyPendingRows,
        (vm, value) => {
            vm.tableStore.loading.lazyPendingRows = Array.isArray(value) ? value : [];
        }
    ),
    stickyHeaderRuntimeEnabled: booleanRuntimeAccessor(
        (vm) => vm.tableStore.sticky.headerRuntimeEnabled,
        (vm, value) => { vm.tableStore.sticky.headerRuntimeEnabled = value; }
    ),
    wordWrapRuntimeEnabled: booleanRuntimeAccessor(
        (vm) => vm.tableStore.view.wordWrapRuntimeEnabled,
        (vm, value) => { vm.tableStore.view.wordWrapRuntimeEnabled = value; }
    ),
    lineNumbersRuntimeEnabled: booleanRuntimeAccessor(
        (vm) => vm.tableStore.view.lineNumbersRuntimeEnabled,
        (vm, value) => { vm.tableStore.view.lineNumbersRuntimeEnabled = value; }
    ),
    isEditable(this: TableRuntimeVm) {
        return !(this.widgetConfig && this.widgetConfig.readonly === true);
    },
    tableZebra(this: TableRuntimeVm) {
        return (this.widgetConfig && this.widgetConfig.zebra) !== false;
    },
    canUndo(this: TableRuntimeVm) {
        return (this.tableStore.history.past.length || 0) > 0;
    },
    canRedo(this: TableRuntimeVm) {
        return (this.tableStore.history.future.length || 0) > 0;
    },
    runtimeColumnKeyList(this: TableRuntimeVm) {
        return withUniqueColumnKeys(this.tableColumns).map((column) => column.columnKey);
    },
    selectionRenderState(this: TableRuntimeVm) {
        const rect = selectionRectFromDisplay(
            runtimeDisplaySelection(this),
            this.tbodyRowCount ? this.tbodyRowCount() : this.tableData.length,
            this.tableColumns.length
        );
        const focus = this.selFocus || { r: 0, c: 0 };
        const anchor = this.selAnchor || { r: 0, c: 0 };
        const columnCount = this.tableColumns.length;
        const readonly = !!(this.widgetConfig && this.widgetConfig.readonly_row_selection);
        const isMulti = (rect.r1 - rect.r0 + 1) * (rect.c1 - rect.c0 + 1) > 1;
        return {
            anchorCol: anchor.c,
            anchorRow: anchor.r,
            focus: { r: focus.r, c: focus.c },
            isFullColumnBlock: !!this.selFullHeightCols,
            isFullRowBlock: columnCount > 0 && !this.selFullHeightCols && rect.c0 === 0 && rect.c1 === columnCount - 1,
            isMulti,
            readonly,
            rect,
            showSelection: (this.isEditable && this._tableFocusWithin) || (readonly && !!this.selFullWidthRows)
        };
    },
    toolbarEnabled(this: TableRuntimeVm) {
        return !!(
            this.widgetConfig &&
            this.widgetConfig.toolbar === true &&
            Array.isArray(this.tableColumns) &&
            this.tableColumns.length > 0
        );
    },
    hasColumnNumbers(this: TableRuntimeVm) {
        return Array.isArray(this.tableColumns) && this.tableColumns.some((column) => column && column.number != null);
    },
    hasColumnLetters(this: TableRuntimeVm) {
        return !!(
            this.widgetConfig &&
            this.widgetConfig.abc === true &&
            Array.isArray(this.tableColumns) &&
            this.tableColumns.length > 0
        );
    },
    columnLetterLabels(this: TableRuntimeVm) {
        if (!this.hasColumnLetters) return [];
        return columnLettersForRuntimeColumns(
            this.tableColumns,
            (column) => !this.isLineNumberColumn(column)
        );
    },
    hasExplicitTableWidth(this: TableRuntimeVm) {
        const width = this.widgetConfig && this.widgetConfig.width;
        return width != null && String(width).trim() !== '';
    },
    tableInlineStyle(this: TableRuntimeVm) {
        const style: Record<string, string | number> = {
            marginBottom: 0,
            tableLayout: 'fixed'
        };
        const columnWidths = this.tableColumns.map((column, index) =>
            typeof this.runtimeColumnWidth === 'function'
                ? this.runtimeColumnWidth(index)
                : column.width
        );
        const sumWidths = columnWidths.reduce((sum, rawWidth) => {
            const width =
                typeof rawWidth === 'string' || typeof rawWidth === 'number'
                    ? rawWidth
                    : '';
            const parsed = width ? parseFloat(String(width)) : 0;
            return Number.isFinite(parsed) && parsed > 0 ? sum + parsed : sum;
        }, 0);
        if (!this.hasExplicitTableWidth) {
            if (sumWidths) {
                style.width = `${sumWidths}px`;
                style.minWidth = `${sumWidths}px`;
            }
            return style;
        }
        const width = this.widgetConfig.width;
        style.width = typeof width === 'number' ? `${width}px` : String(width);
        return style;
    },
    headerSortEnabled(this: TableRuntimeVm) {
        return !(this.widgetConfig && this.widgetConfig.sort === false);
    },
    tableMinRowCount(this: TableRuntimeVm) {
        const row = this.widgetConfig && this.widgetConfig.row;
        if (row == null || row === '') return 0;
        const parsed = typeof row === 'number' ? row : parseInt(String(row).trim(), 10);
        if (!Number.isFinite(parsed) || parsed < 1) return 0;
        return Math.floor(parsed);
    },
    tableDataMode(this: TableRuntimeVm) {
        return this.tableRemote?.mode === 'remote-paged' ? 'remote-paged' : 'local-full';
    },
    tableRowIdToDataIndex(this: TableRuntimeVm) {
        const map = new Map<string, number>();
        this.tableData.forEach((row, index) => {
            if (row && row.id != null) map.set(String(row.id), index);
        });
        return map;
    },
    tableViewModel(this: TableRuntimeVm) {
        if (!Array.isArray(this.tableData) || !Array.isArray(this.tableColumns)) {
            return emptyTableViewModel();
        }
        return buildTableViewModel(this.tableData, this.tableColumns, {
            expanded: this.groupingState.expanded,
            groupingLevelKeys: groupingKeysFromRuntime(this.tableColumns, this.groupingState),
            listColumnIsMultiselect: (column: Record<string, unknown>) =>
                this.listColumnIsMultiselect(column as TableRuntimeColumn),
            sortKeys: sortKeysFromRuntime(this.tableColumns, this.sortKeys)
        });
    },
    contextMenuItems(this: TableRuntimeVm) {
        if (!this.contextMenuOpen || !this.contextMenuTarget || !this.contextMenuContext) {
            return [];
        }
        const groupingLevelsLen = this.groupingState?.levels.length || 0;
        return buildMenuItems({
            target: this.contextMenuTarget,
            snapshot: this.contextMenuContext,
            isApple: isApplePlatform(),
            tableDataLength: this.tableData.length,
            numCols: this.tableColumns.length,
            headerSortEnabled: !!this.headerSortEnabled,
            isEditable: !!this.isEditable,
            isEditingCell: !!this.editingCell,
            groupingActive: !!this.groupingActive,
            tableUiLocked: !!this.tableUiLocked,
            isFullyLoaded: !!this.isFullyLoaded,
            groupingLevelsLen,
            groupingCanAddLevel: canAddGroupingLevel(this.tableColumns.length, groupingLevelsLen),
            lineNumbersEnabled: !!this.lineNumbersRuntimeEnabled,
            stickyHeaderEnabled: !!this.stickyHeaderEnabled,
            wordWrapEnabled: !!this.wordWrapEnabled,
            headerColumn:
                this.contextMenuTarget.kind === 'header'
                    ? this.tableColumns[this.contextMenuTarget.col || 0] || null
                    : null
        });
    },
    groupingActive(this: TableRuntimeVm) {
        return (this.groupingState?.levels.length || 0) > 0;
    },
    displayRows(this: TableRuntimeVm) {
        if (this.tableRemote?.mode === 'remote-paged') {
            return [];
        }
        return this.tableViewModel.displayRows as TableDisplayRow[];
    },
    visibleDisplayRows(this: TableRuntimeVm) {
        if (this.tableRemote?.mode === 'remote-paged') {
            const start = Math.max(0, Math.min(this.tableRemote.totalRows, this.virtualState.start || 0));
            const end = Math.max(start, Math.min(this.tableRemote.totalRows, this.virtualState.end || this.tableRemote.totalRows));
            const rows = [];
            for (let displayIndex = start; displayIndex < end; displayIndex += 1) {
                const item = this.tableRemote.itemsByDisplayIndex[displayIndex];
                if (item?.kind === 'group') {
                    const columnIndex = item.columnKey
                        ? (this.runtimeColumnKeyList || []).indexOf(item.columnKey)
                        : -1;
                    const column = columnIndex >= 0 ? this.tableColumns[columnIndex] : null;
                    const columnLabel =
                        column?.label != null && String(column.label).trim() !== ''
                            ? String(column.label).trim()
                            : item.columnKey || item.key;
                    rows.push({
                        displayIndex,
                        pathKey: item.groupId,
                        row: {
                            colIndex: 0,
                            columnLabel,
                            depth: item.level,
                            kind: 'group',
                            label: `${columnLabel}: ${item.key} (${item.count})`,
                            level: item.level,
                            pathKey: item.groupId,
                            value: item.key
                        } as TableDisplayRow
                    });
                    continue;
                }
                const rowId = item?.kind === 'row'
                    ? item.rowId
                    : `remote_missing_${displayIndex}`;
                const dataRow: TableDataDisplayRow = {
                    dataIndex: displayIndex,
                    depth: 0,
                    kind: 'data',
                    pathKey: rowId,
                    rowId
                };
                rows.push({
                    displayIndex,
                    pathKey: dataRow.pathKey,
                    row: dataRow
                });
            }
            return rows;
        }
        const rows = this.displayRows || [];
        const start = Math.max(0, Math.min(rows.length, this.virtualState.start || 0));
        const end = Math.max(start, Math.min(rows.length, this.virtualState.end || rows.length));
        return rows.slice(start, end).map((row, index) => ({
            displayIndex: start + index,
            pathKey: row.pathKey,
            row
        }));
    },
    visibleCellGridStableRows(this: TableRuntimeVm): TableVisibleCellGridRow[] {
        return buildVisibleCellGridRows(this, { countStableBuilds: true, stubIsEditing: true });
    },
    visibleCellGrid(this: TableRuntimeVm): TableVisibleCellGridRow[] {
        const stable = this.visibleCellGridStableRows;
        return stable.map((row): TableVisibleCellGridRow => {
            if (row.kind === 'group') {
                return row;
            }
            return {
                ...row,
                cells: row.cells.map((cell) => ({
                    ...cell,
                    isEditing: this.isCellEditing(cell.displayIndex, cell.colIndex)
                }))
            };
        });
    },
    tableLazyUiActive(this: TableRuntimeVm) {
        return false;
    },
    virtualTopSpacerStyle(this: TableRuntimeVm) {
        return {
            height: `${Math.max(0, this.virtualState.topSpacerPx || 0)}px`
        };
    },
    virtualBottomSpacerStyle(this: TableRuntimeVm) {
        return {
            height: `${Math.max(0, this.virtualState.bottomSpacerPx || 0)}px`
        };
    },
    toolbarState(this: TableRuntimeVm) {
        return typeof this.tableToolbarState === 'function'
            ? this.tableToolbarState()
            : createDefaultTableToolbarState();
    },
    stickyHeaderEnabled(this: TableRuntimeVm) {
        return !!this.stickyHeaderRuntimeEnabled;
    },
    wordWrapEnabled(this: TableRuntimeVm) {
        return !!this.wordWrapRuntimeEnabled;
    },
    sortColumnIndex(this: TableRuntimeVm) {
        const key = this.sortKeys?.[0];
        return key ? key.col : null;
    },
    sortDirection(this: TableRuntimeVm) {
        const key = this.sortKeys?.[0];
        return key && key.dir === 'desc' ? 'desc' : 'asc';
    }
};

export { tableRuntimeComputed };
