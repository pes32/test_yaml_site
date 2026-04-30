import type { TableCellDataType } from './table_contract.ts';

type CellTypeCoercionResult = {
    message?: string;
    valid: boolean;
    value: unknown;
};

function invalid(value: unknown, message: string): CellTypeCoercionResult {
    return { message, valid: false, value };
}

function valid(value: unknown): CellTypeCoercionResult {
    return { valid: true, value };
}

function coerceNumberLike(value: unknown, integer = false): CellTypeCoercionResult {
    const raw = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
    if (!raw) return valid('');
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return invalid(value, 'Некорректное число');
    return valid(integer ? Math.trunc(parsed) : parsed);
}

function coerceDateLike(value: unknown): CellTypeCoercionResult {
    const raw = String(value ?? '').trim();
    if (!raw) return valid('');
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const ru = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const year = iso ? iso[1] : ru ? ru[3] : '';
    const month = iso ? iso[2] : ru ? ru[2] : '';
    const day = iso ? iso[3] : ru ? ru[1] : '';
    if (!year || !month || !day) return invalid(value, 'Некорректная дата');
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    if (
        parsed.getFullYear() !== Number(year) ||
        parsed.getMonth() + 1 !== Number(month) ||
        parsed.getDate() !== Number(day)
    ) {
        return invalid(value, 'Некорректная дата');
    }
    return valid(`${year}-${month}-${day}`);
}

function coerceTimeLike(value: unknown): CellTypeCoercionResult {
    const raw = String(value ?? '').trim();
    if (!raw) return valid('');
    const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return invalid(value, 'Некорректное время');
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] == null ? 0 : Number(match[3]);
    if (hours > 23 || minutes > 59 || seconds > 59) return invalid(value, 'Некорректное время');
    return valid(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
}

function coerceDateTimeLike(value: unknown): CellTypeCoercionResult {
    const raw = String(value ?? '').trim();
    const parts = raw.split(/[ T]/).filter(Boolean);
    if (parts.length < 2) return invalid(value, 'Некорректные дата и время');
    const date = coerceDateLike(parts[0]);
    const time = coerceTimeLike(parts[1]);
    if (!date.valid) return date;
    if (!time.valid) return time;
    return valid(`${date.value} ${time.value}`);
}

function normalizeIpCandidate(value: unknown, withMask: boolean): string {
    let raw = String(value ?? '').trim().replace(/\s+/g, '');
    if (withMask) {
        const slash = raw.indexOf('/');
        const head = slash >= 0 ? raw.slice(0, slash) : raw;
        const tail = slash >= 0 ? raw.slice(slash + 1) : '';
        raw = head.replace(/[,/]+/g, '.') + (slash >= 0 ? `/${tail}` : '');
    } else {
        raw = raw.replace(/[,.\/]+/g, '.');
    }
    return raw;
}

function coerceIpLike(value: unknown, withMask = false): CellTypeCoercionResult {
    const original = String(value ?? '').trim();
    if (!original) return valid('');
    if (!/[.,/]/.test(original)) return invalid(value, 'Нужны явные разделители IP');
    const normalized = normalizeIpCandidate(original, withMask);
    const slashParts = normalized.split('/');
    if (slashParts.length > 2) return invalid(normalized, 'Некорректная CIDR-маска');
    const octets = slashParts[0].split('.');
    if (octets.length !== 4) return invalid(normalized, 'IP должен содержать 4 октета');
    const okOctets = octets.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
    if (!okOctets) return invalid(normalized, 'Октеты IP должны быть в диапазоне 0..255');
    if (!withMask) return valid(octets.map((part) => String(Number(part))).join('.'));
    if (slashParts.length !== 2 || !/^\d+$/.test(slashParts[1])) {
        return invalid(normalized, 'Нужна CIDR-маска');
    }
    const mask = Number(slashParts[1]);
    if (mask < 0 || mask > 32) return invalid(normalized, 'CIDR-маска должна быть 0..32');
    return valid(`${octets.map((part) => String(Number(part))).join('.')}/${mask}`);
}

function coerceCellValueForDataType(value: unknown, type: TableCellDataType): CellTypeCoercionResult {
    switch (type) {
        case 'general':
        case 'text':
            return valid(value == null ? '' : String(value));
        case 'int':
            return coerceNumberLike(value, true);
        case 'float':
        case 'exponent':
            return coerceNumberLike(value, false);
        case 'date':
            return coerceDateLike(value);
        case 'time':
            return coerceTimeLike(value);
        case 'datetime':
            return coerceDateTimeLike(value);
        case 'ip':
            return coerceIpLike(value, false);
        case 'ip_mask':
            return coerceIpLike(value, true);
        default:
            return valid(value);
    }
}

export {
    coerceCellValueForDataType,
    coerceDateLike,
    coerceDateTimeLike,
    coerceIpLike,
    coerceNumberLike,
    coerceTimeLike
};
export type { CellTypeCoercionResult };
