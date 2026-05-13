import type {
    TableCellMetaHistorySnapshot,
    TableHistoryEntry,
    TableHistorySnapshot,
    TableRecordHistoryOptions,
    TableRemoteHistorySnapshot,
    TableRowInsertHistoryEntry,
    TableRuntimeMethodSubset,
    TableRuntimeVm
} from './table_contract.ts';
import {
    cloneCellMetaBucket,
    cloneCellMetaMap,
    rawCellMetaMap
} from './table_cell_meta.ts';
import {
    appendHistoryEntry,
    buildCoreSelectionFromDisplay,
    cellMetaHistorySnapshotsEqual,
    cloneFullHistoryEntry,
    cloneGroupingState,
    cloneHistorySnapshot,
    cloneRowsForHistory,
    restoreDisplaySelectionFromCore,
    runtimeDisplaySelection,
    snapshotsEqual
} from './table_internal.ts';
import { getRowCells } from './table_utils.ts';

function cloneHistoryRow(row: TableRowInsertHistoryEntry['row']) {
    return { id: String(row.id), cells: getRowCells(row).slice() };
}

function insertHistoryRow(
    rows: TableRuntimeVm['tableData'],
    row: TableRowInsertHistoryEntry['row'],
    beforeRowId?: string | null,
    afterRowId?: string | null
) {
    const copy = cloneHistoryRow(row);
    const beforeIndex = beforeRowId ? rows.findIndex((item) => String(item.id) === beforeRowId) : -1;
    if (beforeIndex >= 0) {
        rows.splice(beforeIndex, 0, copy);
        return;
    }
    const afterIndex = afterRowId ? rows.findIndex((item) => String(item.id) === afterRowId) : -1;
    if (afterIndex >= 0) {
        rows.splice(afterIndex + 1, 0, copy);
        return;
    }
    rows.push(copy);
}

const HistoryRuntimeMethods = {
    captureCellMetaHistorySnapshot(): TableCellMetaHistorySnapshot {
        const viewModel = this.tableViewModelSnapshot();
        return {
            cellMetaByKey: rawCellMetaMap(this.tableStore.meta.cellMetaByKey),
            selection: buildCoreSelectionFromDisplay(
                runtimeDisplaySelection(this),
                this.tableColumns,
                viewModel
            )
        };
    },

    captureRemoteHistorySnapshot(): TableRemoteHistorySnapshot {
        const viewModel = this.tableViewModelSnapshot();
        return {
            cellRangeRules: this.tableRemote.cellRangeRules.slice(),
            columnRulesByKey: Object.fromEntries(
                Object.entries(this.tableRemote.columnRulesByKey || {})
                    .map(([key, rules]) => [key, rules.slice()])
            ),
            directCellOverrides: { ...this.tableRemote.directCellOverrides },
            formatRules: this.tableRemote.formatRules.slice(),
            globalRules: this.tableRemote.globalRules.slice(),
            rowRangeRules: this.tableRemote.rowRangeRules.slice(),
            selection: buildCoreSelectionFromDisplay(
                runtimeDisplaySelection(this),
                this.tableColumns,
                viewModel
            ),
            selectionExpression: this.tableRemote.selectionExpression
                ? { ...this.tableRemote.selectionExpression }
                : null,
            sortKeys: this.sortKeys.map((item) => ({ ...item })),
            view: {
                ...this.tableRemote.view,
                expandedGroups: (this.tableRemote.view.expandedGroups || []).slice(),
                filters: (this.tableRemote.view.filters || []).map((item) => ({ ...item })),
                group: (this.tableRemote.view.group || []).map((item) => ({ ...item })),
                sort: (this.tableRemote.view.sort || []).map((item) => ({ ...item }))
            },
            viewId: this.tableRemote.viewId
        };
    },

    captureHistorySnapshot(): TableHistorySnapshot {
        const viewModel = this.tableViewModelSnapshot();
        return {
            cellMetaByKey: cloneCellMetaMap(rawCellMetaMap(this.tableStore.meta.cellMetaByKey)),
            groupingState: cloneGroupingState(this.groupingState),
            rows: cloneRowsForHistory(this.tableData),
            selection: buildCoreSelectionFromDisplay(
                runtimeDisplaySelection(this),
                this.tableColumns,
                viewModel
            ),
            sortKeys: this.sortKeys.map((item) => ({ ...item })),
            validationErrors: { ...this.cellValidationErrors },
            widthOverridesByColumnKey: { ...this.tableStore.widths.overrideByColumnKey }
        };
    },

    recordOwnedHistoryEntry(entry: TableHistoryEntry) {
        this.tableStore.history.past = appendHistoryEntry(this.tableStore.history.past, entry);
        this.tableStore.history.future = [];
    },

    recordHistoryEntry(
        label: string,
        before: TableHistorySnapshot,
        after: TableHistorySnapshot,
        options: TableRecordHistoryOptions = {}
    ) {
        if (snapshotsEqual(before, after)) return;
        this.recordOwnedHistoryEntry(
            cloneFullHistoryEntry(label, before, after, options.snapshotsAlreadyOwned === true)
        );
    },

    recordCellMetaHistoryEntry(
        label: string,
        before: TableCellMetaHistorySnapshot,
        after: TableCellMetaHistorySnapshot
    ) {
        if (cellMetaHistorySnapshotsEqual(before, after)) return;
        this.recordOwnedHistoryEntry({
            after,
            before,
            kind: 'cell-meta',
            label: String(label || 'change')
        });
    },

    recordRemoteHistoryEntry(
        label: string,
        before: TableRemoteHistorySnapshot,
        after: TableRemoteHistorySnapshot,
        command = {}
    ) {
        if (JSON.stringify(before) === JSON.stringify(after)) return;
        this.recordOwnedHistoryEntry({
            after,
            before,
            command,
            kind: 'remote-command',
            label: String(label || 'remote change')
        });
    },

    runWithHistory(label: string, action: () => void) {
        const before = this.captureHistorySnapshot();
        action();
        const after = this.captureHistorySnapshot();
        this.recordHistoryEntry(label, before, after, { snapshotsAlreadyOwned: true });
    },

    runWithCellMetaHistory(label: string, action: () => void) {
        const before = this.captureCellMetaHistorySnapshot();
        action();
        const after = this.captureCellMetaHistorySnapshot();
        this.recordCellMetaHistoryEntry(label, before, after);
    },

    restoreHistorySnapshot(snapshot: TableHistorySnapshot) {
        const next = cloneHistorySnapshot(snapshot);
        this.tableData.splice(0, this.tableData.length, ...next.rows);
        this.tableStore.meta.cellMetaByKey = next.cellMetaByKey;
        this.tableStore.widths.overrideByColumnKey = { ...next.widthOverridesByColumnKey };
        this.sortKeys = next.sortKeys.map((item) => ({ ...item }));
        this.groupingState = cloneGroupingState(next.groupingState);
        this.cellValidationErrors = { ...next.validationErrors };
        this.tableStore.validation.cellErrors = { ...next.validationErrors };
        const selection = restoreDisplaySelectionFromCore(
            next.selection,
            this.tableColumns,
            this.tableViewModelSnapshot(),
            runtimeDisplaySelection(this)
        );
        this.selAnchor = selection.anchor;
        this.selFocus = selection.focus;
        this.selFullHeightCols = selection.fullHeightCols || null;
        this.selFullWidthRows = selection.fullWidthRows;
        this.onInput();
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    },

    restoreCellMetaHistorySnapshot(snapshot: TableCellMetaHistorySnapshot) {
        this.tableStore.meta.cellMetaByKey = snapshot.cellMetaByKey;
        const selection = restoreDisplaySelectionFromCore(
            snapshot.selection,
            this.tableColumns,
            this.tableViewModelSnapshot(),
            runtimeDisplaySelection(this)
        );
        this.selAnchor = selection.anchor;
        this.selFocus = selection.focus;
        this.selFullHeightCols = selection.fullHeightCols || null;
        this.selFullWidthRows = selection.fullWidthRows;
        this.onInput();
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    },

    restoreRemoteHistorySnapshot(snapshot: TableRemoteHistorySnapshot) {
        this.sortKeys = snapshot.sortKeys.map((item) => ({ ...item }));
        this.tableRemote.activeAbortController?.abort();
        this.tableRemote = {
            ...this.tableRemote,
            activeAbortController: null,
            cellRangeRules: snapshot.cellRangeRules.slice(),
            columnRulesByKey: Object.fromEntries(
                Object.entries(snapshot.columnRulesByKey || {})
                    .map(([key, rules]) => [key, rules.slice()])
            ),
            directCellOverrides: { ...snapshot.directCellOverrides },
            formatRules: snapshot.formatRules.slice(),
            globalRules: snapshot.globalRules.slice(),
            itemsByDisplayIndex: {},
            loadedRanges: [],
            rowItemsById: {},
            rowRangeRules: snapshot.rowRangeRules.slice(),
            selectionExpression: snapshot.selectionExpression
                ? { ...snapshot.selectionExpression }
                : null,
            view: {
                ...snapshot.view,
                expandedGroups: (snapshot.view.expandedGroups || []).slice(),
                filters: (snapshot.view.filters || []).map((item) => ({ ...item })),
                group: (snapshot.view.group || []).map((item) => ({ ...item })),
                sort: (snapshot.view.sort || []).map((item) => ({ ...item }))
            },
            viewId: snapshot.viewId
        };
        const selection = restoreDisplaySelectionFromCore(
            snapshot.selection,
            this.tableColumns,
            this.tableViewModelSnapshot(),
            runtimeDisplaySelection(this)
        );
        this.selAnchor = selection.anchor;
        this.selFocus = selection.focus;
        this.selFullHeightCols = selection.fullHeightCols || null;
        this.selFullWidthRows = selection.fullWidthRows;
        void this.queryRemoteTableWindow?.({
            limit: snapshot.view.limit,
            offset: snapshot.view.offset
        });
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    },

    restoreRowInsertHistoryEntry(entry: TableRowInsertHistoryEntry, side: 'before' | 'after') {
        const rowId = String(entry.row.id || '');
        if (!rowId) return;
        if (side === 'before') {
            const index = this.tableData.findIndex((row) => String(row.id) === rowId);
            if (index >= 0) this.tableData.splice(index, 1);
            const nextMeta = { ...rawCellMetaMap(this.tableStore.meta.cellMetaByKey) };
            delete nextMeta[rowId];
            this.tableStore.meta.cellMetaByKey = nextMeta;
        } else {
            insertHistoryRow(this.tableData, entry.row, entry.beforeRowId, entry.afterRowId);
            if (entry.rowMeta && Object.keys(entry.rowMeta).length > 0) {
                this.tableStore.meta.cellMetaByKey = {
                    ...rawCellMetaMap(this.tableStore.meta.cellMetaByKey),
                    [rowId]: cloneCellMetaBucket(entry.rowMeta)
                };
            }
        }
        const selection = restoreDisplaySelectionFromCore(
            side === 'before' ? entry.beforeSelection : entry.afterSelection,
            this.tableColumns,
            this.tableViewModelSnapshot(),
            runtimeDisplaySelection(this)
        );
        this.selAnchor = selection.anchor;
        this.selFocus = selection.focus;
        this.selFullHeightCols = selection.fullHeightCols || null;
        this.selFullWidthRows = selection.fullWidthRows;
        this.onInput();
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    },

    restoreHistoryEntrySnapshot(entry: TableHistoryEntry, side: 'before' | 'after') {
        if (entry.kind === 'cell-meta') {
            this.restoreCellMetaHistorySnapshot(entry[side]);
            return;
        }
        if (entry.kind === 'row-insert') {
            this.restoreRowInsertHistoryEntry(entry, side);
            return;
        }
        if (entry.kind === 'remote-command') {
            this.restoreRemoteHistorySnapshot(entry[side]);
            return;
        }
        this.restoreHistorySnapshot(entry[side]);
    },

    undoTableAction() {
        const entry = this.tableStore.history.past[this.tableStore.history.past.length - 1];
        if (!entry) return;
        this.tableStore.history.past = this.tableStore.history.past.slice(0, -1);
        this.tableStore.history.future = [entry].concat(this.tableStore.history.future);
        this.restoreHistoryEntrySnapshot(entry, 'before');
    },

    redoTableAction() {
        const entry = this.tableStore.history.future[0];
        if (!entry) return;
        this.tableStore.history.future = this.tableStore.history.future.slice(1);
        this.tableStore.history.past = appendHistoryEntry(this.tableStore.history.past, entry);
        this.restoreHistoryEntrySnapshot(entry, 'after');
    }
} satisfies TableRuntimeMethodSubset<TableRuntimeVm>;

export { HistoryRuntimeMethods };
