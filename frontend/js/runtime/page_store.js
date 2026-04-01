'use strict';

import { normalizeAttrsMap } from './attrs_resolver.js';

/**
 * Snapshot-derived page state.
 *
 * @typedef {Object} PageConfigState
 * @property {string} pageName
 * @property {string} snapshotVersion
 * @property {Array<object>} diagnostics
 * @property {object|null} pageConfig
 * @property {Record<string, object>} attrsByName
 */

function asObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value
            : {};
    }

function uniqueNames(items) {
        const seen = new Set();
        const result = [];
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

function createEmptyStore() {
        return {
            pageName: '',
            snapshotVersion: '',
            diagnostics: [],
            pageConfig: null,
            attrsByName: {}
        };
    }

function normalizePageState(payload) {
        const page = asObject(payload && payload.page);
        const attrs = normalizeAttrsMap(payload && payload.attrs);
        return {
            page: Object.keys(page).length ? page : null,
            attrs,
            diagnostics: Array.isArray(payload && payload.diagnostics) ? payload.diagnostics : [],
            snapshotVersion: String(payload && payload.snapshotVersion || '')
        };
    }

function normalizeAttrsState(payload) {
        const attrs = normalizeAttrsMap(payload && payload.attrs);
        const resolvedNames = uniqueNames(
            (payload && payload.resolvedNames)
            || Object.keys(attrs)
        );
        return {
            attrs,
            resolvedNames,
            missingNames: uniqueNames(
                (payload && payload.missingNames)
                || []
            ),
            diagnostics: Array.isArray(payload && payload.diagnostics) ? payload.diagnostics : [],
            snapshotVersion: String(payload && payload.snapshotVersion || '')
        };
    }

function normalizeModalState(payload) {
        const modal = asObject(payload && payload.modal);
        const attrs = normalizeAttrsMap(payload && payload.attrs);
        return {
            modal: Object.keys(modal).length ? modal : null,
            attrs: attrs,
            diagnostics: Array.isArray(payload && payload.diagnostics) ? payload.diagnostics : [],
            resolvedNames: uniqueNames(
                (payload && payload.resolvedNames)
                || Object.keys(attrs)
            ),
            missingNames: uniqueNames(
                (payload && payload.missingNames)
                || []
            ),
            dependencies: asObject(payload && payload.dependencies),
            snapshotVersion: String(payload && payload.snapshotVersion || '')
        };
    }

function bootstrap(store, payload) {
        const normalized = normalizePageState(payload || {});
        store.pageConfig = normalized.page;
        store.pageName = normalized.page && normalized.page.name
            ? String(normalized.page.name)
            : '';
        store.snapshotVersion = normalized.snapshotVersion;
        store.diagnostics = normalized.diagnostics;
        store.attrsByName = Object.assign({}, normalized.attrs);
        return store;
    }

function mergeAttrs(store, payload, loadedNames) {
        const normalized = normalizeAttrsState(payload || {});
        const attrs = normalized.attrs;

        if (normalized.snapshotVersion) {
            store.snapshotVersion = normalized.snapshotVersion;
        }
        store.diagnostics = normalized.diagnostics.slice();

        Object.assign(store.attrsByName, attrs);
        return normalized;
    }

function mergeModalPayload(store, payload) {
        const normalized = normalizeModalState(payload || {});
        if (normalized.snapshotVersion) {
            store.snapshotVersion = normalized.snapshotVersion;
        }
        store.diagnostics = normalized.diagnostics.slice();
        mergeAttrs(
            store,
            {
                attrs: normalized.attrs,
                resolvedNames: normalized.resolvedNames,
                missingNames: normalized.missingNames,
                diagnostics: normalized.diagnostics,
                snapshotVersion: normalized.snapshotVersion
            },
            normalized.resolvedNames
        );
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
