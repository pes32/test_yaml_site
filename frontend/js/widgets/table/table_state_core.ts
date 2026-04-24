import type {
    TableColumnKey,
    TableCommand,
    TableCoreCellPatch,
    TableContextMenuSnapshot,
    TableCoreCellAddress,
    TableCoreColumn,
    TableCoreSelectionState,
    TableCoreSortState,
    TableCoreState,
    TableDataRow,
    TableGroupingState,
    TableRuntimeColumn,
    TableSelectionState,
    TableSortState
} from './table_contract.ts';
import { createEditingSession } from './table_editing_model.ts';
import { appendRowsDedup } from './table_lazy_load_model.ts';
import { getRowCells } from './table_utils.ts';

const LINE_NUMBER_COLUMN_KEY = '__line_numbers__';

type RuntimeCoreStateOptions = {
    activeCell?: { c: number; r: number } | null;
    columns: TableRuntimeColumn[];
    contextMenuContext?: TableContextMenuSnapshot | null;
    contextMenuOpen?: boolean;
    contextMenuSessionId?: number;
    editingCell?: { c: number; r: number } | null;
    groupingState?: TableGroupingState | null;
    rows: TableDataRow[];
    selection?: TableSelectionState | null;
    sortKeys?: TableSortState[];
};

function cloneRows(rows: readonly TableDataRow[]): TableDataRow[] {
    return rows.map((row) => ({
        id: String(row.id),
        cells: getRowCells(row).slice()
    }));
}

function normalizeBaseColumnKey(column: TableRuntimeColumn | null | undefined, index: number): string {
    if (column && (column.isLineNumber === true || column.attr === LINE_NUMBER_COLUMN_KEY)) {
        return LINE_NUMBER_COLUMN_KEY;
    }
    const attr = column?.attr != null ? String(column.attr).trim() : '';
    if (attr) return attr;
    const widgetRef = column?.widgetRef != null ? String(column.widgetRef).trim() : '';
    if (widgetRef) return `widget:${widgetRef}`;
    const label = column?.label != null ? String(column.label).trim() : '';
    if (label) return `label:${label}:${index}`;
    return `col:${index}`;
}

function withUniqueColumnKeys(columns: readonly TableRuntimeColumn[]): TableCoreColumn[] {
    const seen = new Map<string, number>();
    return columns.map((column, index) => {
        const base = normalizeBaseColumnKey(column, index);
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        const columnKey = count === 0 ? base : `${base}#${count + 1}`;
        return {
            ...column,
            columnKey
        };
    });
}

function columnKeyAt(columns: readonly TableRuntimeColumn[], index: number): TableColumnKey | null {
    if (index < 0 || index >= columns.length) return null;
    return withUniqueColumnKeys(columns)[index]?.columnKey || null;
}

function columnIndexByKey(columns: readonly TableRuntimeColumn[], colKey: TableColumnKey): number {
    return withUniqueColumnKeys(columns).findIndex((column) => column.columnKey === colKey);
}

function rowIdAt(rows: readonly TableDataRow[], index: number): string | null {
    if (index < 0 || index >= rows.length) return null;
    const row = rows[index];
    return row && row.id != null ? String(row.id) : null;
}

function rowIndexById(rows: readonly TableDataRow[], rowId: string): number {
    return rows.findIndex((row) => String(row.id) === rowId);
}

function addressFromDisplayIndex(
    rows: readonly TableDataRow[],
    columns: readonly TableRuntimeColumn[],
    address: { c: number; r: number } | null | undefined
): TableCoreCellAddress | null {
    if (!address) return null;
    const rowId = rowIdAt(rows, address.r);
    const colKey = columnKeyAt(columns, address.c);
    if (!rowId || !colKey) return null;
    return { rowId, colKey };
}

function selectionFromRuntime(
    rows: readonly TableDataRow[],
    columns: readonly TableRuntimeColumn[],
    selection: TableSelectionState | null | undefined
): TableCoreSelectionState {
    const anchor = addressFromDisplayIndex(rows, columns, selection?.anchor);
    const focus = addressFromDisplayIndex(rows, columns, selection?.focus);
    const fullWidthRows = selection?.fullWidthRows || null;
    const fullWidthRowIds =
        fullWidthRows == null
            ? null
            : rows
                  .slice(
                      Math.max(0, Math.min(fullWidthRows.r0, fullWidthRows.r1)),
                      Math.max(0, Math.max(fullWidthRows.r0, fullWidthRows.r1)) + 1
                  )
                  .map((row) => String(row.id));
    return { anchor, focus, fullWidthRowIds };
}

function sortKeysFromRuntime(
    columns: readonly TableRuntimeColumn[],
    sortKeys: readonly TableSortState[] | null | undefined
): TableCoreSortState[] {
    if (!Array.isArray(sortKeys)) return [];
    return sortKeys
        .map((item) => {
            const colKey = columnKeyAt(columns, item.col);
            return colKey ? { colKey, dir: item.dir === 'desc' ? 'desc' : 'asc' } : null;
        })
        .filter((item): item is TableCoreSortState => item != null);
}

function groupingKeysFromRuntime(
    columns: readonly TableRuntimeColumn[],
    groupingState: TableGroupingState | null | undefined
): TableColumnKey[] {
    const levels = groupingState?.levels || [];
    return levels
        .map((col) => columnKeyAt(columns, col))
        .filter((colKey): colKey is TableColumnKey => colKey != null);
}

function createTableCoreStateFromRuntime(options: RuntimeCoreStateOptions): TableCoreState {
    const rows = cloneRows(options.rows || []);
    const columns = withUniqueColumnKeys(options.columns || []);
    const selection = selectionFromRuntime(rows, columns, options.selection || null);
    const activeCell = addressFromDisplayIndex(
        rows,
        columns,
        options.activeCell || options.selection?.focus || null
    );
    const editingCell = addressFromDisplayIndex(rows, columns, options.editingCell || null);
    const groupingState = options.groupingState || { levels: [], expanded: new Set<string>() };

    return normalizeTableCoreState({
        activeCell,
        columns,
        contextMenu: {
            context: options.contextMenuContext || null,
            open: Boolean(options.contextMenuOpen),
            sessionId: options.contextMenuSessionId || 0
        },
        editing: editingCell
            ? {
                  activeCell: editingCell,
                  draftValue: rows[rowIndexById(rows, editingCell.rowId)]?.cells[
                      columnIndexByKey(columns, editingCell.colKey)
                  ],
                  validationErrors: {}
              }
            : null,
        grouping: {
            expanded: new Set(groupingState.expanded || []),
            levelKeys: groupingKeysFromRuntime(columns, groupingState)
        },
        rows,
        selection,
        sortKeys: sortKeysFromRuntime(columns, options.sortKeys || [])
    });
}

function cellExists(state: TableCoreState, cell: TableCoreCellAddress | null): boolean {
    if (!cell) return false;
    return (
        state.rows.some((row) => String(row.id) === cell.rowId) &&
        state.columns.some((column) => column.columnKey === cell.colKey)
    );
}

function firstCell(state: TableCoreState): TableCoreCellAddress | null {
    const row = state.rows[0];
    const column = state.columns[0];
    if (!row || !column) return null;
    return { rowId: String(row.id), colKey: column.columnKey };
}

function normalizeSelection(state: TableCoreState): TableCoreSelectionState {
    const fallback = firstCell(state);
    const anchor = cellExists(state, state.selection.anchor) ? state.selection.anchor : fallback;
    const focus = cellExists(state, state.selection.focus) ? state.selection.focus : anchor;
    const rowIds = new Set(state.rows.map((row) => String(row.id)));
    const fullWidthRowIds = state.selection.fullWidthRowIds
        ? state.selection.fullWidthRowIds.filter((rowId) => rowIds.has(rowId))
        : null;
    return {
        anchor,
        focus,
        fullWidthRowIds: fullWidthRowIds && fullWidthRowIds.length ? fullWidthRowIds : null
    };
}

function normalizeSortKeys(state: TableCoreState): TableCoreSortState[] {
    const columnKeys = new Set(state.columns.map((column) => column.columnKey));
    const seen = new Set<TableColumnKey>();
    const next: TableCoreSortState[] = [];
    for (const item of state.sortKeys || []) {
        if (!columnKeys.has(item.colKey) || seen.has(item.colKey)) continue;
        seen.add(item.colKey);
        next.push({ colKey: item.colKey, dir: item.dir === 'desc' ? 'desc' : 'asc' });
    }
    return next;
}

function contextSnapshotReferencesExistingState(state: TableCoreState): boolean {
    const context = state.contextMenu?.context || null;
    if (!state.contextMenu?.open || !context) return false;
    if (context.sessionId !== state.contextMenu.sessionId) return false;

    const rowIds = new Set(state.rows.map((row) => String(row.id)));
    const columnKeys = new Set(state.columns.map((column) => column.columnKey));
    const rowIdExists = (rowId: TableColumnKey | null | undefined) =>
        rowId == null || rowIds.has(String(rowId));
    const columnKeyExists = (colKey: TableColumnKey | null | undefined) =>
        colKey == null || columnKeys.has(String(colKey));

    if (!rowIdExists(context.anchorRowId)) return false;
    if (!rowIdExists(context.pasteAnchorRowId)) return false;
    if (!columnKeyExists(context.anchorColumnKey)) return false;
    if (!columnKeyExists(context.headerColumnKey)) return false;
    if (!columnKeyExists(context.pasteAnchorColumnKey)) return false;

    if (
        Array.isArray(context.groupingLevelKeysSnapshot) &&
        context.groupingLevelKeysSnapshot.some((colKey) => !columnKeyExists(colKey))
    ) {
        return false;
    }
    if (
        Array.isArray(context.sortKeyColumnsSnapshot) &&
        context.sortKeyColumnsSnapshot.some((item) => !columnKeyExists(item.colKey))
    ) {
        return false;
    }
    if (context.selectionSnapshot) {
        const { anchor, focus, fullWidthRowIds } = context.selectionSnapshot;
        if (!rowIdExists(anchor?.rowId) || !columnKeyExists(anchor?.colKey)) return false;
        if (!rowIdExists(focus?.rowId) || !columnKeyExists(focus?.colKey)) return false;
        if (
            Array.isArray(fullWidthRowIds) &&
            fullWidthRowIds.some((rowId) => !rowIdExists(rowId))
        ) {
            return false;
        }
    }
    if (context.bodyMode != null) {
        if (context.anchorRowId == null && (context.anchorRow < 0 || context.anchorRow >= state.rows.length)) {
            return false;
        }
        if (
            context.pasteAnchorRowId == null &&
            (context.pasteAnchor.r < 0 || context.pasteAnchor.r >= state.rows.length)
        ) {
            return false;
        }
    }
    return true;
}

function normalizeTableCoreState(state: TableCoreState): TableCoreState {
    const rows = cloneRows(state.rows || []);
    const columns = withUniqueColumnKeys(state.columns || []);
    const contextMenuOpen = Boolean(state.contextMenu?.open);
    const next: TableCoreState = {
        ...state,
        activeCell: state.activeCell && cellExists({ ...state, rows, columns }, state.activeCell)
            ? state.activeCell
            : firstCell({ ...state, rows, columns }),
        columns,
        contextMenu: {
            context: contextMenuOpen ? state.contextMenu.context : null,
            open: contextMenuOpen,
            sessionId: state.contextMenu?.sessionId || 0
        },
        editing:
            state.editing && cellExists({ ...state, rows, columns }, state.editing.activeCell)
                ? {
                      activeCell: state.editing.activeCell,
                      draftValue: state.editing.draftValue,
                      validationErrors: { ...state.editing.validationErrors }
                  }
                : null,
        grouping: {
            expanded: new Set(state.grouping?.expanded || []),
            levelKeys: (state.grouping?.levelKeys || []).filter((colKey, index, list) =>
                columns.some((column) => column.columnKey === colKey) && list.indexOf(colKey) === index
            )
        },
        rows,
        selection: state.selection || { anchor: null, focus: null, fullWidthRowIds: null },
        sortKeys: state.sortKeys || []
    };
    next.selection = normalizeSelection(next);
    next.sortKeys = normalizeSortKeys(next);
    if (!contextSnapshotReferencesExistingState(next)) {
        next.contextMenu = {
            context: null,
            open: false,
            sessionId: next.contextMenu.sessionId
        };
    }
    return next;
}

function replaceCellValue(
    rows: readonly TableDataRow[],
    columns: readonly TableCoreColumn[],
    cell: TableCoreCellAddress,
    value: unknown
): TableDataRow[] {
    const rowIndex = rowIndexById(rows, cell.rowId);
    const colIndex = columns.findIndex((column) => column.columnKey === cell.colKey);
    if (rowIndex < 0 || colIndex < 0) return cloneRows(rows);
    return rows.map((row, index) => {
        if (index !== rowIndex) return { id: String(row.id), cells: getRowCells(row).slice() };
        const cells = getRowCells(row).slice();
        cells[colIndex] = value;
        return { id: String(row.id), cells };
    });
}

function patchCellValues(
    rows: readonly TableDataRow[],
    columns: readonly TableCoreColumn[],
    patches: readonly TableCoreCellPatch[]
): TableDataRow[] {
    if (!Array.isArray(patches) || patches.length === 0) return cloneRows(rows);
    const columnIndexByKeyMap = new Map(columns.map((column, index) => [column.columnKey, index]));
    const patchesByRow = new Map<string, TableCoreCellPatch[]>();
    for (const patch of patches) {
        if (!patch?.cell) continue;
        const rowId = String(patch.cell.rowId);
        const colIndex = columnIndexByKeyMap.get(patch.cell.colKey);
        if (colIndex == null) continue;
        if (!patchesByRow.has(rowId)) patchesByRow.set(rowId, []);
        patchesByRow.get(rowId)?.push(patch);
    }
    if (!patchesByRow.size) return cloneRows(rows);
    return rows.map((row) => {
        const rowId = String(row.id);
        const rowPatches = patchesByRow.get(rowId);
        if (!rowPatches?.length) return { id: rowId, cells: getRowCells(row).slice() };
        const cells = getRowCells(row).slice();
        rowPatches.forEach((patch) => {
            const colIndex = columnIndexByKeyMap.get(patch.cell.colKey);
            if (colIndex != null) cells[colIndex] = patch.value;
        });
        return { id: rowId, cells };
    });
}

function insertRows(state: TableCoreState, command: Extract<TableCommand, { type: 'INSERT_ROWS' }>): TableDataRow[] {
    const rows = cloneRows(state.rows);
    const incoming = cloneRows(command.rows || []);
    if (!incoming.length) return rows;
    const beforeIndex = command.beforeRowId ? rowIndexById(rows, command.beforeRowId) : -1;
    if (beforeIndex >= 0) {
        rows.splice(beforeIndex, 0, ...incoming);
        return rows;
    }
    const afterIndex = command.afterRowId ? rowIndexById(rows, command.afterRowId) : -1;
    if (afterIndex >= 0) {
        rows.splice(afterIndex + 1, 0, ...incoming);
        return rows;
    }
    rows.push(...incoming);
    return rows;
}

function moveRowRelative(
    rows: readonly TableDataRow[],
    rowId: string,
    delta: number
): TableDataRow[] {
    const next = cloneRows(rows);
    const sourceIndex = rowIndexById(next, rowId);
    if (sourceIndex < 0) return next;
    const targetIndex = sourceIndex + Math.trunc(delta || 0);
    if (targetIndex < 0 || targetIndex >= next.length || targetIndex === sourceIndex) return next;
    const [movedRow] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, movedRow);
    return next;
}

function applyPasteToCoreRows(
    state: TableCoreState,
    command: Extract<TableCommand, { type: 'PASTE_TSV' }>
): TableDataRow[] {
    const { anchor, matrix } = command;
    const rowIndex = rowIndexById(state.rows, anchor.rowId);
    const colIndex = state.columns.findIndex((column) => column.columnKey === anchor.colKey);
    if (rowIndex < 0 || colIndex < 0 || !matrix.length) return cloneRows(state.rows);
    const rows = cloneRows(state.rows);
    const appendRows = cloneRows(command.appendRows || []);
    const mutableColKeys =
        Array.isArray(command.mutableColKeys)
            ? new Set(command.mutableColKeys)
            : null;
    const targetRowIds = Array.isArray(command.targetRowIds)
        ? command.targetRowIds.map((rowId) => String(rowId))
        : [];
    if (targetRowIds.length) {
        rows.push(...appendRows);
        const matrixByRowId = new Map<string, unknown[]>();
        targetRowIds.forEach((rowId, index) => {
            const source = matrix[index];
            if (Array.isArray(source)) matrixByRowId.set(rowId, source);
        });
        return rows.map((row) =>
            pasteValuesIntoRow(
                row,
                state.columns,
                colIndex,
                matrixByRowId.get(String(row.id)),
                mutableColKeys
            )
        );
    }
    const neededRows = rowIndex + matrix.length;
    while (rows.length < neededRows && appendRows.length > 0) rows.push(appendRows.shift()!);
    return rows.map((row, index) => {
        const rowOffset = index - rowIndex;
        const source = rowOffset >= 0 && rowOffset < matrix.length ? matrix[rowOffset] : null;
        return pasteValuesIntoRow(row, state.columns, colIndex, source, mutableColKeys);
    });
}

function pasteValuesIntoRow(
    row: TableDataRow,
    columns: readonly TableCoreColumn[],
    colIndex: number,
    source: unknown[] | null | undefined,
    mutableColKeys: Set<TableColumnKey> | null
): TableDataRow {
    const cells = getRowCells(row).slice();
    if (Array.isArray(source)) {
        for (let offset = 0; offset < source.length; offset += 1) {
            const targetCol = colIndex + offset;
            const colKey = columns[targetCol]?.columnKey || '';
            if (!colKey || (mutableColKeys && !mutableColKeys.has(colKey))) continue;
            cells[targetCol] = source[offset];
        }
    }
    return { id: String(row.id), cells };
}

function dispatchTableCommand(state: TableCoreState, command: TableCommand): TableCoreState {
    const current = normalizeTableCoreState(state);
    switch (command.type) {
        case 'SET_ACTIVE_CELL':
            return normalizeTableCoreState({ ...current, activeCell: command.cell });
        case 'SET_SELECTION_RECT':
            return normalizeTableCoreState({
                ...current,
                activeCell: command.focus || command.anchor,
                selection: {
                    anchor: command.anchor,
                    focus: command.focus,
                    fullWidthRowIds: command.fullWidthRowIds || null
                }
            });
        case 'ENTER_EDIT_MODE':
            return normalizeTableCoreState({
                ...current,
                activeCell: command.cell,
                editing: createEditingSession(command.cell, command.draftValue)
            });
        case 'COMMIT_EDIT':
            if (!current.editing?.activeCell) return current;
            return normalizeTableCoreState({
                ...current,
                editing: null,
                rows: replaceCellValue(current.rows, current.columns, current.editing.activeCell, command.value)
            });
        case 'CANCEL_EDIT':
            return normalizeTableCoreState({ ...current, editing: null });
        case 'PATCH_CELLS':
            return normalizeTableCoreState({
                ...current,
                rows: patchCellValues(current.rows, current.columns, command.patches)
            });
        case 'REPLACE_ROWS':
            return normalizeTableCoreState({
                ...current,
                rows: cloneRows(command.rows || [])
            });
        case 'INSERT_ROWS':
            return normalizeTableCoreState({ ...current, rows: insertRows(current, command) });
        case 'DELETE_ROWS': {
            const removed = new Set(command.rowIds.map((rowId) => String(rowId)));
            return normalizeTableCoreState({
                ...current,
                rows: current.rows.filter((row) => !removed.has(String(row.id)))
            });
        }
        case 'MOVE_ROW':
            return normalizeTableCoreState({
                ...current,
                rows: moveRowRelative(current.rows, command.rowId, command.delta)
            });
        case 'PASTE_TSV':
            return normalizeTableCoreState({
                ...current,
                rows: applyPasteToCoreRows(current, command)
            });
        case 'SORT_COLUMNS':
            return normalizeTableCoreState({ ...current, sortKeys: command.sortKeys });
        case 'CLEAR_SORT':
            return normalizeTableCoreState({
                ...current,
                sortKeys: command.colKey
                    ? current.sortKeys.filter((item) => item.colKey !== command.colKey)
                    : []
            });
        case 'ADD_GROUP_LEVEL':
            return normalizeTableCoreState({
                ...current,
                grouping: {
                    ...current.grouping,
                    levelKeys: current.grouping.levelKeys.includes(command.colKey)
                        ? current.grouping.levelKeys
                        : current.grouping.levelKeys.concat(command.colKey)
                }
            });
        case 'REMOVE_GROUP_LEVEL':
            return normalizeTableCoreState({
                ...current,
                grouping: {
                    ...current.grouping,
                    levelKeys: current.grouping.levelKeys.filter((colKey) => colKey !== command.colKey)
                }
            });
        case 'SET_GROUP_LEVELS':
            return normalizeTableCoreState({
                ...current,
                grouping: {
                    expanded: new Set(command.expandedPathKeys || []),
                    levelKeys: command.colKeys
                }
            });
        case 'SET_GROUP_EXPANDED':
            return normalizeTableCoreState({
                ...current,
                grouping: {
                    ...current.grouping,
                    expanded: new Set(command.expandedPathKeys || [])
                }
            });
        case 'REBUILD_GROUPING':
            return normalizeTableCoreState(current);
        case 'APPEND_LOADED_ROWS': {
            const merged = appendRowsDedup(current.rows, cloneRows(command.rows || []));
            return normalizeTableCoreState({ ...current, rows: merged.rows });
        }
        case 'OPEN_CONTEXT_MENU':
            return normalizeTableCoreState({
                ...current,
                contextMenu: {
                    context: command.snapshot,
                    open: true,
                    sessionId: command.snapshot.sessionId
                }
            });
        case 'CLOSE_CONTEXT_MENU':
            return normalizeTableCoreState({
                ...current,
                contextMenu: {
                    context: null,
                    open: false,
                    sessionId: current.contextMenu.sessionId
                }
            });
        default:
            return current;
    }
}

export {
    LINE_NUMBER_COLUMN_KEY,
    addressFromDisplayIndex,
    cloneRows,
    columnIndexByKey,
    columnKeyAt,
    createTableCoreStateFromRuntime,
    dispatchTableCommand,
    normalizeTableCoreState,
    rowIdAt,
    rowIndexById,
    selectionFromRuntime,
    sortKeysFromRuntime,
    withUniqueColumnKeys
};
