'use strict';

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

    Object.entries(attrs).forEach(([name, config]) => {
        if (Object.prototype.hasOwnProperty.call(nextValues, name)) {
            return;
        }

        if (config && typeof config === 'object' && config.default !== undefined) {
            nextValues[name] = config.default;
            changed = true;
        }
    });

    if (changed) {
        store.widgetValues = nextValues;
    }

    return store.widgetValues;
}

function setWidgetValue(store, name, value) {
    const key = String(name || '').trim();
    if (!key) {
        return store.widgetValues;
    }

    store.widgetValues = {
        ...asObject(store.widgetValues),
        [key]: value
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
