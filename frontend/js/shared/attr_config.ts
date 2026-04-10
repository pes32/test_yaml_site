type AttrConfigRecord = Record<string, unknown> & {
    label?: unknown;
    source?: unknown;
    widget?: unknown;
};

type AttrConfigMap = Record<string, AttrConfigRecord>;

function asObject<T extends Record<string, unknown>>(value: unknown): T | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as T)
        : null;
}

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
    const config = asObject<AttrConfigRecord>(attrConfig);

    if (!config) {
        return fallbackAttrConfig(key);
    }

    const widget = typeof config.widget === 'string'
        ? config.widget.trim()
        : '';

    return {
        ...config,
        widget: widget || 'str'
    };
}

function normalizeAttrsMap(attrsByName: unknown): AttrConfigMap {
    const attrs = asObject<Record<string, unknown>>(attrsByName) || {};
    const normalized: AttrConfigMap = {};

    Object.entries(attrs).forEach(([attrName, attrConfig]) => {
        normalized[attrName] = normalizeAttrConfig(attrName, attrConfig);
    });

    return normalized;
}

function resolveAttrConfig(attrsByName: unknown, attrName: unknown): AttrConfigRecord {
    const attrs = asObject<Record<string, unknown>>(attrsByName) || {};
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
    AttrConfigMap,
    AttrConfigRecord
};
