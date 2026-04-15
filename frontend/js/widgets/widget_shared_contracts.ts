import type { VocRow } from '../runtime/voc_contract.ts';

type WidgetConfigBase = Record<string, unknown> & {
    columns?: unknown;
    err_text?: string;
    label?: unknown;
    multiselect?: boolean;
    placeholder?: string;
    readonly?: boolean;
    regex?: RegExp | string;
    source?: unknown;
    sup_text?: unknown;
    table_cell_tab_handler?: unknown;
    table_cell_validation_handler?: unknown;
    table_consume_keys?: unknown;
    value?: unknown;
};

type StyleValueMap = Record<string, string | number>;

type WidgetFieldVmBase = Record<string, unknown> & {
    $el?: Element | null;
    $nextTick(callback?: () => void): Promise<void>;
    $refs?: Record<string, unknown>;
    activateDraftController(): void;
    deactivateDraftController(): void;
    emitInput(value: unknown): void;
    fieldError: string;
    handleTableCellCommitValidation(message: string): boolean;
    isDraftEditing: boolean;
    syncCommittedValue(value: unknown, applyValue: (value: unknown) => void): void;
    tableCellCommitError: string;
    tableCellMode: boolean;
    tableCellRootAttrs: Record<string, string>;
    widgetConfig: WidgetConfigBase;
    widgetName: string;
};

type VocWidgetVm = WidgetFieldVmBase & {
    _clickOutside: unknown;
    _clickOutsideTimerId: number;
    _scrollUpdate: unknown;
    clearVocError(): void;
    closeDropdown(): void;
    closeModal(options?: { restoreFocus?: boolean }): void;
    columns: string[];
    combinedFieldError: string;
    fieldError: string;
    formatRowLabel(row: VocRow): string;
    getInputElement(): HTMLElement | HTMLInputElement | null;
    getValue(): string | string[];
    hasValue: boolean;
    highlightedIndex: number;
    inlineRows: VocRow[];
    inputValue: string;
    isDropdownOpen: boolean;
    isFocusInsideWidget(): boolean;
    isFocused: boolean;
    isModalOpen: boolean;
    isMultiselect: boolean;
    labelFloats: boolean;
    listId: string;
    listItemId(index: number): string;
    listMenuId: string;
    menuPosition: StyleValueMap;
    modalActiveRowId: string;
    modalRows: VocRow[];
    modalSearch: string;
    modalSelectedRowId: string;
    modalSelectedRowIdSet: Set<string>;
    modalSelectedRowIds: string[];
    modalSortColumn: number;
    modalSortDirection: string;
    moveHighlightedIndex(delta: number): void;
    moveModalActiveRow(delta: number): void;
    normalizeMultiselectDraftAndSync(options?: {
        fromBlur?: boolean;
        includeActiveToken?: boolean;
    }): unknown;
    onOutsideInteractionCommit(): void;
    openDropdown(options?: { highlightFirst?: boolean }): void;
    openModal(): void;
    resolveHighlightedIndex(): number;
    rows: VocRow[];
    setHighlightedIndex(index: number, options?: { scroll?: boolean }): void;
    setMultiValue(value: unknown): void;
    setSingleValue(value: unknown, options?: { forceSyncInput?: boolean }): void;
    setTableUiLocked(locked: boolean): void;
    setValue(value: unknown): void;
    shouldShowInlineDropdown: boolean;
    singleDraftDirty: boolean;
    skipNextOutsideCommit: boolean;
    syncInputFromCommitted(): void;
    syncModalActiveRow(): void;
    toggleModalRow(row: VocRow): void;
    value: string | string[];
    vocError: string;
};

type VocModalVm = VocWidgetVm;

type WidgetComputedMap<T> = ThisType<T> & Record<string, (this: T) => unknown>;

type WidgetMethodMap<T> = ThisType<T> & Record<string, (this: T, ...args: unknown[]) => unknown>;

type WidgetWatchHandler<T> = (this: T, value: unknown, oldValue?: unknown) => void;

type WidgetWatchEntry<T> =
    | WidgetWatchHandler<T>
    | ({
          deep?: boolean;
          handler: WidgetWatchHandler<T>;
          immediate?: boolean;
      } & ThisType<T>);

type WidgetWatchMap<T> = Record<string, WidgetWatchEntry<T>>;

export type {
    StyleValueMap,
    VocModalVm,
    VocWidgetVm,
    WidgetComputedMap,
    WidgetConfigBase,
    WidgetFieldVmBase,
    WidgetMethodMap,
    WidgetWatchEntry,
    WidgetWatchHandler,
    WidgetWatchMap
};
