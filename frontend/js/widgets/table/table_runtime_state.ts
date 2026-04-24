import type {
    TableCellAddress,
    TableCommand,
    TableCoreCellAddress,
    TableCoreState,
    TableRuntimeColumn,
    TableRuntimeState,
    TableRuntimeVm,
    TableSelectionState,
    TableStore,
    TableViewModel
} from './table_contract.ts';
import { warnTableInvariants } from './table_invariants.ts';
import {
    buildCoreSelectionFromDisplay,
    coreCellToDisplay,
    displayCellToCore,
    restoreDisplaySelectionFromCore,
    runtimeDisplaySelection
} from './table_selection_model.ts';
import { coreSortToRuntimeSort } from './table_sort_model.ts';
import {
    columnIndexByKey,
    createTableCoreStateFromRuntime,
    dispatchTableCommand as dispatchCoreTableCommand,
    normalizeTableCoreState
} from './table_state_core.ts';
import { buildTableViewModel } from './table_view_model.ts';

type RuntimeStateSyncOptions = {
    skipContextMenu?: boolean;
    skipEditing?: boolean;
    skipGrouping?: boolean;
    skipRows?: boolean;
    skipSelection?: boolean;
    skipSort?: boolean;
};

type PublicTableCommandPayload = Record<string, unknown>;
type RuntimeTableStateBridgeSurface = TableRuntimeVm;
type TableRuntimeStoreMirrorSurface = Pick<
    TableRuntimeState,
    | '_stickyPinnedRowCount'
    | '_stickyPinnedTableWidth'
    | '_stickyPinnedWidthsByRow'
    | '_stickyTheadPinned'
    | 'cellValidationErrors'
    | 'contextMenuContext'
    | 'contextMenuOpen'
    | 'contextMenuPosition'
    | 'contextMenuSessionId'
    | 'contextMenuTarget'
    | 'editingCell'
    | 'selAnchor'
    | 'selFocus'
    | 'selFullWidthRows'
> & {
    tableStore: TableStore;
};
type PublicCommandRuntimeSurface = {
    tableCoreStateSnapshot(): Pick<TableCoreState, 'activeCell' | 'grouping'>;
};

function skipRuntimeState(...keys: Array<keyof RuntimeStateSyncOptions>): RuntimeStateSyncOptions {
    return Object.freeze(keys.reduce((options, key) => {
        options[key] = true;
        return options;
    }, {} as RuntimeStateSyncOptions));
}

const TABLE_RUNTIME_SYNC = Object.freeze({
    CONTEXT_MENU_ONLY: skipRuntimeState('skipRows', 'skipSort', 'skipGrouping', 'skipSelection', 'skipEditing'),
    EDITING_ONLY: skipRuntimeState('skipRows', 'skipSort', 'skipGrouping', 'skipSelection', 'skipContextMenu'),
    GROUPING_ONLY: skipRuntimeState('skipRows', 'skipSort', 'skipSelection', 'skipEditing', 'skipContextMenu'),
    ROWS_AND_SELECTION: skipRuntimeState('skipSort', 'skipGrouping', 'skipEditing', 'skipContextMenu'),
    ROWS_GROUPING_SELECTION: skipRuntimeState('skipSort', 'skipEditing', 'skipContextMenu'),
    ROWS_ONLY: skipRuntimeState('skipSort', 'skipGrouping', 'skipSelection', 'skipEditing', 'skipContextMenu'),
    SELECTION_ONLY: skipRuntimeState('skipRows', 'skipSort', 'skipGrouping', 'skipEditing', 'skipContextMenu'),
    SKIP_CONTEXT_MENU: skipRuntimeState('skipContextMenu'),
    SKIP_ROWS: skipRuntimeState('skipRows'),
    SORT_AND_GROUPING: skipRuntimeState('skipRows', 'skipSelection', 'skipEditing', 'skipContextMenu'),
    SORT_ONLY: skipRuntimeState('skipRows', 'skipGrouping', 'skipSelection', 'skipEditing', 'skipContextMenu')
});

function isRecord(value: unknown): value is PublicTableCommandPayload {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneRuntimeCellAddress(cell: TableCellAddress | null | undefined): TableCellAddress | null {
    return cell ? { r: cell.r, c: cell.c } : null;
}

function coreCellFromPayload(value: unknown): TableCoreCellAddress | null {
    if (!isRecord(value)) return null;
    const rowId = value.rowId != null ? String(value.rowId) : '';
    const colKey = value.colKey != null ? String(value.colKey) : '';
    return rowId && colKey ? { rowId, colKey } : null;
}

function rowIdsFromPayload(value: unknown): string[] | null {
    return Array.isArray(value) ? value.map((rowId) => String(rowId)) : null;
}

function matrixFromPayload(value: unknown): unknown[][] {
    return Array.isArray(value)
        ? value.map((row) => (Array.isArray(row) ? row.slice() : [row]))
        : [];
}

function cellPatchesFromPayload(value: unknown): Extract<TableCommand, { type: 'PATCH_CELLS' }>['patches'] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!isRecord(item)) return null;
            const cell = coreCellFromPayload(item.cell);
            return cell ? { cell, value: item.value } : null;
        })
        .filter((item): item is Extract<TableCommand, { type: 'PATCH_CELLS' }>['patches'][number] => item != null);
}

function stringsFromPayload(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function rowsFromPayload(value: unknown): Extract<TableCommand, { type: 'INSERT_ROWS' }>['rows'] {
    return Array.isArray(value)
        ? (value as Extract<TableCommand, { type: 'INSERT_ROWS' }>['rows'])
        : [];
}

function sortKeysFromPayload(value: unknown): Extract<TableCommand, { type: 'SORT_COLUMNS' }>['sortKeys'] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!isRecord(item)) return null;
            const colKey = item.colKey != null ? String(item.colKey) : '';
            if (!colKey) return null;
            return {
                colKey,
                dir: item.dir === 'desc' ? 'desc' : 'asc'
            };
        })
        .filter((item): item is Extract<TableCommand, { type: 'SORT_COLUMNS' }>['sortKeys'][number] => item != null);
}

function runtimeTableCoreStateSnapshot(vm: RuntimeTableStateBridgeSurface): TableCoreState {
    const core = createTableCoreStateFromRuntime({
        activeCell: vm.selFocus,
        columns: vm.tableColumns,
        contextMenuContext: vm.contextMenuContext,
        contextMenuOpen: vm.contextMenuOpen,
        contextMenuSessionId: vm.contextMenuSessionId,
        editingCell: vm.editingCell,
        groupingState: vm.groupingState,
        rows: vm.tableData,
        selection: runtimeDisplaySelection(vm),
        sortKeys: vm.sortKeys
    });
    const viewModel = vm.tableViewModelSnapshot(core);
    const selection = runtimeDisplaySelection(vm);
    core.selection = {
        ...buildCoreSelectionFromDisplay(selection, vm.tableColumns, viewModel)
    };
    core.activeCell = displayCellToCore(vm.selFocus, vm.tableColumns, viewModel);
    if (vm.editingCell) {
        const editingCell = displayCellToCore(vm.editingCell, vm.tableColumns, viewModel);
        core.editing = editingCell
            ? {
                  activeCell: editingCell,
                  draftValue: vm.safeCell(vm.dataRowByIdentity(editingCell.rowId), vm.editingCell.c),
                  validationErrors: { ...vm.cellValidationErrors }
              }
            : null;
    }
    return normalizeTableCoreState(core);
}

function runtimeTableViewModelSnapshot(
    vm: RuntimeTableStateBridgeSurface,
    coreState?: TableCoreState | null
): TableViewModel {
    const core = coreState || vm.tableCoreStateSnapshot();
    return buildTableViewModel(core.rows, core.columns, {
        expanded: core.grouping.expanded,
        groupingLevelKeys: core.grouping.levelKeys,
        listColumnIsMultiselect: (column: Record<string, unknown>) =>
            vm.listColumnIsMultiselect(column as TableRuntimeColumn),
        sortKeys: core.sortKeys
    });
}

function syncRuntimeFromTableCoreState(
    vm: RuntimeTableStateBridgeSurface,
    coreState: TableCoreState,
    options: RuntimeStateSyncOptions = {}
): void {
    const core = normalizeTableCoreState(coreState);
    const normalizedOptions = options || {};
    if (normalizedOptions.skipRows !== true) {
        vm.tableData.splice(0, vm.tableData.length, ...core.rows);
    }
    if (normalizedOptions.skipSort !== true) {
        vm.sortKeys = coreSortToRuntimeSort(vm.tableColumns, core.sortKeys);
    }
    if (normalizedOptions.skipGrouping !== true) {
        const nextLevels = core.grouping.levelKeys
            .map((colKey: string) => columnIndexByKey(vm.tableColumns, colKey))
            .filter((index: number, pos: number, list: number[]) =>
                index >= 0 && list.indexOf(index) === pos
            );
        vm.groupingState = {
            expanded: new Set(core.grouping.expanded || []),
            levels: nextLevels
        };
    }
    if (normalizedOptions.skipSelection !== true) {
        const viewModel = vm.tableViewModelSnapshot(core);
        const fallback: TableSelectionState = runtimeDisplaySelection(vm);
        const selection = restoreDisplaySelectionFromCore(
            core.selection,
            vm.tableColumns,
            viewModel,
            fallback
        );
        vm.selAnchor = selection.anchor;
        vm.selFocus = selection.focus;
        vm.selFullWidthRows = selection.fullWidthRows;
    }
    if (normalizedOptions.skipEditing !== true) {
        const viewModel = vm.tableViewModelSnapshot(core);
        vm.editingCell = coreCellToDisplay(
            core.editing?.activeCell || null,
            vm.tableColumns,
            viewModel
        );
        if (core.editing) vm.cellValidationErrors = { ...core.editing.validationErrors };
    }
    if (normalizedOptions.skipContextMenu !== true) {
        vm.contextMenuOpen = core.contextMenu.open;
        vm.contextMenuContext = core.contextMenu.context;
        vm.contextMenuSessionId = core.contextMenu.sessionId;
        if (!core.contextMenu.open) vm.contextMenuTarget = null;
    }
    syncTableStoreMirrors(vm as TableRuntimeStoreMirrorSurface);
}

function normalizeRuntimeTableState(
    vm: RuntimeTableStateBridgeSurface,
    phase?: string,
    options: RuntimeStateSyncOptions = {}
): TableCoreState {
    const normalizedOptions = {
        ...TABLE_RUNTIME_SYNC.SKIP_ROWS,
        ...(options || {})
    };
    const core = vm.tableCoreStateSnapshot();
    vm.syncRuntimeFromCoreState(core, normalizedOptions);
    vm.checkTableInvariants?.(phase || 'normalize table state');
    return core;
}

function dispatchRuntimeTableCoreCommand(
    vm: RuntimeTableStateBridgeSurface,
    command: TableCommand,
    phase?: string,
    options: RuntimeStateSyncOptions = {}
): TableCoreState {
    const next = dispatchCoreTableCommand(vm.tableCoreStateSnapshot(), command);
    vm.syncRuntimeFromCoreState(next, options);
    vm.checkTableInvariants?.(phase || command.type);
    return next;
}

function dispatchRuntimeTableCommand(
    vm: RuntimeTableStateBridgeSurface,
    command: string | TableCommand,
    payload: Record<string, unknown> = {},
    phase?: string,
    options: RuntimeStateSyncOptions = {}
): TableCoreState {
    const normalizedCommand =
        typeof command === 'string'
            ? tableCommandFromPublicEntrypoint(vm, command, payload)
            : command;
    return vm.dispatchTableCoreCommand(
        normalizedCommand,
        phase || normalizedCommand.type,
        options
    );
}

function checkRuntimeTableInvariants(
    vm: RuntimeTableStateBridgeSurface,
    phase?: string
): void {
    const core = vm.tableCoreStateSnapshot();
    const viewModel = vm.tableViewModelSnapshot(core);
    warnTableInvariants(core, viewModel, { phase: String(phase || 'table mutation') });
}

function syncTableStoreMirrors(vm: TableRuntimeStoreMirrorSurface): void {
    vm.tableStore.selection.anchor = cloneRuntimeCellAddress(vm.selAnchor) || { r: 0, c: 0 };
    vm.tableStore.selection.focus = cloneRuntimeCellAddress(vm.selFocus) || { r: 0, c: 0 };
    vm.tableStore.selection.fullWidthRows = vm.selFullWidthRows
        ? { r0: vm.selFullWidthRows.r0, r1: vm.selFullWidthRows.r1 }
        : null;

    vm.tableStore.editing.activeCell = cloneRuntimeCellAddress(vm.editingCell);
    vm.tableStore.validation.cellErrors = { ...vm.cellValidationErrors };

    vm.tableStore.menu.open = !!vm.contextMenuOpen;
    vm.tableStore.menu.position = { ...vm.contextMenuPosition };
    vm.tableStore.menu.target = vm.contextMenuTarget ? { ...vm.contextMenuTarget } : null;
    vm.tableStore.menu.context = vm.contextMenuContext;
    vm.tableStore.menu.sessionId = vm.contextMenuSessionId || 0;

    vm.tableStore.sticky.stickyTheadPinned = !!vm._stickyTheadPinned;
    vm.tableStore.sticky.stickyPinnedRowCount = vm._stickyPinnedRowCount || 0;
    vm.tableStore.sticky.stickyPinnedTableWidth = vm._stickyPinnedTableWidth || 0;
    vm.tableStore.sticky.stickyPinnedWidthsByRow = vm._stickyPinnedWidthsByRow
        ? vm._stickyPinnedWidthsByRow.map((row) => row.slice())
        : null;
}

function tableCommandFromPublicEntrypoint(
    vm: PublicCommandRuntimeSurface,
    command: string,
    payload: unknown
): TableCommand {
    const body = isRecord(payload) ? payload : {};
    switch (command) {
        case 'SET_SELECTION': {
            const anchor = coreCellFromPayload(body.anchor);
            const focus = coreCellFromPayload(body.focus) || anchor;
            return {
                anchor,
                focus,
                fullWidthRowIds: rowIdsFromPayload(body.fullWidthRowIds),
                type: 'SET_SELECTION_RECT'
            };
        }
        case 'ENTER_EDIT':
            return {
                cell:
                    coreCellFromPayload(body.cell) ||
                    vm.tableCoreStateSnapshot().activeCell ||
                    { rowId: '', colKey: '' },
                draftValue: body.draftValue,
                type: 'ENTER_EDIT_MODE'
            };
        case 'PASTE_TSV':
            return {
                anchor:
                    coreCellFromPayload(body.anchor) ||
                    vm.tableCoreStateSnapshot().activeCell ||
                    { rowId: '', colKey: '' },
                appendRows: rowsFromPayload(body.appendRows),
                matrix: matrixFromPayload(body.matrix),
                mutableColKeys: stringsFromPayload(body.mutableColKeys),
                targetRowIds: rowIdsFromPayload(body.targetRowIds),
                type: 'PASTE_TSV'
            };
        case 'PATCH_CELLS':
        case 'SET_CELL_VALUES':
            return {
                patches: cellPatchesFromPayload(body.patches),
                type: 'PATCH_CELLS'
            };
        case 'REPLACE_ROWS':
            return {
                rows: rowsFromPayload(body.rows),
                type: 'REPLACE_ROWS'
            };
        case 'INSERT_ROWS':
            return {
                afterRowId: body.afterRowId != null ? String(body.afterRowId) : null,
                beforeRowId: body.beforeRowId != null ? String(body.beforeRowId) : null,
                rows: rowsFromPayload(body.rows),
                type: 'INSERT_ROWS'
            };
        case 'DELETE_ROWS':
            return {
                rowIds: rowIdsFromPayload(body.rowIds) || [],
                type: 'DELETE_ROWS'
            };
        case 'MOVE_ROW':
            return {
                delta: Number(body.delta) || 0,
                rowId: String(body.rowId || ''),
                type: 'MOVE_ROW'
            };
        case 'SORT_COLUMNS':
            return {
                sortKeys: sortKeysFromPayload(body.sortKeys),
                type: 'SORT_COLUMNS'
            };
        case 'CLEAR_SORT':
            return {
                colKey: body.colKey != null ? String(body.colKey) : null,
                type: 'CLEAR_SORT'
            };
        case 'ADD_GROUP_LEVEL':
            return {
                colKey: String(body.colKey || ''),
                type: 'ADD_GROUP_LEVEL'
            };
        case 'REMOVE_GROUP_LEVEL':
            return {
                colKey: String(body.colKey || ''),
                type: 'REMOVE_GROUP_LEVEL'
            };
        case 'SET_GROUP_LEVELS':
            return {
                colKeys: stringsFromPayload(body.colKeys),
                expandedPathKeys: stringsFromPayload(body.expandedPathKeys),
                type: 'SET_GROUP_LEVELS'
            };
        case 'SET_GROUP_EXPANDED':
            return {
                expandedPathKeys: stringsFromPayload(body.expandedPathKeys),
                type: 'SET_GROUP_EXPANDED'
            };
        case 'TOGGLE_GROUP': {
            const colKey = String(body.colKey || '');
            const current = vm.tableCoreStateSnapshot();
            return {
                colKey,
                type: current.grouping.levelKeys.includes(colKey)
                    ? 'REMOVE_GROUP_LEVEL'
                    : 'ADD_GROUP_LEVEL'
            };
        }
        case 'CLOSE_CONTEXT_MENU':
            return { type: 'CLOSE_CONTEXT_MENU' };
        default:
            return {
                ...body,
                type: command
            } as TableCommand;
    }
}

export {
    TABLE_RUNTIME_SYNC,
    checkRuntimeTableInvariants,
    dispatchRuntimeTableCommand,
    dispatchRuntimeTableCoreCommand,
    normalizeRuntimeTableState,
    runtimeTableCoreStateSnapshot,
    runtimeTableViewModelSnapshot,
    syncRuntimeFromTableCoreState,
    syncTableStoreMirrors,
    tableCommandFromPublicEntrypoint
};
export type { RuntimeStateSyncOptions, RuntimeTableStateBridgeSurface };
