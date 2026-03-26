/**
 * Парсинг форматов и отображение значений ячеек (чистые функции, без DOM).
 */

import tableEngine from './table_core.js';

const Core = tableEngine;

function addThousands(s) {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Разбор строки формата вида #,.3f (упрощённо, как в formatCellValue). */
function parseNumericFormatHint(fmt) {
    const s = String(fmt || '');
    const hasThousands = /#,/.test(s) || /,/.test(s.replace(/^#/, ''));
    const precMatch = s.match(/\.([0-9]+)/);
    const precision = precMatch ? parseInt(precMatch[1], 10) : undefined;
    const kindMatch = s.match(/([def])\s*$/);
    const kind = kindMatch ? kindMatch[1] : undefined;
    return { hasThousands, precision, kind };
}

function formatNumberWithHint(num, hint) {
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
            const withSep = addThousands(intPart);
            return fracPart ? `${withSep}.${fracPart}` : withSep;
        }
        return fixed;
    }
    const plain = String(num);
    if (hasThousands) {
        const [intPart, fracPart = ''] = plain.split('.');
        const withSep = addThousands(intPart);
        return fracPart ? `${withSep}.${fracPart}` : withSep;
    }
    return plain;
}

/**
 * @param {*} value
 * @param {{ type?: string, format?: string }} column
 */
function formatCellValue(value, column) {
    if (value === null || value === undefined) return '';
    if (value === '') return '';
    const asString = String(value);
    if (asString === '') return '';
    if (!column) return asString;
    if (column.type === 'list') return asString;

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

Core.Format = {
    formatCellValue,
    parseNumericFormatHint,
    formatNumberWithHint,
    addThousands
};

export {
    addThousands,
    formatCellValue,
    formatNumberWithHint,
    parseNumericFormatHint
};

export default Core.Format;
