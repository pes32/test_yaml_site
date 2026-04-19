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

type WidgetAttrsMap = AttrConfigMap;
type TableAttrsMap = WidgetAttrsMap;

type TableWidgetAttrs = {
    data?: unknown;
    lazy_chunk_size?: number | string;
    lazy_fail_full_load?: boolean;
    line_numbers?: boolean;
    row?: number | string;
    sort?: boolean;
    source?: unknown;
    sticky_header?: boolean;
    table_attrs?: unknown;
    table_lazy?: boolean;
    zebra?: boolean;
};

type TableWidgetConfig = CommonWidgetAttrs & TableWidgetAttrs & LegacyYamlAttrCompat;

type TableRowIdentity = string;

type TableCellAddress = {
    c: number;
    r: number;
};

type TableSelectionRect = {
    c0: number;
    c1: number;
    r0: number;
    r1: number;
};

type TableSortDirection = 'asc' | 'desc';

type TableSortState = {
    col: number;
    dir: TableSortDirection;
};

type TableHeaderCell = {
    colspan: number;
    label: string;
    leafColIndex: number | null;
    rowspan: number;
    runtimeColIndex: number | null;
    width?: string | null;
};

type TableRuntimeColumn = {
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

type TableColumnAttrConfig = Partial<AttrConfigRecord> & {
    columns?: unknown[];
    editable?: boolean;
    multiselect?: boolean;
    placeholder?: unknown;
    readonly?: boolean;
};

type TableCellOptions = {
    columns?: unknown[];
    default?: unknown;
    editable?: boolean;
    err_text?: unknown;
    multiselect?: boolean;
    placeholder?: unknown;
    regex?: unknown;
    source?: unknown;
};

type TableCellWidgetConfig = TableCellOptions & {
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

type TableCellWidgetPayload = UnknownRecord & {
    value?: unknown;
};

type TableCellWidgetInstance = ComponentPublicInstance & {
    onArrowClick?: () => void;
    openDatePicker?: () => void;
    openPicker?: () => void;
    openTimePicker?: () => void;
    toggleDropdown?: () => void;
    [key: string]: unknown;
};

type TableCellWidgetRegistryKey =
    | 'dateCellWidget'
    | 'datetimeCellWidget'
    | 'floatCellWidget'
    | 'intCellWidget'
    | 'ipCellWidget'
    | 'ipMaskCellWidget'
    | 'listCellWidget'
    | 'stringCellWidget'
    | 'timeCellWidget'
    | 'vocCellWidget';

type TableCellWidgetRegistry = Record<TableCellWidgetRegistryKey, Component>;

type TableCellDisplayActionKind = 'date' | 'list' | 'time' | string;

type TableCellDisplayAction = {
    icon: string;
    kind: TableCellDisplayActionKind;
    label: string;
};

type TableLeafMeta = {
    isLineNumber: boolean;
    leafColIndex: number | null;
    runtimeColIndex: number;
};

type TableSchema = {
    dependencies: string[];
    headerRows: TableHeaderCell[][];
    isLineNumbersEnabled: boolean;
    leafColumns: TableRuntimeColumn[];
    leafToRuntimeCol: number[];
    runtimeColumns: TableRuntimeColumn[];
    runtimeToLeafMeta: TableLeafMeta[];
};

type TableDataRow = {
    cells: unknown[];
    id: TableRowIdentity;
};

type TableGroupDisplayRow = {
    colIndex: number;
    columnLabel: string;
    depth: number;
    kind: 'group';
    label: string;
    level: number;
    pathKey: string;
    value: string;
};

type TableDataDisplayRow = {
    dataIndex: number;
    depth: number;
    kind: 'data';
    pathKey: string;
    rowId: TableRowIdentity;
};

type TableDisplayRow = TableDataDisplayRow | TableGroupDisplayRow;

type TableGroupingState = {
    expanded: Set<string>;
    levels: number[];
};

type TableGroupingViewCache = {
    displayRows: TableDisplayRow[];
    validPathKeys: Set<string>;
};

type TableSelectionState = {
    anchor: TableCellAddress;
    focus: TableCellAddress;
    fullWidthRows: { r0: number; r1: number } | null;
};

type TableEditingSession = {
    activeCell: TableCellAddress | null;
    validationErrors: Record<string, string>;
};

type TableContextMenuTarget =
    | {
          kind: 'body';
          col: number;
          row: number;
      }
    | {
          kind: 'header';
          col: number;
      };

type TableContextMenuSnapshot = {
    anchorCol: number;
    anchorRow: number;
    bodyMode: 'cell' | 'cells' | 'row' | null;
    groupingLevelsSnapshot: number[];
    headerCol: number | null;
    lineNumbersEnabled: boolean;
    pasteAnchor: TableCellAddress;
    rect: TableSelectionRect;
    sessionId: number;
    sortKeys: TableSortState[];
    stickyHeaderEnabled: boolean;
    wordWrapEnabled: boolean;
};

type TableContextMenuItem = {
    disabled: boolean;
    icon: string | null;
    iconClass?: string;
    id: string;
    kbd: string;
    label: string;
    separatorBefore: boolean;
    visible: boolean;
};

type TableContextMenuState = {
    context: TableContextMenuSnapshot | null;
    open: boolean;
    position: {
        x: number;
        y: number;
    };
    sessionId: number;
    target: TableContextMenuTarget | null;
};

type TableClipboardPayload = {
    matrix: unknown[][];
    pasteAnchor: TableCellAddress;
    rect: TableSelectionRect;
};

type TableLazyLoadState = {
    isFullyLoaded: boolean;
    isLoadingChunk: boolean;
    lazyEnabled: boolean;
    lazyPendingRows: TableDataRow[];
    lazySessionId: number;
};

type TableMeasurementState = {
    stickyPinnedRowCount: number;
    stickyPinnedTableWidth: number;
    stickyPinnedWidthsByRow: number[][] | null;
    stickyTheadPinned: boolean;
};

type TableFeatureFlags = {
    groupingActive: boolean;
    headerSortEnabled: boolean;
    isEditable: boolean;
    lazyUiActive: boolean;
    lineNumbersRuntimeEnabled: boolean;
    stickyHeaderEnabled: boolean;
    wordWrapEnabled: boolean;
};

type TableDerivedState = {
    displayRows: TableDisplayRow[];
    sortColumnIndex: number | null;
    sortDirection: TableSortDirection | null;
    tableInlineStyle: Record<string, string | number>;
};

type TableRenderState = {
    displayRows: TableDisplayRow[];
    headerRows: TableHeaderCell[][];
    tableColumns: TableRuntimeColumn[];
    tableData: TableDataRow[];
};

type TableRuntimeErrorSeverity = 'fatal' | 'recoverable';

type TableRuntimeError = {
    cause?: unknown;
    code: string;
    details?: UnknownRecord;
    message: string;
    severity: TableRuntimeErrorSeverity;
};

type TableRuntimeServices = {
    getAllAttrsMap(): WidgetAttrsMap;
    getListOptions(sourceName: string): unknown[];
    handleRecoverableError(error: TableRuntimeError): void;
    notify(message: string, type?: string): void;
    reportError(error: TableRuntimeError): void;
};

type TableStore = {
    contextMenu: TableContextMenuState;
    editing: TableEditingSession;
    grouping: {
        state: TableGroupingState;
        viewCache: TableGroupingViewCache | null;
    };
    loading: TableLazyLoadState & {
        tableUiLocked: boolean;
    };
    measurement: TableMeasurementState;
    preferences: {
        lineNumbersRuntimeEnabled: boolean;
        stickyHeaderRuntimeEnabled: boolean;
        wordWrapRuntimeEnabled: boolean;
    };
    selection: TableSelectionState;
    sorting: {
        sortKeys: TableSortState[];
    };
};

type TableRuntimeRefs = Record<string, Element | ComponentPublicInstance | Array<Element | ComponentPublicInstance> | null | undefined> & {
    contextMenuEl?: HTMLElement | null;
    lazySentinelRow?: HTMLTableRowElement | null;
    tableRoot?: HTMLTableElement | null;
    tableThead?: HTMLTableSectionElement | null;
};

type TableRuntimeDomSurface = {
    $el?: Element | null;
    $emit: (event: 'input', payload?: unknown) => void;
    $nextTick: <T = void>(callback?: () => T) => Promise<unknown>;
    $refs: TableRuntimeRefs;
    $root?: (ComponentPublicInstance & { showNotification?: (message: string, type?: string) => void }) | null;
};

type TableRuntimeState = {
    _contextMenuClickHandler: ((event: Event) => void) | null;
    _contextMenuKeydownHandler: ((event: KeyboardEvent) => void) | null;
    _lazyDebounceTimer: ReturnType<typeof setTimeout> | null;
    _lazyObserver: IntersectionObserver | null;
    _pasteInProgress: boolean;
    _shiftAnchorLocked: boolean;
    _shiftSelectGesture: boolean;
    _sortCycleRowOrder: TableDataRow[] | null;
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
    dateCellWidget: Component;
    datetimeCellWidget: Component;
    editingCell: TableCellAddress | null;
    floatCellWidget: Component;
    getAllAttrsMapFromRuntime: (() => WidgetAttrsMap) | null;
    handleRecoverableAppErrorFromRuntime: ((error: unknown, context?: UnknownRecord) => void) | null;
    headerRows: TableHeaderCell[][];
    intCellWidget: Component;
    ipCellWidget: Component;
    ipMaskCellWidget: Component;
    listCellWidget: Component;
    selectedRowIndex: number;
    selAnchor: TableCellAddress;
    selFocus: TableCellAddress;
    selFullWidthRows: { r0: number; r1: number } | null;
    showAppNotificationFromRuntime: ((message: string, type?: string) => void) | null;
    stringCellWidget: Component;
    tableColumns: TableRuntimeColumn[];
    tableData: TableDataRow[];
    tablePageBridge: TableRuntimeServices;
    tableSchema: TableSchema | null;
    tableStore: TableStore;
    timeCellWidget: Component;
    value: unknown[];
    vocCellWidget: Component;
};

type TableRuntimePropsSurface = {
    widgetConfig: TableWidgetConfig;
    widgetName: string;
};

type TableRuntimeComputed = {
    _lazyPendingRows: TableDataRow[];
    contextMenuItems: TableContextMenuItem[];
    displayRows: TableDisplayRow[];
    groupingActive: boolean;
    groupingState: TableGroupingState;
    groupingViewCache: TableGroupingViewCache | null;
    hasColumnNumbers: boolean;
    hasExplicitTableWidth: boolean;
    headerSortEnabled: boolean;
    isEditable: boolean;
    isFullyLoaded: boolean;
    isLoadingChunk: boolean;
    lazyEnabled: boolean;
    lazySessionId: number;
    lineNumbersRuntimeEnabled: boolean;
    sortColumnIndex: number | null;
    sortDirection: TableSortDirection;
    sortKeys: TableSortState[];
    stickyHeaderEnabled: boolean;
    stickyHeaderRuntimeEnabled: boolean;
    tableInlineStyle: Record<string, string | number>;
    tableLazyUiActive: boolean;
    tableMinRowCount: number;
    tableUiLocked: boolean;
    tableZebra: boolean;
    wordWrapEnabled: boolean;
    wordWrapRuntimeEnabled: boolean;
};

type TableRuntimeComputedRefs = {
    readonly [K in keyof TableRuntimeComputed]: ComputedRef<TableRuntimeComputed[K]>;
};

type TableMutationOptions = {
    force?: boolean;
    skipEmit?: boolean;
    skipGroupingSync?: boolean;
    skipGroupingViewRefresh?: boolean;
    skipSort?: boolean;
};

type TableShowErrorOptions = {
    cause?: unknown;
    details?: unknown;
};

type TableRuntimeMethods = {
    _appendRowsDedup(rows: unknown[]): void;
    _attachContextMenuGlobalListeners(): void;
    _bindStickyThead(): void;
    _detachContextMenuGlobalListeners(): void;
    _lazyChunkSize(): number;
    _openContextMenuPrepare(): void;
    _requestLazyChunk(): void;
    _scheduleStickyTheadUpdate(): void;
    _setupLazyObserver(): void;
    _teardownLazyObserver(): void;
    _unbindStickyThead(): void;
    _updateStickyThead(): void;
    activateCellEditorAction(row: number, col: number, actionKind: string, attempt?: number): void;
    activeCellCol(): number;
    addNewRow(): void;
    addRowAboveFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    addRowBelowFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    applyColumnSort(colIdx: number, direction: TableSortDirection): void;
    applyJumpExtendSelection(target: TableCellAddress | null | undefined, anchorRow: number, dr: number, dc: number): void;
    applyJumpNavigate(target: TableCellAddress | null | undefined): void;
    applyPasteMatrix(snapshot: TableContextMenuSnapshot, matrix: unknown[][]): void;
    applySortFromMenu(snapshot: TableContextMenuSnapshot, direction: TableSortDirection): void;
    applySortResetFromMenu(snapshot: TableContextMenuSnapshot): void;
    applyTableMutation(mutator: () => void, options?: TableMutationOptions): void;
    applyTrimToEditedTextCell(row: number, col: number): void;
    blankCellValueForColumn(colIndex: number): unknown;
    buildClipboardActionSnapshot(): TableContextMenuSnapshot;
    buildContextMenuSnapshot(kind: 'body' | 'header', anchorRow: number, anchorCol: number, headerCol: number | null): TableContextMenuSnapshot;
    canMutateColumnIndex(colIndex: number): boolean;
    cellAllowsEditing(rowIndex: number, colIndex: number): boolean;
    cellDisplayActionClass(action: TableCellDisplayAction | null | undefined): string[];
    cellDisplayActions(column: TableRuntimeColumn | null | undefined): TableCellDisplayAction[];
    cellDisplayActionsClass(column: TableRuntimeColumn | null | undefined): string[];
    cellDisplayClass(column: TableRuntimeColumn | null | undefined): Record<string, boolean>;
    cellDisplayKind(column: TableRuntimeColumn | null | undefined): string;
    cellDisplayTextClass(column: TableRuntimeColumn | null | undefined): string[];
    cellDisplayTextStyle(column: TableRuntimeColumn | null | undefined): Record<string, string>;
    cellHasCommitError(rowIndex: number, colIndex: number): boolean;
    cellSelectionOutlineStyle(r: number, c: number): Record<string, string>;
    cellTabindex(row: number, col: number): number;
    cellTdClass(row: number, col: number): Record<string, boolean>;
    cellUsesEmbeddedWidget(column: TableRuntimeColumn | null | undefined): boolean;
    cellUsesNativeInput(column: TableRuntimeColumn | null | undefined): boolean;
    cellWidgetComponent(column: TableRuntimeColumn | null | undefined): Component | null;
    cellWidgetConfig(rowIndex: number, cellIndex: number, column: TableRuntimeColumn): TableCellWidgetConfig;
    cellWidgetName(rowIndex: number, cellIndex: number): string;
    cellWidgetRefName(rowIndex: number, cellIndex: number): string;
    cellValidationKeyByDataIndex(dataIndex: number, colIndex: number): string;
    clearAllCellOverflowHints(): void;
    clearCellOverflowHint(event: Event): void;
    clearRectangleValues(rect: TableSelectionRect): void;
    clearSelectedCells(): void;
    clearSelectionFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    clampMenuPosition(event: MouseEvent): { x: number; y: number };
    cloneRect(rect: TableSelectionRect): TableSelectionRect;
    columnWidgetComponentByType(type: unknown): Component | null;
    computeAutoWidth(label: unknown): string;
    computeBodyModeForMenu(): TableContextMenuSnapshot['bodyMode'];
    computePasteAnchorRect(rect: TableSelectionRect): TableCellAddress;
    copySelection(snapshot: TableContextMenuSnapshot): void;
    cutSelection(snapshot: TableContextMenuSnapshot): void;
    dataRowByDisplayIndex(viewRow: number): TableDataRow | null;
    defaultCellValueForColumn(colIndex: number): unknown;
    defaultCellValueFromColumn(column: TableRuntimeColumn | null | undefined): unknown;
    deleteKeyboardSelectedRows(): void;
    deleteRowFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    duplicateRowAboveFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    duplicateRowBelowFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    duplicateTableRowRelative(rowIndex: number, where: 'above' | 'below', anchorCol?: number): void;
    emptyCellValueForColumn(colIndex: number): unknown;
    endProgrammaticFocusSoon(): void;
    ensureMinTableRows(): void;
    enterCellEditAt(row: number, col: number, options?: { caretEnd?: boolean }): void;
    exitCellEdit(): void;
    extendSelectionWithArrow(dr: number, dc: number): boolean;
    findCellOverflowContentEl(cellEl: Element | null | undefined): HTMLElement | null;
    flushLazyFullLoadInternal(): boolean;
    focusSelectionCell(row: number, col: number): void;
    focusSelectionCellWithRetry(row: number, col: number): void;
    formatCellValue(value: unknown, column: TableRuntimeColumn | null | undefined): string;
    getAllAttrsMap(): WidgetAttrsMap;
    getCellEditorActionElement(row: number, col: number, kind?: string): HTMLElement | null;
    getCellEditorElement(row: number, col: number): HTMLInputElement | HTMLSelectElement | HTMLElement | null;
    getCellWidgetInstance(row: number, col: number): TableCellWidgetInstance | null;
    getColumnAttrConfig(column: TableRuntimeColumn | null | undefined): TableColumnAttrConfig;
    getColumnTableCellOptions(column: TableRuntimeColumn | null | undefined): TableCellOptions;
    getListOptions(sourceName: string | null | undefined): unknown[];
    getSelRect(): TableSelectionRect;
    getSelectionCellCount(): number;
    getTableEl(): HTMLTableElement | null;
    getValue(): unknown[][];
    groupExpanded(pathKey: string): boolean;
    groupRowStyle(displayRow: TableDisplayRow | null | undefined): Record<string, string | number>;
    headerSortAffordancePx(): number;
    headerThStyle(cell: TableHeaderCell | null | undefined): Partial<Record<string, string>>;
    hideContextMenu(): void;
    iconSrc(name: unknown): string;
    initializeTable(): void;
    insertRowBelowFullSelection(): void;
    invokeCellWidgetAction(row: number, col: number, actionKind: string): boolean;
    isCellEditing(row: number, col: number): boolean;
    isCellInSelection(r: number, c: number): boolean;
    isExactFullRowR(r: number): boolean;
    isLeafHeaderRow(rIdx: number): boolean;
    isLineNumberColumn(column: TableRuntimeColumn | null | undefined): boolean;
    isMultiCellSelection(): boolean;
    isPasteAnchorInTable(snapshot: TableContextMenuSnapshot): boolean;
    isPrintableCellKey(event: KeyboardEvent): boolean;
    leafColStyle(column: TableRuntimeColumn | null | undefined): Partial<Record<string, string>>;
    lineNumberColumnIndex(): number;
    listColumnIsMultiselect(column: TableRuntimeColumn | null | undefined): boolean;
    listMultiFn(): (col: number) => boolean;
    makeEmptyRow(): TableDataRow;
    moveRowDownFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    moveRowUpFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    moveTableRowRelative(rowIndex: number, delta: number, anchorCol?: number): void;
    navigateTableByTabFromCell(row: number, col: number, shiftKey: boolean): boolean;
    normCol(c: number): number;
    normRow(r: number): number;
    normalizeCellWidgetValue(column: TableRuntimeColumn | null | undefined, currentValue: unknown): unknown;
    normalizeExternalRowsOrWarn(rows: unknown): TableDataRow[] | null;
    onBodyContextMenu(event: MouseEvent, row: number, col: number): void;
    onCellDisplayAction(row: number, col: number, actionKind: string): void;
    onCellFormat(rowIndex: number, cellIndex: number, column: TableRuntimeColumn | null | undefined): void;
    onCellInput(rowIndex: number, cellIndex: number, event: Event | { target?: { value?: unknown } } | unknown): void;
    onCellInputViewMouseDown(event: MouseEvent, row: number, col: number): void;
    onCellWidgetPayload(rowIndex: number, cellIndex: number, payload: TableCellWidgetPayload): void;
    onCellWidgetValidation(rowIndex: number, cellIndex: number, message: unknown): void;
    onContextMenuItemActivate(item: TableContextMenuItem): void;
    onCtxIconError(event: Event): void;
    onGroupAddLevelFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    onGroupClearFromSnapshot(): void;
    onHeaderSortClick(colIdx: number | null, event?: MouseEvent | KeyboardEvent | { shiftKey?: boolean }): void;
    onInput(): void;
    onIpInput(rowIndex: number, cellIndex: number, event: Event | { target?: { value?: unknown } } | unknown): void;
    onNativeCellBlur(row: number, col: number): void;
    onColumnNumberHeaderContextMenu(event: MouseEvent, colIndex: number): void;
    onGroupHeaderContextMenu(event: MouseEvent): void;
    onTableCellClick(event: MouseEvent, row: number, col: number): void;
    onTableCellDblClick(row: number, col: number): void;
    onTableCellMouseDown(event: MouseEvent, row: number, col: number): void;
    onTableContainerFocusIn(event: FocusEvent): void;
    onTableContainerFocusOut(event: FocusEvent): void;
    onTableEditableKeydown(event: KeyboardEvent): void;
    onTableHeaderContextMenu(event: MouseEvent, rowIndex: number, cell: TableHeaderCell | null | undefined, colIndex: number | null): void;
    onTbodyMouseDownCapture(event: MouseEvent): void;
    onTextCellBlur(row: number, col: number, column: TableRuntimeColumn | null | undefined): void;
    parseTableAttrs(tableAttrs: unknown): void;
    pasteFromClipboard(snapshot: TableContextMenuSnapshot): Promise<void>;
    patchCellValue(row: number, col: number, value: unknown): void;
    recalculateLineNumbers(): void;
    recalculateLineNumbersFromSnapshot(snapshot: TableContextMenuSnapshot): void;
    refreshGroupingViewFromData(): void;
    resolveDataRowIndex(viewRow: number): number;
    resolveTableLazyEnabled(rowCount: number): boolean;
    restoreSelectionByRowIds(focusRowId: string, anchorRowId: string, focusCol: number, anchorCol: number, useFullWidthRows: boolean): void;
    restoreSortCycleRowOrder(): void;
    runContextMenuAction(id: string, snapshot: TableContextMenuSnapshot): void;
    safeCell(row: unknown, cellIndex: number): unknown;
    selectedDataRowIdFromViewRow(viewRow: number): string;
    selectionIsFullRowBlock(): boolean;
    selectionIsSingleColumnRect(): boolean;
    selectionIsSingleRowRect(): boolean;
    setCellValidationError(rowIndex: number, colIndex: number, message: unknown): void;
    setSelFullWidthRowSpan(r0: number, r1: number): void;
    setSelectionSingle(r: number, c: number): void;
    setValue(value: unknown): void;
    showSortInHeaderCell(rIdx: number, cell: TableHeaderCell | null | undefined): boolean;
    showTableError(message: string, options?: TableShowErrorOptions): void;
    sortAriaLabel(colIdx: number | null): string;
    sortControlClass(colIdx: number | null): Record<string, boolean>;
    sortTableDataInPlace(): void;
    startTypingReplacingCell(row: number, col: number, character: string): void;
    syncCellOverflowHint(event: Event): void;
    tableCellConsumeKeys(column: TableRuntimeColumn | null | undefined): string;
    thAriaSort(rIdx: number, cIdx: number, cell: TableHeaderCell | null | undefined): 'ascending' | 'descending' | undefined;
    tbodyRowCount(): number;
    toggleGroupExpand(pathKey: string): void;
    toggleLineNumbersFromSnapshot(snapshot?: TableContextMenuSnapshot): void;
    toggleStickyHeaderFromSnapshot(snapshot?: TableContextMenuSnapshot): void;
    toggleWordWrapFromSnapshot(snapshot?: TableContextMenuSnapshot): void;
    writeClipboardText(text: string): Promise<void>;
};

type TableWidgetEmit = (event: 'input', payload: unknown) => void;

type TableWidgetVm = TableRuntimeState &
    TableRuntimePropsSurface &
    TableRuntimeComputed &
    TableRuntimeMethods;

type TableRuntimeVm = TableRuntimeDomSurface & TableWidgetVm;

type TableRuntimeMethodSubset = {
    [K in keyof TableRuntimeMethods]?: (
        this: TableRuntimeVm,
        ...args: Parameters<TableRuntimeMethods[K]>
    ) => ReturnType<TableRuntimeMethods[K]>;
};

type TableRuntimeSurface<K extends keyof TableRuntimeVm> = Pick<TableRuntimeVm, K>;

type TableRuntimeModuleSurface = TableRuntimeVm;
type TableDomRuntimeSurface = TableRuntimeModuleSurface;
type TableSelectionRuntimeSurface = TableRuntimeModuleSurface;
type TableEditingRuntimeSurface = TableRuntimeModuleSurface;
type TableDataViewRuntimeSurface = TableRuntimeModuleSurface;
type TableContextMenuRuntimeSurface = TableRuntimeModuleSurface;
type TableLazyRuntimeSurface = TableRuntimeModuleSurface;
type TableStickyRuntimeSurface = TableRuntimeModuleSurface;

type TableWidgetSetupBindings = ToRefs<TableRuntimeState> &
    {
        readonly widgetConfig: Ref<TableWidgetConfig>;
        readonly widgetName: Ref<string>;
    } &
    TableRuntimeComputedRefs &
    TableRuntimeMethods;

type TableWidgetPublicSurface = {
    readonly contextMenuOpen: boolean;
    readonly stickyHeaderEnabled: boolean;
    readonly tableData: TableDataRow[];
    getTableEl(): HTMLTableElement | null;
    getValue(): unknown[][];
    initializeTable(): void;
    onTableEditableKeydown(event: KeyboardEvent): void;
    setValue(value: unknown): void;
};

type TableRuntimeComputedGetter<T> = (this: TableRuntimeVm) => T;

type TableRuntimeComputedDefinition<T> =
    | TableRuntimeComputedGetter<T>
    | {
          get: TableRuntimeComputedGetter<T>;
          set?: (this: TableRuntimeVm, value: T) => void;
      };

type TableRuntimeComputedDefinitions = {
    [K in keyof TableRuntimeComputed]: TableRuntimeComputedDefinition<TableRuntimeComputed[K]>;
};

type TableRuntimeWatchHandlers = {
    stickyHeaderEnabled(this: TableRuntimeVm, value: TableRuntimeComputed['stickyHeaderEnabled']): void;
    tableLazyUiActive(this: TableRuntimeVm, value: TableRuntimeComputed['tableLazyUiActive']): void;
    widgetConfig(this: TableRuntimeVm): void;
    widgetName(this: TableRuntimeVm): void;
};

export type {
    TableCellDisplayAction,
    TableCellDisplayActionKind,
    TableCellAddress,
    TableClipboardPayload,
    TableCellOptions,
    TableCellWidgetRegistry,
    TableCellWidgetRegistryKey,
    TableCellWidgetConfig,
    TableCellWidgetInstance,
    TableCellWidgetPayload,
    TableColumnAttrConfig,
    TableContextMenuItem,
    TableContextMenuSnapshot,
    TableContextMenuState,
    TableContextMenuTarget,
    TableDataDisplayRow,
    TableDataRow,
    TableDerivedState,
    TableDisplayRow,
    TableDomRuntimeSurface,
    TableEditingSession,
    TableEditingRuntimeSurface,
    TableFeatureFlags,
    TableGroupDisplayRow,
    TableGroupingState,
    TableGroupingViewCache,
    TableHeaderCell,
    TableLazyLoadState,
    TableLeafMeta,
    TableMeasurementState,
    TableRenderState,
    TableRowIdentity,
    TableRuntimeColumn,
    TableRuntimeError,
    TableRuntimeErrorSeverity,
    TableRuntimeComputed,
    TableRuntimeComputedDefinition,
    TableRuntimeComputedDefinitions,
    TableRuntimeComputedRefs,
    TableContextMenuRuntimeSurface,
    TableDataViewRuntimeSurface,
    TableRuntimeDomSurface,
    TableRuntimeMethodSubset,
    TableRuntimeMethods,
    TableRuntimePropsSurface,
    TableRuntimeSurface,
    TableRuntimeState,
    TableRuntimeVm,
    TableRuntimeServices,
    TableRuntimeWatchHandlers,
    TableSchema,
    TableSelectionRect,
    TableSelectionRuntimeSurface,
    TableSelectionState,
    TableLazyRuntimeSurface,
    TableStickyRuntimeSurface,
    TableSortDirection,
    TableSortState,
    TableStore,
    TableAttrsMap,
    TableWidgetAttrs,
    TableWidgetConfig,
    TableWidgetEmit,
    TableWidgetPublicSurface,
    TableWidgetSetupBindings,
    TableWidgetVm,
    UnknownRecord,
    WidgetAttrsMap
};
