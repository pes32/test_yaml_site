import {
    computed,
    getCurrentInstance,
    inject,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    toRef,
    toRefs,
    watch,
    type ComputedRef
} from 'vue';
import type {
    TableRuntimeComputed,
    TableRuntimeComputedRefs,
    TableRuntimeDomSurface,
    TableRuntimeMethods,
    TableRuntimePropsSurface,
    TableRuntimeState,
    TableRuntimeVm,
    WidgetAttrsMap,
    TableWidgetConfig,
    TableWidgetEmit,
    TableWidgetSetupBindings,
    TableWidgetSetupMethods
} from './table_contract.ts';
import { DEFAULT_REMOTE_LIMIT } from './table_row_provider.ts';
import { createTablePageBridge } from './table_page_bridge.ts';
import { TABLE_WIDGET_SETUP_METHOD_KEYS } from './table_setup_keys.ts';
import {
    mountTableRuntime,
    unmountTableRuntime
} from './table_runtime_lifecycle.ts';
import { tableRuntimeComputed } from './table_runtime_computed.ts';
import { tableRuntimeMethods } from './table_runtime_registry.ts';
import { tableRuntimeWatch } from './table_runtime_watch.ts';
import { createTableStore } from './table_store.ts';
import { createDefaultTableToolbarState, emptyTableViewModel } from './table_internal.ts';
import { createInitialVirtualState } from './table_virtual_model.ts';
import {
    computeTableInitSignature,
    tableDependencySignature
} from './table_runtime_init_signature.ts';

type UseTableRuntimeOptions = {
    emit: TableWidgetEmit;
    props: TableRuntimePropsSurface;
};

type RuntimeObjectKey<T extends object> = Extract<keyof T, string>;

type TableRuntimeVmOptions = {
    computedRefs: Partial<TableRuntimeComputedRefs>;
    emit: TableWidgetEmit;
    instance: ReturnType<typeof getCurrentInstance>;
    props: TableRuntimePropsSurface;
    state: TableRuntimeState;
};

type RuntimeVmTarget = Partial<TableRuntimeVm> & Record<string, unknown>;
type RuntimeComputedUnknownSetter = (this: TableRuntimeVm, value: unknown) => void;

const TABLE_CONFIG_WATCH_KEYS = [
    'abc',
    'auto_width',
    'data',
    'readonly_row_selection',
    'readonly_selected_row_id',
    'label',
    'lazy_chunk_size',
    'lazy_fail_full_load',
    'line_numbers',
    'readonly',
    'row',
    'sort',
    'source',
    'sticky_header',
    'sup_text',
    'table_attrs',
    'toolbar',
    'value',
    'width',
    'zebra'
] as const satisfies ReadonlyArray<keyof TableWidgetConfig>;

const TABLE_RUNTIME_COMPUTED_FALLBACKS = {
    _lazyPendingRows: () => [],
    canRedo: () => false,
    canUndo: () => false,
    columnLetterLabels: () => [],
    contextMenuItems: () => [],
    displayRows: () => [],
    groupingActive: () => false,
    groupingState: () => ({ levels: [], expanded: new Set<string>() }),
    hasColumnLetters: () => false,
    hasColumnNumbers: () => false,
    hasExplicitTableWidth: () => false,
    headerSortEnabled: () => false,
    isEditable: () => false,
    isFullyLoaded: () => false,
    isLoadingChunk: () => false,
    lazyEnabled: () => false,
    lazySessionId: () => 0,
    lineNumbersRuntimeEnabled: () => false,
    runtimeColumnKeyList: () => [],
    selectionRenderState: () => ({
        anchorCol: 0,
        anchorRow: 0,
        focus: { r: 0, c: 0 },
        isFullColumnBlock: false,
        isFullRowBlock: false,
        isMulti: false,
        readonly: false,
        rect: { c0: 0, c1: 0, r0: 0, r1: 0 },
        showSelection: false
    }),
    sortColumnIndex: () => null,
    sortDirection: () => 'asc',
    sortKeys: () => [],
    stickyHeaderEnabled: () => false,
    stickyHeaderRuntimeEnabled: () => false,
    tableRowIdToDataIndex: () => new Map<string, number>(),
    tableViewModel: emptyTableViewModel,
    tableInlineStyle: () => ({}),
    tableDataMode: () => 'local-full',
    tableLazyUiActive: () => false,
    tableMinRowCount: () => 0,
    visibleCellGridStableRows: () => [],
    visibleCellGrid: () => [],
    visibleDisplayRows: () => [],
    virtualBottomSpacerStyle: () => ({}),
    virtualTopSpacerStyle: () => ({}),
    toolbarState: createDefaultTableToolbarState,
    tableUiLocked: () => false,
    tableZebra: () => false,
    toolbarEnabled: () => false,
    wordWrapEnabled: () => false,
    wordWrapRuntimeEnabled: () => false
} satisfies { [K in keyof TableRuntimeComputed]: () => TableRuntimeComputed[K] };

function objectKeys<T extends object>(object: T): Array<RuntimeObjectKey<T>> {
    return Object.keys(object) as Array<RuntimeObjectKey<T>>;
}

function runtimeRefsFromInstance(
    instance: ReturnType<typeof getCurrentInstance>
): TableRuntimeDomSurface['$refs'] {
    return (instance?.proxy?.$refs || {}) as TableRuntimeDomSurface['$refs'];
}

function readWidgetConfigValue(
    config: TableWidgetConfig | null | undefined,
    key: keyof TableWidgetConfig
): unknown {
    return config && typeof config === 'object' ? config[key] : undefined;
}

function createInitialTableRuntimeState(
    props: TableRuntimePropsSurface,
    tablePageBridge: ReturnType<typeof createTablePageBridge>
): TableRuntimeState {
    return {
        value: [],
        tableSchema: null,
        headerRows: [],
        tableColumns: [],
        tableData: [],
        tableRemote: {
            activeAbortController: null,
            activeRequestId: 0,
            activeViewFingerprint: '',
            cellRangeRules: [],
            columnRulesByKey: {},
            directCellOverrides: {},
            formatRules: [],
            globalRules: [],
            itemsByDisplayIndex: {},
            loadedRanges: [],
            mode: 'local-full',
            attr: '',
            page: '',
            provider: 'inline',
            rowItemsById: {},
            rowRangeRules: [],
            selectionExpression: null,
            snapshotVersion: '',
            sourceKey: '',
            tableId: '',
            totalRows: 0,
            view: {
                expandedGroups: [],
                filters: [],
                group: [],
                limit: DEFAULT_REMOTE_LIMIT,
                offset: 0,
                search: null,
                sort: []
            },
            viewId: ''
        },
        tableStore: reactive(
            createTableStore({
                lineNumbersEnabled: !!(props.widgetConfig && props.widgetConfig.line_numbers === true),
                stickyHeaderEnabled: !!(props.widgetConfig && props.widgetConfig.sticky_header === true)
            })
        ),
        contextMenuOpen: false,
        contextMenuPosition: { x: 0, y: 0 },
        contextMenuTarget: null,
        contextMenuContext: null,
        contextMenuSessionId: 0,
        _pasteInProgress: false,
        _focusSelectionScheduledRaf: 0,
        _pendingFocusSelectionCell: null,
        _remotePendingRange: null,
        _remoteRangeRequestRaf: 0,
        selectedRowIndex: -1,
        lastInitSignature: '',
        selAnchor: { r: 0, c: 0 },
        selFocus: { r: 0, c: 0 },
        selFullHeightCols: null,
        selFullWidthRows: null,
        _tableProgrammaticFocus: false,
        _shiftSelectGesture: false,
        _shiftAnchorLocked: false,
        _contextMenuClickHandler: null,
        _contextMenuKeydownHandler: null,
        editingCell: null,
        _tableFocusWithin: false,
        cellValidationErrors: {},
        _lazyObserver: null,
        _lazyDebounceTimer: null,
        _tableContextMenuMouseDown: false,
        _stickyTheadPinned: false,
        _stickyScrollRoot: null,
        _stickyPinnedRowCount: 0,
        _stickyPinnedTableWidth: 0,
        _stickyPinnedWidthsByRow: null,
        _stickyRaf: 0,
        _stickyOnScroll: null,
        _stickyRo: null,
        _virtualScrollRoot: null,
        _virtualRaf: 0,
        _virtualMeasureRaf: 0,
        _virtualOnScroll: null,
        _virtualOnResize: null,
        _virtualRo: null,
        virtualState: createInitialVirtualState(),
        tablePageBridge,
        getAllAttrsMapFromRuntime: tablePageBridge.getAllAttrsMap,
        handleRecoverableAppErrorFromRuntime: (error: unknown, context?: Record<string, unknown>) => {
            tablePageBridge.handleRecoverableError({
                cause: error,
                code: typeof context?.code === 'string' ? context.code : 'table_runtime_error',
                details: context || undefined,
                message:
                    typeof context?.message === 'string' ? context.message : 'Ошибка таблицы',
                severity: 'recoverable'
            });
        },
        showAppNotificationFromRuntime: tablePageBridge.notify
    };
}

function setRuntimeComputedValue(
    vm: TableRuntimeVm,
    key: keyof TableRuntimeComputed,
    value: unknown
): boolean {
    const definition = tableRuntimeComputed[key];
    const setter =
        typeof definition === 'function'
            ? null
            : (definition.set as RuntimeComputedUnknownSetter | undefined);
    if (!setter) return false;
    setter.call(vm, value);
    return true;
}

function defineRuntimeProperty<TValue>(
    target: RuntimeVmTarget,
    key: string,
    getter: () => TValue,
    setter?: (value: TValue) => void
): void {
    Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        get: getter,
        ...(setter ? { set: setter } : {})
    });
}

function runtimeComputedFallback<K extends keyof TableRuntimeComputed>(
    key: K
): TableRuntimeComputed[K] {
    const createFallback = TABLE_RUNTIME_COMPUTED_FALLBACKS[key] as () => TableRuntimeComputed[K];
    return createFallback();
}

function createTableRuntimeVm(options: TableRuntimeVmOptions): TableRuntimeVm {
    const target: RuntimeVmTarget = {};
    const vm = target as TableRuntimeVm;
    const baseProperties: Array<[string, () => unknown]> = [
        ['$el', () => options.instance?.proxy?.$el || null],
        ['$emit', () => options.emit],
        ['$nextTick', () => nextTick],
        ['$refs', () => runtimeRefsFromInstance(options.instance)],
        ['$root', () => options.instance?.proxy?.$root || null],
        ['widgetConfig', () => options.props.widgetConfig],
        ['widgetName', () => options.props.widgetName]
    ];

    baseProperties.forEach(([key, getter]) => {
        defineRuntimeProperty(target, key, getter);
    });

    objectKeys(options.state).forEach((key) => {
        defineRuntimeProperty(
            target,
            key,
            () => options.state[key],
            (value) => {
                (options.state as Record<string, unknown>)[key] = value;
            }
        );
    });

    objectKeys(tableRuntimeComputed).forEach((key) => {
        defineRuntimeProperty(
            target,
            key,
            () => options.computedRefs[key]?.value ?? runtimeComputedFallback(key),
            (value) => {
                setRuntimeComputedValue(vm, key, value);
            }
        );
    });

    return vm;
}

function createRuntimeComputedRef<K extends keyof TableRuntimeComputed>(
    vm: TableRuntimeVm,
    key: K
): ComputedRef<TableRuntimeComputed[K]> {
    const definition = tableRuntimeComputed[key];

    if (typeof definition === 'function') {
        return computed(() => definition.call(vm));
    }

    if (definition.set) {
        return computed({
            get: () => definition.get.call(vm),
            set: (value: TableRuntimeComputed[K]) => {
                definition.set?.call(vm, value);
            }
        });
    }

    return computed(() => definition.get.call(vm));
}

function createRuntimeComputedRefs(vm: TableRuntimeVm): TableRuntimeComputedRefs {
    return objectKeys(tableRuntimeComputed).reduce((refs, key) => {
        (refs as Record<string, ComputedRef<unknown>>)[key] =
            createRuntimeComputedRef(vm, key) as ComputedRef<unknown>;
        return refs;
    }, {} as Record<string, ComputedRef<unknown>>) as TableRuntimeComputedRefs;
}

function createBoundRuntimeMethods(vm: TableRuntimeVm): TableRuntimeMethods {
    return objectKeys(tableRuntimeMethods).reduce((bound, key) => {
        (bound as Record<string, (...args: unknown[]) => unknown>)[key] = (...args: unknown[]) =>
            Reflect.apply(tableRuntimeMethods[key], vm, args);
        return bound;
    }, {} as Partial<TableRuntimeMethods>) as TableRuntimeMethods;
}

function createTableWidgetSetupBindings(
    state: TableRuntimeState,
    props: TableRuntimePropsSurface,
    computedRefs: TableRuntimeComputedRefs,
    boundMethods: TableRuntimeMethods
): TableWidgetSetupBindings {
    const setupMethods = TABLE_WIDGET_SETUP_METHOD_KEYS.reduce((methods, key) => {
        (methods as Record<string, unknown>)[key] = boundMethods[key];
        return methods;
    }, {} as Partial<TableWidgetSetupMethods>) as TableWidgetSetupMethods;

    return {
        ...toRefs(state),
        widgetConfig: toRef(props, 'widgetConfig'),
        widgetName: toRef(props, 'widgetName'),
        ...computedRefs,
        ...setupMethods
    };
}

function useTableRuntime(options: UseTableRuntimeOptions): TableWidgetSetupBindings {
    const { emit, props } = options;

    const instance = getCurrentInstance();

    const getAllAttrsMapFromRuntime = inject<(() => WidgetAttrsMap) | null>('getAllAttrsMap', null);
    const getSnapshotVersionFromRuntime = inject<(() => string) | null>(
        'getCurrentSnapshotVersionFromRuntime',
        null
    );
    const handleRecoverableAppErrorFromRuntime = inject<
        ((error: unknown, context?: Record<string, unknown>) => void) | null
    >('handleRecoverableAppError', null);
    const showAppNotificationFromRuntime = inject<((message: string, type?: string) => void) | null>(
        'showAppNotification',
        null
    );
    const tablePageBridge = createTablePageBridge({
        getAllAttrsMap: getAllAttrsMapFromRuntime,
        getSnapshotVersion: getSnapshotVersionFromRuntime,
        handleRecoverableAppError: handleRecoverableAppErrorFromRuntime,
        showAppNotification: showAppNotificationFromRuntime
    });

    const state = reactive(createInitialTableRuntimeState(props, tablePageBridge)) as TableRuntimeState;

    const computedRefs: Partial<TableRuntimeComputedRefs> = {};
    const vm = createTableRuntimeVm({
        computedRefs,
        emit,
        instance,
        props,
        state
    });

    const runtimeMethods = createBoundRuntimeMethods(vm);
    Object.assign(vm, runtimeMethods);

    const runtimeComputedRefs = createRuntimeComputedRefs(vm);
    Object.assign(computedRefs, runtimeComputedRefs);

    let virtualWindowWatchFlushPending = false;
    const queueVirtualWindowUpdateFromWatchers = () => {
        if (virtualWindowWatchFlushPending) return;
        virtualWindowWatchFlushPending = true;
        vm.$nextTick?.(() => {
            virtualWindowWatchFlushPending = false;
            vm._scheduleVirtualWindowUpdate?.();
        });
    };

    watch(
        TABLE_CONFIG_WATCH_KEYS.map((key) => () =>
            readWidgetConfigValue(props.widgetConfig, key)
        ),
        () => tableRuntimeWatch.widgetConfig.call(vm)
    );
    watch(
        () => tableDependencySignature(props.widgetConfig, getAllAttrsMapFromRuntime),
        () => tableRuntimeWatch.widgetConfig.call(vm)
    );
    watch(() => props.widgetName, () => tableRuntimeWatch.widgetName.call(vm));
    watch(runtimeComputedRefs.tableLazyUiActive, (value) =>
        tableRuntimeWatch.tableLazyUiActive.call(vm, value)
    );
    watch(runtimeComputedRefs.stickyHeaderEnabled, (value) =>
        tableRuntimeWatch.stickyHeaderEnabled.call(vm, value)
    );
    watch(
        () => runtimeComputedRefs.displayRows.value.length,
        () => queueVirtualWindowUpdateFromWatchers()
    );
    watch(runtimeComputedRefs.displayRows, () => {
        vm._resetVirtualMeasurements?.();
        queueVirtualWindowUpdateFromWatchers();
    });
    watch(runtimeComputedRefs.wordWrapEnabled, () => {
        vm._resetVirtualMeasurements?.();
        queueVirtualWindowUpdateFromWatchers();
    });
    watch(
        () => [
            state.tableColumns.length,
            Object.entries(state.tableStore.widths.overrideByColumnKey)
                .map(([key, value]) => `${key}:${value ?? ''}`)
                .join('|')
        ].join(':'),
        () => {
            vm._resetVirtualMeasurements?.();
            queueVirtualWindowUpdateFromWatchers();
        }
    );

    onMounted(() => {
        mountTableRuntime(vm);
        vm.lastInitSignature = computeTableInitSignature(vm);
    });

    onBeforeUnmount(() => {
        unmountTableRuntime(vm);
    });

    return createTableWidgetSetupBindings(state, props, runtimeComputedRefs, runtimeMethods);
}

export { useTableRuntime };
