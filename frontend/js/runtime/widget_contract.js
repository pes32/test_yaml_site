const STATEFUL_WIDGET_TYPES = new Set([
    'str',
    'text',
    'int',
    'float',
    'date',
    'time',
    'datetime',
    'ip',
    'ip_mask',
    'list',
    'voc'
]);

function normalizeWidgetType(configOrType) {
    if (typeof configOrType === 'string') {
        return configOrType.trim();
    }

    if (
        configOrType &&
        typeof configOrType === 'object' &&
        typeof configOrType.widget === 'string'
    ) {
        return configOrType.widget.trim();
    }

    return '';
}

function isStatefulWidgetType(type) {
    return STATEFUL_WIDGET_TYPES.has(normalizeWidgetType(type));
}

function isStatefulWidgetConfig(widgetConfig) {
    return isStatefulWidgetType(widgetConfig);
}

function isListMultiselect(widgetConfig) {
    return (
        normalizeWidgetType(widgetConfig) === 'list' &&
        widgetConfig &&
        widgetConfig.multiselect === true
    );
}

function isVocMultiselect(widgetConfig) {
    return (
        normalizeWidgetType(widgetConfig) === 'voc' &&
        widgetConfig &&
        widgetConfig.multiselect === true
    );
}

function isChoiceWidgetMultiselect(widgetConfig) {
    return isListMultiselect(widgetConfig) || isVocMultiselect(widgetConfig);
}

function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function formatNowValueForWidgetType(widgetType, now = new Date()) {
    const datePart = `${padDatePart(now.getDate())}.${padDatePart(now.getMonth() + 1)}.${now.getFullYear()}`;
    const timePart = `${padDatePart(now.getHours())}:${padDatePart(now.getMinutes())}`;

    if (widgetType === 'date') return datePart;
    if (widgetType === 'time') return timePart;
    if (widgetType === 'datetime') return `${datePart} ${timePart}`;
    return '';
}

function normalizeScalarStringValue(value) {
    if (Array.isArray(value)) {
        return value.length ? normalizeScalarStringValue(value[0]) : '';
    }

    return value == null ? '' : String(value);
}

function normalizeStringArrayValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeScalarStringValue(item));
    }

    if (value == null || value === '') {
        return [];
    }

    return [normalizeScalarStringValue(value)];
}

function normalizeStatefulWidgetValue(widgetConfig, value, options = {}) {
    const widgetType = normalizeWidgetType(widgetConfig);
    const now = options.now instanceof Date ? options.now : new Date();
    let rawValue = value;

    if (
        rawValue === undefined &&
        options.useDefaultOnUndefined === true &&
        widgetConfig &&
        Object.prototype.hasOwnProperty.call(widgetConfig, 'default')
    ) {
        rawValue = widgetConfig.default;
    }

    if (rawValue === undefined) {
        return isChoiceWidgetMultiselect(widgetConfig) ? [] : '';
    }

    if (
        (widgetType === 'date' ||
            widgetType === 'time' ||
            widgetType === 'datetime') &&
        rawValue === 'now'
    ) {
        return formatNowValueForWidgetType(widgetType, now);
    }

    if (isChoiceWidgetMultiselect(widgetConfig)) {
        return normalizeStringArrayValue(rawValue);
    }

    return normalizeScalarStringValue(rawValue);
}

function resolveInitialWidgetValue(widgetConfig, options = {}) {
    if (!isStatefulWidgetConfig(widgetConfig)) {
        return undefined;
    }

    return normalizeStatefulWidgetValue(widgetConfig, undefined, {
        ...options,
        useDefaultOnUndefined: true
    });
}

function normalizedStatefulValueEquals(left, right) {
    if (Array.isArray(left) && Array.isArray(right)) {
        if (left.length !== right.length) {
            return false;
        }

        for (let index = 0; index < left.length; index += 1) {
            if (left[index] !== right[index]) {
                return false;
            }
        }

        return true;
    }

    return left === right;
}

function normalizeListOption(item, index, duplicateValueCounts = null) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
        const hasValue = Object.prototype.hasOwnProperty.call(item, 'value');
        const hasLabel = Object.prototype.hasOwnProperty.call(item, 'label');
        const hasId = Object.prototype.hasOwnProperty.call(item, 'id');
        const value = hasValue
            ? normalizeScalarStringValue(item.value)
            : hasLabel
              ? normalizeScalarStringValue(item.label)
              : hasId
                ? normalizeScalarStringValue(item.id)
                : '';
        const label = hasLabel ? normalizeScalarStringValue(item.label) : value;
        const explicitId = hasId ? normalizeScalarStringValue(item.id) : '';
        const shouldUseFallbackId =
            !explicitId &&
            duplicateValueCounts &&
            duplicateValueCounts.get(value) > 1;

        return {
            id: explicitId || (shouldUseFallbackId ? `legacy:${index}:${value}` : `value:${value}`),
            label,
            value
        };
    }

    const value = normalizeScalarStringValue(item);
    const shouldUseFallbackId =
        duplicateValueCounts &&
        duplicateValueCounts.get(value) > 1;
    return {
        id: shouldUseFallbackId ? `legacy:${index}:${value}` : `value:${value}`,
        label: value,
        value
    };
}

function normalizeListOptions(source) {
    if (!Array.isArray(source)) {
        return [];
    }

    const duplicateValueCounts = new Map();

    source.forEach((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item) && Object.prototype.hasOwnProperty.call(item, 'id')) {
            return;
        }

        const normalized = normalizeListOption(item, -1, null);
        duplicateValueCounts.set(
            normalized.value,
            (duplicateValueCounts.get(normalized.value) || 0) + 1
        );
    });

    return source.map((item, index) => normalizeListOption(item, index, duplicateValueCounts));
}

export {
    STATEFUL_WIDGET_TYPES,
    formatNowValueForWidgetType,
    isChoiceWidgetMultiselect,
    isListMultiselect,
    isStatefulWidgetConfig,
    isStatefulWidgetType,
    isVocMultiselect,
    normalizeListOption,
    normalizeListOptions,
    normalizeScalarStringValue,
    normalizeStatefulWidgetValue,
    normalizeStringArrayValue,
    normalizeWidgetType,
    normalizedStatefulValueEquals,
    resolveInitialWidgetValue
};

export default {
    STATEFUL_WIDGET_TYPES,
    formatNowValueForWidgetType,
    isChoiceWidgetMultiselect,
    isListMultiselect,
    isStatefulWidgetConfig,
    isStatefulWidgetType,
    isVocMultiselect,
    normalizeListOption,
    normalizeListOptions,
    normalizeScalarStringValue,
    normalizeStatefulWidgetValue,
    normalizeStringArrayValue,
    normalizeWidgetType,
    normalizedStatefulValueEquals,
    resolveInitialWidgetValue
};
