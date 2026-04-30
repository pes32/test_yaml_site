type NormalizeChoiceValueOptions = {
    coerceToString?: boolean;
};

export function normalizeScalarStringValue(value: unknown): string {
    if (Array.isArray(value)) {
        return value.length ? normalizeScalarStringValue(value[0]) : '';
    }

    return value == null ? '' : String(value);
}

function normalizeStringArrayValue(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeScalarStringValue(item));
    }

    if (value == null || value === '') {
        return [];
    }

    return [normalizeScalarStringValue(value)];
}

export function normalizeChoiceValue(
    value: unknown,
    multiselect: boolean,
    options: NormalizeChoiceValueOptions = {}
): unknown {
    if (options.coerceToString === true) {
        return multiselect
            ? normalizeStringArrayValue(value)
            : normalizeScalarStringValue(value);
    }

    if (multiselect) {
        return Array.isArray(value)
            ? value.slice()
            : value
              ? [value]
              : [];
    }

    return Array.isArray(value) ? value[0] || '' : value;
}
