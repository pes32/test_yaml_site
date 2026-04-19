type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is UnknownRecord {
    if (!isRecord(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function asRecord<T extends UnknownRecord = UnknownRecord>(value: unknown): T {
    return (isRecord(value) ? value : {}) as T;
}

export {
    asRecord,
    isPlainRecord,
    isRecord
};

export type {
    UnknownRecord
};
