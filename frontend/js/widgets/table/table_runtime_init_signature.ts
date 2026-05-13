import { resolveTableDependencies } from '../../shared/table_attr_dependencies.ts';
import type { TableRuntimeVm, TableWidgetConfig, WidgetAttrsMap } from './table_contract.ts';
import {
    normalizeRuntimeProviderConfig,
    resolveRemoteProviderSourceKey
} from './table_row_provider.ts';

const TABLE_INIT_SIGNATURE_ATTR_KEYS = [
    'abc',
    'auto_width',
    'data',
    'lazy_chunk_size',
    'lazy_fail_full_load',
    'line_numbers',
    'readonly',
    'readonly_row_selection',
    'readonly_selected_row_id',
    'row',
    'sort',
    'source',
    'sticky_header',
    'table_attrs',
    'toolbar',
    'value',
    'width',
    'zebra'
] as const satisfies ReadonlyArray<keyof TableWidgetConfig>;

function sortedJson(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => sortedJson(item)).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => `${JSON.stringify(key)}:${sortedJson(record[key])}`)
        .join(',')}}`;
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
                columns,
                sortedJson(attrConfig.source ?? null),
                sortedJson(attrConfig.default ?? null),
                String(attrConfig.regex || ''),
                String(attrConfig.err_text || ''),
                String(attrConfig.placeholder || '')
            ].join(':');
        })
        .join('|');
}

function computeTableInitSignature(vm: TableRuntimeVm): string {
    const cfg = vm.widgetConfig || ({} as TableWidgetConfig);
    const depSig = tableDependencySignature(
        cfg,
        typeof vm.getAllAttrsMapFromRuntime === 'function' ? vm.getAllAttrsMapFromRuntime : null
    );
    const sidecarRaw = normalizeRuntimeProviderConfig(cfg.__tableRuntime);
    const mergedRemote = {
        ...sidecarRaw,
        sourceKey: resolveRemoteProviderSourceKey(sidecarRaw, cfg)
    };
    const tableLevelSnapshot: Record<string, unknown> = {};
    TABLE_INIT_SIGNATURE_ATTR_KEYS.forEach((key) => {
        tableLevelSnapshot[key] = cfg[key];
    });
    return sortedJson({
        depSig,
        mergedRemoteBootstrap: mergedRemote,
        tableAttrsSnapshot: cfg.table_attrs ?? null,
        tableLevelSnapshot,
        widgetName: vm.widgetName
    });
}

export {
    TABLE_INIT_SIGNATURE_ATTR_KEYS,
    computeTableInitSignature,
    sortedJson,
    tableDependencySignature
};
