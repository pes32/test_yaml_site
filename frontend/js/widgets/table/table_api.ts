import { resolveAttrConfig } from '../../shared/attr_config.ts';
import { resolveTableDependencies } from '../../shared/table_attr_dependencies.ts';
import { createTableStore } from './table_store.ts';

function resolveDependencies(tableAttrConfig: Record<string, unknown>): string[] {
    return resolveTableDependencies(tableAttrConfig);
}

function getListOptions(
    allAttrs: Record<string, unknown>,
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
