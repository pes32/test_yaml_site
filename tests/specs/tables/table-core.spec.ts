import { expect, test } from '@playwright/test';
import {
  applyPasteMatrixToTableState
} from '../../../frontend/js/widgets/table/table_clipboard.ts';
import {
  copyRowCellMeta,
  patchCellMeta,
  patchCellMetaForRowsAndColumns
} from '../../../frontend/js/widgets/table/table_cell_meta.ts';
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
  createRemoteProviderState,
  LOCAL_FULL_MAX_ROWS,
  resolveRemoteProviderSourceKey,
  rowsFromRemoteProviderState
} from '../../../frontend/js/widgets/table/table_row_provider.ts';
import { computeTableQueryViewFingerprint } from '../../../frontend/js/widgets/table/table_query_fingerprint.ts';
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
  HistoryRuntimeMethods
} from '../../../frontend/js/widgets/table/table_history_runtime.ts';
import {
  buildRemoteFormatRuleBuckets,
  applyRemoteRangeRulesForCell
} from '../../../frontend/js/widgets/table/table_format_rule_index.ts';
import {
  buildTableViewModel
} from '../../../frontend/js/widgets/table/table_view_model.ts';
import {
  buildVirtualWindow,
  createInitialVirtualState,
  updateMeasuredRowHeight,
  virtualOffsetForRow
} from '../../../frontend/js/widgets/table/table_virtual_model.ts';
import type {
  TableCellMetaMap,
  TableDataRow,
  TableFormatRule,
  TableHistoryEntry,
  TableRemoteCommandHistoryEntry,
  TableRemoteProviderState,
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

/** Минимальная модель ВМ для тестов table_history_runtime (typed tableRemote). */
type HistoryHarnessVm = {
  tableRemote: TableRemoteProviderState;
  cellValidationErrors: Record<string, unknown>;
  groupingState: { expanded: Set<string>; levels: number[] };
  onInput(): void;
  selAnchor: { r: number; c: number };
  selFocus: { r: number; c: number };
  selFullHeightCols: null;
  selFullWidthRows: null;
  sortKeys: unknown[];
  tableColumns: TableRuntimeColumn[];
  tableData: TableDataRow[];
  tableStore: {
    history: { future: TableHistoryEntry[]; past: TableHistoryEntry[] };
    meta: { cellMetaByKey: TableCellMetaMap };
    validation: { cellErrors: Record<string, unknown> };
    widths: { overrideByColumnKey: Record<string, unknown> };
  };
  tableViewModelSnapshot(): ReturnType<typeof buildTableViewModel>;
  $nextTick(callback?: () => void): Promise<void>;
  _scheduleStickyTheadUpdate(): void;
  queryRemoteTableWindow(): Promise<boolean>;
  captureRemoteHistorySnapshot(): unknown;
  recordRemoteHistoryEntry(
    label: string,
    before: unknown,
    after: unknown,
    command?: Record<string, unknown>
  ): void;
  undoTableAction(): void;
  redoTableAction(): void;
  runWithCellMetaHistory(label: string, action: () => void): void;
};

function bindHistoryVm(): HistoryHarnessVm {
  const vm = {
    cellValidationErrors: {},
    groupingState: { expanded: new Set<string>(), levels: [] },
    onInput() {},
    selAnchor: { r: 0, c: 0 },
    selFocus: { r: 0, c: 0 },
    selFullHeightCols: null,
    selFullWidthRows: null,
    sortKeys: [],
    tableColumns: columns,
    tableData: alphaBetaRows(),
    tableRemote: createRemoteProviderState({
      attr: 'big_table',
      mode: 'remote-paged',
      page: 'demo',
      provider: 'file',
      tableId: 'demo:big_table',
      initialView: { offset: 0, limit: LOCAL_FULL_MAX_ROWS },
      initialWindow: {
        has_more: true,
        items: [
          { kind: 'row', rowId: 'r1', sourceIndex: 0, values: ['Alpha', 'A'] },
          { kind: 'row', rowId: 'r2', sourceIndex: 1, values: ['Beta', 'B'] }
        ],
        limit: LOCAL_FULL_MAX_ROWS,
        offset: 0,
        total: 1_000_000,
        view_id: 'view_initial'
      }
    }),
    tableStore: {
      history: { future: [], past: [] },
      meta: { cellMetaByKey: {} as TableCellMetaMap },
      validation: { cellErrors: {} },
      widths: { overrideByColumnKey: {} }
    },
    tableViewModelSnapshot() {
      return buildTableViewModel(this.tableData, this.tableColumns);
    },
    $nextTick(callback?: () => void) {
      callback?.();
      return Promise.resolve();
    },
    _scheduleStickyTheadUpdate() {},
    queryRemoteTableWindow() {
      return Promise.resolve(true);
    }
  } as unknown as Record<string, unknown>;

  Object.entries(HistoryRuntimeMethods).forEach(([key, method]) => {
    vm[key] = (...args: unknown[]) => Reflect.apply(method, vm, args);
  });
  return vm as HistoryHarnessVm;
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
  test('patchCellMeta is copy-on-write and removes empty metadata', () => {
    const a1 = { rowId: 'r1', colKey: 'name' };
    const b1 = { rowId: 'r1', colKey: 'team' };
    const missing = { rowId: 'missing', colKey: 'name' };
    const untouched = { style: { bold: true } };
    const base: TableCellMetaMap = {
      r1: {
        name: { style: { strike: true, textColor: '#111111' } },
        team: untouched
      }
    };

    expect(patchCellMeta(base, [{ cell: a1, meta: { style: { strike: true } } }])).toBe(base);
    expect(patchCellMeta(base, [{ cell: missing, meta: null }])).toBe(base);

    const updated = patchCellMeta(base, [{ cell: a1, meta: { style: { underline: true } } }]);
    expect(updated).not.toBe(base);
    expect(updated.r1).not.toBe(base.r1);
    expect(updated.r1.team).toBe(untouched);
    expect(base.r1.name.style).not.toHaveProperty('underline');

    const removed = patchCellMeta(base, [
      { cell: a1, meta: { style: { strike: false, textColor: null } } }
    ]);
    expect(removed).not.toBe(base);
    expect(removed.r1).not.toHaveProperty('name');
    expect(removed.r1.team).toBe(untouched);

    const dirty: TableCellMetaMap = {
      r1: { name: { dataType: {}, style: { strike: false } } }
    };
    const cleaned = patchCellMeta(dirty, [{ cell: a1, meta: { style: { strike: false } } }]);
    expect(cleaned).not.toBe(dirty);
    expect(cleaned).not.toHaveProperty('r1');
  });

  test('copyRowCellMeta replaces target metadata for copied columns only', () => {
    const untouched = { style: { italic: true } };
    const base: TableCellMetaMap = {
      r1: {
        name: { style: { bold: true, textColor: '#222222' } }
      },
      r2: {
        name: { style: { strike: true } },
        team: { style: { underline: true } }
      },
      r3: {
        name: untouched
      }
    };

    const next = copyRowCellMeta(base, 'r1', 'r2', ['name', 'team']);
    expect(next).not.toBe(base);
    expect(next.r2.name).toEqual(base.r1.name);
    expect(next.r2.name).not.toBe(base.r1.name);
    expect(next.r2).not.toHaveProperty('team');
    expect(next.r3.name).toBe(untouched);
    expect(next.r3).toBe(base.r3);
    expect(base.r2.name).toEqual({ style: { strike: true } });
  });

  test('bulk cell meta patch shares row buckets but keeps later patches isolated', () => {
    const bulk = patchCellMetaForRowsAndColumns(
      {},
      ['r1', 'r2', 'r3'],
      ['name', 'team'],
      { style: { strike: true } }
    );
    expect(bulk.r1).toBe(bulk.r2);
    expect(bulk.r2).toBe(bulk.r3);
    expect(bulk.r1.name).toBe(bulk.r1.team);

    const afterSingleCell = patchCellMeta(bulk, [
      { cell: { rowId: 'r2', colKey: 'team' }, meta: { style: { fillColor: '#fff2cc' } } }
    ]);
    expect(afterSingleCell.r1).toBe(bulk.r1);
    expect(afterSingleCell.r3).toBe(bulk.r3);
    expect(afterSingleCell.r2).not.toBe(bulk.r2);
    expect(afterSingleCell.r1.team.style).toEqual({ strike: true });
    expect(afterSingleCell.r2.team.style).toEqual({ strike: true, fillColor: '#fff2cc' });
  });

  test('metadata-only history restores styles without aliasing snapshots', () => {
    const vm = bindHistoryVm();
    const a1 = { rowId: 'r1', colKey: 'name' };
    const b1 = { rowId: 'r2', colKey: 'team' };

    vm.runWithCellMetaHistory('strike', () => {
      vm.tableStore.meta.cellMetaByKey = patchCellMeta(vm.tableStore.meta.cellMetaByKey, [
        { cell: a1, meta: { style: { strike: true } } }
      ]);
    });
    vm.selAnchor = { r: 1, c: 1 };
    vm.selFocus = { r: 1, c: 1 };
    vm.runWithCellMetaHistory('bold color', () => {
      vm.tableStore.meta.cellMetaByKey = patchCellMeta(vm.tableStore.meta.cellMetaByKey, [
        { cell: b1, meta: { style: { bold: true, textColor: '#333333' } } }
      ]);
    });

    expect(vm.tableStore.history.past.map((entry) => entry.kind)).toEqual(['cell-meta', 'cell-meta']);
    const secondEntry = vm.tableStore.history.past[1];
    expect(secondEntry.kind).toBe('cell-meta');
    const savedAfterMap = secondEntry.kind === 'cell-meta' ? secondEntry.after.cellMetaByKey : {};
    const savedAfterB1 = savedAfterMap.r2?.team;

    vm.undoTableAction();
    expect(vm.tableStore.meta.cellMetaByKey.r1?.name?.style?.strike).toBe(true);
    expect(vm.tableStore.meta.cellMetaByKey.r2?.team).toBeUndefined();
    expect(vm.selFocus).toEqual({ r: 1, c: 1 });

    vm.redoTableAction();
    expect(vm.tableStore.meta.cellMetaByKey.r2?.team?.style).toEqual({
      bold: true,
      textColor: '#333333'
    });

    vm.undoTableAction();
    vm.runWithCellMetaHistory('new fill', () => {
      vm.tableStore.meta.cellMetaByKey = patchCellMeta(vm.tableStore.meta.cellMetaByKey, [
        { cell: b1, meta: { style: { fillColor: '#444444' } } }
      ]);
    });
    expect(savedAfterMap.r2?.team).toBe(savedAfterB1);
    expect(savedAfterMap.r2?.team?.style).toEqual({ bold: true, textColor: '#333333' });

    vm.undoTableAction();
    vm.redoTableAction();
    expect(vm.tableStore.meta.cellMetaByKey.r2?.team?.style).toEqual({ fillColor: '#444444' });
  });

  test('virtual window computes spacer math and measured row updates', () => {
    const initial = createInitialVirtualState();
    expect(initial.enabled).toBe(true);
    expect(initial.start).toBe(0);
    expect(initial.end).toBe(0);

    const measured = { 0: 20, 1: 30, 2: 40 };
    const win = buildVirtualWindow({
      estimatedRowHeightPx: 10,
      overscan: 1,
      rowCount: 100,
      rowHeightsByDisplayIndex: measured,
      scrollTopPx: 90,
      viewportHeightPx: 60
    });
    expect(win.start).toBe(2);
    expect(win.end).toBe(9);
    expect(win.topSpacerPx).toBe(50);
    expect(win.bottomSpacerPx).toBe(1092);
    expect(virtualOffsetForRow(measured, 3, 10)).toBe(90);

    const sameHeights = updateMeasuredRowHeight(measured, 2, 40.2);
    expect(sameHeights).toBe(measured);
    const nextHeights = updateMeasuredRowHeight(measured, 2, 44);
    expect(nextHeights).not.toBe(measured);
    expect(nextHeights[2]).toBe(44);
  });

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
        grouping: { expanded: new Set<string>(), levelKeys: [] as string[] }
      })
    } as unknown as Parameters<typeof tableCommandFromPublicEntrypoint>[0];

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
      fullHeightColumnKeys: null,
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
      fullHeightCols: null,
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

  test('remote provider keeps only the initial display window', () => {
    const state = createRemoteProviderState({
      attr: 'big_table',
      mode: 'remote-paged',
      page: 'demo',
      provider: 'inline',
      tableId: 'demo:big_table',
      initialView: { offset: 0, limit: LOCAL_FULL_MAX_ROWS },
      initialWindow: {
        has_more: true,
        items: [
          { kind: 'row', rowId: 'row_0', sourceIndex: 0, values: ['A'] },
          { kind: 'row', rowId: 'row_1', sourceIndex: 1, values: ['B'] }
        ],
        limit: LOCAL_FULL_MAX_ROWS,
        offset: 0,
        total: 1_000_000,
        view_id: 'view_initial'
      }
    });

    expect(state.mode).toBe('remote-paged');
    expect(state.totalRows).toBe(1_000_000);
    expect(Object.keys(state.itemsByDisplayIndex)).toHaveLength(2);
    expect(rowsFromRemoteProviderState(state).map((item) => item.id)).toEqual(['row_0', 'row_1']);
  });

  test('remote command history stores rules and view state without row snapshots', () => {
    const vm = bindHistoryVm();
    const before = vm.captureRemoteHistorySnapshot();
    const rule: TableFormatRule = {
      id: 'rule_1',
      scope: 'entireDataset',
      stylePatch: { bold: true },
      target: { kind: 'column', columnKey: 'name' }
    };

    vm.tableRemote = {
      ...vm.tableRemote,
      columnRulesByKey: { name: [rule] },
      formatRules: [rule]
    };
    const after = vm.captureRemoteHistorySnapshot();
    vm.recordRemoteHistoryEntry('remote format', before, after, { kind: 'format' });

    expect(vm.tableStore.history.past[0]).toMatchObject({
      kind: 'remote-command',
      label: 'remote format'
    });
    expect('rows' in vm.tableStore.history.past[0].after).toBe(false);

    vm.undoTableAction();
    expect(vm.tableRemote.formatRules).toHaveLength(0);

    vm.redoTableAction();
    expect(vm.tableRemote.formatRules).toHaveLength(1);
    const entry = vm.tableStore.history.past[0];
    expect(entry?.kind).toBe('remote-command');
    const savedAfter = (entry as TableRemoteCommandHistoryEntry).after;
    vm.tableRemote = {
      ...vm.tableRemote,
      formatRules: vm.tableRemote.formatRules.concat({
        id: 'rule_2',
        scope: 'entireDataset',
        stylePatch: { strike: true },
        target: { kind: 'column', columnKey: 'team' }
      })
    };
    expect(savedAfter.formatRules).toHaveLength(1);
  });

  test('computeTableQueryViewFingerprint matches backend table_runtime canonical hashing', async () => {
    const fingerprint = await computeTableQueryViewFingerprint({
      attr: 't',
      page: 'p',
      provider: 'file',
      sourceKey: 'value',
      view: {
        expandedGroups: ['b', 'a'],
        filters: [],
        group: [],
        limit: 100,
        offset: 10,
        search: null,
        sort: []
      }
    });

    expect(fingerprint).toBe('view_0843f0bab1ec7f91');
  });

  test('resolveRemoteProviderSourceKey restores table-query fingerprint when __tableRuntime omits sourceKey', async () => {
    const view = {
      expandedGroups: [] as string[],
      filters: [] as unknown[],
      group: [] as unknown[],
      limit: 50,
      offset: 100,
      search: null,
      sort: [] as unknown[]
    };
    const fpMissing = await computeTableQueryViewFingerprint({
      attr: 'demo_table_7',
      page: '2_widget_demo',
      provider: 'inline',
      sourceKey: '',
      view
    });
    const fpOk = await computeTableQueryViewFingerprint({
      attr: 'demo_table_7',
      page: '2_widget_demo',
      provider: 'inline',
      sourceKey: 'source',
      view
    });
    expect(fpMissing).not.toBe(fpOk);
    const resolved = resolveRemoteProviderSourceKey(
      { mode: 'remote-paged' },
      { source: [['1', 'a']] }
    );
    expect(resolved).toBe('source');
    const fpResolved = await computeTableQueryViewFingerprint({
      attr: 'demo_table_7',
      page: '2_widget_demo',
      provider: 'inline',
      sourceKey: resolved,
      view
    });
    expect(fpResolved).toBe(fpOk);
  });

  test('virtual geometryScale shrinks scroll surface beyond browser-safe height', () => {
    const win = buildVirtualWindow({
      estimatedRowHeightPx: 100,
      overscan: 0,
      rowCount: 200_000,
      rowHeightsByDisplayIndex: {},
      scrollTopPx: 0,
      viewportHeightPx: 500
    });
    expect(win.geometryScale).toBeLessThan(1);
    expect(win.totalRows).toBe(200_000);
  });

  test('remote format rule buckets resolve row and cell range without full scans', () => {
    const hit: string[] = [];
    const rRule: TableFormatRule = {
      id: 'rr1',
      scope: 'currentView',
      stylePatch: { bold: true },
      target: { kind: 'row-range', r0: 3, r1: 3 }
    };
    const cRule: TableFormatRule = {
      id: 'cr1',
      scope: 'currentView',
      stylePatch: { strike: true },
      target: { kind: 'cell-range', r0: 10, r1: 10, c0: 0, c1: 0 }
    };
    const buckets = buildRemoteFormatRuleBuckets([rRule], [cRule]);
    expect(buckets.bySourceIndex.get(3)?.map((r) => r.id)).toEqual(['rr1']);
    expect(buckets.bySourceIndex.get(10)?.map((r) => r.id)).toEqual(['cr1']);
    expect(buckets.bySourceIndex.has(0)).toBe(false);
    applyRemoteRangeRulesForCell(buckets, 10, 0, (r) => hit.push(r.id));
    expect(hit).toEqual(['cr1']);
    hit.length = 0;
    applyRemoteRangeRulesForCell(buckets, 10, 1, (r) => hit.push(r.id));
    expect(hit).toEqual([]);
  });

  test('virtual window can jump near one million rows with estimated geometry', () => {
    const state = createInitialVirtualState();
    const window = buildVirtualWindow({
      estimatedRowHeightPx: state.estimatedRowHeightPx,
      overscan: 4,
      rowCount: 1_000_000,
      rowHeightsByDisplayIndex: {},
      scrollTopPx: 999_900 * state.estimatedRowHeightPx,
      viewportHeightPx: state.estimatedRowHeightPx * 10
    });

    expect(window.start).toBeGreaterThanOrEqual(999_896);
    expect(window.end).toBeLessThanOrEqual(999_915);
    expect(window.bottomSpacerPx).toBeGreaterThan(0);
  });

  test('invariants reject duplicate source row ids', () => {
    const core = createTableCoreStateFromRuntime({
      columns,
      rows: [row('r1', ['Alpha', 'A']), row('r1', ['Duplicate', 'B'])]
    });

    expect(() => assertTableInvariants(core)).toThrow(/duplicate_row_id/);
  });
});
