import {
    blankCellValueForColumn as selectBlankCellValueForColumn,
    defaultCellValueForColumn as selectDefaultCellValueForColumn,
    defaultCellValueFromColumn as selectDefaultCellValueFromColumn,
    resolveTableLazyEnabled as selectResolveTableLazyEnabled
} from './table_selectors.ts';
import { defineTableRuntimeModule } from './table_method_helpers.ts';
import { TABLE_LAZY_THRESHOLD } from './table_grouping.ts';
import {
    cloneTableData,
    generateTableRowId,
    getLineNumberColumnIndex,
    isLineNumberColumn,
    nextLineNumber,
    normalizeTableRows,
    stripTableDataForEmit,
    validateExternalTableRows
} from './table_utils.ts';

const DataRuntimeMethods = defineTableRuntimeModule({
    getAllAttrsMap() {
        if (typeof this.getAllAttrsMapFromRuntime === 'function') {
            const attrs = this.getAllAttrsMapFromRuntime();
            if (attrs && typeof attrs === 'object') {
                return attrs;
            }
        }
        return {};
    },

    isLineNumberColumn(column) {
        return isLineNumberColumn(column);
    },

    lineNumberColumnIndex() {
        return getLineNumberColumnIndex(this.tableColumns);
    },

    resolveTableLazyEnabled(rowCount) {
        return selectResolveTableLazyEnabled(this.widgetConfig, rowCount, TABLE_LAZY_THRESHOLD);
    },

    defaultCellValueFromColumn(column) {
        const tableCellOptions =
            column && column.tableCellOptions && typeof column.tableCellOptions === 'object'
                ? column.tableCellOptions
                : {};
        return selectDefaultCellValueFromColumn(column, {
            isLineNumberColumn: (item) => this.isLineNumberColumn(item),
            isListColumnMultiselect: this.listColumnIsMultiselect(column),
            now: new Date(),
            tableCellOptions
        });
    },

    defaultCellValueForColumn(colIndex) {
        return selectDefaultCellValueForColumn(this.tableColumns, colIndex, {
            isLineNumberColumn: (column) => this.isLineNumberColumn(column),
            isListColumnMultiselect: this.listColumnIsMultiselect(this.tableColumns[colIndex]),
            now: new Date(),
            tableCellOptions:
                this.tableColumns[colIndex] && this.tableColumns[colIndex].tableCellOptions
                    ? this.tableColumns[colIndex].tableCellOptions
                    : {}
        });
    },

    blankCellValueForColumn(colIndex) {
        return selectBlankCellValueForColumn(this.tableColumns, colIndex, {
            isListColumnMultiselect: this.listColumnIsMultiselect(this.tableColumns[colIndex])
        });
    },

    normalizeExternalRowsOrWarn(rows) {
        const check = validateExternalTableRows(rows, this.tableColumns);
        if (!check.ok) {
            this.showTableError(
                'setValue() и source таблицы принимают только внешний формат без колонки №.'
            );
            return null;
        }
        const normalized = normalizeTableRows(rows, this.tableColumns, {
            inputMode: 'external'
        });
        const lineNumberCol = this.lineNumberColumnIndex();
        if (lineNumberCol >= 0) {
            for (let index = 0; index < normalized.length; index += 1) {
                normalized[index].cells[lineNumberCol] = index + 1;
            }
        }
        return normalized;
    },

    initializeTable() {
        this.headerRows = [];
        this.tableSchema = null;
        this.tableColumns = [];
        this.tableData = [];
        this.cellValidationErrors = {};
        this.contextMenuOpen = false;
        this.contextMenuContext = null;
        this.contextMenuTarget = null;
        this.selectedRowIndex = -1;
        this.selAnchor = { r: 0, c: 0 };
        this.selFocus = { r: 0, c: 0 };
        this.selFullWidthRows = null;
        this._shiftAnchorLocked = false;
        this._tableFocusWithin = false;
        this.sortKeys = [];
        this._sortCycleRowOrder = null;
        this._tableContextMenuMouseDown = false;
        this.exitCellEdit();
        this._teardownLazyObserver();
        this.lazySessionId = (this.lazySessionId || 0) + 1;
        this.isLoadingChunk = false;
        this.tableUiLocked = false;
        this.lazyEnabled = false;
        this._lazyPendingRows = [];
        this.stickyHeaderRuntimeEnabled = !!(this.widgetConfig && this.widgetConfig.sticky_header === true);
        this.wordWrapRuntimeEnabled = false;
        this.groupingState = { levels: [], expanded: new Set() };
        this.groupingViewCache = null;

        this.parseTableAttrs(this.widgetConfig.table_attrs);

        let incoming = [];
        if (Array.isArray(this.widgetConfig.value)) {
            incoming = cloneTableData(this.widgetConfig.value);
        } else if (
            this.widgetConfig.source &&
            typeof this.widgetConfig.source === 'object' &&
            Array.isArray(this.widgetConfig.source)
        ) {
            incoming = cloneTableData(this.widgetConfig.source);
        } else if (this.widgetConfig.data) {
            incoming = cloneTableData(this.widgetConfig.data);
        }

        const cols = this.tableColumns.length;
        const lazyThreshold = TABLE_LAZY_THRESHOLD;
        let normalized = [];

        if (cols > 0) {
            normalized = this.normalizeExternalRowsOrWarn(incoming) || [];
            this.lazyEnabled = this.resolveTableLazyEnabled(normalized.length);
            if (this.lazyEnabled && normalized.length > lazyThreshold) {
                this._lazyPendingRows = normalized.slice(lazyThreshold);
                normalized = normalized.slice(0, lazyThreshold);
                this.isFullyLoaded = false;
            } else {
                this._lazyPendingRows = [];
                this.isFullyLoaded = true;
            }
            if (normalized.length === 0 && this.isEditable) {
                this.tableData = [this.makeEmptyRow()];
            } else {
                this.tableData = normalized;
            }
        } else {
            this.tableData = [];
            this._lazyPendingRows = [];
            this.isFullyLoaded = true;
        }

        this.ensureMinTableRows();
        this.onInput();
        this.$nextTick(() => {
            this._setupLazyObserver();
            this._unbindStickyThead();
            if (this.stickyHeaderEnabled) this._bindStickyThead();
        });
    },

    makeEmptyRow() {
        const cols = this.tableColumns.length;
        if (cols === 0) return { id: generateTableRowId(), cells: [] };
        const cells = [];
        for (let columnIndex = 0; columnIndex < cols; columnIndex += 1) {
            cells.push(this.defaultCellValueForColumn(columnIndex));
        }
        const lineNumberIndex = this.lineNumberColumnIndex();
        if (lineNumberIndex >= 0) {
            const nextLine = nextLineNumber(this.tableData, this.tableColumns) || this.tableData.length + 1;
            cells[lineNumberIndex] = nextLine;
        }
        return { id: generateTableRowId(), cells };
    },

    ensureMinTableRows() {
        const minRows = this.tableMinRowCount;
        if (minRows === 0) return;
        if (this.tableColumns.length === 0) return;
        while (this.tableData.length < minRows) {
            this.tableData.push(this.makeEmptyRow());
        }
    },

    showTableError(message, options = {}) {
        const normalizedMessage = String(message || 'Ошибка таблицы').trim() || 'Ошибка таблицы';
        const sourceError = options && options.cause ? options.cause : new Error(normalizedMessage);

        if (typeof this.handleRecoverableAppErrorFromRuntime === 'function') {
            this.handleRecoverableAppErrorFromRuntime(sourceError, {
                scope: 'table',
                message: normalizedMessage,
                details: options && options.details ? options.details : null
            });
            return;
        }

        if (typeof this.showAppNotificationFromRuntime === 'function') {
            this.showAppNotificationFromRuntime(normalizedMessage, 'danger');
            return;
        }

        const root = this.$root;
        if (root && typeof root.showNotification === 'function') {
            root.showNotification(normalizedMessage, 'danger');
        }
    },

    onInput() {
        this.$emit('input', {
            name: this.widgetName,
            value: stripTableDataForEmit(this.tableData, this.tableColumns),
            config: this.widgetConfig
        });
    },

    setValue(value) {
        const incoming = Array.isArray(value)
            ? cloneTableData(value)
            : [];
        const cols = this.tableColumns.length;
        const lazyThreshold = TABLE_LAZY_THRESHOLD;
        let normalized = null;
        if (cols > 0) {
            normalized = this.normalizeExternalRowsOrWarn(incoming);
            if (normalized == null) return;
        }
        this.sortKeys = [];
        this._sortCycleRowOrder = null;
        this.groupingState = { levels: [], expanded: new Set() };
        this.groupingViewCache = null;
        this.cellValidationErrors = {};
        this.lazySessionId = (this.lazySessionId || 0) + 1;
        this._lazyPendingRows = [];
        this.isFullyLoaded = true;
        this._teardownLazyObserver();
        if (cols > 0) {
            this.lazyEnabled = this.resolveTableLazyEnabled(normalized.length);
            if (this.lazyEnabled && normalized.length > lazyThreshold) {
                this._lazyPendingRows = normalized.slice(lazyThreshold);
                normalized = normalized.slice(0, lazyThreshold);
                this.isFullyLoaded = false;
            } else {
                this._lazyPendingRows = [];
                this.isFullyLoaded = true;
            }
            this.tableData = normalized;
        } else {
            this.lazyEnabled = false;
            this.tableData = [];
        }
        this.ensureMinTableRows();
        this.onInput();
    },

    getValue() {
        return stripTableDataForEmit(this.tableData, this.tableColumns);
    }
});

export { DataRuntimeMethods };
export default DataRuntimeMethods;
