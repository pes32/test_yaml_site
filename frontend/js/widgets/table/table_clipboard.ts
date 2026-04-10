/**
 * TSV clipboard helpers without Vue/runtime side effects.
 */
import { getRowCells } from './table_utils.ts';

function normalizeTsvInput(text: string | null | undefined): string {
    if (text == null) return '';
    let normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (normalized.endsWith('\n')) normalized = normalized.slice(0, -1);
    return normalized;
}

function sanitizeForTsvCell(value: unknown): string {
    if (value == null) return '';
    return String(value)
        .replace(/\t/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ');
}

function cellToTsvString(
    value: unknown,
    listMultiFn: ((colIdx: number) => boolean) | undefined,
    colIdx: number
): string {
    const isMulti = listMultiFn && listMultiFn(colIdx);
    if (isMulti) {
        if (!Array.isArray(value)) return sanitizeForTsvCell(value);
        return value.map((item) => sanitizeForTsvCell(item)).join(', ');
    }
    if (Array.isArray(value)) return value.map((item) => sanitizeForTsvCell(item)).join(', ');
    return sanitizeForTsvCell(value);
}

function parsePastedCell(
    raw: string,
    colIdx: number,
    tableColumns: Array<Record<string, unknown>>,
    listMultiFn: ((colIdx: number) => boolean) | undefined
): unknown {
    const column = tableColumns[colIdx];
    const isMulti = listMultiFn && listMultiFn(colIdx);
    if (isMulti) {
        if (!raw || !String(raw).trim()) return [];
        return String(raw)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    const isNumericType =
        column &&
        (column.type === 'int' ||
            column.type === 'float' ||
            column.type === 'line_number');
    if (isNumericType && String(raw).trim() !== '' && !Number.isNaN(Number(raw))) {
        return column.type === 'int' || column.type === 'line_number'
            ? parseInt(raw, 10)
            : Number(raw);
    }
    return raw;
}

function deserializeTsvToMatrix(
    text: string,
    tableColumns: Array<Record<string, unknown>>,
    listMultiFn: ((colIdx: number) => boolean) | undefined
): unknown[][] {
    const normalized = normalizeTsvInput(text);
    if (!normalized || !String(normalized).trim()) return [];
    const lines = normalized.split('\n');
    const numCols = Array.isArray(tableColumns) ? tableColumns.length : 0;
    const rows: unknown[][] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const parts = lines[lineIndex].split('\t');
        const row: unknown[] = [];
        const width = parts.length;
        for (let colIndex = 0; colIndex < width; colIndex += 1) {
            const raw = parts[colIndex] != null ? parts[colIndex] : '';
            if (numCols > 0 && colIndex < numCols) {
                row.push(parsePastedCell(raw, colIndex, tableColumns, listMultiFn));
            } else {
                row.push(raw);
            }
        }
        rows.push(row);
    }

    return rows;
}

function serializeSelectionToTsv(
    tableData: unknown[],
    rect: { c0: number; c1: number; r0: number; r1: number },
    listMultiFn: ((colIdx: number) => boolean) | undefined,
    getRowAtDisplayIndex?: (displayRow: number) => unknown
): string {
    const { r0, r1, c0, c1 } = rect;
    const lines: string[] = [];
    const pickRow =
        typeof getRowAtDisplayIndex === 'function'
            ? getRowAtDisplayIndex
            : (rowIndex: number) => tableData[rowIndex];

    for (let rowIndex = r0; rowIndex <= r1; rowIndex += 1) {
        const row = pickRow(rowIndex);
        const rawCells = getRowCells(row);
        const cells: string[] = [];
        for (let colIndex = c0; colIndex <= c1; colIndex += 1) {
            cells.push(cellToTsvString(rawCells[colIndex], listMultiFn, colIndex));
        }
        lines.push(cells.join('\t'));
    }

    return lines.join('\n');
}

export {
    cellToTsvString,
    deserializeTsvToMatrix,
    normalizeTsvInput,
    sanitizeForTsvCell,
    serializeSelectionToTsv
};
