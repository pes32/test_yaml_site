'use strict';

import { resolveAttrConfig } from './attrs_resolver.js';
import {
    isStatefulWidgetConfig,
    normalizeStatefulWidgetValue,
    normalizedStatefulValueEquals,
    resolveInitialWidgetValue
} from './widget_contract.js';

/**
 * Session/runtime state that is not derived directly from snapshot payload.
 *
 * @typedef {Object} PageSessionState
 * @property {Record<string, unknown>} widgetValues
 * @property {string[]} loadedAttrNames
 * @property {string[]} loadedModalIds
 * @property {object|null} parsedGui
 */

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

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function createEmptyStore() {
    return {
        widgetValues: {},
        loadedAttrNames: [],
        loadedModalIds: [],
        parsedGui: null
    };
}

function bootstrap(store, configState) {
    const attrsByName = asObject(configState && configState.attrsByName);
    store.loadedAttrNames = uniqueNames(Object.keys(attrsByName));
    store.loadedModalIds = [];
    store.parsedGui = null;
    return store;
}

function mergeLoadedAttrNames(store, names) {
    store.loadedAttrNames = uniqueNames([].concat(store.loadedAttrNames || [], names || []));
    return store.loadedAttrNames;
}

function markModalLoaded(store, modalId) {
    store.loadedModalIds = uniqueNames([].concat(store.loadedModalIds || [], [modalId]));
    return store.loadedModalIds;
}

function setParsedGui(store, parsedGui) {
    store.parsedGui = parsedGui && typeof parsedGui === 'object'
        ? parsedGui
        : null;
    return store.parsedGui;
}

function initializeWidgetValues(store, attrsByName) {
    const attrs = asObject(attrsByName);
    const nextValues = { ...asObject(store.widgetValues) };
    let changed = false;
    const now = new Date();

    Object.entries(attrs).forEach(([name, config]) => {
        if (!isStatefulWidgetConfig(config)) {
            return;
        }

        const hasCurrentValue = Object.prototype.hasOwnProperty.call(nextValues, name);
        const normalizedValue = hasCurrentValue
            ? normalizeStatefulWidgetValue(config, nextValues[name], { now })
            : resolveInitialWidgetValue(config, { now });

        if (
            hasCurrentValue &&
            normalizedStatefulValueEquals(nextValues[name], normalizedValue)
        ) {
            return;
        }

        nextValues[name] = normalizedValue;
        changed = true;
    });

    if (changed) {
        store.widgetValues = nextValues;
    }

    return store.widgetValues;
}

function setWidgetValue(store, attrsByName, name, value) {
    const key = String(name || '').trim();
    if (!key) {
        return store.widgetValues;
    }

    const currentValues = asObject(store.widgetValues);
    const attrs = asObject(attrsByName);
    const config = resolveAttrConfig(attrs, key);
    const normalizedValue = isStatefulWidgetConfig(config)
        ? normalizeStatefulWidgetValue(config, value)
        : value;
    const previousValue = Object.prototype.hasOwnProperty.call(currentValues, key)
        ? currentValues[key]
        : undefined;
    const isEqual = isStatefulWidgetConfig(config)
        ? normalizedStatefulValueEquals(previousValue, normalizedValue)
        : previousValue === normalizedValue;

    if (isEqual) {
        return store.widgetValues;
    }

    store.widgetValues = {
        ...currentValues,
        [key]: normalizedValue
    };

    return store.widgetValues;
}

const PageSessionStore = {
    bootstrap,
    createEmptyStore,
    initializeWidgetValues,
    markModalLoaded,
    mergeLoadedAttrNames,
    setParsedGui,
    setWidgetValue
};

export {
    PageSessionStore,
    bootstrap,
    createEmptyStore,
    initializeWidgetValues,
    markModalLoaded,
    mergeLoadedAttrNames,
    setParsedGui,
    setWidgetValue
};

export default PageSessionStore;
