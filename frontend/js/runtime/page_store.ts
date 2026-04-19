'use strict';

import { normalizeAttrsMap } from '../shared/attr_config.ts';
import { asRecord, isRecord } from '../shared/object_record.ts';
import type {
    AttrsResponse,
    ModalResponse,
    PageResponse
} from './api_contract.ts';
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

type NormalizedPageState = Omit<PageResponse, 'attrs' | 'page'> & {
    attrs: AttrConfigMap;
    page: PageConfigRecord | null;
};

type NormalizedAttrsState = Omit<AttrsResponse, 'attrs'> & {
    attrs: AttrConfigMap;
};

type NormalizedModalState = Omit<ModalResponse, 'attrs' | 'modal'> & {
    attrs: AttrConfigMap;
    modal: ParsedGuiModal | null;
};

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
        ? value.filter(isRecord)
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
    const page = asRecord<PageConfigRecord>(payload.page);
    const attrs = normalizeAttrsMap(payload.attrs);

    return {
        page: page && Object.keys(page).length ? page : null,
        attrs,
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        snapshotVersion: String(payload.snapshotVersion || '')
    };
}

function normalizeAttrsState(payload: AttrsPayload): NormalizedAttrsState {
    const attrs = normalizeAttrsMap(payload.attrs);
    const resolvedNames = uniqueNames(payload.resolvedNames || Object.keys(attrs));

    return {
        attrs,
        page: String(payload.page || ''),
        resolvedNames,
        missingNames: uniqueNames(payload.missingNames || []),
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        snapshotVersion: String(payload.snapshotVersion || '')
    };
}

function normalizeModalState(payload: ModalPayload): NormalizedModalState {
    const modal = asRecord<ParsedGuiModal>(payload.modal);
    const attrs = normalizeAttrsMap(payload.attrs);

    return {
        modal: modal && Object.keys(modal).length ? modal : null,
        attrs,
        page: String(payload.page || ''),
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        resolvedNames: uniqueNames(payload.resolvedNames || Object.keys(attrs)),
        missingNames: uniqueNames(payload.missingNames || []),
        dependencies: asRecord(payload.dependencies),
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
        page: normalized.page,
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
