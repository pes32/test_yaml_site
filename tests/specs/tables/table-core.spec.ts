import { expect, test } from '@playwright/test';
import {
  applyPasteMatrixToTableState
} from '../../../frontend/js/widgets/table/table_clipboard.ts';
import {
  buildContextMenuSnapshot,
  isContextMenuSnapshotCurrent
} from '../../../frontend/js/widgets/table/table_context_menu_model.ts';
import {
  createDomTableEditorHandle,
  createEditingSession,
  resolveEditingBoundary
} from '../../../frontend/js/widgets/table/table_editing_model.ts';
import {
  assertTableInvariants
} from '../../../frontend/js/widgets/table/table_invariants.ts';
import {
  appendRowsDedup,
  splitLazyInitialRows,
  takeLazyChunk
} from '../../../frontend/js/widgets/table/table_lazy_load_model.ts';
import {
  buildCoreSelectionFromDisplay,
  restoreDisplaySelectionFromCore
} from '../../../frontend/js/widgets/table/table_selection_model.ts';
import {
  createTableStore
} from '../../../frontend/js/widgets/table/table_store.ts';
import {
  createTableCoreStateFromRuntime,
  dispatchTableCommand,
  normalizeTableCoreState
} from '../../../frontend/js/widgets/table/table_state_core.ts';
import {
  tableCommandFromPublicEntrypoint
} from '../../../frontend/js/widgets/table/table_runtime_state.ts';
import {
  buildTableViewModel
} from '../../../frontend/js/widgets/table/table_view_model.ts';
import type {
  TableDataRow,
  TableRuntimeColumn
} from '../../../frontend/js/widgets/table/table_contract.ts';

const columns = [
  { attr: 'name', label: 'Name', type: 'str' },
  { attr: 'team', label: 'Team', type: 'str' }
] satisfies TableRuntimeColumn[];

function row(id: string, cells: unknown[]): TableDataRow {
  return { id, cells };
}

function groupedNameRows(): TableDataRow[] {
  return [
    row('r2', ['Bee', 'B']),
    row('r1', ['Ant', 'A']),
    row('r3', ['Aardvark', 'A'])
  ];
}

function alphaBetaRows(): TableDataRow[] {
  return [row('r1', ['Alpha', 'A']), row('r2', ['Beta', 'B'])];
}

function secondRowSelectionSnapshot(viewModel: ReturnType<typeof buildTableViewModel>) {
  return buildCoreSelectionFromDisplay(
    {
      anchor: { r: 1, c: 0 },
      focus: { r: 1, c: 1 },
      fullWidthRows: null
    },
    columns,
    viewModel
  );
}

function cellContextMenuSnapshot(
  viewModel: ReturnType<typeof buildTableViewModel>,
  selectionSnapshot: ReturnType<typeof buildCoreSelectionFromDisplay>,
  overrides: Partial<Parameters<typeof buildContextMenuSnapshot>[0]> = {}
) {
  return buildContextMenuSnapshot({
    anchorCol: 1,
    anchorRow: 1,
    bodyMode: 'cell',
    columns,
    groupingLevels: [],
    headerCol: null,
    lineNumbersEnabled: false,
    pasteAnchor: { r: 1, c: 1 },
    rect: { r0: 1, r1: 1, c0: 0, c1: 1 },
    selectionSnapshot,
    sessionId: 3,
    sortKeys: [],
    stickyHeaderEnabled: false,
    viewModel,
    wordWrapEnabled: false,
    ...overrides
  });
}

function secondRowContextMenuFixture(
  overrides: Partial<Parameters<typeof buildContextMenuSnapshot>[0]> = {}
) {
  const rows = alphaBetaRows();
  const viewModel = buildTableViewModel(rows, columns);
  const selectionSnapshot = secondRowSelectionSnapshot(viewModel);
  const snapshot = cellContextMenuSnapshot(viewModel, selectionSnapshot, overrides);
  return { rows, selectionSnapshot, snapshot, viewModel };
}

test.describe('table pure core', () => {
  test('store exposes subsystem slices without legacy preference buckets', () => {
    const store = createTableStore({
      stickyHeaderEnabled: true
    });

    expect(store).toMatchObject({
      editing: { activeCell: null },
      loading: { tableUiLocked: false },
      menu: { open: false, sessionId: 0 },
      sticky: { headerRuntimeEnabled: true },
      validation: { cellErrors: {} },
      view: { wordWrapRuntimeEnabled: false }
    });
    expect('preferences' in store).toBe(false);
    expect('contextMenu' in store).toBe(false);
    expect('measurement' in store).toBe(false);
  });

  test('normalizes selection by rowId after deleting selected source rows', () => {
    const core = createTableCoreStateFromRuntime({
      columns,
      rows: [row('r1', ['Alpha', 'A']), row('r2', ['Beta', 'B'])],
      selection: {
        anchor: { r: 0, c: 0 },
        focus: { r: 0, c: 1 },
        fullWidthRows: null
      }
    });

    const next = dispatchTableCommand(core, {
      rowIds: ['r1'],
      type: 'DELETE_ROWS'
    });

    expect(next.rows.map((item) => item.id)).toEqual(['r2']);
    expect(next.selection.anchor).toEqual({ rowId: 'r2', colKey: 'name' });
    expect(next.selection.focus).toEqual({ rowId: 'r2', colKey: 'name' });
  });

  test('sort view model is rowId-based and does not mutate source rows', () => {
    const rows = [
      row('r2', ['Same', 'B']),
      row('r1', ['Same', 'A']),
      row('r3', ['First', 'A'])
    ];
    const sourceOrder = rows.map((item) => item.id);
    const viewModel = buildTableViewModel(rows, columns, {
      sortKeys: [{ colKey: 'name', dir: 'asc' }]
    });

    expect(viewModel.orderedRowIds).toEqual(['r3', 'r1', 'r2']);
    expect(rows.map((item) => item.id)).toEqual(sourceOrder);
  });

  test('grouping display tree is built over ordered row ids', () => {
    const rows = groupedNameRows();
    const viewModel = buildTableViewModel(rows, columns, {
      expanded: new Set(['A']),
      groupingLevelKeys: ['team'],
      sortKeys: [{ colKey: 'name', dir: 'asc' }]
    });

    expect(viewModel.displayRows.map((item) => item.kind)).toEqual([
      'group',
      'data',
      'data',
      'group'
    ]);
    expect(viewModel.displayIndexToRowId).toEqual([null, 'r3', 'r1', null]);
  });

  test('paste matrix helper tiles selected ranges and grows rows without DOM', () => {
    const result = applyPasteMatrixToTableState([['seed']], {
      createEmptyRow: () => row('new-row', ['', '']),
      pasteAnchor: { r: 0, c: 0 },
      rect: { r0: 0, r1: 1, c0: 0, c1: 1 },
      tableColumns: columns,
      tableData: [row('r1', ['', ''])]
    });

    expect(result.tiled).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((item) => item.cells)).toEqual([
      ['seed', 'seed'],
      ['seed', 'seed']
    ]);
  });

  test('paste command writes target row ids instead of source row offsets', () => {
    const core = createTableCoreStateFromRuntime({
      columns,
      rows: [row('r2', ['Beta', 'B']), row('r1', ['Alpha', 'A'])]
    });
    const next = dispatchTableCommand(core, {
      anchor: { rowId: 'r1', colKey: 'name' },
      matrix: [['Ant'], ['Bee']],
      mutableColKeys: ['name'],
      targetRowIds: ['r1', 'r2'],
      type: 'PASTE_TSV'
    });

    expect(next.rows.map((item) => item.cells)).toEqual([
      ['Bee', 'B'],
      ['Ant', 'A']
    ]);
  });

  test('lazy append command deduplicates incoming row ids', () => {
    const core = createTableCoreStateFromRuntime({
      columns,
      rows: [row('r1', ['Alpha', 'A'])]
    });
    const next = dispatchTableCommand(core, {
      rows: [row('r1', ['Duplicate', 'A']), row('r2', ['Beta', 'B'])],
      type: 'APPEND_LOADED_ROWS'
    });

    expect(next.rows.map((item) => item.id)).toEqual(['r1', 'r2']);
  });

  test('public command mapper normalizes row, sort and grouping commands', () => {
    const vm = {
      tableCoreStateSnapshot: () => ({
        activeCell: null,
        grouping: { levelKeys: [] }
      })
    } as Parameters<typeof tableCommandFromPublicEntrypoint>[0];

    expect(tableCommandFromPublicEntrypoint(vm, 'DELETE_ROWS', { rowIds: ['r1', 7] })).toEqual({
      rowIds: ['r1', '7'],
      type: 'DELETE_ROWS'
    });
    expect(tableCommandFromPublicEntrypoint(vm, 'SORT_COLUMNS', {
      sortKeys: [{ colKey: 'name', dir: 'desc' }, { colKey: 'team', dir: 'wat' }]
    })).toEqual({
      sortKeys: [{ colKey: 'name', dir: 'desc' }, { colKey: 'team', dir: 'asc' }],
      type: 'SORT_COLUMNS'
    });
    expect(tableCommandFromPublicEntrypoint(vm, 'ADD_GROUP_LEVEL', { colKey: 'team' })).toEqual({
      colKey: 'team',
      type: 'ADD_GROUP_LEVEL'
    });
  });

  test('selection model maps display rows to stable row ids', () => {
    const rows = groupedNameRows();
    const viewModel = buildTableViewModel(rows, columns, {
      sortKeys: [{ colKey: 'name', dir: 'asc' }]
    });

    const selection = buildCoreSelectionFromDisplay(
      {
        anchor: { r: 0, c: 1 },
        focus: { r: 1, c: 0 },
        fullWidthRows: { r0: 0, r1: 1 }
      },
      columns,
      viewModel
    );

    expect(selection).toEqual({
      anchor: { rowId: 'r3', colKey: 'team' },
      focus: { rowId: 'r1', colKey: 'name' },
      fullWidthRowIds: ['r3', 'r1']
    });

    const restored = restoreDisplaySelectionFromCore(selection, columns, viewModel, {
      anchor: { r: 0, c: 0 },
      focus: { r: 0, c: 0 },
      fullWidthRows: null
    });

    expect(restored).toEqual({
      anchor: { r: 0, c: 1 },
      focus: { r: 1, c: 0 },
      fullWidthRows: { r0: 0, r1: 1 }
    });
  });

  test('context menu snapshot is rowId based and session checked', () => {
    const { snapshot } = secondRowContextMenuFixture({
      groupingLevels: [1],
      sessionId: 7,
      sortKeys: [{ col: 0, dir: 'asc' }],
      stickyHeaderEnabled: true
    });

    expect(snapshot.anchorRowId).toBe('r2');
    expect(snapshot.anchorSourceRow).toBe(1);
    expect(snapshot.anchorColumnKey).toBe('team');
    expect(snapshot.selectionSnapshot?.focus).toEqual({ rowId: 'r2', colKey: 'team' });
    expect(isContextMenuSnapshotCurrent(snapshot, 7)).toBe(true);
    expect(isContextMenuSnapshotCurrent(snapshot, 8)).toBe(false);

    const sortedViewModel = buildTableViewModel(
      [row('r2', ['Beta', 'B']), row('r1', ['Alpha', 'A'])],
      columns,
      { sortKeys: [{ colKey: 'name', dir: 'asc' }] }
    );
    const sortedSelection = buildCoreSelectionFromDisplay(
      { anchor: { r: 0, c: 0 }, focus: { r: 0, c: 0 }, fullWidthRows: null },
      columns,
      sortedViewModel
    );
    const sortedSnapshot = cellContextMenuSnapshot(sortedViewModel, sortedSelection, {
      anchorCol: 0,
      anchorRow: 0,
      pasteAnchor: { r: 0, c: 0 },
      rect: { r0: 0, r1: 0, c0: 0, c1: 0 },
      sessionId: 8,
      sortKeys: [{ col: 0, dir: 'asc' }],
    });
    expect(sortedSnapshot.anchorRowId).toBe('r1');
    expect(sortedSnapshot.anchorSourceRow).toBe(1);
  });

  test('normalizes stale context menu snapshots after source rows change', () => {
    const { rows, snapshot } = secondRowContextMenuFixture();
    const core = createTableCoreStateFromRuntime({
      columns,
      contextMenuContext: snapshot,
      contextMenuOpen: true,
      contextMenuSessionId: 3,
      rows
    });

    const next = normalizeTableCoreState({
      ...core,
      rows: [row('r1', ['Alpha', 'A'])]
    });

    expect(next.contextMenu.open).toBe(false);
    expect(next.contextMenu.context).toBeNull();
  });

  test('editing model owns boundary decisions and editor handle commits', () => {
    expect(createEditingSession({ rowId: 'r1', colKey: 'name' }, 'draft')).toEqual({
      activeCell: { rowId: 'r1', colKey: 'name' },
      draftValue: 'draft',
      validationErrors: {}
    });
    expect(resolveEditingBoundary({
      colCount: 2,
      current: { r: 0, c: 1 },
      key: 'Tab',
      rowCount: 2
    })).toEqual({
      action: 'commit',
      nextCell: { r: 1, c: 0 }
    });
    expect(resolveEditingBoundary({
      addRowOnFinalEnter: true,
      colCount: 2,
      current: { r: 1, c: 1 },
      key: 'Enter',
      rowCount: 2
    })).toEqual({
      action: 'commit',
      nextCell: null,
      shouldAddRow: true
    });
    expect(resolveEditingBoundary({
      colCount: 2,
      current: { r: 0, c: 0 },
      key: 'Escape',
      rowCount: 2
    })).toEqual({
      action: 'cancel',
      nextCell: null
    });

    const input = {
      blur() {},
      focus() {},
      textContent: '',
      value: 'committed'
    } as HTMLElement & { value: string };
    let committed: unknown = null;
    const handle = createDomTableEditorHandle(input, {
      commitValue: (value) => {
        committed = value;
      }
    });
    expect(handle.commitPendingState({ rowId: 'r1', colKey: 'name' })).toBe('committed');
    expect(committed).toBe('committed');
  });

  test('lazy model splits chunks and deduplicates by row id', () => {
    const split = splitLazyInitialRows(
      [row('r1', []), row('r2', []), row('r3', [])],
      { enabled: true, threshold: 2 }
    );

    expect(split.visibleRows.map((item) => item.id)).toEqual(['r1', 'r2']);
    expect(split.pendingRows.map((item) => item.id)).toEqual(['r3']);
    expect(split.isFullyLoaded).toBe(false);
    expect(takeLazyChunk(split.pendingRows, 1).chunk.map((item) => item.id)).toEqual(['r3']);

    const merged = appendRowsDedup(
      [row('r1', ['A'])],
      [row('r1', ['Duplicate']), row('r2', ['B'])]
    );
    expect(merged.rows.map((item) => item.id)).toEqual(['r1', 'r2']);
    expect(merged.duplicateRowIds).toEqual(['r1']);
  });

  test('invariants reject duplicate source row ids', () => {
    const core = createTableCoreStateFromRuntime({
      columns,
      rows: [row('r1', ['Alpha', 'A']), row('r1', ['Duplicate', 'B'])]
    });

    expect(() => assertTableInvariants(core)).toThrow(/duplicate_row_id/);
  });
});
