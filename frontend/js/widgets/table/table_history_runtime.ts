import type {
    TableHistorySnapshot,
    TableRuntimeMethodSubset,
    TableRuntimeVm
} from './table_contract.ts';
import { cloneCellMetaMap } from './table_cell_meta.ts';
import {
    appendHistoryEntry,
    cloneGroupingState,
    cloneHistorySnapshot,
    cloneRowsForHistory,
    snapshotsEqual
} from './table_history_model.ts';
import {
    buildCoreSelectionFromDisplay,
    restoreDisplaySelectionFromCore,
    runtimeDisplaySelection
} from './table_selection_model.ts';

const HistoryRuntimeMethods = {
    captureHistorySnapshot(): TableHistorySnapshot {
        const viewModel = this.tableViewModelSnapshot();
        return {
            cellMetaByKey: cloneCellMetaMap(this.tableStore.meta.cellMetaByKey),
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

    recordHistoryEntry(label: string, before: TableHistorySnapshot, after: TableHistorySnapshot) {
        if (snapshotsEqual(before, after)) return;
        this.tableStore.history.past = appendHistoryEntry(this.tableStore.history.past, {
            after: cloneHistorySnapshot(after),
            before: cloneHistorySnapshot(before),
            label: String(label || 'change')
        });
        this.tableStore.history.future = [];
    },

    runWithHistory(label: string, action: () => void) {
        const before = this.captureHistorySnapshot();
        action();
        const after = this.captureHistorySnapshot();
        this.recordHistoryEntry(label, before, after);
    },

    restoreHistorySnapshot(snapshot: TableHistorySnapshot) {
        const next = cloneHistorySnapshot(snapshot);
        this.tableData.splice(0, this.tableData.length, ...next.rows);
        this.tableStore.meta.cellMetaByKey = cloneCellMetaMap(next.cellMetaByKey);
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

    undoTableAction() {
        const entry = this.tableStore.history.past[this.tableStore.history.past.length - 1];
        if (!entry) return;
        this.tableStore.history.past = this.tableStore.history.past.slice(0, -1);
        this.tableStore.history.future = [entry].concat(this.tableStore.history.future);
        this.restoreHistorySnapshot(entry.before);
    },

    redoTableAction() {
        const entry = this.tableStore.history.future[0];
        if (!entry) return;
        this.tableStore.history.future = this.tableStore.history.future.slice(1);
        this.tableStore.history.past = appendHistoryEntry(this.tableStore.history.past, entry);
        this.restoreHistorySnapshot(entry.after);
    }
} satisfies TableRuntimeMethodSubset<TableRuntimeVm>;

export { HistoryRuntimeMethods };
