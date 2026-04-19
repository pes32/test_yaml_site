import { resolveAttrConfig } from '../../shared/attr_config.ts';
import { resolveTableDependencies } from '../../shared/table_attr_dependencies.ts';
import { createTableStore } from './table_store.ts';
import type { TableWidgetConfig, WidgetAttrsMap } from './table_contract.ts';

function resolveDependencies(tableAttrConfig: Pick<TableWidgetConfig, 'table_attrs'> | null | undefined): string[] {
    return resolveTableDependencies(tableAttrConfig);
}

function getListOptions(
    allAttrs: WidgetAttrsMap,
    sourceName: string
): unknown[] {
    if (!sourceName || !allAttrs || typeof allAttrs !== 'object') {
        return [];
    }
    const attr = resolveAttrConfig(allAttrs, sourceName);
    return attr && Array.isArray(attr.source) ? attr.source : [];
}

function createStore(options: { stickyHeaderEnabled?: boolean } = {}) {
    return createTableStore(options);
}

const tableApi = {
    createStore,
    resolveDependencies,
    getListOptions
};

export { createStore, getListOptions, resolveDependencies, tableApi };
export default tableApi;
