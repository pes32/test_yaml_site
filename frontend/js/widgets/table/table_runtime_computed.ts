import type {
    TableDisplayRow,
    TableRuntimeComputedDefinitions,
    TableRuntimeVm
} from './table_contract.ts';

import { canAddGroupingLevel } from './table_grouping.ts';
import { buildMenuItems, isApplePlatform } from './table_menu_runtime.ts';
import { WidgetMeasure } from './table_widget_helpers.ts';

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
    isFullyLoaded: runtimeAccessor(
        (vm) => !!vm.tableStore.loading.isFullyLoaded,
        (vm, value) => {
            vm.tableStore.loading.isFullyLoaded = !!value;
        }
    ),
    lazySessionId: runtimeAccessor(
        (vm) => vm.tableStore.loading.lazySessionId || 0,
        (vm, value) => {
            vm.tableStore.loading.lazySessionId = Number(value) || 0;
        }
    ),
    isLoadingChunk: runtimeAccessor(
        (vm) => !!vm.tableStore.loading.isLoadingChunk,
        (vm, value) => {
            vm.tableStore.loading.isLoadingChunk = !!value;
        }
    ),
    tableUiLocked: runtimeAccessor(
        (vm) => !!vm.tableStore.loading.tableUiLocked,
        (vm, value) => {
            vm.tableStore.loading.tableUiLocked = !!value;
        }
    ),
    lazyEnabled: runtimeAccessor(
        (vm) => !!vm.tableStore.loading.lazyEnabled,
        (vm, value) => {
            vm.tableStore.loading.lazyEnabled = !!value;
        }
    ),
    _lazyPendingRows: runtimeAccessor(
        (vm) => vm.tableStore.loading.lazyPendingRows,
        (vm, value) => {
            vm.tableStore.loading.lazyPendingRows = Array.isArray(value) ? value : [];
        }
    ),
    stickyHeaderRuntimeEnabled: runtimeAccessor(
        (vm) => !!vm.tableStore.sticky.headerRuntimeEnabled,
        (vm, value) => {
            vm.tableStore.sticky.headerRuntimeEnabled = !!value;
        }
    ),
    wordWrapRuntimeEnabled: runtimeAccessor(
        (vm) => !!vm.tableStore.view.wordWrapRuntimeEnabled,
        (vm, value) => {
            vm.tableStore.view.wordWrapRuntimeEnabled = !!value;
        }
    ),
    lineNumbersRuntimeEnabled: runtimeAccessor(
        (vm) => !!vm.tableStore.view.lineNumbersRuntimeEnabled,
        (vm, value) => {
            vm.tableStore.view.lineNumbersRuntimeEnabled = !!value;
        }
    ),
    isEditable(this: TableRuntimeVm) {
        return !(this.widgetConfig && this.widgetConfig.readonly === true);
    },
    tableZebra(this: TableRuntimeVm) {
        return (this.widgetConfig && this.widgetConfig.zebra) !== false;
    },
    hasColumnNumbers(this: TableRuntimeVm) {
        return Array.isArray(this.tableColumns) && this.tableColumns.some((column) => column && column.number != null);
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
        const sumWidths =
            WidgetMeasure && typeof WidgetMeasure.sumColumnWidthsPx === 'function'
                ? WidgetMeasure.sumColumnWidthsPx(this.tableColumns)
                : null;
        if (!this.hasExplicitTableWidth) {
            if (sumWidths) {
                style.width = sumWidths;
                style.minWidth = sumWidths;
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
        return this.tableViewModelSnapshot().displayRows as TableDisplayRow[];
    },
    tableLazyUiActive(this: TableRuntimeVm) {
        return this.lazyEnabled && !this.isFullyLoaded && !this.groupingActive;
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
