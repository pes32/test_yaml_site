/**
 * TSV clipboard helpers without Vue/runtime side effects.
 */
import { getRowCells } from './table_utils.ts';
import type {
    TableCellAddress,
    TableDataRow,
    TableRuntimeColumn,
    TableSelectionRect
} from './table_contract.ts';

type ApplyPasteMatrixOptions = {
    canMutateColumnIndex?: (colIndex: number) => boolean;
    createEmptyRow: () => TableDataRow;
    pasteAnchor: TableCellAddress;
    rect: TableSelectionRect;
    resolveSourceRowIndex?: (displayRowIndex: number) => number;
    tableColumns: TableRuntimeColumn[];
    tableData: TableDataRow[];
};

type ApplyPasteMatrixResult = {
    pasteAnchor: TableCellAddress;
    rows: TableDataRow[];
    tiled: boolean;
};

type PreparedPasteMatrix = {
    matrix: unknown[][];
    pasteAnchor: TableCellAddress;
    tiled: boolean;
};

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

function cloneDataRow(row: TableDataRow): TableDataRow {
    return {
        id: String(row.id),
        cells: getRowCells(row).slice()
    };
}

function tilePasteMatrix(
    matrix: unknown[][],
    selectionRows: number,
    selectionCols: number
): unknown[][] {
    if (!matrix.length || selectionRows <= 0 || selectionCols <= 0) return matrix;
    return Array.from({ length: selectionRows }, (_, rowOffset) => {
        const sourceRow = matrix[rowOffset % matrix.length] || [];
        return Array.from({ length: selectionCols }, (_, colOffset) =>
            sourceRow[colOffset % Math.max(1, sourceRow.length)]
        );
    });
}

function preparePasteMatrix(
    matrix: unknown[][],
    rect: TableSelectionRect,
    pasteAnchor: TableCellAddress
): PreparedPasteMatrix {
    const selectionRows = rect.r1 - rect.r0 + 1;
    const selectionCols = rect.c1 - rect.c0 + 1;
    const matrixWidth = Math.max(...matrix.map((row) => (Array.isArray(row) ? row.length : 0)));
    const shouldTileIntoSelection =
        selectionRows > 0 &&
        selectionCols > 0 &&
        (selectionRows > matrix.length || selectionCols > matrixWidth);
    return {
        matrix: shouldTileIntoSelection
            ? tilePasteMatrix(matrix, selectionRows, selectionCols)
            : matrix,
        pasteAnchor: shouldTileIntoSelection
            ? { r: rect.r0, c: rect.c0 }
            : pasteAnchor,
        tiled: shouldTileIntoSelection
    };
}

function applyPasteMatrixToTableState(
    matrix: unknown[][],
    options: ApplyPasteMatrixOptions
): ApplyPasteMatrixResult {
    const tableData = Array.isArray(options.tableData) ? options.tableData : [];
    const tableColumns = Array.isArray(options.tableColumns) ? options.tableColumns : [];
    const rows = tableData.map((row) => cloneDataRow(row));
    const numCols = tableColumns.length;
    if (!matrix.length || numCols === 0) {
        return {
            pasteAnchor: options.pasteAnchor,
            rows,
            tiled: false
        };
    }

    const prepared = preparePasteMatrix(matrix, options.rect, options.pasteAnchor);
    const pasteMatrix = prepared.matrix;
    const pasteAnchor = prepared.pasteAnchor;
    const neededRows = pasteAnchor.r + pasteMatrix.length;
    while (rows.length < neededRows) {
        rows.push(cloneDataRow(options.createEmptyRow()));
    }

    for (let rowOffset = 0; rowOffset < pasteMatrix.length; rowOffset += 1) {
        const rowIndex = pasteAnchor.r + rowOffset;
        const resolvedRowIndex = options.resolveSourceRowIndex
            ? options.resolveSourceRowIndex(rowIndex)
            : rowIndex;
        const sourceRowIndex = resolvedRowIndex >= 0 ? resolvedRowIndex : rowIndex;
        if (sourceRowIndex < 0 || sourceRowIndex >= rows.length) continue;
        const sourceRow = pasteMatrix[rowOffset];
        if (!Array.isArray(sourceRow)) continue;
        const nextCells = getRowCells(rows[sourceRowIndex]).slice();
        for (let colOffset = 0; colOffset < sourceRow.length; colOffset += 1) {
            const colIndex = pasteAnchor.c + colOffset;
            if (colIndex < 0 || colIndex >= numCols) continue;
            if (options.canMutateColumnIndex && !options.canMutateColumnIndex(colIndex)) continue;
            nextCells[colIndex] = sourceRow[colOffset];
        }
        rows[sourceRowIndex] = {
            id: String(rows[sourceRowIndex].id),
            cells: nextCells
        };
    }

    return {
        pasteAnchor,
        rows,
        tiled: prepared.tiled
    };
}

export {
    applyPasteMatrixToTableState,
    cellToTsvString,
    deserializeTsvToMatrix,
    normalizeTsvInput,
    preparePasteMatrix,
    sanitizeForTsvCell,
    serializeSelectionToTsv
};
export type { ApplyPasteMatrixOptions, ApplyPasteMatrixResult, PreparedPasteMatrix };
