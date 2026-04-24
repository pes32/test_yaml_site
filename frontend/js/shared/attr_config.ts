import { asRecord, isRecord } from './object_record.ts';
import type { UnknownRecord } from './object_record.ts';
import type { KnownWidgetType, WidgetType } from './widget_types.ts';

type CommonWidgetAttrs = {
    default?: unknown;
    label?: unknown;
    name?: unknown;
    readonly?: boolean;
    rows?: number | string;
    sup_text?: unknown;
    value?: unknown;
    widget: WidgetType;
    width?: number | string;
};

type ValidationWidgetAttrs = {
    err_text?: unknown;
    placeholder?: unknown;
    regex?: unknown;
};

type ChoiceWidgetAttrs = {
    columns?: unknown[];
    editable?: boolean;
    multiselect?: boolean;
    source?: unknown;
};

type ActionWidgetAttrs = {
    command?: unknown;
    dialog?: unknown;
    fon?: unknown;
    hint?: unknown;
    icon?: unknown;
    output_attrs?: unknown;
    size?: number | string;
    url?: unknown;
};

type MediaWidgetAttrs = {
    source?: unknown;
};

type LegacyYamlAttrCompat = {
    data?: unknown;
};

type DynamicYamlAttrExtensions = {
    [key: `data_${string}`]: unknown;
    [key: `x_${string}`]: unknown;
};

type AttrConfigRecord = CommonWidgetAttrs &
    ValidationWidgetAttrs &
    ChoiceWidgetAttrs &
    ActionWidgetAttrs &
    MediaWidgetAttrs &
    LegacyYamlAttrCompat &
    DynamicYamlAttrExtensions;

type AttrConfigMap = Record<string, AttrConfigRecord>;

const FALLBACK_ATTR_CONFIG_CACHE = new Map<string, AttrConfigRecord>();

function fallbackAttrConfig(attrName: string): AttrConfigRecord {
    const key = attrName.trim();
    const cached = FALLBACK_ATTR_CONFIG_CACHE.get(key);
    if (cached) {
        return cached;
    }

    const fallback = Object.freeze(
        key
            ? {
                  widget: 'str',
                  label: key
              }
            : {
                  widget: 'str'
              }
    );

    FALLBACK_ATTR_CONFIG_CACHE.set(key, fallback);
    return fallback;
}

function normalizeAttrConfig(attrName: unknown, attrConfig: unknown): AttrConfigRecord {
    const key = typeof attrName === 'string' ? attrName.trim() : '';
    if (!isRecord(attrConfig)) {
        return fallbackAttrConfig(key);
    }

    const config = attrConfig as Partial<AttrConfigRecord> & UnknownRecord;
    const widget = typeof config.widget === 'string'
        ? config.widget.trim()
        : '';

    return {
        ...config,
        widget: widget || 'str'
    };
}

function normalizeAttrsMap(attrsByName: unknown): AttrConfigMap {
    const attrs = asRecord(attrsByName);
    const normalized: AttrConfigMap = {};

    Object.entries(attrs).forEach(([attrName, attrConfig]) => {
        normalized[attrName] = normalizeAttrConfig(attrName, attrConfig);
    });

    return normalized;
}

function resolveAttrConfig(attrsByName: unknown, attrName: unknown): AttrConfigRecord {
    const attrs = asRecord(attrsByName);
    const key = typeof attrName === 'string' ? attrName.trim() : '';

    if (!key) {
        return fallbackAttrConfig('');
    }

    if (!Object.prototype.hasOwnProperty.call(attrs, key)) {
        return fallbackAttrConfig(key);
    }

    return normalizeAttrConfig(key, attrs[key]);
}

export {
    normalizeAttrConfig,
    normalizeAttrsMap,
    resolveAttrConfig
};

export type {
    ActionWidgetAttrs,
    AttrConfigMap,
    AttrConfigRecord,
    ChoiceWidgetAttrs,
    CommonWidgetAttrs,
    DynamicYamlAttrExtensions,
    KnownWidgetType,
    LegacyYamlAttrCompat,
    MediaWidgetAttrs,
    ValidationWidgetAttrs,
    WidgetType
};
