/**
 * Table data helpers without Vue/runtime side effects.
 */

const LINE_NUMBER_ATTR = '__line_numbers__';

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(v, max));
}

let rowIdSeq = 0;

function generateTableRowId(): string {
    return 'tr_' + Date.now() + '_' + ++rowIdSeq;
}

function isObjectRowWithCells(row: unknown): row is { cells: unknown[]; id?: unknown } {
    if (
        row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        Array.isArray((row as { cells?: unknown[] }).cells)
    ) {
        return true;
    }
    return false;
}

function getRowCells(row: unknown): unknown[] {
    if (isObjectRowWithCells(row)) return row.cells;
    if (Array.isArray(row)) return row;
    return [];
}

function getRowId(row: unknown): string {
    if (
        row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        (row as { id?: unknown }).id != null
    ) {
        return String((row as { id: unknown }).id);
    }
    return '';
}

function isLineNumberColumn(column: Record<string, unknown> | null | undefined): boolean {
    return !!(
        column &&
        (column.isLineNumber === true || column.attr === LINE_NUMBER_ATTR)
    );
}

function getLineNumberColumnIndex(tableColumns: Array<Record<string, unknown>>): number {
    if (!Array.isArray(tableColumns) || tableColumns.length === 0) return -1;
    return isLineNumberColumn(tableColumns[0]) ? 0 : -1;
}

function getExternalColumnCount(tableColumnsOrNumCols: Array<Record<string, unknown>> | number): number {
    if (!Array.isArray(tableColumnsOrNumCols)) {
        return Math.max(0, Number(tableColumnsOrNumCols) || 0);
    }
    const n = tableColumnsOrNumCols.length;
    return n - (getLineNumberColumnIndex(tableColumnsOrNumCols) >= 0 ? 1 : 0);
}

function resolveNumCols(tableColumnsOrNumCols: Array<Record<string, unknown>> | number): number {
    if (Array.isArray(tableColumnsOrNumCols)) {
        return tableColumnsOrNumCols.length;
    }
    return Math.max(0, Number(tableColumnsOrNumCols) || 0);
}

function normalizeLineNumberValue(value: unknown): number | '' {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    if (num < 1) return '';
    return Math.floor(num);
}

function normalizeIpOctetText(value: unknown): string {
    return String(value ?? '')
        .replace(/[,\s|\\/]+/g, '.')
        .replace(/[^\d.]/g, '')
        .split('.')
        .slice(0, 4)
        .map((part) => part.replace(/\D/g, '').slice(0, 3))
        .join('.');
}

function normalizeIpMaskText(value: unknown): string {
    const raw = String(value ?? '').trim().replace(/\s+/g, '');
    if (!raw) return '';
    const slashIndex = raw.indexOf('/');
    if (slashIndex < 0) return normalizeIpOctetText(raw);
    const ipPart = normalizeIpOctetText(raw.slice(0, slashIndex));
    const maskPart = raw.slice(slashIndex + 1).replace(/\D/g, '').slice(0, 2);
    return `${ipPart}/${maskPart}`;
}

function normalizeCellValueForColumn(value: unknown, column: Record<string, unknown> | null | undefined): unknown {
    const type = String(column?.type || '').trim();
    if (type === 'ip') return normalizeIpOctetText(value);
    if (type === 'ip_mask') return normalizeIpMaskText(value);
    return value;
}

function validateExternalTableRows(
    rows: unknown,
    tableColumns: Array<Record<string, unknown>>
) {
    if (!Array.isArray(rows)) return { ok: true };
    const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
    if (lineNumberIndex < 0) return { ok: true };
    const maxCols = getExternalColumnCount(tableColumns);
    for (let i = 0; i < rows.length; i += 1) {
        const src = getRowCells(rows[i]);
        if (src.length > maxCols) {
            return {
                ok: false,
                code: 'external_line_numbers_forbidden',
                rowIndex: i
            };
        }
    }
    return { ok: true };
}

function buildNormalizedCells(
    src: unknown,
    tableColumnsOrNumCols: Array<Record<string, unknown>> | number,
    options: { inputMode?: 'external' | 'runtime' } = {}
): unknown[] | null {
    const cols = resolveNumCols(tableColumnsOrNumCols);
    const tableColumns = Array.isArray(tableColumnsOrNumCols)
        ? tableColumnsOrNumCols
        : null;
    const lineNumberIndex = getLineNumberColumnIndex(tableColumns || []);
    const mode = options.inputMode === 'runtime' ? 'runtime' : 'external';
    const raw = Array.isArray(src) ? src.slice() : [];

    if (mode === 'external' && lineNumberIndex >= 0) {
        const externalCols = getExternalColumnCount(tableColumns || []);
        if (raw.length > externalCols) return null;
        const cells = new Array(cols).fill('');
        for (let i = 0; i < externalCols; i += 1) {
            const column = tableColumns ? tableColumns[i + 1] : null;
            cells[i + 1] = normalizeCellValueForColumn(raw[i] !== undefined ? raw[i] : '', column);
        }
        return cells;
    }

    while (raw.length < cols) raw.push('');
    if (raw.length > cols) raw.length = cols;
    if (tableColumns) {
        for (let index = 0; index < raw.length; index += 1) {
            raw[index] = normalizeCellValueForColumn(raw[index], tableColumns[index]);
        }
    }
    if (lineNumberIndex >= 0) {
        raw[lineNumberIndex] = normalizeLineNumberValue(raw[lineNumberIndex]);
    }
    return raw;
}

function normalizeRowToDataRow(
    row: unknown,
    tableColumnsOrNumCols: Array<Record<string, unknown>> | number,
    options: { inputMode?: 'external' | 'runtime'; lineNumber?: number } = {}
) {
    const src = getRowCells(row);
    const cells = buildNormalizedCells(src, tableColumnsOrNumCols, options);
    if (!cells) return null;
    const lineNumberIndex = Array.isArray(tableColumnsOrNumCols)
        ? getLineNumberColumnIndex(tableColumnsOrNumCols)
        : -1;
    if (lineNumberIndex >= 0 && options.lineNumber != null) {
        cells[lineNumberIndex] = normalizeLineNumberValue(options.lineNumber);
    }
    let id = getRowId(row);
    if (!id) id = generateTableRowId();
    return { id, cells };
}

function normalizeTableRows(
    rows: unknown,
    tableColumnsOrNumCols: Array<Record<string, unknown>> | number,
    options: { inputMode?: 'external' | 'runtime'; lineNumber?: number } = {}
) {
    if (!Array.isArray(rows)) return [];
    const out: Array<{ id: string; cells: unknown[] }> = [];
    for (let i = 0; i < rows.length; i += 1) {
        const normalized = normalizeRowToDataRow(
            rows[i],
            tableColumnsOrNumCols,
            options
        );
        if (normalized) out.push(normalized);
    }
    return out;
}

function stripTableDataForEmit(
    rows: Array<{ id: string; cells: unknown[] }>,
    tableColumns: Array<Record<string, unknown>>
): unknown[][] {
    if (!Array.isArray(rows)) return [];
    const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
    return rows.map((row) => {
        const cells = getRowCells(row).slice();
        if (lineNumberIndex >= 0) {
            cells.splice(lineNumberIndex, 1);
        }
        return cells;
    });
}

function tryStructuredClone<T>(value: T): T | null {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
    } catch {
        /* ignore */
    }
    return null;
}

function cloneTableData(value: unknown) {
    if (!Array.isArray(value)) return [];
    const structured = tryStructuredClone(value);
    if (structured) return structured;
    return value.map((row) => {
        if (isObjectRowWithCells(row)) {
            return {
                id: row.id || generateTableRowId(),
                cells: row.cells.slice()
            };
        }
        return Array.isArray(row) ? row.slice() : [];
    });
}

function cloneCellValueDeep<T>(value: T): T {
    if (value === null || value === undefined) return value;
    const type = typeof value;
    if (
        type === 'number' ||
        type === 'boolean' ||
        type === 'string' ||
        type === 'bigint'
    ) {
        return value;
    }
    if (value instanceof Date) return new Date(value.getTime()) as T;
    if (Array.isArray(value)) return value.map((item) => cloneCellValueDeep(item)) as T;
    if (type === 'object' && (value as { constructor?: unknown }).constructor === Object) {
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>)) {
            result[key] = cloneCellValueDeep((value as Record<string, unknown>)[key]);
        }
        return result as T;
    }
    return tryStructuredClone(value) ?? value;
}

function cloneTableRowDeep(
    row: unknown,
    tableColumns: Array<Record<string, unknown>>,
    options: { resetLineNumber?: boolean } = {}
) {
    const cells = getRowCells(row).map((cell) => cloneCellValueDeep(cell));
    const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
    const keepLineNumber = options.resetLineNumber === false;
    if (lineNumberIndex >= 0 && !keepLineNumber) {
        cells[lineNumberIndex] = '';
    }
    return { id: generateTableRowId(), cells };
}

function safeCellValue(row: unknown, cellIndex: number): unknown {
    const cells = getRowCells(row);
    return cells[cellIndex] ?? '';
}

function replaceRowCellValue(row: unknown, cellIndex: number, value: unknown) {
    const cells = getRowCells(row).slice();
    cells[cellIndex] = value;
    const id = getRowId(row) || generateTableRowId();
    return { id, cells };
}

function nextLineNumber(
    rows: unknown[],
    tableColumns: Array<Record<string, unknown>>
): number | null {
    const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
    if (lineNumberIndex < 0) return null;
    let maxValue = 0;
    const list = Array.isArray(rows) ? rows : [];
    for (let i = 0; i < list.length; i += 1) {
        const value = normalizeLineNumberValue(
            safeCellValue(list[i], lineNumberIndex)
        );
        if (typeof value === 'number' && value > maxValue) maxValue = value;
    }
    return maxValue + 1;
}

function assignRowLineNumber(
    row: unknown,
    tableColumns: Array<Record<string, unknown>>,
    value: unknown
) {
    const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
    if (lineNumberIndex < 0 || !row) return row;
    const cells = getRowCells(row).slice();
    cells[lineNumberIndex] = normalizeLineNumberValue(value);
    const id = getRowId(row) || generateTableRowId();
    return { id, cells };
}

export {
    LINE_NUMBER_ATTR,
    assignRowLineNumber,
    clamp,
    cloneCellValueDeep,
    cloneTableData,
    cloneTableRowDeep,
    generateTableRowId,
    getExternalColumnCount,
    getLineNumberColumnIndex,
    getRowCells,
    getRowId,
    isLineNumberColumn,
    nextLineNumber,
    normalizeLineNumberValue,
    normalizeRowToDataRow,
    normalizeTableRows,
    replaceRowCellValue,
    safeCellValue,
    stripTableDataForEmit,
    validateExternalTableRows
};
