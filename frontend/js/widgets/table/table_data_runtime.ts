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
    TableCoreState,
    TableDataRow,
    TableRuntimeColumn,
    TableRuntimeMethodSubset,
    TableSelectionState,
    TableSortState
} from './table_contract.ts';
import {
    buildGroupedDataOrder,
    pruneExpanded,
    TABLE_LAZY_THRESHOLD
} from './table_grouping.ts';
import { warnTableInvariants } from './table_invariants.ts';
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
    displayCellToCore,
    restoreDisplaySelectionFromCore,
    restoreSelectionIdentity as restoreCoreSelectionIdentity
} from './table_selection_model.ts';
import { coreSortToRuntimeSort } from './table_sort_model.ts';
import { SelectionMethods } from './table_selection.ts';
import {
    columnIndexByKey,
    columnKeyAt,
    createTableCoreStateFromRuntime,
    dispatchTableCommand,
    normalizeTableCoreState,
    sortKeysFromRuntime,
    withUniqueColumnKeys
} from './table_state_core.ts';
import { buildTableViewModel } from './table_view_model.ts';
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
const DataRuntimeMethods = {
    tableCoreStateSnapshot() {
        const core = createTableCoreStateFromRuntime({
            activeCell: this.selFocus,
            columns: this.tableColumns,
            contextMenuContext: this.contextMenuContext,
            contextMenuOpen: this.contextMenuOpen,
            contextMenuSessionId: this.contextMenuSessionId,
            editingCell: this.editingCell,
            groupingState: this.groupingState,
            rows: this.tableData,
            selection: {
                anchor: this.selAnchor,
                focus: this.selFocus,
                fullWidthRows: this.selFullWidthRows
            },
            sortKeys: this.sortKeys
        });
        const viewModel = this.tableViewModelSnapshot(core);
        const selection = {
            anchor: this.selAnchor,
            focus: this.selFocus,
            fullWidthRows: this.selFullWidthRows
        };
        core.selection = {
            ...buildCoreSelectionFromDisplay(selection, this.tableColumns, viewModel)
        };
        core.activeCell = displayCellToCore(this.selFocus, this.tableColumns, viewModel);
        if (this.editingCell) {
            const editingCell = displayCellToCore(this.editingCell, this.tableColumns, viewModel);
            core.editing = editingCell
                ? {
                      activeCell: editingCell,
                      draftValue:
                          this.tableData[this.resolveDataRowIndex(this.editingCell.r)]?.cells[
                              this.editingCell.c
                          ],
                      validationErrors: { ...this.cellValidationErrors }
                  }
                : null;
        }
        return normalizeTableCoreState(core);
    },
    tableViewModelSnapshot(coreState) {
        const core = coreState || this.tableCoreStateSnapshot();
        return buildTableViewModel(core.rows, core.columns, {
            expanded: core.grouping.expanded,
            groupingLevelKeys: core.grouping.levelKeys,
            listColumnIsMultiselect: (column: Record<string, unknown>) =>
                this.listColumnIsMultiselect(column as TableRuntimeColumn),
            sortKeys: core.sortKeys
        });
    },
    syncRuntimeFromCoreState(coreState, options = {}) {
        const core = normalizeTableCoreState(coreState as TableCoreState);
        const normalizedOptions = options || {};
        if (normalizedOptions.skipRows !== true) {
            this.tableData.splice(0, this.tableData.length, ...core.rows);
        }
        if (normalizedOptions.skipSort !== true) {
            this.sortKeys = coreSortToRuntimeSort(this.tableColumns, core.sortKeys);
        }
        if (normalizedOptions.skipGrouping !== true) {
            this.groupingState = {
                expanded: new Set(core.grouping.expanded || []),
                levels: core.grouping.levelKeys
                    .map((colKey: string) => columnIndexByKey(this.tableColumns, colKey))
                    .filter((index: number, pos: number, list: number[]) =>
                        index >= 0 && list.indexOf(index) === pos
                    )
            };
        }
        if (normalizedOptions.skipSelection !== true) {
            const viewModel = this.tableViewModelSnapshot(core);
            const fallback: TableSelectionState = {
                anchor: this.selAnchor,
                focus: this.selFocus,
                fullWidthRows: this.selFullWidthRows
            };
            const selection = restoreDisplaySelectionFromCore(
                core.selection,
                this.tableColumns,
                viewModel,
                fallback
            );
            this.selAnchor = selection.anchor;
            this.selFocus = selection.focus;
            this.selFullWidthRows = selection.fullWidthRows;
        }
        if (normalizedOptions.skipEditing !== true) {
            const viewModel = this.tableViewModelSnapshot(core);
            this.editingCell = coreCellToDisplay(
                core.editing?.activeCell || null,
                this.tableColumns,
                viewModel
            );
            if (core.editing) this.cellValidationErrors = { ...core.editing.validationErrors };
        }
        if (normalizedOptions.skipContextMenu !== true) {
            this.contextMenuOpen = core.contextMenu.open;
            this.contextMenuContext = core.contextMenu.context;
            this.contextMenuSessionId = core.contextMenu.sessionId;
            if (!core.contextMenu.open) this.contextMenuTarget = null;
        }
    },
    dispatchTableCoreCommand(command, phase, options = {}) {
        const next = dispatchTableCommand(
            this.tableCoreStateSnapshot(),
            command as TableCommand
        );
        this.syncRuntimeFromCoreState(next, options);
        this.checkTableInvariants?.(phase || command.type);
        return next;
    },
    checkTableInvariants(phase) {
        const core = this.tableCoreStateSnapshot();
        const viewModel = this.tableViewModelSnapshot(core);
        warnTableInvariants(core, viewModel, { phase: String(phase || 'table mutation') });
    },
    runtimeColumnKeys() {
        return withUniqueColumnKeys(this.tableColumns).map((column) => column.columnKey);
    },
    runtimeSortKeySnapshots() {
        return sortKeysFromRuntime(this.tableColumns, this.sortKeys);
    },
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
        this.lineNumbersRuntimeEnabled = !!(this.widgetConfig && this.widgetConfig.line_numbers === true);
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
            const lazyRows = splitLazyInitialRows(normalized, {
                enabled: this.lazyEnabled,
                threshold: lazyThreshold
            });
            this._lazyPendingRows = lazyRows.pendingRows;
            normalized = lazyRows.visibleRows;
            this.isFullyLoaded = lazyRows.isFullyLoaded;
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
        this.checkTableInvariants?.('initialize table');
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
        let normalized: TableDataRow[] = [];
        if (cols > 0) {
            const nextRows = this.normalizeExternalRowsOrWarn(incoming);
            if (nextRows == null) return;
            normalized = nextRows;
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
            const lazyRows = splitLazyInitialRows(normalized, {
                enabled: this.lazyEnabled,
                threshold: lazyThreshold
            });
            this._lazyPendingRows = lazyRows.pendingRows;
            normalized = lazyRows.visibleRows;
            this.isFullyLoaded = lazyRows.isFullyLoaded;
            this.tableData = normalized;
        } else {
            this.lazyEnabled = false;
            this.tableData = [];
        }
        this.ensureMinTableRows();
        this.checkTableInvariants?.('set value');
        this.onInput();
    },
    getValue() {
        return stripTableDataForEmit(this.tableData, this.tableColumns);
    },
    toggleLineNumbersFromSnapshot(snapshot) {
        if (snapshot && snapshot.sessionId !== this.contextMenuSessionId) {
            this.hideContextMenu();
            return;
        }
        if (this.tableUiLocked) return;
        const oldLineNumberIndex = this.lineNumberColumnIndex();
        const nextEnabled = !this.lineNumbersRuntimeEnabled;
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
        const mappedSortKeys = this.sortKeys
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
        const mappedGroupingLevels = this.groupingState.levels
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
        this.tableData.splice(0, this.tableData.length, ...normalized);
        this.selFullWidthRows = fullWidthRows;
        this.selAnchor = {
            r: this.normRow(anchorRow),
            c: this.normCol(anchorCol)
        };
        this.selFocus = {
            r: this.normRow(focusRow),
            c: this.normCol(focusCol)
        };
        this.sortKeys = mappedSortKeys as typeof this.sortKeys;
        this.groupingState = {
            levels: mappedGroupingLevels as number[],
            expanded: new Set()
        };
        this.refreshGroupingViewFromData();
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
        this.checkTableInvariants?.('sort');
    },
    applyColumnSort(colIdx, direction) {
        this.applySortKeysFromRuntime(
            [{ col: colIdx, dir: direction === 'desc' ? 'desc' : 'asc' }],
            'sort'
        );
    },
    restoreSortCycleRowOrder() {
        const snapshot = this._sortCycleRowOrder;
        this._sortCycleRowOrder = null;
        if (!snapshot || snapshot.length !== this.tableData.length) return;
        const currentRows = new Set(this.tableData);
        for (let index = 0; index < snapshot.length; index += 1) {
            if (!currentRows.has(snapshot[index])) return;
        }
        this.tableData.splice(0, this.tableData.length, ...snapshot.slice());
    },
    applySortKeysFromRuntime(nextSortKeys, phase) {
        const selectionIdentity = this.captureSelectionIdentity();
        this.dispatchTableCoreCommand(
            {
                sortKeys: sortKeysFromRuntime(this.tableColumns, nextSortKeys || []),
                type: 'SORT_COLUMNS'
            },
            phase || 'sort',
            { skipRows: true, skipEditing: true, skipContextMenu: true }
        );
        this.restoreSelectionIdentity(selectionIdentity);
        this.refreshGroupingViewFromData();
        this.onInput();
    },
    normRow(rowIndex) {
        const length = this.displayRows.length || this.tableData.length;
        const max = Math.max(0, length - 1);
        return clamp(rowIndex, 0, max);
    },
    tbodyRowCount() {
        return this.displayRows.length || this.tableData.length;
    },
    resolveDataRowIndex(viewRow) {
        const displayRow = this.displayRows[viewRow];
        if (displayRow && displayRow.kind === 'data') return displayRow.dataIndex;
        if (!this.displayRows.length) return this.normRow(viewRow);
        return -1;
    },
    dataRowByDisplayIndex(viewRow) {
        const dataIndex = this.resolveDataRowIndex(viewRow);
        if (dataIndex < 0) return null;
        return this.tableData[dataIndex];
    },
    groupExpanded(pathKey) {
        return this.groupingState.expanded.has(pathKey);
    },
    toggleGroupExpand(pathKey) {
        const next = new Set(this.groupingState.expanded);
        if (next.has(pathKey)) next.delete(pathKey);
        else next.add(pathKey);
        this.groupingState = Object.assign({}, this.groupingState, { expanded: next });
        this.refreshGroupingViewFromData();
    },
    refreshGroupingViewFromData() {
        if (!this.groupingActive || !this.isFullyLoaded) {
            this.groupingViewCache = null;
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
            return;
        }
        let expanded = this.groupingState.expanded;
        let viewModel = this.tableViewModelSnapshot();
        const pruned = pruneExpanded(expanded, viewModel.validPathKeys);
        if (pruned.size !== expanded.size || [...expanded].some((key) => !pruned.has(key))) {
            expanded = pruned;
            this.groupingState = Object.assign({}, this.groupingState, { expanded });
            viewModel = this.tableViewModelSnapshot();
        }
        this.groupingViewCache = {
            displayRows: viewModel.displayRows,
            validPathKeys: viewModel.validPathKeys
        };
        this.checkTableInvariants?.('rebuild display model');
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    },
    applyTableMutation(mutator, options) {
        const normalizedOptions = options || {};
        if (this.tableUiLocked && !normalizedOptions.force) return;
        mutator();
        if (!normalizedOptions.skipSort && this.sortKeys.length) {
            this.sortTableDataInPlace();
        }
        const skipGrouping =
            normalizedOptions.skipGroupingViewRefresh === true ||
            normalizedOptions.skipGroupingSync === true;
        if (!skipGrouping && this.groupingActive && this.isFullyLoaded) {
            this.refreshGroupingViewFromData();
        }
        this.checkTableInvariants?.('table mutation');
        if (!normalizedOptions.skipEmit) this.onInput();
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
        this.tableData.splice(0, this.tableData.length, ...merged.rows);
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
            this.applyTableMutation(
                () => {
                    this._appendRowsDedup(chunk);
                },
                { skipSort: false, skipEmit: true, force: true }
            );
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
        this.applyTableMutation(
            () => {
                this._lazyPendingRows = [];
                this._appendRowsDedup(rest);
            },
            { skipSort: false, skipEmit: true, force: true }
        );
        this.isFullyLoaded = true;
        this._teardownLazyObserver();
        return true;
    },
    clearSelectedCells() {
        if (this.groupingActive || this.tableUiLocked) return;
        if (typeof SelectionMethods.clearSelectedCells === 'function') {
            SelectionMethods.clearSelectedCells.call(this);
        }
    },
    onHeaderSortClick(colIdx, event) {
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
        this._sortCycleRowOrder = this.tableData.slice();
        this.applySortKeysFromRuntime([{ col: colIdx, dir: 'asc' }], 'sort');
        tableLog(
            'sort',
            colIdx,
            'asc',
            this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
        );
    },
    selectedDataRowIdFromViewRow(viewRow) {
        return this.tableViewModelSnapshot().displayIndexToRowId[viewRow] || '';
    },
    captureSelectionIdentity() {
        const selection = captureCoreSelectionIdentity(
            {
                anchor: this.selAnchor,
                focus: this.selFocus,
                fullWidthRows: this.selFullWidthRows
            },
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
    restoreSelectionIdentity(snapshot) {
        if (!snapshot) return;
        if (snapshot.selection) {
            const selection = restoreCoreSelectionIdentity(
                snapshot.selection,
                this.tableColumns,
                this.tableViewModelSnapshot(),
                {
                    anchor: this.selAnchor,
                    focus: this.selFocus,
                    fullWidthRows: this.selFullWidthRows
                }
            );
            this.selAnchor = selection.anchor;
            this.selFocus = selection.focus;
            this.selFullWidthRows = selection.fullWidthRows;
            this.$nextTick(() => this.focusSelectionCell(this.selFocus.r, this.selFocus.c));
            return;
        }
        if (!snapshot.focusRowId) return;
        this.restoreSelectionByRowIds(
            snapshot.focusRowId,
            snapshot.anchorRowId || snapshot.focusRowId,
            snapshot.focusCol,
            snapshot.anchorCol,
            snapshot.useFullWidthRows
        );
    },
    restoreSelectionByRowIds(focusRowId, anchorRowId, focusCol, anchorCol, useFullWidthRows) {
        const rowIndexById = this.tableViewModelSnapshot().rowIdToDisplayIndex;
        const nextFocusRow = rowIndexById.has(focusRowId)
            ? rowIndexById.get(focusRowId)
            : 0;
        const nextAnchorRow = rowIndexById.has(anchorRowId)
            ? rowIndexById.get(anchorRowId)
            : nextFocusRow;
        const focusColumn = this.normCol(focusCol != null ? focusCol : 0);
        const anchorColumn = this.normCol(anchorCol != null ? anchorCol : focusColumn);
        this.selFullWidthRows = null;
        this.selAnchor = { r: nextAnchorRow, c: anchorColumn };
        this.selFocus = { r: nextFocusRow, c: focusColumn };
        if (useFullWidthRows && this.tableColumns.length > 0) {
            this.setSelFullWidthRowSpan(nextAnchorRow, nextFocusRow);
        }
        this.$nextTick(() => this.focusSelectionCell(nextFocusRow, focusColumn));
    },
    recalculateLineNumbersFromSnapshot(snapshot) {
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
            if (!this.isFullyLoaded) {
                const ok = this.flushLazyFullLoadInternal();
                if (!ok) {
                    this.showTableError(
                        'Не удалось полностью загрузить данные для пересчёта нумерации.'
                    );
                    return;
                }
            }
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
            const updated = this.tableData.map((row: TableDataRow): TableDataRow => {
                const nextRow = assignRowLineNumber(
                    row,
                    this.tableColumns,
                    nextNumbers.get(String(row.id))
                );
                return nextRow &&
                    typeof nextRow === 'object' &&
                    !Array.isArray(nextRow) &&
                    Array.isArray((nextRow as { cells?: unknown[] }).cells) &&
                    (nextRow as { id?: unknown }).id != null
                    ? {
                          id: String((nextRow as { id: unknown }).id),
                          cells: (nextRow as { cells: unknown[] }).cells
                      }
                    : row;
            });
            this.tableData.splice(0, this.tableData.length, ...updated);
            this.sortKeys = [];
            this._sortCycleRowOrder = null;
            this.groupingState = { levels: [], expanded: new Set() };
            this.groupingViewCache = null;
            this.onInput();
            this.restoreSelectionByRowIds(
                focusRowId,
                anchorRowId,
                focusCol,
                anchorCol,
                useFullWidthRows
            );
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
