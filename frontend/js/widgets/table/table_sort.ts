/**
 * Cell comparison helpers for table sorting.
 */
import {
    isChoiceLikeColumn,
    isTableCellValueEmpty,
    tableChoiceSortKey
} from './table_choice_value.ts';

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

function compareIp(left: unknown, right: unknown): number {
    const leftParts = parseIpParts(left);
    const rightParts = parseIpParts(right);
    for (let index = 0; index < 4; index += 1) {
        if (leftParts[index] !== rightParts[index]) {
            return leftParts[index] < rightParts[index] ? -1 : 1;
        }
    }
    return 0;
}

function compareCells(
    left: unknown,
    right: unknown,
    column: Record<string, unknown> | null | undefined,
    listColumnIsMultiselect: ((column: Record<string, unknown>) => boolean) | undefined
): number {
    const leftEmpty = isTableCellValueEmpty(left, column, listColumnIsMultiselect);
    const rightEmpty = isTableCellValueEmpty(right, column, listColumnIsMultiselect);
    if (leftEmpty && rightEmpty) return 0;
    if (leftEmpty) return 1;
    if (rightEmpty) return -1;

    const currentColumn = column || {};
    const type = currentColumn.type;

    if (type === 'int' || type === 'float' || type === 'line_number') {
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        const leftIsNumber = !Number.isNaN(leftNumber);
        const rightIsNumber = !Number.isNaN(rightNumber);
        if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
            return leftNumber < rightNumber ? -1 : 1;
        }
        if (leftIsNumber && !rightIsNumber) return -1;
        if (!leftIsNumber && rightIsNumber) return 1;
        return String(left).localeCompare(String(right), undefined, {
            numeric: false,
            sensitivity: 'base'
        });
    }

    if (type === 'ip' || type === 'ip_mask') {
        const compared = compareIp(left, right);
        if (compared !== 0) return compared;
        return String(left).localeCompare(String(right), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    if (isChoiceLikeColumn(currentColumn)) {
        const leftKey = tableChoiceSortKey(left, currentColumn, listColumnIsMultiselect);
        const rightKey = tableChoiceSortKey(right, currentColumn, listColumnIsMultiselect);
        return leftKey.localeCompare(rightKey, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    return String(left).localeCompare(String(right), undefined, {
        numeric: false,
        sensitivity: 'base'
    });
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
    compareRows,
    compareRowsComposite
};
