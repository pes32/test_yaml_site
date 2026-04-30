import type {
    TableDisplayRow,
    TableRuntimeColumn,
    TableToolbarState,
    TableRuntimeComputedDefinitions,
    TableRuntimeVm
} from './table_contract.ts';

import { canAddGroupingLevel } from './table_grouping.ts';
import { columnLettersForRuntimeColumns } from './table_column_headers_model.ts';
import { buildMenuItems } from './table_menu_runtime.ts';
import { isApplePlatform } from './table_platform.ts';
import {
    groupingKeysFromRuntime,
    sortKeysFromRuntime,
    withUniqueColumnKeys
} from './table_state_core.ts';
import { createDefaultTableToolbarState } from './table_toolbar_model.ts';
import { buildTableViewModel, emptyTableViewModel } from './table_view_model.ts';

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
        return this.tableViewModel.displayRows as TableDisplayRow[];
    },
    tableLazyUiActive(this: TableRuntimeVm) {
        return this.lazyEnabled && !this.isFullyLoaded && !this.groupingActive;
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
