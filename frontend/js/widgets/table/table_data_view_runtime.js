import tableEngine from './table_core.js';

const Core = tableEngine;

const DataViewRuntimeMethods = {
    sortTableDataInPlace() {
        const Sort = tableEngine.Sort;
        if (!Sort || typeof Sort.compareRowsComposite !== 'function' || !this.sortKeys.length) {
            return;
        }
        const listMulti = (column) => this.listColumnIsMultiselect(column);
        const sorted = [...this.tableData].sort((rowA, rowB) =>
            Sort.compareRowsComposite(rowA, rowB, this.sortKeys, this.tableColumns, listMulti)
        );
        this.tableData.splice(0, this.tableData.length, ...sorted);
    },

    applyColumnSort(colIdx, direction) {
        this.sortKeys = [{ col: colIdx, dir: direction === 'desc' ? 'desc' : 'asc' }];
        this.sortTableDataInPlace();
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

    normRow(rowIndex) {
        const Utils = tableEngine.Utils;
        const clamp = Utils && Utils.clamp;
        const clampValue = clamp || ((value, lo, hi) => Math.max(lo, Math.min(hi, value)));
        const length = this.groupingActive ? this.displayRows.length : this.tableData.length;
        const max = Math.max(0, length - 1);
        return clampValue(rowIndex, 0, max);
    },

    tbodyRowCount() {
        return this.groupingActive ? this.displayRows.length : this.tableData.length;
    },

    resolveDataRowIndex(viewRow) {
        if (!this.groupingActive) return this.normRow(viewRow);
        const displayRow = this.displayRows[viewRow];
        if (!displayRow || displayRow.kind !== 'data') return -1;
        return displayRow.dataIndex;
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
        const Grouping = tableEngine.Grouping;
        if (
            !Grouping ||
            typeof Grouping.buildDisplayRows !== 'function' ||
            typeof Grouping.pruneExpanded !== 'function'
        ) {
            return;
        }
        let expanded = this.groupingState.expanded;
        let result = Grouping.buildDisplayRows(
            this.tableData,
            this.groupingState.levels,
            expanded,
            this.tableColumns
        );
        const pruned = Grouping.pruneExpanded(expanded, result.validPathKeys);
        if (pruned.size !== expanded.size || [...expanded].some((key) => !pruned.has(key))) {
            expanded = pruned;
            this.groupingState = Object.assign({}, this.groupingState, { expanded });
            result = Grouping.buildDisplayRows(
                this.tableData,
                this.groupingState.levels,
                expanded,
                this.tableColumns
            );
        }
        this.groupingViewCache = {
            displayRows: result.displayRows,
            validPathKeys: result.validPathKeys
        };
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
        if (!normalizedOptions.skipEmit) this.onInput();
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    },

    _lazyChunkSize() {
        const Grouping = tableEngine.Grouping;
        const fallback = Grouping && Grouping.TABLE_LAZY_THRESHOLD ? Grouping.TABLE_LAZY_THRESHOLD : 100;
        const rawValue = this.widgetConfig && this.widgetConfig.lazy_chunk_size;
        const parsed = typeof rawValue === 'number' ? rawValue : parseInt(String(rawValue || ''), 10);
        if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
        return fallback;
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

    _appendRowsDedup(rows) {
        const Utils = tableEngine.Utils;
        if (!Utils || typeof Utils.normalizeRowToDataRow !== 'function') return;
        const seen = new Set(this.tableData.map((item) => String(item.id)));
        for (let index = 0; index < rows.length; index += 1) {
            const normalized = Utils.normalizeRowToDataRow(rows[index], this.tableColumns, {
                inputMode: 'runtime'
            });
            if (!normalized) continue;
            const id = String(normalized.id);
            if (seen.has(id)) {
                if (tableEngine.DEBUG) {
                    console.warn('[TableWidget] duplicate row id on merge', id);
                }
                continue;
            }
            seen.add(id);
            this.tableData.push(normalized);
        }
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
        const chunk = pending.splice(0, this._lazyChunkSize());
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
        if (!pending.length) {
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
        const SelectionMethods = tableEngine.SelectionMethods;
        const clearSelection = SelectionMethods && SelectionMethods.clearSelectedCells;
        if (typeof clearSelection === 'function') clearSelection.call(this);
    },

    onHeaderSortClick(colIdx, event) {
        if (!this.headerSortEnabled || this.tableUiLocked) return;
        if (colIdx < 0 || colIdx >= this.tableColumns.length) return;
        const Sort = tableEngine.Sort;
        if (!Sort || typeof Sort.compareRowsComposite !== 'function') return;
        const normalizedEvent = event || {};
        const shift = !!normalizedEvent.shiftKey;

        if (shift) {
            const sortIndex = this.sortKeys.findIndex((item) => item.col === colIdx);
            if (sortIndex >= 0) {
                const current = this.sortKeys[sortIndex];
                const nextDirection = current.dir === 'asc' ? 'desc' : 'asc';
                this.sortKeys = this.sortKeys.map((item, index) =>
                    index === sortIndex ? { col: current.col, dir: nextDirection } : item
                );
            } else {
                this.sortKeys = this.sortKeys.concat([{ col: colIdx, dir: 'asc' }]);
            }
            this.sortTableDataInPlace();
            this.refreshGroupingViewFromData();
            tableEngine.log('sort multi', colIdx, this.sortKeys);
            this.onInput();
            return;
        }

        const currentSort =
            this.sortKeys.length === 1 && this.sortKeys[0].col === colIdx
                ? this.sortKeys[0]
                : null;
        if (currentSort) {
            if (currentSort.dir === 'asc') {
                this.sortKeys = [{ col: colIdx, dir: 'desc' }];
                this.sortTableDataInPlace();
                this.refreshGroupingViewFromData();
                tableEngine.log(
                    'sort',
                    colIdx,
                    'desc',
                    this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
                );
                this.onInput();
                return;
            }
            this.sortKeys = [];
            this.restoreSortCycleRowOrder();
            this.refreshGroupingViewFromData();
            tableEngine.log(
                'sort reset',
                colIdx,
                this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
            );
            this.onInput();
            return;
        }

        this._sortCycleRowOrder = this.tableData.slice();
        this.sortKeys = [{ col: colIdx, dir: 'asc' }];
        this.sortTableDataInPlace();
        this.refreshGroupingViewFromData();
        tableEngine.log(
            'sort',
            colIdx,
            'asc',
            this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
        );
        this.onInput();
    },

    selectedDataRowIdFromViewRow(viewRow) {
        const dataIndex = this.resolveDataRowIndex(viewRow);
        if (dataIndex < 0 || dataIndex >= this.tableData.length) return '';
        const row = this.tableData[dataIndex];
        return row && row.id != null ? String(row.id) : '';
    },

    restoreSelectionByRowIds(focusRowId, anchorRowId, focusCol, anchorCol, useFullWidthRows) {
        const rowIndexById = new Map();
        for (let index = 0; index < this.tableData.length; index += 1) {
            const row = this.tableData[index];
            const id = row && row.id != null ? String(row.id) : '';
            if (id) rowIndexById.set(id, index);
        }
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
        const Utils = tableEngine.Utils;
        const Grouping = tableEngine.Grouping;
        const assignLineNumber = Utils && Utils.assignRowLineNumber;
        if (typeof assignLineNumber !== 'function') return;

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
                this.groupingActive &&
                Grouping &&
                typeof Grouping.buildGroupedDataOrder === 'function'
                    ? Grouping.buildGroupedDataOrder(
                        this.tableData,
                        this.groupingState.levels,
                        this.tableColumns
                    )
                    : this.tableData.map((_, index) => index);
            const nextNumbers = new Map();
            order.forEach((dataIndex, index) => {
                const row = this.tableData[dataIndex];
                if (!row || row.id == null) return;
                nextNumbers.set(String(row.id), index + 1);
            });
            const updated = this.tableData.map((row) =>
                assignLineNumber(
                    row,
                    this.tableColumns,
                    nextNumbers.get(String(row.id))
                )
            );
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
};

Core.DataViewRuntimeMethods = DataViewRuntimeMethods;

export { DataViewRuntimeMethods };
export default DataViewRuntimeMethods;
