/**
 * Cell comparison helpers for table sorting.
 */
import {
    isChoiceLikeColumn,
    isTableCellValueEmpty,
    tableChoiceSortKey
} from './table_choice_value.ts';

const TEXT_COLLATOR = new Intl.Collator(undefined, {
    numeric: false,
    sensitivity: 'base'
});
const NATURAL_COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base'
});

type PreparedCellSortValue =
    | { empty: true }
    | { empty: false; kind: 'number'; numberValue: number; textValue: string; validNumber: boolean }
    | { empty: false; ipParts: number[]; kind: 'ip'; textValue: string }
    | { empty: false; kind: 'naturalText' | 'text'; textValue: string };

function parseIpParts(value: unknown): number[] {
    const parts = String(value || '')
        .split('.')
        .map((item) => parseInt(String(item).replace(/\D/g, ''), 10));
    const result: number[] = [];
    for (let index = 0; index < 4; index += 1) {
        const part = parts[index];
        result.push(Number.isFinite(part) ? part : -1);
    }
    return result;
}

function prepareCellSortValue(
    value: unknown,
    column: Record<string, unknown> | null | undefined,
    listColumnIsMultiselect: ((column: Record<string, unknown>) => boolean) | undefined
): PreparedCellSortValue {
    if (isTableCellValueEmpty(value, column, listColumnIsMultiselect)) {
        return { empty: true };
    }
    const currentColumn = column || {};
    const type = currentColumn.type;

    if (type === 'int' || type === 'float' || type === 'line_number') {
        const numberValue = Number(value);
        return {
            empty: false,
            kind: 'number',
            numberValue,
            textValue: String(value),
            validNumber: !Number.isNaN(numberValue)
        };
    }

    if (type === 'ip' || type === 'ip_mask') {
        return {
            empty: false,
            ipParts: parseIpParts(value),
            kind: 'ip',
            textValue: String(value)
        };
    }

    if (isChoiceLikeColumn(currentColumn)) {
        return {
            empty: false,
            kind: 'naturalText',
            textValue: tableChoiceSortKey(value, currentColumn, listColumnIsMultiselect)
        };
    }

    return {
        empty: false,
        kind: 'text',
        textValue: String(value)
    };
}

function comparePreparedCellSortValues(
    left: PreparedCellSortValue,
    right: PreparedCellSortValue
): number {
    if (left.empty && right.empty) return 0;
    if (left.empty) return 1;
    if (right.empty) return -1;

    if (left.kind === 'number' && right.kind === 'number') {
        if (left.validNumber && right.validNumber && left.numberValue !== right.numberValue) {
            return left.numberValue < right.numberValue ? -1 : 1;
        }
        if (left.validNumber && !right.validNumber) return -1;
        if (!left.validNumber && right.validNumber) return 1;
        return TEXT_COLLATOR.compare(left.textValue, right.textValue);
    }

    if (left.kind === 'ip' && right.kind === 'ip') {
        for (let index = 0; index < 4; index += 1) {
            if (left.ipParts[index] !== right.ipParts[index]) {
                return left.ipParts[index] < right.ipParts[index] ? -1 : 1;
            }
        }
        return NATURAL_COLLATOR.compare(left.textValue, right.textValue);
    }

    if (left.kind === 'naturalText' || right.kind === 'naturalText') {
        return NATURAL_COLLATOR.compare(left.textValue, right.textValue);
    }

    return TEXT_COLLATOR.compare(left.textValue, right.textValue);
}

function compareCells(
    left: unknown,
    right: unknown,
    column: Record<string, unknown> | null | undefined,
    listColumnIsMultiselect: ((column: Record<string, unknown>) => boolean) | undefined
): number {
    return comparePreparedCellSortValues(
        prepareCellSortValue(left, column, listColumnIsMultiselect),
        prepareCellSortValue(right, column, listColumnIsMultiselect)
    );
}

function getCells(row: unknown): unknown[] {
    if (row && typeof row === 'object' && !Array.isArray(row) && Array.isArray((row as { cells?: unknown[] }).cells)) {
        return (row as { cells: unknown[] }).cells;
    }
    return Array.isArray(row) ? row : [];
}

function compareRows(
    rowA: unknown,
    rowB: unknown,
    colIndex: number,
    tableColumns: Array<Record<string, unknown>>,
    listColumnIsMultiselect: ((column: Record<string, unknown>) => boolean) | undefined
): number {
    const column = tableColumns[colIndex];
    const cellsA = getCells(rowA);
    const cellsB = getCells(rowB);
    return compareCells(cellsA[colIndex], cellsB[colIndex], column, listColumnIsMultiselect);
}

function compareRowsComposite(
    rowA: unknown,
    rowB: unknown,
    sortKeys: Array<{ col: number; dir: 'asc' | 'desc' }>,
    tableColumns: Array<Record<string, unknown>>,
    listColumnIsMultiselect: ((column: Record<string, unknown>) => boolean) | undefined
): number {
    if (!Array.isArray(sortKeys) || sortKeys.length === 0) return 0;
    for (let index = 0; index < sortKeys.length; index += 1) {
        const sortKey = sortKeys[index];
        const col = sortKey.col | 0;
        const dir = sortKey.dir === 'desc' ? -1 : 1;
        const compared = compareRows(rowA, rowB, col, tableColumns, listColumnIsMultiselect);
        if (compared !== 0) return dir * compared;
    }
    const idA = rowA && typeof rowA === 'object' && !Array.isArray(rowA) && (rowA as { id?: unknown }).id != null
        ? String((rowA as { id: unknown }).id)
        : '';
    const idB = rowB && typeof rowB === 'object' && !Array.isArray(rowB) && (rowB as { id?: unknown }).id != null
        ? String((rowB as { id: unknown }).id)
        : '';
    return idA.localeCompare(idB, undefined, { numeric: false, sensitivity: 'base' });
}

export {
    compareCells,
    comparePreparedCellSortValues,
    compareRows,
    compareRowsComposite,
    prepareCellSortValue
};
export type { PreparedCellSortValue };
