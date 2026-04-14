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
    watch
} from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { resolveTableDependencies } from '../../shared/table_attr_dependencies.ts';
import type {
    TableRuntimeState,
    TableRuntimeVm,
    TableWidgetConfig,
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

type TableWidgetProps = {
    widgetConfig: TableWidgetConfig;
    widgetName: string;
};

type CellWidgetRegistry = {
    dateCellWidget: unknown;
    datetimeCellWidget: unknown;
    floatCellWidget: unknown;
    intCellWidget: unknown;
    ipCellWidget: unknown;
    ipMaskCellWidget: unknown;
    listCellWidget: unknown;
    stringCellWidget: unknown;
    timeCellWidget: unknown;
    vocCellWidget: unknown;
};

type TableWidgetEmit = (event: 'input', payload: unknown) => void;

type UseTableRuntimeOptions = {
    cellWidgets: CellWidgetRegistry;
    emit: TableWidgetEmit;
    props: TableWidgetProps;
};

type AnyFn = (...args: unknown[]) => unknown;
type ComputedLike = { value: unknown };

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
] as const;

function readWidgetConfigValue(
    config: Record<string, unknown> | null | undefined,
    key: string
): unknown {
    return config && typeof config === 'object' ? config[key] : undefined;
}

function tableDependencySignature(
    config: TableWidgetConfig | null | undefined,
    getAllAttrsMap: (() => Record<string, unknown>) | null
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

            const attr = attrConfig as Record<string, unknown>;
            const columns = Array.isArray(attr.columns)
                ? attr.columns.map((item) => String(item ?? '')).join(',')
                : '';
            return [
                name,
                String(attr.widget || ''),
                attr.readonly === true ? 'readonly' : '',
                attr.editable === false ? 'not-editable' : '',
                attr.multiselect === true ? 'multi' : '',
                columns
            ].join(':');
        })
        .join('|');
}

function createInitialTableRuntimeState(
    cellWidgets: CellWidgetRegistry,
    props: TableWidgetProps,
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

function useTableRuntime(options: UseTableRuntimeOptions): TableWidgetSetupBindings {
    const { cellWidgets, emit, props } = options;

    const instance = getCurrentInstance();

    const getAllAttrsMapFromRuntime = inject<(() => Record<string, unknown>) | null>('getAllAttrsMap', null);
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

    const computedRefs = {} as Record<string, ComputedLike>;
    const boundMethods = {} as Record<string, AnyFn>;

    const vmTarget: Record<string, unknown> = {};

    const vm = new Proxy(vmTarget, {
        get(_target, key) {
            if (typeof key === 'string') {
                if (Object.prototype.hasOwnProperty.call(boundMethods, key)) {
                    return boundMethods[key];
                }
                if (Object.prototype.hasOwnProperty.call(computedRefs, key)) {
                    return computedRefs[key].value;
                }
                if (Object.prototype.hasOwnProperty.call(state, key)) {
                    return Reflect.get(state, key);
                }
                if (key === 'widgetConfig') return props.widgetConfig;
                if (key === 'widgetName') return props.widgetName;
                if (key === '$emit') return emit;
                if (key === '$nextTick') return nextTick;
                if (key === '$refs') return (instance?.proxy as ComponentPublicInstance | null)?.$refs || {};
                if (key === '$el') return (instance?.proxy as ComponentPublicInstance | null)?.$el || null;
                if (key === '$root') return (instance?.proxy as ComponentPublicInstance | null)?.$root || null;
            }
            return Reflect.get(_target, key);
        },
        set(_target, key, value) {
            if (typeof key === 'string') {
                const computedDef = (tableRuntimeComputed as Record<string, unknown>)[key];
                if (
                    computedDef &&
                    typeof computedDef === 'object' &&
                    typeof (computedDef as { set?: unknown }).set === 'function' &&
                    Object.prototype.hasOwnProperty.call(computedRefs, key)
                ) {
                    computedRefs[key].value = value;
                    return true;
                }
                if (Object.prototype.hasOwnProperty.call(state, key)) {
                    Reflect.set(state, key, value);
                    return true;
                }
            }
            return Reflect.set(_target, key, value);
        }
    }) as unknown as TableRuntimeVm & ComponentPublicInstance;

    Object.entries(tableRuntimeMethods).forEach(([name, fn]) => {
        boundMethods[name] = (...args: unknown[]) => (fn as AnyFn).apply(vm, args);
    });

    Object.entries(tableRuntimeComputed).forEach(([name, def]) => {
        if (typeof def === 'function') {
            computedRefs[name] = computed(() => (def as AnyFn).call(vm));
            return;
        }
        const getter = (def as { get?: AnyFn }).get;
        const setter = (def as { set?: AnyFn }).set;
        if (setter) {
            computedRefs[name] = computed({
                get: () => (getter ? getter.call(vm) : undefined),
                set: (value: unknown) => setter.call(vm, value)
            });
            return;
        }
        computedRefs[name] = computed(() => (getter ? getter.call(vm) : undefined));
    });

    Object.entries(tableRuntimeWatch).forEach(([name, handler]) => {
        if (name === 'widgetConfig') {
            watch(
                TABLE_CONFIG_WATCH_KEYS.map((key) => () =>
                    readWidgetConfigValue(props.widgetConfig, key)
                ),
                () => (handler as AnyFn).call(vm)
            );
            watch(
                () => tableDependencySignature(props.widgetConfig, getAllAttrsMapFromRuntime),
                () => (handler as AnyFn).call(vm)
            );
            return;
        }
        if (name === 'widgetName') {
            watch(() => props.widgetName, () => (handler as AnyFn).call(vm));
            return;
        }
        if (Object.prototype.hasOwnProperty.call(computedRefs, name)) {
            watch(computedRefs[name], (value) => (handler as AnyFn).call(vm, value));
        }
    });

    onMounted(() => {
        mountTableRuntime(vm);
    });

    onBeforeUnmount(() => {
        unmountTableRuntime(vm);
    });

    return {
        ...toRefs(state),
        widgetConfig: toRef(props, 'widgetConfig'),
        widgetName: toRef(props, 'widgetName'),
        ...computedRefs,
        ...boundMethods
    } as unknown as TableWidgetSetupBindings;
}

export { useTableRuntime };
