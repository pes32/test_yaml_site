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
type TableWidgetConfig = CommonWidgetAttrs & LegacyYamlAttrCompat & {
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
type TableRowIdentity = string;
type TableRowId = TableRowIdentity;
type TableColumnKey = string;
type TableCellAddress = {
    c: number;
    r: number;
};
type TableCoreCellAddress = {
    colKey: TableColumnKey;
    rowId: TableRowId;
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
type TableCoreSortState = {
    colKey: TableColumnKey;
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
type TableCoreColumn = TableRuntimeColumn & {
    columnKey: TableColumnKey;
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
type TableCoreSelectionState = {
    anchor: TableCoreCellAddress | null;
    focus: TableCoreCellAddress | null;
    fullWidthRowIds: TableRowId[] | null;
};
type TableEditingSession = {
    activeCell: TableCellAddress | null;
    validationErrors: Record<string, string>;
};
type TableCoreEditingSession = {
    activeCell: TableCoreCellAddress | null;
    draftValue: unknown;
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
    anchorColumnKey?: TableColumnKey | null;
    anchorRow: number;
    anchorRowId?: TableRowId | null;
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
type TableCoreContextMenuState = {
    context: TableContextMenuSnapshot | null;
    open: boolean;
    sessionId: number;
};
type TableCoreState = {
    activeCell: TableCoreCellAddress | null;
    columns: TableCoreColumn[];
    contextMenu: TableCoreContextMenuState;
    editing: TableCoreEditingSession | null;
    grouping: {
        expanded: Set<string>;
        levelKeys: TableColumnKey[];
    };
    rows: TableDataRow[];
    selection: TableCoreSelectionState;
    sortKeys: TableCoreSortState[];
};
type TableCommand =
    | { type: 'SET_ACTIVE_CELL'; cell: TableCoreCellAddress | null }
    | {
          type: 'SET_SELECTION_RECT';
          anchor: TableCoreCellAddress | null;
          focus: TableCoreCellAddress | null;
          fullWidthRowIds?: TableRowId[] | null;
      }
    | { type: 'ENTER_EDIT_MODE'; cell: TableCoreCellAddress; draftValue: unknown }
    | { type: 'COMMIT_EDIT'; value: unknown }
    | { type: 'CANCEL_EDIT' }
    | {
          type: 'INSERT_ROWS';
          afterRowId?: TableRowId | null;
          beforeRowId?: TableRowId | null;
          rows: TableDataRow[];
      }
    | { type: 'DELETE_ROWS'; rowIds: TableRowId[] }
    | { type: 'PASTE_TSV'; anchor: TableCoreCellAddress; matrix: unknown[][] }
    | { type: 'SORT_COLUMNS'; sortKeys: TableCoreSortState[] }
    | { type: 'CLEAR_SORT'; colKey?: TableColumnKey | null }
    | { type: 'ADD_GROUP_LEVEL'; colKey: TableColumnKey }
    | { type: 'REMOVE_GROUP_LEVEL'; colKey: TableColumnKey }
    | { type: 'REBUILD_GROUPING' }
    | { type: 'APPEND_LOADED_ROWS'; rows: TableDataRow[] }
    | { type: 'OPEN_CONTEXT_MENU'; snapshot: TableContextMenuSnapshot }
    | { type: 'CLOSE_CONTEXT_MENU' };
type TableViewModel = {
    displayIndexToRowId: Array<TableRowId | null>;
    displayRows: TableDisplayRow[];
    orderedRowIds: TableRowId[];
    rowIdToDisplayIndex: Map<TableRowId, number>;
    rowIdToSourceIndex: Map<TableRowId, number>;
    validPathKeys: Set<string>;
};
type TableEditorHandle = {
    blur?: () => void;
    commitDraft: () => unknown;
    commitPendingState: (context: { colKey: TableColumnKey; rowId: TableRowId }) => unknown;
    focus: () => void;
    getValue: () => unknown;
    setValue: (value: unknown) => void;
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
    editingCell: TableCellAddress | null;
    getAllAttrsMapFromRuntime: (() => WidgetAttrsMap) | null;
    handleRecoverableAppErrorFromRuntime: ((error: unknown, context?: UnknownRecord) => void) | null;
    headerRows: TableHeaderCell[][];
    selectedRowIndex: number;
    selAnchor: TableCellAddress;
    selFocus: TableCellAddress;
    selFullWidthRows: { r0: number; r1: number } | null;
    showAppNotificationFromRuntime: ((message: string, type?: string) => void) | null;
    tableColumns: TableRuntimeColumn[];
    tableData: TableDataRow[];
    tablePageBridge: TableRuntimeServices;
    tableSchema: TableSchema | null;
    tableStore: TableStore;
    value: unknown[];
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
type TableRuntimeLooseValue = ReturnType<typeof JSON.parse>;
type TableRuntimeMethodSubset = Record<string, (this: TableRuntimeLooseValue, ...args: TableRuntimeLooseValue[]) => unknown>;
type TableRuntimeMethods = typeof import('./createTableRuntime.ts').tableRuntimeMethods;
type TableWidgetEmit = (event: 'input', payload: unknown) => void;
type TableWidgetVm = TableRuntimeState &
    TableRuntimePropsSurface &
    TableRuntimeComputed &
    Record<string, TableRuntimeLooseValue>;
type TableRuntimeVm = TableRuntimeDomSurface & TableWidgetVm;
type TableRuntimeModuleSurface = TableRuntimeVm;
type TableDomRuntimeSurface = TableRuntimeModuleSurface;
type TableSelectionRuntimeSurface = TableRuntimeModuleSurface;
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
    TableColumnKey,
    TableClipboardPayload,
    TableCellOptions,
    TableCellWidgetConfig,
    TableCellWidgetInstance,
    TableCellWidgetPayload,
    TableColumnAttrConfig,
    TableCommand,
    TableContextMenuItem,
    TableContextMenuSnapshot,
    TableContextMenuState,
    TableContextMenuTarget,
    TableCoreCellAddress,
    TableCoreColumn,
    TableCoreContextMenuState,
    TableCoreEditingSession,
    TableCoreSelectionState,
    TableCoreSortState,
    TableCoreState,
    TableDataDisplayRow,
    TableDataRow,
    TableDisplayRow,
    TableDomRuntimeSurface,
    TableEditingSession,
    TableEditorHandle,
    TableGroupDisplayRow,
    TableGroupingState,
    TableGroupingViewCache,
    TableHeaderCell,
    TableLazyLoadState,
    TableLeafMeta,
    TableMeasurementState,
    TableRowIdentity,
    TableRowId,
    TableRuntimeColumn,
    TableRuntimeError,
    TableRuntimeErrorSeverity,
    TableRuntimeComputed,
    TableRuntimeComputedDefinition,
    TableRuntimeComputedDefinitions,
    TableRuntimeComputedRefs,
    TableRuntimeDomSurface,
    TableRuntimeMethodSubset,
    TableRuntimeMethods,
    TableRuntimePropsSurface,
    TableRuntimeState,
    TableRuntimeVm,
    TableRuntimeServices,
    TableRuntimeWatchHandlers,
    TableSchema,
    TableSelectionRect,
    TableSelectionRuntimeSurface,
    TableSelectionState,
    TableStickyRuntimeSurface,
    TableSortDirection,
    TableSortState,
    TableStore,
    TableViewModel,
    TableWidgetConfig,
    TableWidgetEmit,
    TableWidgetPublicSurface,
    TableWidgetSetupBindings,
    TableWidgetVm,
    UnknownRecord,
    WidgetAttrsMap
};
