'use strict';

import { normalizeAttrsMap } from '../shared/attr_config.ts';
import type {
    AttrConfigMap,
    AttrsPayload,
    ModalPayload,
    PageConfigRecord,
    PageConfigState,
    PagePayload,
    ParsedGuiModal,
    UnknownRecord
} from './page_contract.ts';

type NormalizedPageState = {
    attrs: AttrConfigMap;
    diagnostics: UnknownRecord[];
    page: PageConfigRecord | null;
    snapshotVersion: string;
};

type NormalizedAttrsState = {
    attrs: AttrConfigMap;
    diagnostics: UnknownRecord[];
    missingNames: string[];
    resolvedNames: string[];
    snapshotVersion: string;
};

type NormalizedModalState = {
    attrs: AttrConfigMap;
    dependencies: UnknownRecord;
    diagnostics: UnknownRecord[];
    missingNames: string[];
    modal: ParsedGuiModal | null;
    resolvedNames: string[];
    snapshotVersion: string;
};

function asObject<T extends UnknownRecord>(value: unknown): T | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as T)
        : null;
}

function uniqueNames(items: unknown): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    (Array.isArray(items) ? items : []).forEach((item) => {
        const value = String(item || '').trim();
        if (!value || seen.has(value)) {
            return;
        }
        seen.add(value);
        result.push(value);
    });

    return result;
}

function normalizeDiagnostics(value: unknown): UnknownRecord[] {
    return Array.isArray(value)
        ? value.filter((item): item is UnknownRecord => !!asObject(item))
        : [];
}

function createEmptyStore(): PageConfigState {
    return {
        pageName: '',
        snapshotVersion: '',
        diagnostics: [],
        pageConfig: null,
        attrsByName: {}
    };
}

function normalizePageState(payload: PagePayload): NormalizedPageState {
    const page = asObject<PageConfigRecord>(payload.page);
    const attrs = normalizeAttrsMap(payload.attrs) as AttrConfigMap;

    return {
        page: page && Object.keys(page).length ? page : null,
        attrs,
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        snapshotVersion: String(payload.snapshotVersion || '')
    };
}

function normalizeAttrsState(payload: AttrsPayload): NormalizedAttrsState {
    const attrs = normalizeAttrsMap(payload.attrs) as AttrConfigMap;
    const resolvedNames = uniqueNames(payload.resolvedNames || Object.keys(attrs));

    return {
        attrs,
        resolvedNames,
        missingNames: uniqueNames(payload.missingNames || []),
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        snapshotVersion: String(payload.snapshotVersion || '')
    };
}

function normalizeModalState(payload: ModalPayload): NormalizedModalState {
    const modal = asObject<ParsedGuiModal>(payload.modal);
    const attrs = normalizeAttrsMap(payload.attrs) as AttrConfigMap;

    return {
        modal: modal && Object.keys(modal).length ? modal : null,
        attrs,
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        resolvedNames: uniqueNames(payload.resolvedNames || Object.keys(attrs)),
        missingNames: uniqueNames(payload.missingNames || []),
        dependencies: asObject(payload.dependencies) || {},
        snapshotVersion: String(payload.snapshotVersion || '')
    };
}

function bootstrap(store: PageConfigState, payload: PagePayload): PageConfigState {
    const normalized = normalizePageState(payload);

    store.pageConfig = normalized.page;
    store.pageName = normalized.page?.name
        ? String(normalized.page.name)
        : '';
    store.snapshotVersion = normalized.snapshotVersion;
    store.diagnostics = normalized.diagnostics;
    store.attrsByName = Object.assign({}, normalized.attrs);

    return store;
}

function mergeAttrs(
    store: PageConfigState,
    payload: AttrsPayload,
    _loadedNames?: unknown
): NormalizedAttrsState {
    const normalized = normalizeAttrsState(payload);

    if (normalized.snapshotVersion) {
        store.snapshotVersion = normalized.snapshotVersion;
    }
    store.diagnostics = normalized.diagnostics.slice();
    Object.assign(store.attrsByName, normalized.attrs);

    return normalized;
}

function mergeModalPayload(
    store: PageConfigState,
    payload: ModalPayload
): NormalizedModalState {
    const normalized = normalizeModalState(payload);

    if (normalized.snapshotVersion) {
        store.snapshotVersion = normalized.snapshotVersion;
    }
    store.diagnostics = normalized.diagnostics.slice();

    mergeAttrs(store, {
        attrs: normalized.attrs,
        resolvedNames: normalized.resolvedNames,
        missingNames: normalized.missingNames,
        diagnostics: normalized.diagnostics,
        snapshotVersion: normalized.snapshotVersion
    });

    return normalized;
}

const PageRuntimeStore = {
    createEmptyStore,
    normalizePageState,
    normalizeAttrsState,
    normalizeModalState,
    bootstrap,
    mergeAttrs,
    mergeModalPayload
};

export {
    PageRuntimeStore,
    bootstrap,
    createEmptyStore,
    mergeAttrs,
    mergeModalPayload,
    normalizeAttrsState,
    normalizeModalState,
    normalizePageState
};

export default PageRuntimeStore;
