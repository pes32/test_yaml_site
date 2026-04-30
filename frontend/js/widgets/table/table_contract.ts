import type {
    Component,
    ComponentPublicInstance,
    ComputedRef,
    Ref,
    ToRefs
} from 'vue';
import type {
    AttrConfigMap,
    AttrConfigRecord,
    CommonWidgetAttrs,
    LegacyYamlAttrCompat
} from '../../shared/attr_config.ts';
import type { UnknownRecord } from '../../shared/object_record.ts';
import type { TableWidgetSetupMethodKey } from './table_setup_keys.ts';
export type { UnknownRecord } from '../../shared/object_record.ts';
export type { TableWidgetSetupMethodKey } from './table_setup_keys.ts';
export type WidgetAttrsMap = AttrConfigMap;
export type TableWidgetConfig = CommonWidgetAttrs & LegacyYamlAttrCompat & {
    abc?: boolean;
    data?: unknown;
    lazy_chunk_size?: number | string;
    lazy_fail_full_load?: boolean;
    line_numbers?: boolean;
    row?: number | string;
    sort?: boolean;
    source?: unknown;
    sticky_header?: boolean;
    table_attrs?: unknown;
    toolbar?: boolean;
    zebra?: boolean;
};
export type TableRowIdentity = string;
export type TableRowId = TableRowIdentity;
export type TableColumnKey = string;
export type TableCellAddress = { c: number; r: number };
export type TableCoreCellAddress = { colKey: TableColumnKey; rowId: TableRowId };
export type TableCellMetaKey = string;
export type TableHorizontalAlign = 'left' | 'center' | 'right';
export type TableVerticalAlign = 'top' | 'middle' | 'bottom';
export type TableCellDataType =
    | 'general'
    | 'text'
    | 'int'
    | 'float'
    | 'exponent'
    | 'date'
    | 'time'
    | 'datetime'
    | 'ip'
    | 'ip_mask';
export type TableCellStyleMeta = {
    bold?: boolean;
    fillColor?: string | null;
    fontSize?: number | null;
    horizontalAlign?: TableHorizontalAlign | null;
    italic?: boolean;
    strike?: boolean;
    textColor?: string | null;
    underline?: boolean;
    verticalAlign?: TableVerticalAlign | null;
};
export type TableCellTypeMeta = {
    precision?: number | null;
    thousands?: boolean;
    type?: TableCellDataType | null;
};
export type TableCellMeta = {
    dataType?: TableCellTypeMeta;
    style?: TableCellStyleMeta;
};
export type TableCellMetaMap = Record<TableCellMetaKey, TableCellMeta>;
export type TableToolbarState = {
    activeButtons: string[];
    canApplyNumericFormat: boolean;
    fontSize: number;
    precision: number | null;
    thousands: boolean;
    type: TableCellDataType;
    typeLocked: boolean;
};
export type TableSelectionRect = { c0: number; c1: number; r0: number; r1: number };
export type TableSortDirection = 'asc' | 'desc';
export type TableSortState = { col: number; dir: TableSortDirection };
export type TableCoreSortState = { colKey: TableColumnKey; dir: TableSortDirection };
export type TableHeaderCell = {
    colspan: number;
    label: string;
    leafColIndex: number | null;
    rowspan: number;
    runtimeColIndex: number | null;
    width?: string | null;
};
export type TableRuntimeColumn = {
    attr?: string | null;
    embeddedWidget?: boolean;
    format?: string | null;
    isLineNumber?: boolean;
    label?: string;
    multiselect?: boolean;
    number?: number | null;
    readonly?: boolean;
    runtimeColIndex?: number;
    source?: string | null;
    tableCellOptions?: TableCellOptions;
    type?: string;
    widgetConfig?: TableColumnAttrConfig;
    widgetRef?: string | null;
    width?: string | null;
};
export type TableCoreColumn = TableRuntimeColumn & {
    columnKey: TableColumnKey;
};
export type TableColumnAttrConfig = Partial<AttrConfigRecord> & {
    columns?: unknown[];
    editable?: boolean;
    multiselect?: boolean;
    placeholder?: unknown;
    readonly?: boolean;
};
export type TableCellOptions = {
    columns?: unknown[];
    default?: unknown;
    editable?: boolean;
    err_text?: unknown;
    multiselect?: boolean;
    placeholder?: unknown;
    regex?: unknown;
    source?: unknown;
};
export type TableCellWidgetConfig = TableCellOptions & {
    label: unknown;
    readonly: boolean;
    sup_text: string;
    table_cell_mode: true;
    table_cell_tab_handler: (shiftKey?: boolean) => boolean | void;
    table_cell_ui_lock_handler: (locked: boolean) => void;
    table_cell_validation_handler: (message: unknown) => void;
    table_consume_keys: string;
    value: unknown;
    widget: string | undefined;
};
export type TableCellWidgetPayload = UnknownRecord & {
    value?: unknown;
};
export type TableCellWidgetInstance = ComponentPublicInstance & {
    onArrowClick?: () => void;
    openDatePicker?: () => void;
    openPicker?: () => void;
    openTimePicker?: () => void;
    toggleDropdown?: () => void;
    [key: string]: unknown;
};
export type TableCellDisplayActionKind = 'date' | 'list' | 'time' | string;
export type TableCellDisplayAction = {
    icon: string;
    kind: TableCellDisplayActionKind;
    label: string;
};
export type TableLeafMeta = {
    isLineNumber: boolean;
    leafColIndex: number | null;
    runtimeColIndex: number;
};
export type TableSchema = {
    dependencies: string[];
    headerRows: TableHeaderCell[][];
    isLineNumbersEnabled: boolean;
    leafColumns: TableRuntimeColumn[];
    leafToRuntimeCol: number[];
    runtimeColumns: TableRuntimeColumn[];
    runtimeToLeafMeta: TableLeafMeta[];
};
export type TableDataRow = { cells: unknown[]; id: TableRowIdentity };
export type TableGroupDisplayRow = {
    colIndex: number;
    columnLabel: string;
    depth: number;
    kind: 'group';
    label: string;
    level: number;
    pathKey: string;
    value: string;
};
export type TableDataDisplayRow = {
    dataIndex: number;
    depth: number;
    kind: 'data';
    pathKey: string;
    rowId: TableRowIdentity;
};
export type TableDisplayRow = TableDataDisplayRow | TableGroupDisplayRow;
export type TableGroupingState = { expanded: Set<string>; levels: number[] };
export type TableSelectionState = {
    anchor: TableCellAddress;
    focus: TableCellAddress;
    fullHeightCols?: { c0: number; c1: number } | null;
    fullWidthRows: { r0: number; r1: number } | null;
};
export type TableCoreSelectionState = {
    anchor: TableCoreCellAddress | null;
    focus: TableCoreCellAddress | null;
    fullHeightColumnKeys?: TableColumnKey[] | null;
    fullWidthRowIds: TableRowId[] | null;
};
export type TableEditingSession = { activeCell: TableCellAddress | null };
export type TableCoreEditingSession = {
    activeCell: TableCoreCellAddress | null;
    draftValue: unknown;
    validationErrors: Record<string, string>;
};
export type TableContextMenuTarget = { kind: 'body'; col: number; row: number } | { kind: 'header'; col: number };
export type TableContextMenuSnapshot = {
    anchorCol: number;
    anchorColumnKey?: TableColumnKey | null;
    anchorRow: number;
    anchorRowId?: TableRowId | null;
    anchorSourceRow?: number | null;
    bodyMode: 'cell' | 'cells' | 'row' | null;
    groupingLevelsSnapshot: number[];
    groupingLevelKeysSnapshot?: TableColumnKey[];
    headerCol: number | null;
    headerColumnKey?: TableColumnKey | null;
    lineNumbersEnabled: boolean;
    pasteAnchor: TableCellAddress;
    pasteAnchorColumnKey?: TableColumnKey | null;
    pasteAnchorRowId?: TableRowId | null;
    rect: TableSelectionRect;
    selectionSnapshot?: TableCoreSelectionState;
    sessionId: number;
    sortKeys: TableSortState[];
    sortKeyColumnsSnapshot?: TableCoreSortState[];
    stickyHeaderEnabled: boolean;
    wordWrapEnabled: boolean;
};
export type TableContextMenuItem = {
    disabled: boolean;
    icon: string | null;
    iconClass?: string;
    id: string;
    kbd: string;
    label: string;
    separatorBefore: boolean;
    visible: boolean;
};
export type TableContextMenuState = {
    context: TableContextMenuSnapshot | null;
    open: boolean;
    position: { x: number; y: number };
    sessionId: number;
    target: TableContextMenuTarget | null;
};
export type TableClipboardPayload = { matrix: unknown[][]; pasteAnchor: TableCellAddress; rect: TableSelectionRect };
export type TableCoreContextMenuState = { context: TableContextMenuSnapshot | null; open: boolean; sessionId: number };
export type TableCoreCellPatch = { cell: TableCoreCellAddress; value: unknown };
export type TableCoreState = {
    activeCell: TableCoreCellAddress | null;
    columns: TableCoreColumn[];
    contextMenu: TableCoreContextMenuState;
    editing: TableCoreEditingSession | null;
    grouping: { expanded: Set<string>; levelKeys: TableColumnKey[] };
    rows: TableDataRow[];
    selection: TableCoreSelectionState;
    sortKeys: TableCoreSortState[];
};
export type TableCommand =
    | { type: 'SET_ACTIVE_CELL'; cell: TableCoreCellAddress | null }
    | { type: 'SET_SELECTION_RECT'; anchor: TableCoreCellAddress | null; focus: TableCoreCellAddress | null; fullHeightColumnKeys?: TableColumnKey[] | null; fullWidthRowIds?: TableRowId[] | null }
    | { type: 'ENTER_EDIT_MODE'; cell: TableCoreCellAddress; draftValue: unknown }
    | { type: 'COMMIT_EDIT'; value: unknown }
    | { type: 'CANCEL_EDIT' }
    | { type: 'PATCH_CELLS'; patches: TableCoreCellPatch[] }
    | { type: 'REPLACE_ROWS'; rows: TableDataRow[] }
    | { type: 'INSERT_ROWS'; afterRowId?: TableRowId | null; beforeRowId?: TableRowId | null; rows: TableDataRow[] }
    | { type: 'DELETE_ROWS'; rowIds: TableRowId[] }
    | { type: 'MOVE_ROW'; delta: number; rowId: TableRowId }
    | { type: 'PASTE_TSV'; anchor: TableCoreCellAddress; appendRows?: TableDataRow[]; matrix: unknown[][]; mutableColKeys?: TableColumnKey[] | null; targetRowIds?: TableRowId[] | null }
    | { type: 'SORT_COLUMNS'; sortKeys: TableCoreSortState[] }
    | { type: 'CLEAR_SORT'; colKey?: TableColumnKey | null }
    | { type: 'ADD_GROUP_LEVEL'; colKey: TableColumnKey }
    | { type: 'REMOVE_GROUP_LEVEL'; colKey: TableColumnKey }
    | { type: 'SET_GROUP_LEVELS'; colKeys: TableColumnKey[]; expandedPathKeys?: string[] }
    | { type: 'SET_GROUP_EXPANDED'; expandedPathKeys: string[] }
    | { type: 'REBUILD_GROUPING' }
    | { type: 'APPEND_LOADED_ROWS'; rows: TableDataRow[] }
    | { type: 'OPEN_CONTEXT_MENU'; snapshot: TableContextMenuSnapshot }
    | { type: 'CLOSE_CONTEXT_MENU' };
export type TableViewModel = {
    displayIndexToRowId: Array<TableRowId | null>;
    displayRows: TableDisplayRow[];
    orderedRowIds: TableRowId[];
    rowIdToDisplayIndex: Map<TableRowId, number>;
    rowIdToSourceIndex: Map<TableRowId, number>;
    validPathKeys: Set<string>;
};
export type TableEditorHandle = {
    blur?: () => void;
    commitDraft: () => unknown;
    commitPendingState: (context: { colKey: TableColumnKey; rowId: TableRowId }) => unknown;
    focus: () => void;
    getValue: () => unknown;
    setValue: (value: unknown) => void;
};
export type TableLazyLoadState = {
    isFullyLoaded: boolean;
    isLoadingChunk: boolean;
    lazyEnabled: boolean;
    lazyPendingRows: TableDataRow[];
    lazySessionId: number;
};
export type TableMeasurementState = {
    stickyPinnedRowCount: number;
    stickyPinnedTableWidth: number;
    stickyPinnedWidthsByRow: number[][] | null;
    stickyTheadPinned: boolean;
};
export type TableStickyState = TableMeasurementState & { headerRuntimeEnabled: boolean };
export type TableValidationState = { cellErrors: Record<string, string> };
export type TableViewRuntimeState = { lineNumbersRuntimeEnabled: boolean; wordWrapRuntimeEnabled: boolean };
export type TableMetadataState = { cellMetaByKey: TableCellMetaMap };
export type TableWidthsState = {
    initialByColumnKey: Record<TableColumnKey, string | null>;
    overrideByColumnKey: Record<TableColumnKey, string | null>;
};
export type TableHistorySnapshot = {
    cellMetaByKey: TableCellMetaMap;
    groupingState: TableGroupingState;
    rows: TableDataRow[];
    selection: TableCoreSelectionState;
    sortKeys: TableSortState[];
    validationErrors: Record<string, string>;
    widthOverridesByColumnKey: Record<TableColumnKey, string | null>;
};
export type TableHistoryEntry = {
    after: TableHistorySnapshot;
    before: TableHistorySnapshot;
    label: string;
};
export type TableHistoryState = {
    future: TableHistoryEntry[];
    past: TableHistoryEntry[];
};
export type TableRuntimeErrorSeverity = 'fatal' | 'recoverable';
export type TableRuntimeError = {
    cause?: unknown;
    code: string;
    details?: UnknownRecord;
    message: string;
    severity: TableRuntimeErrorSeverity;
};
export type TableRuntimeServices = {
    getAllAttrsMap(): WidgetAttrsMap;
    getListOptions(sourceName: string): unknown[];
    handleRecoverableError(error: TableRuntimeError): void;
    notify(message: string, type?: string): void;
    reportError(error: TableRuntimeError): void;
};
export type TableStore = {
    editing: TableEditingSession;
    grouping: { state: TableGroupingState };
    loading: TableLazyLoadState & { tableUiLocked: boolean };
    meta: TableMetadataState;
    menu: TableContextMenuState;
    selection: TableSelectionState;
    sorting: { sortKeys: TableSortState[] };
    sticky: TableStickyState;
    validation: TableValidationState;
    view: TableViewRuntimeState;
    widths: TableWidthsState;
    history: TableHistoryState;
};
export type TableRuntimeRefs = Record<string, Element | ComponentPublicInstance | Array<Element | ComponentPublicInstance> | null | undefined> & {
    contextMenuEl?: HTMLElement | null;
    lazySentinelRow?: HTMLTableRowElement | null;
    tableRoot?: HTMLTableElement | null;
    tableThead?: HTMLTableSectionElement | null;
    tableToolbarHost?: HTMLElement | null;
};
export type TableRuntimeDomSurface = {
    $el?: Element | null;
    $emit: (event: 'input', payload?: unknown) => void;
    $nextTick: <T = void>(callback?: () => T) => Promise<unknown>;
    $refs: TableRuntimeRefs;
    $root?: (ComponentPublicInstance & { showNotification?: (message: string, type?: string) => void }) | null;
};
export type TableRuntimeState = {
    _contextMenuClickHandler: ((event: Event) => void) | null;
    _contextMenuKeydownHandler: ((event: KeyboardEvent) => void) | null;
    _lazyDebounceTimer: ReturnType<typeof setTimeout> | null;
    _lazyObserver: IntersectionObserver | null;
    _pasteInProgress: boolean;
    _shiftAnchorLocked: boolean;
    _shiftSelectGesture: boolean;
    _stickyOnScroll: (() => void) | null;
    _stickyPinnedRowCount: number;
    _stickyPinnedTableWidth: number;
    _stickyPinnedWidthsByRow: number[][] | null;
    _stickyRaf: number;
    _stickyRo: ResizeObserver | null;
    _stickyScrollRoot: Element | null;
    _stickyTheadPinned: boolean;
    _tableContextMenuMouseDown: boolean;
    _tableFocusWithin: boolean;
    _tableProgrammaticFocus: boolean;
    cellValidationErrors: Record<string, string>;
    contextMenuContext: TableContextMenuSnapshot | null;
    contextMenuOpen: boolean;
    contextMenuPosition: { x: number; y: number };
    contextMenuSessionId: number;
    contextMenuTarget: TableContextMenuTarget | null;
    editingCell: TableCellAddress | null;
    getAllAttrsMapFromRuntime: (() => WidgetAttrsMap) | null;
    handleRecoverableAppErrorFromRuntime: ((error: unknown, context?: UnknownRecord) => void) | null;
    headerRows: TableHeaderCell[][];
    selectedRowIndex: number;
    selAnchor: TableCellAddress;
    selFocus: TableCellAddress;
    selFullHeightCols: { c0: number; c1: number } | null;
    selFullWidthRows: { r0: number; r1: number } | null;
    showAppNotificationFromRuntime: ((message: string, type?: string) => void) | null;
    tableColumns: TableRuntimeColumn[];
    tableData: TableDataRow[];
    tablePageBridge: TableRuntimeServices;
    tableSchema: TableSchema | null;
    tableStore: TableStore;
    value: unknown[];
};
export type TableRuntimePropsSurface = { widgetConfig: TableWidgetConfig; widgetName: string };
export type TableRuntimeComputed = {
    _lazyPendingRows: TableDataRow[];
    columnLetterLabels: string[];
    contextMenuItems: TableContextMenuItem[];
    canRedo: boolean;
    canUndo: boolean;
    displayRows: TableDisplayRow[];
    groupingActive: boolean;
    groupingState: TableGroupingState;
    hasColumnLetters: boolean;
    hasColumnNumbers: boolean;
    hasExplicitTableWidth: boolean;
    headerSortEnabled: boolean;
    isEditable: boolean;
    isFullyLoaded: boolean;
    isLoadingChunk: boolean;
    lazyEnabled: boolean;
    lazySessionId: number;
    lineNumbersRuntimeEnabled: boolean;
    runtimeColumnKeyList: string[];
    sortColumnIndex: number | null;
    sortDirection: TableSortDirection;
    sortKeys: TableSortState[];
    stickyHeaderEnabled: boolean;
    stickyHeaderRuntimeEnabled: boolean;
    tableRowIdToDataIndex: Map<TableRowIdentity, number>;
    tableViewModel: TableViewModel;
    tableInlineStyle: Record<string, string | number>;
    tableLazyUiActive: boolean;
    tableMinRowCount: number;
    toolbarState: TableToolbarState;
    tableUiLocked: boolean;
    tableZebra: boolean;
    toolbarEnabled: boolean;
    wordWrapEnabled: boolean;
    wordWrapRuntimeEnabled: boolean;
};
export type TableRuntimeComputedRefs = {
    readonly [K in keyof TableRuntimeComputed]: ComputedRef<TableRuntimeComputed[K]>;
};
export type TableShowErrorOptions = { cause?: unknown; details?: unknown };
export type TableRuntimeMethod = CallableFunction;
export type TableRuntimeMethodSubset<This = TableRuntimeVm> = Record<string, TableRuntimeMethod> &
    ThisType<This>;
export type TableRuntimeMethodContracts = {
    _detachContextMenuGlobalListeners(): void;
    _scheduleStickyTheadUpdate(): void;
    _updateStickyThead(): void;
    _teardownLazyObserver(): void;
    _unbindStickyThead(): void;
    canMutateColumnIndex(colIndex: number): boolean;
    columnLetter(index: number): string;
    applyCellDataTypeToSelection(type: TableCellDataType): void;
    applyCellStylePatchToSelection(patch: TableCellStyleMeta): void;
    applyPrecisionDeltaToSelection(delta: number): void;
    applyTableAutoWidthToSelection(): void;
    captureHistorySnapshot(): TableHistorySnapshot;
    captureInitialTableWidths(): void;
    canApplyNumericFormatToSelection(): boolean;
    cellDisplayActionsByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn): TableCellDisplayAction[];
    cellDisplayActionsClassByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn): unknown;
    cellDisplayClassByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn): unknown;
    cellDisplayTextClassByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn): unknown;
    cellTdStyleByIdentity(rowId: string, colKey: string, fallbackRow: number, fallbackCol: number): Record<string, string>;
    cellUsesEmbeddedWidgetByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn): boolean;
    cellUsesNativeInputByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn): boolean;
    cellVisualTextStyleByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn | null | undefined): Record<string, string>;
    cellWidgetComponentByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn): Component | null;
    coreCellFromDisplay(rowIndex: number, colIndex: number): TableCoreCellAddress | null;
    effectiveCellColumnByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn | null | undefined): TableRuntimeColumn | null;
    effectiveCellTypeByIdentity(rowId: string, colKey: string, fallbackCol: number, column: TableRuntimeColumn): string;
    dataRowByIdentity(rowId: string): TableDataRow | null;
    displayCellFromIdentity(rowId: string, colKey: string, fallback: TableCellAddress): TableCellAddress;
    dispatchTableCoreCommand(command: TableCommand, phase?: string, options?: Record<string, unknown>): TableCoreState;
    emptyCellValueForColumn(colIndex: number): unknown;
    buildSelectionSnapshotFromDisplay(): TableCoreSelectionState;
    clearAllCellOverflowHints(): void;
    computeBodyModeForMenu(): 'cell' | 'cells' | 'row' | null;
    getAllAttrsMap(): WidgetAttrsMap;
    getColumnAttrConfig(column: TableRuntimeColumn | null | undefined): TableColumnAttrConfig;
    getColumnTableCellOptions(column: TableRuntimeColumn | null | undefined): Record<string, unknown>;
    getListOptions(sourceName: unknown): unknown[];
    getSelRect(): TableSelectionRect;
    isLineNumberColumn(column: TableRuntimeColumn | null | undefined): boolean;
    listColumnIsMultiselect(column: TableRuntimeColumn | null | undefined): boolean;
    navigateTableByTabFromCell(rowIndex: number, cellIndex: number, shiftKey: boolean): boolean | void;
    normCol(col: number): number;
    normRow(row: number): number;
    normalizeCellWidgetValue(column: TableRuntimeColumn | null | undefined, currentValue: unknown): unknown;
    onCellWidgetValidation(rowIndex: number, cellIndex: number, message: unknown): void;
    onColumnLetterHeaderClick(event: MouseEvent, colIndex: number): void;
    onTableToolbarAction(action: string, value?: unknown): void;
    tableToolbarState(): TableToolbarState;
    redoTableAction(): void;
    recordHistoryEntry(label: string, before: TableHistorySnapshot, after: TableHistorySnapshot): void;
    resetTableWidthsForSelection(): void;
    onHeaderSortClick(colIdx: number | null | undefined, event?: { shiftKey?: boolean }): void;
    onInput(): void;
    onTableHeaderContextMenu(event: MouseEvent, rowIndex: number, cell: TableHeaderCell | null, colIndex: number | null | undefined): void;
    safeCell(row: unknown, colIndex: number): unknown;
    runtimeColumnKey(colIndex: number): string;
    runtimeColumnKeys(): string[];
    runtimeColumnWidth(columnIndex: number): string | null;
    runtimeSortKeySnapshots(): TableCoreSortState[];
    selectAllTable(): TableCellAddress;
    selectFullRow(row: number, focusCol?: number): TableCellAddress;
    selectedDataRowIdFromViewRow(viewRow: number): string | null;
    selectedMutableCoreCells(): TableCoreCellAddress[];
    setSelFullHeightColSpan(c0: number, c1: number): TableCellAddress;
    restoreHistorySnapshot(snapshot: TableHistorySnapshot): void;
    runWithHistory(label: string, action: () => void): void;
    toggleLineNumbersFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    toggleThousandsForSelection(): void;
    undoTableAction(): void;
    refreshGroupingViewFromData(): void;
    syncRuntimeFromCoreState(coreState: TableCoreState, options?: Record<string, unknown>): void;
    tableCellConsumeKeys(column: TableRuntimeColumn | null | undefined): string;
    tableCoreStateSnapshot(): TableCoreState;
    tableViewModelSnapshot(coreState?: TableCoreState | null): TableViewModel;
};
export type TableWidgetPublicRuntimeMethods = {
    dispatchTableCommand(command: string | TableCommand, payload?: Record<string, unknown>, phase?: string, options?: Record<string, unknown>): unknown;
    getTableEl(): HTMLTableElement | null;
    getValue(): unknown[][];
    initializeTable(): void;
    onTableEditableKeydown(event: KeyboardEvent): void;
    setValue(value: unknown): void;
};
export type TableRuntimeMethods = Record<string, TableRuntimeMethod> &
    TableRuntimeMethodContracts &
    TableWidgetPublicRuntimeMethods;
export type TableWidgetEmit = (event: 'input', payload: unknown) => void;
export type TableWidgetVm = TableRuntimeState & TableRuntimePropsSurface & TableRuntimeComputed;
export type TableRuntimeVm = TableRuntimeDomSurface & TableWidgetVm & TableRuntimeMethods;
export type TableWidgetSetupMethods = Pick<TableRuntimeMethods, TableWidgetSetupMethodKey>;
export type TableSelectionRuntimeSurface = Pick<
    TableRuntimeState,
    | '_tableFocusWithin'
    | 'selAnchor'
    | 'selFocus'
    | 'selFullHeightCols'
    | 'selFullWidthRows'
    | 'tableColumns'
    | 'tableData'
> &
    Pick<TableRuntimeComputed, 'columnLetterLabels' | 'isEditable' | 'tableUiLocked'> & {
        $nextTick: <T = void>(callback?: () => T) => Promise<unknown>;
        blankCellValueForColumn(colIndex: number): unknown;
        canMutateColumnIndex(colIndex: number): boolean;
        cellHasCommitError(row: number, col: number): boolean;
        dispatchTableCoreCommand(command: TableCommand, phase?: string, options?: Record<string, unknown>): unknown;
        emptyCellValueForColumn(colIndex: number): unknown;
        exitCellEdit(): void;
        focusSelectionCell(row: number, col: number): void;
        getSelectionCellCount(): number;
        getSelRect(): TableSelectionRect;
        isCellInSelection(row: number, col: number): boolean;
        isLineNumberColumn(column: TableRuntimeColumn | null | undefined): boolean;
        isMultiCellSelection(): boolean;
        listColumnIsMultiselect(column: TableRuntimeColumn | null | undefined): boolean;
        normCol(col: number): number;
        normRow(row: number): number;
        selectionIsFullRowBlock(): boolean;
        selectionIsFullColumnBlock(): boolean;
        selectAllTable(): TableCellAddress;
        tableViewModelSnapshot(): TableViewModel;
        tbodyRowCount(): number;
        setSelFullHeightColSpan(c0: number, c1: number): TableCellAddress;
    };
export type TableStickyRuntimeSurface = TableRuntimeDomSurface &
    Pick<
        TableRuntimeState,
        | '_stickyOnScroll'
        | '_stickyPinnedRowCount'
        | '_stickyPinnedTableWidth'
        | '_stickyPinnedWidthsByRow'
        | '_stickyRaf'
        | '_stickyRo'
        | '_stickyScrollRoot'
        | '_stickyTheadPinned'
        | 'headerRows'
        | 'tableColumns'
    > & {
        stickyHeaderEnabled: TableRuntimeComputed['stickyHeaderEnabled'];
        onHeaderSortClick(colIdx: number | null | undefined, event?: { shiftKey?: boolean }): void;
        onTableHeaderContextMenu(event: MouseEvent, rowIndex: number, cell: TableHeaderCell | null, colIndex: number | null | undefined): void;
    };
export type TableWidgetSetupBindings = ToRefs<TableRuntimeState> &
    { readonly widgetConfig: Ref<TableWidgetConfig>; readonly widgetName: Ref<string> } &
    TableRuntimeComputedRefs &
    TableWidgetSetupMethods;
export type TableWidgetPublicSurface = {
    readonly contextMenuOpen: boolean;
    readonly stickyHeaderEnabled: boolean;
    readonly tableData: TableDataRow[];
} & TableWidgetPublicRuntimeMethods;
export type TableRuntimeComputedGetter<T> = (this: TableRuntimeVm) => T;
export type TableRuntimeComputedDefinition<T> =
    | TableRuntimeComputedGetter<T>
    | { get: TableRuntimeComputedGetter<T>; set?: (this: TableRuntimeVm, value: T) => void };
export type TableRuntimeComputedDefinitions = {
    [K in keyof TableRuntimeComputed]: TableRuntimeComputedDefinition<TableRuntimeComputed[K]>;
};
export type TableRuntimeWatchHandlers = {
    stickyHeaderEnabled(this: TableRuntimeVm, value: TableRuntimeComputed['stickyHeaderEnabled']): void;
    tableLazyUiActive(this: TableRuntimeVm, value: TableRuntimeComputed['tableLazyUiActive']): void;
    widgetConfig(this: TableRuntimeVm): void;
    widgetName(this: TableRuntimeVm): void;
};
