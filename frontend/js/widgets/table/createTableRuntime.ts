import type {
    TableDisplayRow,
    TableRuntimeComputedDefinitions,
    TableRuntimeMethodSubset,
    TableRuntimeWatchHandlers,
    TableRuntimeVm
} from './table_contract.ts';

import { canAddGroupingLevel } from './table_grouping.ts';
import { ClipboardRuntimeMethods } from './table_clipboard_runtime.ts';
import { CellRuntimeMethods } from './table_cell_runtime.ts';
import { DataRuntimeMethods } from './table_data_runtime.ts';
import { EditingRuntimeMethods } from './table_editing_runtime.ts';
import { InteractionRuntimeMethods } from './table_interactions.ts';
import { buildMenuItems, isApplePlatform, MenuRuntimeMethods } from './table_menu_runtime.ts';
import { RowRuntimeMethods } from './table_row_runtime.ts';
import { SelectionMethods } from './table_selection.ts';
import { ViewRuntimeMethods } from './table_view_runtime.ts';
import { WidgetMeasure } from './table_widget_helpers.ts';

const tableRuntimeComputed: TableRuntimeComputedDefinitions = {
    sortKeys: {
        get(this: TableRuntimeVm) {
            return this.tableStore.sorting.sortKeys;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.sorting.sortKeys = Array.isArray(value) ? value : [];
        }
    },
    groupingState: {
        get(this: TableRuntimeVm) {
            return this.tableStore.grouping.state;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.grouping.state = value && typeof value === 'object'
                ? (value as NonNullable<TableRuntimeVm['groupingState']>)
                : { levels: [], expanded: new Set() };
        }
    },
    groupingViewCache: {
        get(this: TableRuntimeVm) {
            return this.tableStore.grouping.viewCache;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.grouping.viewCache =
                value && typeof value === 'object'
                    ? (value as NonNullable<TableRuntimeVm['groupingViewCache']>)
                    : null;
        }
    },
    isFullyLoaded: {
        get(this: TableRuntimeVm) {
            return !!this.tableStore.loading.isFullyLoaded;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.loading.isFullyLoaded = !!value;
        }
    },
    lazySessionId: {
        get(this: TableRuntimeVm) {
            return this.tableStore.loading.lazySessionId || 0;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.loading.lazySessionId = Number(value) || 0;
        }
    },
    isLoadingChunk: {
        get(this: TableRuntimeVm) {
            return !!this.tableStore.loading.isLoadingChunk;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.loading.isLoadingChunk = !!value;
        }
    },
    tableUiLocked: {
        get(this: TableRuntimeVm) {
            return !!this.tableStore.loading.tableUiLocked;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.loading.tableUiLocked = !!value;
        }
    },
    lazyEnabled: {
        get(this: TableRuntimeVm) {
            return !!this.tableStore.loading.lazyEnabled;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.loading.lazyEnabled = !!value;
        }
    },
    _lazyPendingRows: {
        get(this: TableRuntimeVm) {
            return this.tableStore.loading.lazyPendingRows;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.loading.lazyPendingRows = Array.isArray(value) ? value : [];
        }
    },
    stickyHeaderRuntimeEnabled: {
        get(this: TableRuntimeVm) {
            return !!this.tableStore.preferences.stickyHeaderRuntimeEnabled;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.preferences.stickyHeaderRuntimeEnabled = !!value;
        }
    },
    wordWrapRuntimeEnabled: {
        get(this: TableRuntimeVm) {
            return !!this.tableStore.preferences.wordWrapRuntimeEnabled;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.preferences.wordWrapRuntimeEnabled = !!value;
        }
    },
    lineNumbersRuntimeEnabled: {
        get(this: TableRuntimeVm) {
            return !!this.tableStore.preferences.lineNumbersRuntimeEnabled;
        },
        set(this: TableRuntimeVm, value: unknown) {
            this.tableStore.preferences.lineNumbersRuntimeEnabled = !!value;
        }
    },
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

const tableRuntimeWatch: TableRuntimeWatchHandlers = {
    widgetName(this: TableRuntimeVm) {
        this.initializeTable?.();
    },
    widgetConfig(this: TableRuntimeVm) {
        this.initializeTable?.();
    },
    tableLazyUiActive(this: TableRuntimeVm, value: boolean) {
        this.$nextTick?.(() => {
            if (value) this._setupLazyObserver?.();
            else this._teardownLazyObserver?.();
        });
    },
    stickyHeaderEnabled(this: TableRuntimeVm, value: boolean) {
        this.$nextTick?.(() => {
            this._unbindStickyThead?.();
            if (value) this._bindStickyThead?.();
        });
    }
};

const tableRuntimeMethods = {
    ...SelectionMethods,
    ...ViewRuntimeMethods,
    ...DataRuntimeMethods,
    ...CellRuntimeMethods,
    ...RowRuntimeMethods,
    ...EditingRuntimeMethods,
    ...InteractionRuntimeMethods,
    ...MenuRuntimeMethods,
    ...ClipboardRuntimeMethods
} satisfies TableRuntimeMethodSubset;

function mountTableRuntime(vm: TableRuntimeVm) {
    vm.initializeTable?.();
}

function unmountTableRuntime(vm: TableRuntimeVm) {
    vm._unbindStickyThead?.();
    vm._detachContextMenuGlobalListeners?.();
    vm._teardownLazyObserver?.();
}

function createTableRuntime() {
    return {
        computed: tableRuntimeComputed,
        methods: tableRuntimeMethods,
        mount: mountTableRuntime,
        unmount: unmountTableRuntime,
        watch: tableRuntimeWatch
    };
}

export { createTableRuntime, mountTableRuntime, tableRuntimeComputed, tableRuntimeMethods, tableRuntimeWatch, unmountTableRuntime };
