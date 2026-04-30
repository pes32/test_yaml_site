import {
    blankCellValueForColumn as selectBlankCellValueForColumn,
    defaultCellValueForColumn as selectDefaultCellValueForColumn,
    defaultCellValueFromColumn as selectDefaultCellValueFromColumn,
    resolveTableLazyEnabled as selectResolveTableLazyEnabled
} from './table_selectors.ts';
import { tableLog } from './table_debug.ts';
import type {
    TableCellAddress,
    TableCommand,
    TableContextMenuSnapshot,
    TableCoreSelectionState,
    TableCoreSortState,
    TableCoreState,
    TableDataRow,
    TableRuntimeColumn,
    TableRuntimeMethodSubset,
    TableSortState,
    TableViewModel
} from './table_contract.ts';
import {
    buildGroupedDataOrder,
    pruneExpanded,
    TABLE_LAZY_THRESHOLD
} from './table_grouping.ts';
import {
    appendRowsDedup,
    normalizeLazyChunkSize,
    splitLazyInitialRows,
    takeLazyChunk
} from './table_lazy_load_model.ts';
import {
    buildCoreSelectionFromDisplay,
    captureSelectionIdentity as captureCoreSelectionIdentity,
    coreCellToDisplay,
    runtimeDisplaySelection,
    restoreSelectionIdentity as restoreCoreSelectionIdentity,
    setSelectionCommandFromCore
} from './table_selection_model.ts';
import {
    TABLE_RUNTIME_SYNC,
    checkRuntimeTableInvariants,
    dispatchRuntimeTableCommand,
    dispatchRuntimeTableCoreCommand,
    normalizeRuntimeTableState,
    runtimeTableCoreStateSnapshot,
    runtimeTableViewModelSnapshot,
    syncRuntimeFromTableCoreState,
    type RuntimeStateSyncOptions
} from './table_runtime_state.ts';
import {
    columnKeyAt,
    sortKeysFromRuntime,
    withUniqueColumnKeys
} from './table_state_core.ts';
import { coreSortToRuntimeSort } from './table_sort_model.ts';
import {
    assignRowLineNumber,
    cloneTableData,
    clamp,
    generateTableRowId,
    getLineNumberColumnIndex,
    getRowCells,
    isLineNumberColumn,
    nextLineNumber,
    normalizeRowToDataRow,
    normalizeTableRows,
    stripTableDataForEmit,
    validateExternalTableRows
} from './table_utils.ts';

type TableRuntimeErrorOptions = {
    cause?: unknown;
    details?: unknown;
};

type TableSelectionIdentitySnapshot = {
    anchorCol: number;
    anchorRowId: string;
    focusCol: number;
    focusRowId: string;
    selection: TableCoreSelectionState | null;
    useFullWidthRows: boolean;
};
type RestoreSelectionIdentityOptions = {
    focus?: boolean;
};

type HeaderSortEvent = {
    shiftKey?: boolean;
};

const DataRuntimeMethods = {
    tableCoreStateSnapshot() {
        return runtimeTableCoreStateSnapshot(this);
    },
    tableViewModelSnapshot(coreState?: TableCoreState | null): TableViewModel {
        if (!coreState) return this.tableViewModel;
        return runtimeTableViewModelSnapshot(this, coreState);
    },
    syncRuntimeFromCoreState(coreState: TableCoreState, options: RuntimeStateSyncOptions = {}) {
        syncRuntimeFromTableCoreState(this, coreState, options);
    },
    normalizeTableRuntimeState(phase?: string, options: RuntimeStateSyncOptions = {}) {
        return normalizeRuntimeTableState(this, phase, options);
    },
    dispatchTableCoreCommand(
        command: TableCommand,
        phase?: string,
        options: RuntimeStateSyncOptions = {}
    ) {
        return dispatchRuntimeTableCoreCommand(this, command, phase, options);
    },
    dispatchTableCommand(
        command: string | TableCommand,
        payload: Record<string, unknown> = {},
        phase?: string,
        options: RuntimeStateSyncOptions = {}
    ) {
        return dispatchRuntimeTableCommand(this, command, payload, phase, options);
    },
    checkTableInvariants(phase?: string) {
        checkRuntimeTableInvariants(this, phase);
    },
    runtimeColumnKeys() {
        return Array.isArray(this.runtimeColumnKeyList)
            ? this.runtimeColumnKeyList.slice()
            : withUniqueColumnKeys(this.tableColumns).map((column) => column.columnKey);
    },
    runtimeColumnKey(colIndex: number) {
        const keys = Array.isArray(this.runtimeColumnKeyList) ? this.runtimeColumnKeyList : null;
        if (keys) return keys[this.normCol(colIndex)] || '';
        return columnKeyAt(this.tableColumns, this.normCol(colIndex)) || '';
    },
    runtimeSortKeySnapshots() {
        return sortKeysFromRuntime(this.tableColumns, this.sortKeys);
    },
    getAllAttrsMap() {
        if (typeof this.getAllAttrsMapFromRuntime !== 'function') return {};
        const attrs = this.getAllAttrsMapFromRuntime();
        return attrs && typeof attrs === 'object' ? attrs : {};
    },
    isLineNumberColumn(column: TableRuntimeColumn | null | undefined) {
        return isLineNumberColumn(column);
    },
    lineNumberColumnIndex() {
        return getLineNumberColumnIndex(this.tableColumns);
    },
    resolveTableLazyEnabled(rowCount: number) {
        return selectResolveTableLazyEnabled(this.widgetConfig, rowCount, TABLE_LAZY_THRESHOLD);
    },
    defaultCellValueFromColumn(column: TableRuntimeColumn | null | undefined) {
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
    defaultCellValueForColumn(colIndex: number) {
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
    blankCellValueForColumn(colIndex: number) {
        return selectBlankCellValueForColumn(this.tableColumns, colIndex, {
            isListColumnMultiselect: this.listColumnIsMultiselect(this.tableColumns[colIndex])
        });
    },
    normalizeExternalRowsOrWarn(rows: unknown): TableDataRow[] | null {
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
        this.selFullHeightCols = null;
        this.selFullWidthRows = null;
        this._shiftAnchorLocked = false;
        this._tableFocusWithin = false;
        this.sortKeys = [];
        this._tableContextMenuMouseDown = false;
        this.exitCellEdit();
        this._teardownLazyObserver();
        this.lazySessionId = (this.lazySessionId || 0) + 1;
        this.isLoadingChunk = false;
        this.tableUiLocked = false;
        this.lazyEnabled = false;
        this._lazyPendingRows = [];
        this.tableStore.meta.cellMetaByKey = {};
        this.tableStore.history.past = [];
        this.tableStore.history.future = [];
        this.tableStore.widths.initialByColumnKey = {};
        this.tableStore.widths.overrideByColumnKey = {};
        this.lineNumbersRuntimeEnabled = !!(this.widgetConfig && this.widgetConfig.line_numbers === true);
        this.stickyHeaderRuntimeEnabled = !!(this.widgetConfig && this.widgetConfig.sticky_header === true);
        this.wordWrapRuntimeEnabled = false;
        this.groupingState = { levels: [], expanded: new Set() };
        this.parseTableAttrs(this.widgetConfig.table_attrs);
        this.captureInitialTableWidths?.();
        const incomingSource = Array.isArray(this.widgetConfig.value)
            ? this.widgetConfig.value
            : Array.isArray(this.widgetConfig.source)
              ? this.widgetConfig.source
              : this.widgetConfig.data;
        const incoming = cloneTableData(incomingSource || []);
        const cols = this.tableColumns.length;
        let normalized: TableDataRow[] = [];
        if (cols > 0) {
            normalized = this.normalizeExternalRowsOrWarn(incoming) || [];
            normalized = this.prepareRowsForLazyDisplay(normalized, TABLE_LAZY_THRESHOLD);
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
        this.normalizeTableRuntimeState?.('initialize table');
        this.onInput();
        this.$nextTick(() => {
            this._setupLazyObserver();
            this._unbindStickyThead();
            if (this.stickyHeaderEnabled || this.toolbarEnabled) this._bindStickyThead();
        });
    },
    makeEmptyRow() {
        const cols = this.tableColumns.length;
        if (cols === 0) return { id: generateTableRowId(), cells: [] };
        const cells = Array.from({ length: cols }, (_item, columnIndex) =>
            this.defaultCellValueForColumn(columnIndex)
        );
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
    prepareRowsForLazyDisplay(rows: TableDataRow[], lazyThreshold: number) {
        this.lazyEnabled = this.resolveTableLazyEnabled(rows.length);
        const lazyRows = splitLazyInitialRows(rows, {
            enabled: this.lazyEnabled,
            threshold: lazyThreshold
        });
        this._lazyPendingRows = lazyRows.pendingRows;
        this.isFullyLoaded = lazyRows.isFullyLoaded;
        return lazyRows.visibleRows;
    },
    showTableError(message: unknown, options: TableRuntimeErrorOptions = {}) {
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
    setValue(value: unknown) {
        const incoming = Array.isArray(value)
            ? cloneTableData(value)
            : [];
        const cols = this.tableColumns.length;
        let normalized: TableDataRow[] = [];
        if (cols > 0) {
            const nextRows = this.normalizeExternalRowsOrWarn(incoming);
            if (nextRows == null) return;
            normalized = nextRows;
        }
        this.sortKeys = [];
        this.groupingState = { levels: [], expanded: new Set() };
        this.cellValidationErrors = {};
        this.lazySessionId = (this.lazySessionId || 0) + 1;
        this._lazyPendingRows = [];
        this.isFullyLoaded = true;
        this._teardownLazyObserver();
        if (cols > 0) {
            this.tableData = this.prepareRowsForLazyDisplay(normalized, TABLE_LAZY_THRESHOLD);
        } else {
            this.lazyEnabled = false;
            this.tableData = [];
        }
        this.ensureMinTableRows();
        this.normalizeTableRuntimeState?.('set value');
        this.onInput();
    },
    getValue() {
        return stripTableDataForEmit(this.tableData, this.tableColumns);
    },
    toggleLineNumbersFromSnapshot(snapshot: TableContextMenuSnapshot) {
        if (snapshot && snapshot.sessionId !== this.contextMenuSessionId) {
            this.hideContextMenu();
            return;
        }
        if (this.tableUiLocked) return;
        const oldLineNumberIndex = this.lineNumberColumnIndex();
        const nextEnabled = !snapshot.lineNumbersEnabled;
        const mapRuntimeColumn = (colIndex: number): number => {
            const col = this.normCol(colIndex);
            if (oldLineNumberIndex >= 0 && !nextEnabled) {
                return col > oldLineNumberIndex ? col - 1 : 0;
            }
            if (oldLineNumberIndex < 0 && nextEnabled) {
                return col + 1;
            }
            return col;
        };
        const externalRows = this.tableData.map((row: TableDataRow) => {
            const cells = getRowCells(row).slice();
            if (oldLineNumberIndex >= 0) {
                cells.splice(oldLineNumberIndex, 1);
            }
            return {
                id: row.id,
                cells
            };
        });
        const focusRow = this.selFocus.r;
        const anchorRow = this.selAnchor.r;
        const focusCol = mapRuntimeColumn(this.selFocus.c);
        const anchorCol = mapRuntimeColumn(this.selAnchor.c);
        const fullWidthRows = this.selFullWidthRows
            ? { ...this.selFullWidthRows }
            : null;
        const mappedSortKeys = snapshot.sortKeys
            .map((item: TableSortState): TableSortState | null => {
                if (oldLineNumberIndex >= 0 && !nextEnabled && item.col === oldLineNumberIndex) {
                    return null;
                }
                return {
                    col: mapRuntimeColumn(item.col),
                    dir: item.dir
                };
            })
            .filter(Boolean);
        const mappedGroupingLevels = snapshot.groupingLevelsSnapshot
            .map((col: number): number | null => {
                if (oldLineNumberIndex >= 0 && !nextEnabled && col === oldLineNumberIndex) {
                    return null;
                }
                return mapRuntimeColumn(col);
            })
            .filter((col: number | null, index: number, list: Array<number | null>): col is number =>
                col != null && list.indexOf(col) === index
            );
        this.hideContextMenu();
        this.lineNumbersRuntimeEnabled = nextEnabled;
        this.parseTableAttrs(this.widgetConfig.table_attrs);
        const normalized = normalizeTableRows(externalRows, this.tableColumns, {
            inputMode: 'external'
        });
        const nextLineNumberIndex = this.lineNumberColumnIndex();
        if (nextLineNumberIndex >= 0) {
            normalized.forEach((row, index) => {
                row.cells[nextLineNumberIndex] = index + 1;
            });
        }
        const nextSelection = {
            fullWidthRows,
            anchor: {
                r: this.normRow(anchorRow),
                c: this.normCol(anchorCol)
            },
            focus: {
                r: this.normRow(focusRow),
                c: this.normCol(focusCol)
            }
        };
        this.dispatchTableCoreCommand(
            { rows: normalized, type: 'REPLACE_ROWS' },
            'toggle line numbers rows',
            TABLE_RUNTIME_SYNC.ROWS_ONLY
        );
        this.dispatchTableCoreCommand(
            {
                sortKeys: sortKeysFromRuntime(this.tableColumns, mappedSortKeys as TableSortState[]),
                type: 'SORT_COLUMNS'
            },
            'toggle line numbers sort',
            TABLE_RUNTIME_SYNC.SORT_ONLY
        );
        this.dispatchTableCoreCommand(
            {
                colKeys: mappedGroupingLevels
                    .map((col: number) => columnKeyAt(this.tableColumns, col))
                    .filter((colKey: string | null): colKey is string => colKey != null),
                expandedPathKeys: [],
                type: 'SET_GROUP_LEVELS'
            },
            'toggle line numbers grouping',
            TABLE_RUNTIME_SYNC.GROUPING_ONLY
        );
        const coreSelection = buildCoreSelectionFromDisplay(
            nextSelection,
            this.tableColumns,
            this.tableViewModelSnapshot()
        );
        this.dispatchTableCoreCommand(
            setSelectionCommandFromCore(coreSelection),
            'toggle line numbers selection',
            TABLE_RUNTIME_SYNC.SELECTION_ONLY
        );
        this.refreshGroupingViewFromData();
        this.normalizeTableRuntimeState?.('toggle line numbers');
        this.onInput();
        this.$nextTick(() => {
            this.focusSelectionCell(this.selFocus.r, this.selFocus.c);
            this._scheduleStickyTheadUpdate();
        });
    },
    sortTableDataInPlace() {
        if (!this.sortKeys.length) {
            return;
        }
        this.normalizeTableRuntimeState?.('sort');
    },
    applyColumnSort(colIdx: number, direction: 'asc' | 'desc') {
        this.applySortKeysFromRuntime(
            [{ col: colIdx, dir: direction === 'desc' ? 'desc' : 'asc' }],
            'sort'
        );
    },
    applySortKeysFromRuntime(nextSortKeys: TableSortState[] | null | undefined, phase?: string) {
        this.applySortKeysFromCore(
            sortKeysFromRuntime(this.tableColumns, nextSortKeys || []),
            phase || 'sort'
        );
    },
    applySortKeysFromCore(nextSortKeys: TableCoreSortState[] | null | undefined, phase?: string) {
        const selectionIdentity = this.captureSelectionIdentity();
        this.sortKeys = coreSortToRuntimeSort(this.tableColumns, nextSortKeys || []);
        this.restoreSelectionIdentity(selectionIdentity, { focus: false });
        if (this.groupingActive) {
            this.refreshGroupingViewFromData();
        } else {
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
        }
        void phase;
    },
    normRow(rowIndex: number) {
        const length = this.displayRows.length || this.tableData.length;
        const max = Math.max(0, length - 1);
        return clamp(rowIndex, 0, max);
    },
    tbodyRowCount() {
        return this.displayRows.length || this.tableData.length;
    },
    resolveDataRowIndex(viewRow: number) {
        const displayRow = this.displayRows[viewRow];
        if (displayRow && displayRow.kind === 'data') return displayRow.dataIndex;
        if (!this.displayRows.length) return this.normRow(viewRow);
        return -1;
    },
    dataRowByDisplayIndex(viewRow: number) {
        const dataIndex = this.resolveDataRowIndex(viewRow);
        if (dataIndex < 0) return null;
        return this.tableData[dataIndex];
    },
    displayCellFromIdentity(
        rowId: string,
        colKey: string,
        fallback: TableCellAddress
    ): TableCellAddress {
        const cell = coreCellToDisplay(
            {
                colKey: String(colKey || ''),
                rowId: String(rowId || '')
            },
            this.tableColumns,
            this.tableViewModelSnapshot()
        );
        if (cell) return cell;
        return {
            r: this.normRow(fallback?.r ?? 0),
            c: this.normCol(fallback?.c ?? 0)
        };
    },
    groupExpanded(pathKey: string) {
        return this.groupingState.expanded.has(pathKey);
    },
    toggleGroupExpand(pathKey: string) {
        const next = new Set(this.groupingState.expanded);
        if (next.has(pathKey)) next.delete(pathKey);
        else next.add(pathKey);
        this.dispatchTableCoreCommand(
            { expandedPathKeys: [...next], type: 'SET_GROUP_EXPANDED' },
            'toggle group',
            TABLE_RUNTIME_SYNC.GROUPING_ONLY
        );
        this.refreshGroupingViewFromData();
    },
    refreshGroupingViewFromData() {
        this.normalizeTableRuntimeState?.('rebuild grouping');
        if (!this.groupingActive || !this.isFullyLoaded) {
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
            return;
        }
        let expanded = this.groupingState.expanded;
        const viewModel = this.tableViewModelSnapshot();
        const pruned = pruneExpanded(expanded, viewModel.validPathKeys);
        if (pruned.size !== expanded.size || [...expanded].some((key) => !pruned.has(key))) {
            expanded = pruned;
            this.dispatchTableCoreCommand(
                { expandedPathKeys: [...expanded], type: 'SET_GROUP_EXPANDED' },
                'prune grouping',
                TABLE_RUNTIME_SYNC.GROUPING_ONLY
            );
        }
        this.checkTableInvariants?.('rebuild display model');
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    },
    _lazyChunkSize() {
        return normalizeLazyChunkSize(
            this.widgetConfig && this.widgetConfig.lazy_chunk_size,
            TABLE_LAZY_THRESHOLD
        );
    },
    _teardownLazyObserver() {
        if (this._lazyDebounceTimer) {
            clearTimeout(this._lazyDebounceTimer);
            this._lazyDebounceTimer = null;
        }
        if (this._lazyObserver) {
            try {
                this._lazyObserver.disconnect();
            } catch (error) {}
            this._lazyObserver = null;
        }
    },
    _setupLazyObserver() {
        this._teardownLazyObserver();
        if (!this.tableLazyUiActive || typeof IntersectionObserver === 'undefined') return;
        const root = this.$refs.tableRoot;
        if (!root) return;
        const options = { root: null, rootMargin: '80px', threshold: 0 };
        this._lazyObserver = new IntersectionObserver((entries) => {
            const hit = entries.some((entry) => entry.isIntersecting);
            if (!hit || this.isFullyLoaded || this.isLoadingChunk || this.groupingActive) return;
            if (this._lazyDebounceTimer) clearTimeout(this._lazyDebounceTimer);
            this._lazyDebounceTimer = setTimeout(() => {
                this._lazyDebounceTimer = null;
                this._requestLazyChunk();
            }, 160);
        }, options);
        const row = this.$refs.lazySentinelRow;
        if (row) this._lazyObserver.observe(row);
    },
    _appendRowsDedup(rows: unknown[]) {
        const normalizedRows = (rows || [])
            .map((item) =>
                normalizeRowToDataRow(item, this.tableColumns, {
                    inputMode: 'runtime'
                })
            )
            .filter((row: TableDataRow | null): row is TableDataRow => row != null);
        const merged = appendRowsDedup(this.tableData, normalizedRows);
        merged.duplicateRowIds.forEach((id) => tableLog('duplicate row id on merge', id));
        this.dispatchTableCoreCommand(
            { rows: merged.rows, type: 'REPLACE_ROWS' },
            'append rows',
            TABLE_RUNTIME_SYNC.ROWS_GROUPING_SELECTION
        );
    },
    _requestLazyChunk() {
        if (this.tableUiLocked || !this.tableLazyUiActive || this.isLoadingChunk) return;
        const pending = this._lazyPendingRows;
        if (!pending || !pending.length) {
            this.isFullyLoaded = true;
            this._teardownLazyObserver();
            return;
        }
        this.isLoadingChunk = true;
        const sessionId = this.lazySessionId;
        const nextChunk = takeLazyChunk(pending, this._lazyChunkSize());
        const chunk = nextChunk.chunk;
        this._lazyPendingRows = nextChunk.remaining;
        try {
            this._appendRowsDedup(chunk);
            this.normalizeTableRuntimeState?.('lazy append');
        } finally {
            this.isLoadingChunk = false;
        }
        if (sessionId !== this.lazySessionId) return;
        if (!this._lazyPendingRows.length) {
            this.isFullyLoaded = true;
            this._teardownLazyObserver();
        }
        this.onInput();
        this.$nextTick(() => this._setupLazyObserver());
    },
    flushLazyFullLoadInternal() {
        if (this.isFullyLoaded) return true;
        if (this.widgetConfig && this.widgetConfig.lazy_fail_full_load === true) {
            return false;
        }
        const rest = this._lazyPendingRows.slice();
        this._lazyPendingRows = [];
        this._appendRowsDedup(rest);
        this.normalizeTableRuntimeState?.('lazy full load');
        this.isFullyLoaded = true;
        this._teardownLazyObserver();
        return true;
    },
    flushLazyFullLoadOrWarn(message: string) {
        if (this.isFullyLoaded) return true;
        const ok = this.flushLazyFullLoadInternal();
        if (!ok) this.showTableError(message);
        return ok;
    },
    onHeaderSortClick(colIdx: number | null | undefined, event?: HeaderSortEvent) {
        if (!this.headerSortEnabled || this.tableUiLocked) return;
        if (colIdx == null) return;
        if (colIdx < 0 || colIdx >= this.tableColumns.length) return;
        const normalizedEvent = event || {};
        const shift = !!normalizedEvent.shiftKey;
        if (shift) {
            const sortIndex = this.sortKeys.findIndex((item: TableSortState) => item.col === colIdx);
            let nextSortKeys: TableSortState[];
            if (sortIndex >= 0) {
                const current = this.sortKeys[sortIndex];
                const nextDirection = current.dir === 'asc' ? 'desc' : 'asc';
                nextSortKeys = this.sortKeys.map((item: TableSortState, index: number) =>
                    index === sortIndex ? { col: current.col, dir: nextDirection } : item
                );
            } else {
                nextSortKeys = this.sortKeys.concat([{ col: colIdx, dir: 'asc' }]);
            }
            this.applySortKeysFromRuntime(nextSortKeys, 'sort');
            tableLog('sort multi', colIdx, this.sortKeys);
            return;
        }
        const currentSort =
            this.sortKeys.length === 1 && this.sortKeys[0].col === colIdx
                ? this.sortKeys[0]
                : null;
        if (currentSort) {
            if (currentSort.dir === 'asc') {
                this.applySortKeysFromRuntime([{ col: colIdx, dir: 'desc' }], 'sort');
                tableLog(
                    'sort',
                    colIdx,
                    'desc',
                    this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
                );
                return;
            }
            this.applySortKeysFromRuntime([], 'sort reset');
            tableLog(
                'sort reset',
                colIdx,
                this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
            );
            return;
        }
        this.applySortKeysFromRuntime([{ col: colIdx, dir: 'asc' }], 'sort');
        tableLog(
            'sort',
            colIdx,
            'asc',
            this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
        );
    },
    selectedDataRowIdFromViewRow(viewRow: number) {
        const displayRow = this.displayRows[viewRow];
        return displayRow && displayRow.kind === 'data' ? displayRow.rowId : '';
    },
    captureSelectionIdentity() {
        const selection = this.buildSelectionSnapshotFromDisplay
            ? this.buildSelectionSnapshotFromDisplay()
            : captureCoreSelectionIdentity(
                  runtimeDisplaySelection(this),
                  this.tableColumns,
                  this.tableViewModelSnapshot()
              );
        return {
            selection,
            anchorCol: this.selAnchor.c,
            anchorRowId: selection.anchor?.rowId || '',
            focusCol: this.selFocus.c,
            focusRowId: selection.focus?.rowId || '',
            useFullWidthRows: !!this.selFullWidthRows
        };
    },
    restoreSelectionIdentity(
        snapshot: TableSelectionIdentitySnapshot | null | undefined,
        options: RestoreSelectionIdentityOptions = {}
    ) {
        if (!snapshot) return;
        const shouldFocus = options.focus !== false;
        if (snapshot.selection) {
            const selection = restoreCoreSelectionIdentity(
                snapshot.selection,
                this.tableColumns,
                this.tableViewModelSnapshot(),
                runtimeDisplaySelection(this)
            );
            this.selAnchor = selection.anchor;
            this.selFocus = selection.focus;
            this.selFullWidthRows = selection.fullWidthRows;
            if (shouldFocus) {
                this.$nextTick(() => this.focusSelectionCell(this.selFocus.r, this.selFocus.c));
            }
            return;
        }
        if (!snapshot.focusRowId) return;
        this.restoreSelectionByRowIds(
            snapshot.focusRowId,
            snapshot.anchorRowId || snapshot.focusRowId,
            snapshot.focusCol,
            snapshot.anchorCol,
            snapshot.useFullWidthRows,
            options
        );
    },
    restoreSelectionByRowIds(
        focusRowId: string,
        anchorRowId: string,
        focusCol: number,
        anchorCol: number,
        useFullWidthRows: boolean,
        options: RestoreSelectionIdentityOptions = {}
    ) {
        const rowIndexById = this.tableViewModelSnapshot().rowIdToDisplayIndex;
        const displayRow = (rowId: string, fallback: number) =>
            rowIndexById.get(rowId) ?? fallback;
        const nextFocusRow = displayRow(focusRowId, 0);
        const nextAnchorRow = displayRow(anchorRowId, nextFocusRow);
        const focusColumn = this.normCol(focusCol != null ? focusCol : 0);
        const anchorColumn = this.normCol(anchorCol != null ? anchorCol : focusColumn);
        this.selFullWidthRows = null;
        this.selAnchor = { r: nextAnchorRow, c: anchorColumn };
        this.selFocus = { r: nextFocusRow, c: focusColumn };
        if (useFullWidthRows && this.tableColumns.length > 0) {
            this.setSelFullWidthRowSpan(nextAnchorRow, nextFocusRow);
        }
        this.normalizeTableRuntimeState?.('restore selection', {
            ...TABLE_RUNTIME_SYNC.SELECTION_ONLY
        });
        if (options.focus !== false) {
            this.$nextTick(() => this.focusSelectionCell(this.selFocus.r, this.selFocus.c));
        }
    },
    recalculateLineNumbersFromSnapshot(snapshot: TableContextMenuSnapshot) {
        if (snapshot.sessionId !== this.contextMenuSessionId) {
            this.hideContextMenu();
            return;
        }
        this.hideContextMenu();
        this.recalculateLineNumbers();
    },
    recalculateLineNumbers() {
        const lineNumberIndex = this.lineNumberColumnIndex();
        if (lineNumberIndex < 0 || this.tableUiLocked) return;
        const focusRowId = this.selectedDataRowIdFromViewRow(this.selFocus.r);
        const anchorRowId = this.selectedDataRowIdFromViewRow(this.selAnchor.r);
        const focusCol = this.selFocus.c;
        const anchorCol = this.selAnchor.c;
        const useFullWidthRows = !!this.selFullWidthRows;
        this.tableUiLocked = true;
        try {
            if (!this.flushLazyFullLoadOrWarn(
                'Не удалось полностью загрузить данные для пересчёта нумерации.'
            )) return;
            const order =
                this.groupingActive
                    ? buildGroupedDataOrder(
                          this.tableData,
                          this.groupingState.levels,
                          this.tableColumns
                      )
                    : this.tableData.map((_row: TableDataRow, index: number) => index);
            const nextNumbers = new Map();
            order.forEach((dataIndex: number, index: number) => {
                const row = this.tableData[dataIndex];
                if (!row || row.id == null) return;
                nextNumbers.set(String(row.id), index + 1);
            });
            const updated = this.tableData.map((row: TableDataRow) =>
                assignRowLineNumber(row, this.tableColumns, nextNumbers.get(String(row.id))) as TableDataRow
            );
            this.dispatchTableCoreCommand(
                { rows: updated, type: 'REPLACE_ROWS' },
                'recalculate line numbers rows',
                TABLE_RUNTIME_SYNC.ROWS_ONLY
            );
            this.dispatchTableCoreCommand(
                { sortKeys: [], type: 'SORT_COLUMNS' },
                'recalculate line numbers sort reset',
                TABLE_RUNTIME_SYNC.SORT_ONLY
            );
            this.dispatchTableCoreCommand(
                { colKeys: [], expandedPathKeys: [], type: 'SET_GROUP_LEVELS' },
                'recalculate line numbers grouping reset',
                TABLE_RUNTIME_SYNC.GROUPING_ONLY
            );
            this.onInput();
            this.restoreSelectionByRowIds(
                focusRowId,
                anchorRowId,
                focusCol,
                anchorCol,
                useFullWidthRows
            );
            this.normalizeTableRuntimeState?.('recalculate line numbers');
        } catch (error) {
            this.showTableError('Не удалось пересчитать нумерацию.', {
                cause: error,
                details: {
                    action: 'recalculate_line_numbers'
                }
            });
        } finally {
            this.tableUiLocked = false;
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
        }
    }
} satisfies TableRuntimeMethodSubset;
export { DataRuntimeMethods };
export default DataRuntimeMethods;
