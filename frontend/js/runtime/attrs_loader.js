import frontendApiClient from './api_client.js';
import { resolveTableDependencies } from '../shared/table_attr_dependencies.ts';
import PageRuntimeStore from './page_store.ts';
import PageSessionStore from './page_session_store.ts';
import { logDiagnosticsToConsole } from './diagnostics.js';
import { collectActiveWidgetNames } from './page_selectors.ts';

function fetchAttrsSubset(vm, names) {
    if (!Array.isArray(names) || names.length === 0) {
        return Promise.resolve({});
    }

    return frontendApiClient.fetchAttrs(vm.getCurrentPageName(), names);
}

function mergeLoadedAttrs(vm, payload, loadedNames) {
    const normalized = PageRuntimeStore.mergeAttrs(vm.configState, payload || {}, loadedNames);
    PageSessionStore.mergeLoadedAttrNames(
        vm.sessionState,
        [].concat(normalized.resolvedNames || [], loadedNames || [])
    );
    PageSessionStore.initializeWidgetValues(vm.sessionState, vm.allAttrs);
    logDiagnosticsToConsole('attrs', vm.diagnostics);
    return normalized;
}

function normalizeRequestedAttrNames(names) {
    const requested = [];
    const seen = new Set();
    (Array.isArray(names) ? names : []).forEach((name) => {
        const key = typeof name === 'string' ? name.trim() : '';
        if (!key || seen.has(key)) {
            return;
        }
        seen.add(key);
        requested.push(key);
    });
    return requested;
}

async function loadTableListSources(vm, attrNames) {
    if (!attrNames || attrNames.length === 0) {
        return;
    }

    const extra = new Set();
    attrNames.forEach((name) => {
        const cfg = typeof vm.getWidgetConfig === 'function'
            ? vm.getWidgetConfig(name)
            : vm.allAttrs[name];
        if (!cfg || cfg.widget !== 'table' || !cfg.table_attrs) {
            return;
        }

        const deps = resolveTableDependencies(cfg);
        deps.forEach((token) => {
            if (vm.loadedAttrNames.includes(token)) {
                return;
            }
            extra.add(token);
        });
    });

    const extraNames = Array.from(extra);
    if (!extraNames.length) {
        return;
    }

    const data = await fetchAttrsSubset(vm, extraNames);
    mergeLoadedAttrs(vm, data, extraNames);
}

async function ensureAttrsLoaded(vm, names) {
    const requested = normalizeRequestedAttrNames(names);
    const toLoad = requested.filter((name) => !vm.loadedAttrNames.includes(name));
    if (!toLoad.length) {
        return {};
    }

    const data = await fetchAttrsSubset(vm, toLoad);
    const normalized = mergeLoadedAttrs(vm, data, toLoad);
    const attrsMap = normalized && normalized.attrs ? normalized.attrs : {};
    await loadTableListSources(vm, Object.keys(attrsMap));
    return attrsMap;
}

async function fetchActiveViewAttrs(vm) {
    if (!vm.activeMenu) {
        return;
    }

    const activeNames = collectActiveWidgetNames(vm.activeMenu, vm.activeTabIndex);
    await ensureAttrsLoaded(vm, activeNames);
}

export {
    ensureAttrsLoaded,
    fetchActiveViewAttrs,
    fetchAttrsSubset,
    loadTableListSources,
    mergeLoadedAttrs,
    normalizeRequestedAttrNames
};
