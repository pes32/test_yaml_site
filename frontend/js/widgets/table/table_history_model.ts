import type {
    TableCellMetaMap,
    TableCoreSelectionState,
    TableGroupingState,
    TableHistoryEntry,
    TableHistorySnapshot,
    TableDataRow,
    TableSortState
} from './table_contract.ts';
import { cloneCellMetaMap } from './table_cell_meta.ts';
import { getRowCells } from './table_utils.ts';

const HISTORY_LIMIT = 80;

function cloneRowsForHistory(rows: readonly TableDataRow[]): TableDataRow[] {
    return rows.map((row) => ({ id: String(row.id), cells: getRowCells(row).slice() }));
}

function cloneGroupingState(state: TableGroupingState): TableGroupingState {
    return {
        expanded: new Set(state?.expanded || []),
        levels: (state?.levels || []).slice()
    };
}

function cloneSelectionState(selection: TableCoreSelectionState): TableCoreSelectionState {
    return {
        anchor: selection.anchor ? { ...selection.anchor } : null,
        focus: selection.focus ? { ...selection.focus } : null,
        fullHeightColumnKeys: selection.fullHeightColumnKeys ? selection.fullHeightColumnKeys.slice() : null,
        fullWidthRowIds: selection.fullWidthRowIds ? selection.fullWidthRowIds.slice() : null
    };
}

function cloneHistorySnapshot(snapshot: TableHistorySnapshot): TableHistorySnapshot {
    return {
        cellMetaByKey: cloneCellMetaMap(snapshot.cellMetaByKey),
        groupingState: cloneGroupingState(snapshot.groupingState),
        rows: cloneRowsForHistory(snapshot.rows),
        selection: cloneSelectionState(snapshot.selection),
        sortKeys: snapshot.sortKeys.map((item: TableSortState) => ({ ...item })),
        validationErrors: { ...snapshot.validationErrors },
        widthOverridesByColumnKey: { ...snapshot.widthOverridesByColumnKey }
    };
}

function snapshotsEqual(left: TableHistorySnapshot, right: TableHistorySnapshot): boolean {
    return JSON.stringify({
        ...left,
        groupingState: { expanded: [...left.groupingState.expanded], levels: left.groupingState.levels }
    }) === JSON.stringify({
        ...right,
        groupingState: { expanded: [...right.groupingState.expanded], levels: right.groupingState.levels }
    });
}

function appendHistoryEntry(
    list: readonly TableHistoryEntry[],
    entry: TableHistoryEntry
): TableHistoryEntry[] {
    const next = list.concat([entry]);
    return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

export {
    appendHistoryEntry,
    cloneGroupingState,
    cloneHistorySnapshot,
    cloneRowsForHistory,
    cloneSelectionState,
    snapshotsEqual
};
