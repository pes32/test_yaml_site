function validateRegexValue(rawValue: unknown, regex: unknown, errText?: string): string {
    if (!regex) {
        return '';
    }

    try {
        const pattern = regex instanceof RegExp || typeof regex === 'string'
            ? (typeof regex === 'string' ? new RegExp(regex) : regex)
            : null;
        if (!pattern) {
            return '';
        }

        return rawValue !== '' && !pattern.test(String(rawValue))
            ? errText || 'Неверный формат'
            : '';
    } catch {
        return '';
    }
}

export {
    validateRegexValue
};
