import type { ComponentPublicInstance } from 'vue';

type UnknownRecord = Record<string, unknown>;

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

type TableRuntimeColumn = UnknownRecord & {
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
    tableCellOptions?: UnknownRecord;
    type?: string;
    widgetConfig?: UnknownRecord;
    widgetRef?: string | null;
    width?: string | null;
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
    pasteAnchor: TableCellAddress;
    rect: TableSelectionRect;
    sessionId: number;
    sortKeys: TableSortState[];
    stickyHeaderEnabled: boolean;
    wordWrapEnabled: boolean;
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
    getAllAttrsMap(): Record<string, unknown>;
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
        stickyHeaderRuntimeEnabled: boolean;
        wordWrapRuntimeEnabled: boolean;
    };
    selection: TableSelectionState;
    sorting: {
        sortKeys: TableSortState[];
    };
};

type TableWidgetVm = Record<string, unknown> & {
    $el?: Element | null;
    $emit?: (event: string, payload?: unknown) => void;
    $nextTick?: <T = void>(callback?: () => T) => Promise<unknown>;
    $refs?: Record<string, unknown>;
    _contextMenuClickHandler?: ((event: Event) => void) | null;
    _contextMenuKeydownHandler?: ((event: KeyboardEvent) => void) | null;
    _lazyDebounceTimer?: ReturnType<typeof setTimeout> | null;
    _lazyObserver?: IntersectionObserver | null;
    _lazyPendingRows?: TableDataRow[];
    _pasteInProgress?: boolean;
    _shiftAnchorLocked?: boolean;
    _shiftSelectGesture?: boolean;
    _sortCycleRowOrder?: TableDataRow[] | null;
    _stickyOnScroll?: (() => void) | null;
    _stickyPinnedRowCount?: number;
    _stickyPinnedTableWidth?: number;
    _stickyPinnedWidthsByRow?: number[][] | null;
    _stickyRaf?: number;
    _stickyRo?: ResizeObserver | null;
    _stickyScrollRoot?: Element | null;
    _stickyTheadPinned?: boolean;
    _bindStickyThead?: () => void;
    _detachContextMenuGlobalListeners?: () => void;
    _setupLazyObserver?: () => void;
    _teardownLazyObserver?: () => void;
    _unbindStickyThead?: () => void;
    _tableContextMenuMouseDown?: boolean;
    _tableFocusWithin?: boolean;
    _tableProgrammaticFocus?: boolean;
    cellValidationErrors?: Record<string, string>;
    contextMenuContext?: TableContextMenuSnapshot | null;
    contextMenuOpen?: boolean;
    contextMenuPosition?: { x: number; y: number };
    contextMenuSessionId?: number;
    contextMenuTarget?: TableContextMenuTarget | null;
    groupingActive?: boolean;
    groupingState?: TableGroupingState;
    groupingViewCache?: TableGroupingViewCache | null;
    hasExplicitTableWidth?: boolean;
    headerSortEnabled?: boolean;
    editingCell?: TableCellAddress | null;
    getAllAttrsMapFromRuntime?: (() => Record<string, unknown>) | null;
    handleRecoverableAppErrorFromRuntime?: ((error: unknown, context?: UnknownRecord) => void) | null;
    headerRows: TableHeaderCell[][];
    initializeTable?: () => void;
    isEditable?: boolean;
    isFullyLoaded?: boolean;
    lazyEnabled?: boolean;
    selectedRowIndex?: number;
    selAnchor?: TableCellAddress;
    selFocus?: TableCellAddress;
    selFullWidthRows?: { r0: number; r1: number } | null;
    showAppNotificationFromRuntime?: ((message: string, type?: string) => void) | null;
    sortKeys?: TableSortState[];
    tableData: TableDataRow[];
    tableColumns: TableRuntimeColumn[];
    tableSchema: TableSchema | null;
    tableStore: TableStore;
    tableUiLocked?: boolean;
    widgetConfig: Record<string, unknown>;
    widgetName: string;
    wordWrapEnabled?: boolean;
    wordWrapRuntimeEnabled?: boolean;
    stickyHeaderEnabled?: boolean;
    stickyHeaderRuntimeEnabled?: boolean;
};

type TableRuntimeVm = ComponentPublicInstance & TableWidgetVm;

export type {
    TableCellAddress,
    TableClipboardPayload,
    TableContextMenuSnapshot,
    TableContextMenuState,
    TableContextMenuTarget,
    TableDataDisplayRow,
    TableDataRow,
    TableDerivedState,
    TableDisplayRow,
    TableEditingSession,
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
    TableRuntimeVm,
    TableRuntimeServices,
    TableSchema,
    TableSelectionRect,
    TableSelectionState,
    TableSortDirection,
    TableSortState,
    TableStore,
    TableWidgetVm,
    UnknownRecord
};
