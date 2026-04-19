import frontendApiClient from './api_client.ts';
import { resolveTableDependencies } from '../shared/table_attr_dependencies.ts';
import PageRuntimeStore from './page_store.ts';
import PageSessionStore from './page_session_store.ts';
import { logDiagnosticsToConsole } from './diagnostics.ts';
import { collectActiveWidgetNames } from './page_selectors.ts';
import type {
    AttrConfigMap,
    AttrsPayload,
    PageAttrConfig,
    PageConfigState,
    PageSessionState,
    ParsedGuiMenu
} from './page_contract.ts';

type AttrsLoaderHost = {
    activeMenu: ParsedGuiMenu | null;
    activeTabIndex: number;
    allAttrs: AttrConfigMap;
    configState: PageConfigState;
    diagnostics: unknown[];
    getCurrentPageName(): string;
    getWidgetConfig?(widgetName: string): PageAttrConfig;
    loadedAttrNames: string[];
    sessionState: PageSessionState;
};

function normalizeStringList(names: unknown): string[] {
    return (Array.isArray(names) ? names : [])
        .map((name) => (typeof name === 'string' ? name.trim() : ''))
        .filter(Boolean);
}

function fetchAttrsSubset(vm: AttrsLoaderHost, names: unknown): Promise<AttrsPayload | Record<string, never>> {
    const normalizedNames = normalizeStringList(names);
    if (normalizedNames.length === 0) {
        return Promise.resolve({});
    }

    return frontendApiClient.fetchAttrs(vm.getCurrentPageName(), normalizedNames);
}

function mergeLoadedAttrs(
    vm: AttrsLoaderHost,
    payload: AttrsPayload | null | undefined,
    loadedNames: unknown
) {
    const normalized = PageRuntimeStore.mergeAttrs(vm.configState, payload || {}, loadedNames);
    PageSessionStore.mergeLoadedAttrNames(
        vm.sessionState,
        [
            ...(normalized.resolvedNames || []),
            ...normalizeStringList(loadedNames)
        ]
    );
    PageSessionStore.initializeWidgetValues(vm.sessionState, vm.allAttrs);
    logDiagnosticsToConsole('attrs', vm.diagnostics);
    return normalized;
}

function normalizeRequestedAttrNames(names: unknown): string[] {
    const requested: string[] = [];
    const seen = new Set<string>();
    normalizeStringList(names).forEach((name) => {
        if (seen.has(name)) {
            return;
        }
        seen.add(name);
        requested.push(name);
    });
    return requested;
}

async function loadTableListSources(vm: AttrsLoaderHost, attrNames: unknown): Promise<void> {
    const names = normalizeStringList(attrNames);
    if (!names.length) {
        return;
    }

    const extra = new Set<string>();
    names.forEach((name) => {
        const cfg = typeof vm.getWidgetConfig === 'function'
            ? vm.getWidgetConfig(name)
            : vm.allAttrs[name];
        const tableAttrs = cfg && 'table_attrs' in cfg ? cfg.table_attrs : null;
        if (!cfg || cfg.widget !== 'table' || !tableAttrs) {
            return;
        }

        const deps = resolveTableDependencies({ table_attrs: tableAttrs });
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

async function ensureAttrsLoaded(vm: AttrsLoaderHost, names: unknown) {
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

async function fetchActiveViewAttrs(vm: AttrsLoaderHost): Promise<void> {
    if (!vm.activeMenu) {
        return;
    }

    const activeNames = collectActiveWidgetNames(vm.activeMenu, vm.activeTabIndex);
    await ensureAttrsLoaded(vm, activeNames);
}

export type { AttrsLoaderHost };

export {
    ensureAttrsLoaded,
    fetchActiveViewAttrs,
    fetchAttrsSubset,
    loadTableListSources,
    mergeLoadedAttrs,
    normalizeRequestedAttrNames
};
