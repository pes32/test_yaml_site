function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

const FALLBACK_ATTR_CONFIG_CACHE = new Map();

function fallbackAttrConfig(attrName) {
    const key = typeof attrName === 'string' ? attrName.trim() : '';
    if (FALLBACK_ATTR_CONFIG_CACHE.has(key)) {
        return FALLBACK_ATTR_CONFIG_CACHE.get(key);
    }

    const fallback = key
        ? Object.freeze({
            widget: 'str',
            label: key
        })
        : Object.freeze({
            widget: 'str'
        });

    FALLBACK_ATTR_CONFIG_CACHE.set(key, fallback);
    return fallback;
}

function normalizeAttrConfig(attrName, attrConfig) {
    if (!attrConfig || typeof attrConfig !== 'object' || Array.isArray(attrConfig)) {
        return fallbackAttrConfig(attrName);
    }

    const normalized = {
        ...attrConfig
    };
    const widget = typeof attrConfig.widget === 'string'
        ? attrConfig.widget.trim()
        : '';

    normalized.widget = widget || 'str';
    return normalized;
}

function normalizeAttrsMap(attrsByName) {
    const attrs = asObject(attrsByName);
    const normalized = {};

    Object.entries(attrs).forEach(([attrName, attrConfig]) => {
        normalized[attrName] = normalizeAttrConfig(attrName, attrConfig);
    });

    return normalized;
}

function resolveAttrConfig(attrsByName, attrName) {
    const attrs = asObject(attrsByName);
    const key = typeof attrName === 'string' ? attrName.trim() : '';

    if (!key) {
        return fallbackAttrConfig('');
    }

    if (!Object.prototype.hasOwnProperty.call(attrs, key)) {
        return fallbackAttrConfig(key);
    }

    const config = attrs[key];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return fallbackAttrConfig(key);
    }

    return config;
}

export {
    normalizeAttrConfig,
    normalizeAttrsMap,
    resolveAttrConfig
};
