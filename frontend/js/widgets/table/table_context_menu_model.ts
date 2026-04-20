import type {
    TableCellAddress,
    TableContextMenuSnapshot,
    TableCoreSelectionState,
    TableRuntimeColumn,
    TableSelectionRect,
    TableSortState,
    TableViewModel
} from './table_contract.ts';
import { columnKeyAt, sortKeysFromRuntime } from './table_state_core.ts';

type BuildContextMenuSnapshotOptions = {
    anchorCol: number;
    anchorRow: number;
    bodyMode: 'cell' | 'cells' | 'row' | null;
    columns: readonly TableRuntimeColumn[];
    groupingLevels: readonly number[];
    headerCol: number | null;
    lineNumbersEnabled: boolean;
    pasteAnchor: TableCellAddress;
    rect: TableSelectionRect;
    selectionSnapshot: TableCoreSelectionState;
    sessionId: number;
    sortKeys: readonly TableSortState[];
    stickyHeaderEnabled: boolean;
    viewModel: TableViewModel;
    wordWrapEnabled: boolean;
};

function rowIdFromDisplay(viewModel: TableViewModel, displayRow: number): string | null {
    if (displayRow < 0) return null;
    return viewModel.displayIndexToRowId[displayRow] || null;
}

function cloneRuntimeSortKeys(sortKeys: readonly TableSortState[]): TableSortState[] {
    return Array.isArray(sortKeys)
        ? sortKeys.map((item) => ({ col: item.col, dir: item.dir === 'desc' ? 'desc' : 'asc' }))
        : [];
}

function groupingLevelKeys(
    columns: readonly TableRuntimeColumn[],
    groupingLevels: readonly number[]
): string[] {
    return (groupingLevels || [])
        .map((col) => columnKeyAt(columns, col))
        .filter((colKey): colKey is string => colKey != null);
}

function buildContextMenuSnapshot(options: BuildContextMenuSnapshotOptions): TableContextMenuSnapshot {
    const sortKeys = cloneRuntimeSortKeys(options.sortKeys);
    return {
        anchorCol: options.anchorCol,
        anchorColumnKey: columnKeyAt(options.columns, options.anchorCol),
        anchorRow: options.anchorRow,
        anchorRowId: rowIdFromDisplay(options.viewModel, options.anchorRow),
        bodyMode: options.bodyMode,
        groupingLevelKeysSnapshot: groupingLevelKeys(options.columns, options.groupingLevels),
        groupingLevelsSnapshot: (options.groupingLevels || []).slice(),
        headerCol: options.headerCol,
        headerColumnKey:
            options.headerCol != null ? columnKeyAt(options.columns, options.headerCol) : null,
        lineNumbersEnabled: options.lineNumbersEnabled,
        pasteAnchor: { r: options.pasteAnchor.r, c: options.pasteAnchor.c },
        pasteAnchorColumnKey: columnKeyAt(options.columns, options.pasteAnchor.c),
        pasteAnchorRowId: rowIdFromDisplay(options.viewModel, options.pasteAnchor.r),
        rect: { ...options.rect },
        selectionSnapshot: options.selectionSnapshot,
        sessionId: options.sessionId,
        sortKeyColumnsSnapshot: sortKeysFromRuntime(options.columns, sortKeys),
        sortKeys,
        stickyHeaderEnabled: options.stickyHeaderEnabled,
        wordWrapEnabled: options.wordWrapEnabled
    };
}

function isContextMenuSnapshotCurrent(
    snapshot: Pick<TableContextMenuSnapshot, 'sessionId'> | null | undefined,
    sessionId: number
): boolean {
    return !!snapshot && snapshot.sessionId === sessionId;
}

export { buildContextMenuSnapshot, isContextMenuSnapshotCurrent, rowIdFromDisplay };
export type { BuildContextMenuSnapshotOptions };
