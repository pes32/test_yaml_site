import tableEngine from './table_core.js';

const Core = tableEngine;

function resolveDependencies(tableAttrConfig) {
    const cfg = tableAttrConfig && typeof tableAttrConfig === 'object'
        ? tableAttrConfig
        : {};
    const text = cfg.table_attrs != null ? String(cfg.table_attrs) : '';
    const schema = Core.TableSchema && typeof Core.TableSchema.extractDependencies === 'function'
        ? Core.TableSchema
        : null;
    if (!schema || !text) {
        return [];
    }
    return schema.extractDependencies(text);
}

function getListOptions(allAttrs, sourceName) {
    if (!sourceName || !allAttrs || typeof allAttrs !== 'object') {
        return [];
    }
    const attr = allAttrs[sourceName];
    return attr && Array.isArray(attr.source) ? attr.source : [];
}

function createStore(options) {
    const cfg = options && typeof options === 'object' ? options : {};
    return {
        sorting: {
            sortKeys: []
        },
        grouping: {
            state: {
                levels: [],
                expanded: new Set()
            },
            viewCache: null
        },
        loading: {
            isFullyLoaded: true,
            lazySessionId: 0,
            isLoadingChunk: false,
            tableUiLocked: false,
            lazyEnabled: false,
            lazyPendingRows: []
        },
        preferences: {
            stickyHeaderRuntimeEnabled: !!cfg.stickyHeaderEnabled,
            wordWrapRuntimeEnabled: false
        }
    };
}

const tableApi = {
    createStore,
    resolveDependencies,
    getListOptions
};

export { createStore, getListOptions, resolveDependencies, tableApi };
export default tableApi;
