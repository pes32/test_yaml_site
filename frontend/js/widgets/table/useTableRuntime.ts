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
import { resolveTableDependencies } from '../../shared/table_attr_dependencies.ts';
import type {
    TableCellWidgetRegistry,
    TableRuntimeComputed,
    TableRuntimeComputedDefinition,
    TableRuntimeComputedRefs,
    TableRuntimeDomSurface,
    TableRuntimeMethods,
    TableRuntimePropsSurface,
    TableRuntimeState,
    TableRuntimeVm,
    WidgetAttrsMap,
    TableWidgetConfig,
    TableWidgetEmit,
    TableWidgetSetupBindings
} from './table_contract.ts';
import { createTablePageBridge } from './table_page_bridge.ts';
import {
    mountTableRuntime,
    tableRuntimeComputed,
    tableRuntimeMethods,
    tableRuntimeWatch,
    unmountTableRuntime
} from './createTableRuntime.ts';
import { createTableStore } from './table_store.ts';

type UseTableRuntimeOptions = {
    cellWidgets: TableCellWidgetRegistry;
    emit: TableWidgetEmit;
    props: TableRuntimePropsSurface;
};

type RuntimeObjectKey<T extends object> = Extract<keyof T, string>;

type TableRuntimeControllerOptions = {
    boundMethods: Partial<TableRuntimeMethods>;
    computedRefs: Partial<TableRuntimeComputedRefs>;
    emit: TableWidgetEmit;
    instance: ReturnType<typeof getCurrentInstance>;
    props: TableRuntimePropsSurface;
    state: TableRuntimeState;
};

const TABLE_CONFIG_WATCH_KEYS = [
    'data',
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
    'table_lazy',
    'value',
    'width',
    'zebra'
] as const satisfies ReadonlyArray<keyof TableWidgetConfig>;

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

function tableDependencySignature(
    config: TableWidgetConfig | null | undefined,
    getAllAttrsMap: (() => WidgetAttrsMap) | null
): string {
    const deps = resolveTableDependencies(config || {});
    if (!deps.length || typeof getAllAttrsMap !== 'function') {
        return '';
    }

    const attrs = getAllAttrsMap() || {};
    return deps
        .map((name) => {
            const attrConfig = attrs && typeof attrs === 'object' ? attrs[name] : null;
            if (!attrConfig || typeof attrConfig !== 'object') {
                return `${name}:missing`;
            }

            const columns = Array.isArray(attrConfig.columns)
                ? attrConfig.columns.map((item) => String(item ?? '')).join(',')
                : '';
            return [
                name,
                String(attrConfig.widget || ''),
                attrConfig.readonly === true ? 'readonly' : '',
                attrConfig.editable === false ? 'not-editable' : '',
                attrConfig.multiselect === true ? 'multi' : '',
                columns
            ].join(':');
        })
        .join('|');
}

function createInitialTableRuntimeState(
    cellWidgets: TableCellWidgetRegistry,
    props: TableRuntimePropsSurface,
    tablePageBridge: ReturnType<typeof createTablePageBridge>
): TableRuntimeState {
    return {
        value: [],
        tableSchema: null,
        headerRows: [],
        tableColumns: [],
        tableData: [],
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
        selectedRowIndex: -1,
        selAnchor: { r: 0, c: 0 },
        selFocus: { r: 0, c: 0 },
        selFullWidthRows: null,
        _tableProgrammaticFocus: false,
        _shiftSelectGesture: false,
        _shiftAnchorLocked: false,
        _contextMenuClickHandler: null,
        _contextMenuKeydownHandler: null,
        editingCell: null,
        stringCellWidget: cellWidgets.stringCellWidget,
        intCellWidget: cellWidgets.intCellWidget,
        floatCellWidget: cellWidgets.floatCellWidget,
        dateCellWidget: cellWidgets.dateCellWidget,
        timeCellWidget: cellWidgets.timeCellWidget,
        datetimeCellWidget: cellWidgets.datetimeCellWidget,
        ipCellWidget: cellWidgets.ipCellWidget,
        ipMaskCellWidget: cellWidgets.ipMaskCellWidget,
        listCellWidget: cellWidgets.listCellWidget,
        vocCellWidget: cellWidgets.vocCellWidget,
        _tableFocusWithin: false,
        _sortCycleRowOrder: null,
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

function computedSetter<K extends keyof TableRuntimeComputed>(
    definition: TableRuntimeComputedDefinition<TableRuntimeComputed[K]>
): ((this: TableRuntimeVm, value: TableRuntimeComputed[K]) => void) | null {
    if (typeof definition === 'function') {
        return null;
    }
    return definition.set || null;
}

function defineRuntimeStateProperty<K extends keyof TableRuntimeState>(
    controller: Partial<TableRuntimeVm>,
    state: TableRuntimeState,
    key: K
): void {
    Object.defineProperty(controller, key, {
        configurable: true,
        enumerable: true,
        get: () => state[key],
        set: (value: TableRuntimeState[K]) => {
            state[key] = value;
        }
    });
}

function defineRuntimeMethodProperty<K extends keyof TableRuntimeMethods>(
    controller: Partial<TableRuntimeVm>,
    boundMethods: Partial<TableRuntimeMethods>,
    key: K
): void {
    Object.defineProperty(controller, key, {
        configurable: true,
        enumerable: true,
        get: () => boundMethods[key]
    });
}

function defineRuntimeComputedProperty<K extends keyof TableRuntimeComputed>(
    controller: Partial<TableRuntimeVm>,
    controllerVm: TableRuntimeVm,
    computedRefs: Partial<TableRuntimeComputedRefs>,
    key: K
): void {
    const setter = computedSetter(tableRuntimeComputed[key]);

    Object.defineProperty(controller, key, {
        configurable: true,
        enumerable: true,
        get: () => computedRefs[key]?.value,
        set: setter
            ? (value: TableRuntimeComputed[K]) => {
                setter.call(controllerVm, value);
            }
            : undefined
    });
}

function createTableRuntimeController({
    boundMethods,
    computedRefs,
    emit,
    instance,
    props,
    state
}: TableRuntimeControllerOptions): TableRuntimeVm {
    const controller: Partial<TableRuntimeVm> = {
        $emit: emit,
        $nextTick: nextTick,
        get $el() {
            return instance?.proxy?.$el || null;
        },
        get $refs() {
            return runtimeRefsFromInstance(instance);
        },
        get $root() {
            return instance?.proxy?.$root || null;
        },
        get widgetConfig() {
            return props.widgetConfig;
        },
        get widgetName() {
            return props.widgetName;
        }
    };

    const controllerVm = controller as TableRuntimeVm;

    objectKeys(state).forEach((key) => {
        defineRuntimeStateProperty(controller, state, key);
    });

    objectKeys(tableRuntimeMethods).forEach((key) => {
        defineRuntimeMethodProperty(controller, boundMethods, key);
    });

    objectKeys(tableRuntimeComputed).forEach((key) => {
        defineRuntimeComputedProperty(controller, controllerVm, computedRefs, key);
    });

    return controllerVm;
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
    return {
        _lazyPendingRows: createRuntimeComputedRef(vm, '_lazyPendingRows'),
        contextMenuItems: createRuntimeComputedRef(vm, 'contextMenuItems'),
        displayRows: createRuntimeComputedRef(vm, 'displayRows'),
        groupingActive: createRuntimeComputedRef(vm, 'groupingActive'),
        groupingState: createRuntimeComputedRef(vm, 'groupingState'),
        groupingViewCache: createRuntimeComputedRef(vm, 'groupingViewCache'),
        hasColumnNumbers: createRuntimeComputedRef(vm, 'hasColumnNumbers'),
        hasExplicitTableWidth: createRuntimeComputedRef(vm, 'hasExplicitTableWidth'),
        headerSortEnabled: createRuntimeComputedRef(vm, 'headerSortEnabled'),
        isEditable: createRuntimeComputedRef(vm, 'isEditable'),
        isFullyLoaded: createRuntimeComputedRef(vm, 'isFullyLoaded'),
        isLoadingChunk: createRuntimeComputedRef(vm, 'isLoadingChunk'),
        lazyEnabled: createRuntimeComputedRef(vm, 'lazyEnabled'),
        lazySessionId: createRuntimeComputedRef(vm, 'lazySessionId'),
        lineNumbersRuntimeEnabled: createRuntimeComputedRef(vm, 'lineNumbersRuntimeEnabled'),
        sortColumnIndex: createRuntimeComputedRef(vm, 'sortColumnIndex'),
        sortDirection: createRuntimeComputedRef(vm, 'sortDirection'),
        sortKeys: createRuntimeComputedRef(vm, 'sortKeys'),
        stickyHeaderEnabled: createRuntimeComputedRef(vm, 'stickyHeaderEnabled'),
        stickyHeaderRuntimeEnabled: createRuntimeComputedRef(vm, 'stickyHeaderRuntimeEnabled'),
        tableInlineStyle: createRuntimeComputedRef(vm, 'tableInlineStyle'),
        tableLazyUiActive: createRuntimeComputedRef(vm, 'tableLazyUiActive'),
        tableMinRowCount: createRuntimeComputedRef(vm, 'tableMinRowCount'),
        tableUiLocked: createRuntimeComputedRef(vm, 'tableUiLocked'),
        tableZebra: createRuntimeComputedRef(vm, 'tableZebra'),
        wordWrapEnabled: createRuntimeComputedRef(vm, 'wordWrapEnabled'),
        wordWrapRuntimeEnabled: createRuntimeComputedRef(vm, 'wordWrapRuntimeEnabled')
    };
}

function bindRuntimeMethod<K extends keyof TableRuntimeMethods>(
    vm: TableRuntimeVm,
    method: TableRuntimeMethods[K]
): TableRuntimeMethods[K] {
    const runtimeMethod = method as (
        this: TableRuntimeVm,
        ...args: Parameters<TableRuntimeMethods[K]>
    ) => ReturnType<TableRuntimeMethods[K]>;
    const boundMethod = (...args: Parameters<TableRuntimeMethods[K]>) =>
        Reflect.apply(runtimeMethod, vm, args);

    return boundMethod as TableRuntimeMethods[K];
}

function assignRuntimeMethod<K extends keyof TableRuntimeMethods>(
    methods: Partial<TableRuntimeMethods>,
    key: K,
    method: TableRuntimeMethods[K]
): void {
    methods[key] = method;
}

function assertCompleteRuntimeMethods(
    methods: Partial<TableRuntimeMethods>
): asserts methods is TableRuntimeMethods {
    objectKeys(tableRuntimeMethods).forEach((key) => {
        if (typeof methods[key] !== 'function') {
            throw new Error(`Table runtime method "${key}" was not initialized.`);
        }
    });
}

function createBoundRuntimeMethods(vm: TableRuntimeVm): TableRuntimeMethods {
    const methods: Partial<TableRuntimeMethods> = {};

    objectKeys(tableRuntimeMethods).forEach((key) => {
        assignRuntimeMethod(methods, key, bindRuntimeMethod(vm, tableRuntimeMethods[key]));
    });

    assertCompleteRuntimeMethods(methods);
    return methods;
}

function createTableWidgetSetupBindings(
    state: TableRuntimeState,
    props: TableRuntimePropsSurface,
    computedRefs: TableRuntimeComputedRefs,
    boundMethods: TableRuntimeMethods
): TableWidgetSetupBindings {
    return {
        ...toRefs(state),
        widgetConfig: toRef(props, 'widgetConfig'),
        widgetName: toRef(props, 'widgetName'),
        ...computedRefs,
        ...boundMethods
    };
}

function useTableRuntime(options: UseTableRuntimeOptions): TableWidgetSetupBindings {
    const { cellWidgets, emit, props } = options;

    const instance = getCurrentInstance();

    const getAllAttrsMapFromRuntime = inject<(() => WidgetAttrsMap) | null>('getAllAttrsMap', null);
    const handleRecoverableAppErrorFromRuntime = inject<
        ((error: unknown, context?: Record<string, unknown>) => void) | null
    >('handleRecoverableAppError', null);
    const showAppNotificationFromRuntime = inject<((message: string, type?: string) => void) | null>(
        'showAppNotification',
        null
    );
    const tablePageBridge = createTablePageBridge({
        getAllAttrsMap: getAllAttrsMapFromRuntime,
        handleRecoverableAppError: handleRecoverableAppErrorFromRuntime,
        showAppNotification: showAppNotificationFromRuntime
    });

    const state = reactive(createInitialTableRuntimeState(cellWidgets, props, tablePageBridge)) as TableRuntimeState;

    const computedRefs: Partial<TableRuntimeComputedRefs> = {};
    const boundMethods: Partial<TableRuntimeMethods> = {};

    const vm = createTableRuntimeController({
        boundMethods,
        computedRefs,
        emit,
        instance,
        props,
        state
    });

    const runtimeMethods = createBoundRuntimeMethods(vm);
    Object.assign(boundMethods, runtimeMethods);

    const runtimeComputedRefs = createRuntimeComputedRefs(vm);
    Object.assign(computedRefs, runtimeComputedRefs);

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

    onMounted(() => {
        mountTableRuntime(vm);
    });

    onBeforeUnmount(() => {
        unmountTableRuntime(vm);
    });

    return createTableWidgetSetupBindings(state, props, runtimeComputedRefs, runtimeMethods);
}

export { useTableRuntime };
