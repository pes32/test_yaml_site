'use strict';

import { normalizeAttrsMap } from '../shared/attr_config.ts';
import { asRecord, isRecord } from '../shared/object_record.ts';
import { uniqueNames } from '../shared/string_list.ts';
import type {
    AttrsResponse,
    ModalResponse
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

type NormalizedAttrsState = Omit<AttrsResponse, 'attrs'> & {
    attrs: AttrConfigMap;
};

type NormalizedModalState = Omit<ModalResponse, 'attrs' | 'modal'> & {
    attrs: AttrConfigMap;
    modal: ParsedGuiModal | null;
};

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

function bootstrap(store: PageConfigState, payload: PagePayload): PageConfigState {
    const page = asRecord<PageConfigRecord>(payload.page);
    const attrs = normalizeAttrsMap(payload.attrs);

    store.pageConfig = page && Object.keys(page).length ? page : null;
    store.pageName = store.pageConfig?.name
        ? String(store.pageConfig.name)
        : '';
    store.snapshotVersion = String(payload.snapshotVersion || '');
    store.diagnostics = normalizeDiagnostics(payload.diagnostics);
    store.attrsByName = Object.assign({}, attrs);

    return store;
}

function mergeAttrs(
    store: PageConfigState,
    payload: AttrsPayload,
    _loadedNames?: unknown
): NormalizedAttrsState {
    const attrs = normalizeAttrsMap(payload.attrs);
    const normalized: NormalizedAttrsState = {
        attrs,
        page: String(payload.page || ''),
        resolvedNames: uniqueNames(payload.resolvedNames || Object.keys(attrs)),
        missingNames: uniqueNames(payload.missingNames || []),
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        snapshotVersion: String(payload.snapshotVersion || '')
    };

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
    const modal = asRecord<ParsedGuiModal>(payload.modal);
    const attrs = normalizeAttrsMap(payload.attrs);
    const normalized: NormalizedModalState = {
        modal: modal && Object.keys(modal).length ? modal : null,
        attrs,
        page: String(payload.page || ''),
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        resolvedNames: uniqueNames(payload.resolvedNames || Object.keys(attrs)),
        missingNames: uniqueNames(payload.missingNames || []),
        dependencies: asRecord(payload.dependencies),
        snapshotVersion: String(payload.snapshotVersion || '')
    };

    if (normalized.snapshotVersion) {
        store.snapshotVersion = normalized.snapshotVersion;
    }
    store.diagnostics = normalized.diagnostics.slice();
    Object.assign(store.attrsByName, normalized.attrs);

    return normalized;
}

const PageRuntimeStore = {
    createEmptyStore,
    bootstrap,
    mergeAttrs,
    mergeModalPayload
};

export {
    PageRuntimeStore,
    bootstrap,
    createEmptyStore,
    mergeAttrs,
    mergeModalPayload
};

export default PageRuntimeStore;
