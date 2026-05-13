/**
 * Внутренний barrel: импортировать только из `frontend/js/widgets/table/**`.
 * Снаружи каталога не использовать — публичная граница по-прежнему `factory.ts` + `TableWidget.vue`.
 *
 * Явные re-export без `export *` (циклы, tree-shaking). Символы с одним каноническим
 * источником: `buildOrderedRowIds` / `coreSortToRuntimeSort` — из `table_sort_model`;
 * `rowIdAtDisplayIndex` и индексы display — из `table_view_model`.
 */

export {
    setTableValidationError,
    tableValidationKey,
    TABLE_RUNTIME_ERROR_CODES,
    createTableRuntimeError,
    normalizeTableRuntimeError
} from './table_errors.ts';
export {
    columnLetter,
    columnLettersForRuntimeColumns,
    firstUserColumnIndex
} from './table_column_navigation.ts';
export type { UserColumnRuntime } from './table_column_navigation.ts';

export { buildOrderedRowIds, coreSortToRuntimeSort } from './table_sort_model.ts';

export {
    buildTableViewModel,
    displayIndexForCell,
    emptyTableViewModel,
    rowAtDisplayIndex,
    rowIdAtDisplayIndex,
    sourceIndexAtDisplayIndex
} from './table_view_model.ts';

export {
    buildFlatDisplayRows,
    buildGroupedDisplayRows,
    buildRowIdToSourceIndex,
    groupRowIdsByColumn,
    sortedGroupKeys
} from './table_grouping_model.ts';
export type { TableDisplayProjection } from './table_grouping_model.ts';

export {
    appendRowsDedup,
    normalizeLazyChunkSize,
    splitLazyInitialRows,
    takeLazyChunk
} from './table_lazy_load_model.ts';
export type { LazyAppendResult } from './table_lazy_load_model.ts';

export {
    buildContextMenuSnapshot,
    isContextMenuSnapshotCurrent
} from './table_context_menu_model.ts';
export type { BuildContextMenuSnapshotOptions } from './table_context_menu_model.ts';

export {
    appendHistoryEntry,
    cellMetaHistorySnapshotsEqual,
    cloneGroupingState,
    cloneFullHistoryEntry,
    cloneHistorySnapshot,
    cloneRowsForHistory,
    cloneSelectionState,
    snapshotsEqual
} from './table_history_model.ts';

export {
    TABLE_TOOLBAR_COLOR_COLUMNS,
    TABLE_TOOLBAR_DEFAULT_FILL_COLOR,
    TABLE_TOOLBAR_DEFAULT_FONT_SIZE,
    TABLE_TOOLBAR_DEFAULT_TEXT_COLOR,
    TABLE_TOOLBAR_FONT_SIZES,
    TABLE_TOOLBAR_STANDARD_COLORS,
    TABLE_TOOLBAR_TYPE_OPTIONS,
    createDefaultTableToolbarState,
    tableToolbarButtonTooltip,
    tableToolbarIconSrc
} from './table_toolbar_model.ts';
export type {
    TableToolbarButton,
    TableToolbarButtonState,
    TableToolbarTypeOption
} from './table_toolbar_model.ts';

export {
    commitEditorHandle,
    createDomTableEditorHandle,
    createEditingSession,
    isTableEditorHandle,
    resolveEditingBoundary
} from './table_editing_model.ts';
export type {
    TableEditingBoundaryKey,
    TableEditingBoundaryOptions,
    TableEditingBoundaryResult,
    TableEditorCommitContext
} from './table_editing_model.ts';

export {
    buildCoreSelectionFromDisplay,
    captureSelectionIdentity,
    coreCellToDisplay,
    displayCellFromCoreIdentity,
    displayCellToCore,
    displaySelectionFromSnapshot,
    fallbackSelectionFromSnapshot,
    fullWidthRowIdsFromDisplay,
    fullHeightColumnKeysFromDisplay,
    normalizeDisplayCell,
    runtimeDisplaySelection,
    restoreDisplaySelectionFromCore,
    restoreSelectionIdentity,
    setSelectionCommandFromCore,
    selectionRectFromDisplay,
    selectionRectFromSnapshot
} from './table_selection_model.ts';
export type { TableSelectionIdentity } from './table_selection_model.ts';

export {
    AUTO_WIDTH_MAX,
    AUTO_WIDTH_MIN,
    autoFitHeaderWidth,
    autoFitColumnWidth,
    captureInitialColumnWidths,
    headerSortAffordancePx,
    measureAutoFitHeaderWidthPx,
    resolveRuntimeColumnWidth
} from './table_width_model.ts';
export type { AutoFitCellSample } from './table_width_model.ts';
