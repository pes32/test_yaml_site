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

type NormalizedAttrsState = Omit<AttrsResponse, 'attrs' | 'snapshotVersion'> & {
    attrs: AttrConfigMap;
    snapshotVersion: string;
};

type NormalizedModalState = Omit<ModalResponse, 'attrs' | 'modal' | 'snapshotVersion'> & {
    attrs: AttrConfigMap;
    modal: ParsedGuiModal | null;
    snapshotVersion: string;
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
        attrsByName: {},
        tableRuntimeByName: {}
    };
}

function bootstrap(store: PageConfigState, payload: PagePayload): PageConfigState {
    const page = asRecord<PageConfigRecord>(payload.page);
    const attrs = normalizeAttrsMap(payload.attrs);
    const tableRuntime = asRecord<Record<string, UnknownRecord>>(payload.tableRuntime);

    store.pageConfig = page && Object.keys(page).length ? page : null;
    store.pageName = store.pageConfig?.name
        ? String(store.pageConfig.name)
        : '';
    store.snapshotVersion = String(payload.snapshotVersion || '');
    store.diagnostics = normalizeDiagnostics(payload.diagnostics);
    store.attrsByName = Object.assign({}, attrs);
    store.tableRuntimeByName = Object.assign({}, tableRuntime);

    return store;
}

function applyAttrsSnapshotToStore(
    store: PageConfigState,
    snapshotVersion: string,
    diagnostics: UnknownRecord[],
    attrs: AttrConfigMap,
    tableRuntime?: UnknownRecord
): void {
    if (snapshotVersion) {
        store.snapshotVersion = snapshotVersion;
    }
    store.diagnostics = diagnostics.slice();
    Object.assign(store.attrsByName, attrs);
    Object.assign(store.tableRuntimeByName, tableRuntime || {});
}

function patchAttrConfig(
    store: PageConfigState,
    attrName: unknown,
    patch: unknown
): AttrConfigMap {
    const key = String(attrName || '').trim();
    const patchRecord = asRecord(patch);
    if (!key || !Object.keys(patchRecord).length) {
        return store.attrsByName;
    }

    const current: AttrConfigMap = store.attrsByName || {};
    const currentAttr = asRecord(current[key]);
    const normalizedPatch = normalizeAttrsMap({
        [key]: {
            ...currentAttr,
            ...patchRecord
        }
    });
    store.attrsByName = {
        ...current,
        [key]: normalizedPatch[key]
    };
    return store.attrsByName;
}

function mergeAttrs(
    store: PageConfigState,
    payload: AttrsPayload,
    _loadedNames?: unknown
): NormalizedAttrsState {
    const attrs = normalizeAttrsMap(payload.attrs);
    const tableRuntime = asRecord<Record<string, UnknownRecord>>(payload.tableRuntime);
    const normalized: NormalizedAttrsState = {
        attrs,
        page: String(payload.page || ''),
        resolvedNames: uniqueNames(payload.resolvedNames || Object.keys(attrs)),
        missingNames: uniqueNames(payload.missingNames || []),
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        snapshotVersion: String(payload.snapshotVersion || ''),
        tableRuntime
    };

    applyAttrsSnapshotToStore(
        store,
        normalized.snapshotVersion,
        normalized.diagnostics,
        normalized.attrs,
        normalized.tableRuntime
    );

    return normalized;
}

function mergeModalPayload(
    store: PageConfigState,
    payload: ModalPayload
): NormalizedModalState {
    const modal = asRecord<ParsedGuiModal>(payload.modal);
    const attrs = normalizeAttrsMap(payload.attrs);
    const tableRuntime = asRecord<Record<string, UnknownRecord>>(payload.tableRuntime);
    const normalized: NormalizedModalState = {
        modal: modal && Object.keys(modal).length ? modal : null,
        attrs,
        page: String(payload.page || ''),
        diagnostics: normalizeDiagnostics(payload.diagnostics),
        resolvedNames: uniqueNames(payload.resolvedNames || Object.keys(attrs)),
        missingNames: uniqueNames(payload.missingNames || []),
        dependencies: asRecord(payload.dependencies),
        snapshotVersion: String(payload.snapshotVersion || ''),
        tableRuntime
    };

    applyAttrsSnapshotToStore(
        store,
        normalized.snapshotVersion,
        normalized.diagnostics,
        normalized.attrs,
        normalized.tableRuntime
    );

    return normalized;
}

const PageRuntimeStore = {
    createEmptyStore,
    bootstrap,
    mergeAttrs,
    mergeModalPayload,
    patchAttrConfig
};

export {
    PageRuntimeStore,
    bootstrap,
    createEmptyStore,
    mergeAttrs,
    mergeModalPayload,
    patchAttrConfig
};

export default PageRuntimeStore;
