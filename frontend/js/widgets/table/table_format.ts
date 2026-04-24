/**
 * Парсинг форматов и отображение значений ячеек (чистые функции, без DOM).
 */
import type { TableRuntimeColumn } from './table_contract.ts';

type NumericFormatHint = {
    hasThousands: boolean;
    kind?: string;
    precision?: number;
};

function addThousands(s: string): string {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Разбор строки формата вида #,.3f (упрощённо, как в formatCellValue). */
function parseNumericFormatHint(fmt: unknown): NumericFormatHint {
    const s = String(fmt || '');
    const hasThousands = /#,/.test(s) || /,/.test(s.replace(/^#/, ''));
    const precMatch = s.match(/\.([0-9]+)/);
    const precision = precMatch ? parseInt(precMatch[1], 10) : undefined;
    const kindMatch = s.match(/([def])\s*$/);
    const kind = kindMatch ? kindMatch[1] : undefined;
    return { hasThousands, precision, kind };
}

function formatNumberWithHint(num: number, hint: NumericFormatHint): string {
    const { hasThousands, precision, kind } = hint;
    if (kind === 'e') {
        const p = precision !== undefined ? precision : 6;
        return num.toExponential(p);
    }
    if (kind === 'd') {
        const intStr = Math.trunc(num).toString();
        return hasThousands ? addThousands(intStr) : intStr;
    }
    if (precision !== undefined) {
        const fixed = num.toFixed(precision);
        if (hasThousands) {
            const [intPart, fracPart = ''] = fixed.split('.');
            const withSep = addThousands(intPart || '');
            return fracPart ? `${withSep}.${fracPart}` : withSep;
        }
        return fixed;
    }
    const plain = String(num);
    if (hasThousands) {
        const [intPart, fracPart = ''] = plain.split('.');
        const withSep = addThousands(intPart || '');
        return fracPart ? `${withSep}.${fracPart}` : withSep;
    }
    return plain;
}

function formatCellValue(value: unknown, column: TableRuntimeColumn | null | undefined): string {
    if (value === null || value === undefined) return '';
    if (
        column &&
        (column.type === 'list' || column.type === 'voc') &&
        Array.isArray(value)
    ) {
        return value
            .map((item) => String(item ?? '').trim())
            .filter((item) => item !== '')
            .join(', ');
    }
    if (value === '') return '';
    const asString = String(value);
    if (asString === '') return '';
    if (!column) return asString;
    if (column.type === 'list' || column.type === 'voc') return asString;

    if (column.format) {
        const hint = parseNumericFormatHint(column.format);
        const num = Number(value);
        if (Number.isNaN(num)) return asString;
        return formatNumberWithHint(num, hint);
    }

    if (column.type === 'float' || column.type === 'int') {
        const num = Number(value);
        return Number.isNaN(num) ? asString : String(num);
    }

    return asString;
}

export {
    addThousands,
    formatCellValue,
    formatNumberWithHint,
    parseNumericFormatHint
};
