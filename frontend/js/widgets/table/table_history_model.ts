import type {
    TableCellMetaHistorySnapshot,
    TableCellMetaMap,
    TableCoreSelectionState,
    TableFullHistoryEntry,
    TableGroupingState,
    TableHistoryEntry,
    TableHistorySnapshot,
    TableDataRow,
    TableSortState
} from './table_contract.ts';
import { cellMetaEqual, cloneCellMetaMap } from './table_cell_meta.ts';
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

function cloneFullHistoryEntry(
    label: string,
    before: TableHistorySnapshot,
    after: TableHistorySnapshot,
    snapshotsAlreadyOwned = false
): TableFullHistoryEntry {
    return {
        after: snapshotsAlreadyOwned ? after : cloneHistorySnapshot(after),
        before: snapshotsAlreadyOwned ? before : cloneHistorySnapshot(before),
        kind: 'full',
        label: String(label || 'change')
    };
}

function cellMetaMapsEqual(
    left: TableCellMetaMap | null | undefined,
    right: TableCellMetaMap | null | undefined
): boolean {
    if (left === right) return true;
    const leftMap = left || {};
    const rightMap = right || {};
    const leftKeys = Object.keys(leftMap);
    const rightKeys = Object.keys(rightMap);
    return (
        leftKeys.length === rightKeys.length &&
        leftKeys.every((rowId) => {
            if (!Object.prototype.hasOwnProperty.call(rightMap, rowId)) return false;
            const leftBucket = leftMap[rowId] || {};
            const rightBucket = rightMap[rowId] || {};
            const leftCols = Object.keys(leftBucket);
            const rightCols = Object.keys(rightBucket);
            return (
                leftCols.length === rightCols.length &&
                leftCols.every((colKey) =>
                    Object.prototype.hasOwnProperty.call(rightBucket, colKey) &&
                    cellMetaEqual(leftBucket[colKey], rightBucket[colKey])
                )
            );
        })
    );
}

function selectionStatesEqual(
    left: TableCoreSelectionState,
    right: TableCoreSelectionState
): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function cellMetaHistorySnapshotsEqual(
    left: TableCellMetaHistorySnapshot,
    right: TableCellMetaHistorySnapshot
): boolean {
    return (
        cellMetaMapsEqual(left.cellMetaByKey, right.cellMetaByKey) &&
        selectionStatesEqual(left.selection, right.selection)
    );
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
    cellMetaHistorySnapshotsEqual,
    cloneGroupingState,
    cloneFullHistoryEntry,
    cloneHistorySnapshot,
    cloneRowsForHistory,
    cloneSelectionState,
    snapshotsEqual
};
