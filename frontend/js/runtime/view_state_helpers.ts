type BooleanRecord = Record<string, boolean>;
type NumberRecord = Record<string, number>;

function normalizeViewPart(part: string | number | null | undefined | false): string {
    if (part === false || part == null) {
        return '';
    }

    return typeof part === 'number'
        ? String(part)
        : String(part).trim();
}

function buildViewId(...parts: Array<string | number | null | undefined | false>): string {
    return parts
        .map((part) => normalizeViewPart(part))
        .filter(Boolean)
        .join('-');
}

function resolveTabbedViewPart(
    hasTabs: boolean,
    activeTabIndex: number,
    contentPart = 'content'
): string {
    return hasTabs
        ? buildViewId('tab', Number(activeTabIndex) || 0)
        : contentPart;
}

function toggleBooleanRecordFlag(
    record: BooleanRecord | null | undefined,
    key: string
): BooleanRecord {
    const source = record && typeof record === 'object' ? record : {};
    return {
        ...source,
        [key]: !source[key]
    };
}

function setNumberRecordValue(
    record: NumberRecord | null | undefined,
    key: string,
    value: number
): NumberRecord {
    const source = record && typeof record === 'object' ? record : {};
    return {
        ...source,
        [key]: Number(value) || 0
    };
}

function getNumberRecordValue(
    record: NumberRecord | null | undefined,
    key: string
): number {
    return Object.prototype.hasOwnProperty.call(record || {}, key)
        ? Number((record || {})[key]) || 0
        : 0;
}

export {
    buildViewId,
    getNumberRecordValue,
    resolveTabbedViewPart,
    setNumberRecordValue,
    toggleBooleanRecordFlag
};

export type {
    BooleanRecord,
    NumberRecord
};
