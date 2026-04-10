'use strict';

import { resolveAttrConfig } from '../shared/attr_config.ts';
import type {
    AttrConfigMap,
    PageConfigState,
    PageSessionState,
    ParsedGuiState,
    UnknownRecord
} from './page_contract.ts';
import {
    isStatefulWidgetConfig,
    normalizeStatefulWidgetValue,
    normalizedStatefulValueEquals,
    type NormalizedStatefulWidgetValue,
    resolveInitialWidgetValue
} from './widget_contract.ts';

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

function toStringList(items: unknown): string[] {
    return uniqueNames(items);
}

function asObject<T extends UnknownRecord>(value: unknown): T | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as T)
        : null;
}

function asPlainObject<T extends UnknownRecord>(value: unknown): T | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null
        ? (value as T)
        : null;
}

function plainValueEquals(left: unknown, right: unknown, depth = 0): boolean {
    if (Object.is(left, right)) {
        return true;
    }

    if (depth > 20) {
        return false;
    }

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right)) {
            return false;
        }
        if (left.length !== right.length) {
            return false;
        }
        for (let index = 0; index < left.length; index += 1) {
            if (!plainValueEquals(left[index], right[index], depth + 1)) {
                return false;
            }
        }
        return true;
    }

    const leftObject = asPlainObject<Record<string, unknown>>(left);
    const rightObject = asPlainObject<Record<string, unknown>>(right);
    if (!leftObject || !rightObject) {
        return false;
    }

    const leftKeys = Object.keys(leftObject);
    const rightKeys = Object.keys(rightObject);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(rightObject, key)) {
            return false;
        }
        if (!plainValueEquals(leftObject[key], rightObject[key], depth + 1)) {
            return false;
        }
    }

    return true;
}

function createEmptyStore(): PageSessionState {
    return {
        widgetValues: {},
        loadedAttrNames: [],
        loadedModalIds: [],
        parsedGui: null
    };
}

function bootstrap(
    store: PageSessionState,
    configState: PageConfigState | null | undefined
): PageSessionState {
    const attrsByName = asObject<AttrConfigMap>(configState?.attrsByName) || {};
    store.loadedAttrNames = uniqueNames(Object.keys(attrsByName));
    store.loadedModalIds = [];
    store.parsedGui = null;
    return store;
}

function mergeLoadedAttrNames(store: PageSessionState, names: unknown): string[] {
    store.loadedAttrNames = uniqueNames([
        ...(store.loadedAttrNames || []),
        ...toStringList(names)
    ]);
    return store.loadedAttrNames;
}

function markModalLoaded(store: PageSessionState, modalId: unknown): string[] {
    store.loadedModalIds = uniqueNames([
        ...(store.loadedModalIds || []),
        String(modalId || '').trim()
    ]);
    return store.loadedModalIds;
}

function setParsedGui(store: PageSessionState, parsedGui: unknown): ParsedGuiState | null {
    store.parsedGui = parsedGui && typeof parsedGui === 'object'
        ? (parsedGui as ParsedGuiState)
        : null;
    return store.parsedGui;
}

function initializeWidgetValues(
    store: PageSessionState,
    attrsByName: unknown
): Record<string, unknown> {
    const attrs = asObject<AttrConfigMap>(attrsByName) || {};
    const nextValues = { ...(asObject<Record<string, unknown>>(store.widgetValues) || {}) };
    let changed = false;
    const now = new Date();

    Object.entries(attrs).forEach(([name, config]) => {
        if (!isStatefulWidgetConfig(config)) {
            return;
        }

        const hasCurrentValue = Object.prototype.hasOwnProperty.call(nextValues, name);
        const normalizedValue = hasCurrentValue
            ? normalizeStatefulWidgetValue(
                config,
                nextValues[name] as NormalizedStatefulWidgetValue | undefined,
                { now }
            )
            : resolveInitialWidgetValue(config, { now });

        if (
            hasCurrentValue &&
            normalizedStatefulValueEquals(
                nextValues[name] as NormalizedStatefulWidgetValue | undefined,
                normalizedValue
            )
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

function setWidgetValue(
    store: PageSessionState,
    attrsByName: unknown,
    name: unknown,
    value: unknown
): Record<string, unknown> {
    const key = String(name || '').trim();
    if (!key) {
        return store.widgetValues;
    }

    const currentValues = asObject<Record<string, unknown>>(store.widgetValues) || {};
    const attrs = asObject<AttrConfigMap>(attrsByName) || {};
    const config = resolveAttrConfig(attrs, key);
    const normalizedValue = isStatefulWidgetConfig(config)
        ? normalizeStatefulWidgetValue(config, value)
        : value;
    const previousValue = Object.prototype.hasOwnProperty.call(currentValues, key)
        ? currentValues[key]
        : undefined;
    const isEqual = isStatefulWidgetConfig(config)
        ? normalizedStatefulValueEquals(
            previousValue as NormalizedStatefulWidgetValue | undefined,
            normalizedValue as NormalizedStatefulWidgetValue | undefined
        )
        : plainValueEquals(previousValue, normalizedValue);

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
