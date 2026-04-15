function asTrimmedString(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (value == null) {
        return '';
    }

    return String(value).trim();
}

export { asTrimmedString };
