/**
 * Утилиты данных таблицы (без Vue).
 */
import tableEngine from './table_core.js';

const Core = tableEngine;
    const Schema = Core.TableSchema || {};
    const LINE_NUMBER_ATTR = Schema.LINE_NUMBER_ATTR || '__line_numbers__';

    function clamp(v, min, max) {
        return Math.max(min, Math.min(v, max));
    }

    let __rowIdSeq = 0;
    function generateTableRowId() {
        return 'tr_' + Date.now() + '_' + ++__rowIdSeq;
    }

    function getRowCells(row) {
        if (
            row &&
            typeof row === 'object' &&
            !Array.isArray(row) &&
            Array.isArray(row.cells)
        ) {
            return row.cells;
        }
        if (Array.isArray(row)) return row;
        return [];
    }

    function getRowId(row) {
        if (
            row &&
            typeof row === 'object' &&
            !Array.isArray(row) &&
            row.id != null
        ) {
            return String(row.id);
        }
        return '';
    }

    function isLineNumberColumn(column) {
        return !!(
            column &&
            (column.isLineNumber === true || column.attr === LINE_NUMBER_ATTR)
        );
    }

    function getLineNumberColumnIndex(tableColumns) {
        if (!Array.isArray(tableColumns) || tableColumns.length === 0) return -1;
        return isLineNumberColumn(tableColumns[0]) ? 0 : -1;
    }

    function getExternalColumnCount(tableColumnsOrNumCols) {
        if (!Array.isArray(tableColumnsOrNumCols)) {
            return Math.max(0, Number(tableColumnsOrNumCols) || 0);
        }
        const n = tableColumnsOrNumCols.length;
        return n - (getLineNumberColumnIndex(tableColumnsOrNumCols) >= 0 ? 1 : 0);
    }

    function resolveNumCols(tableColumnsOrNumCols) {
        if (Array.isArray(tableColumnsOrNumCols)) {
            return tableColumnsOrNumCols.length;
        }
        return Math.max(0, Number(tableColumnsOrNumCols) || 0);
    }

    function normalizeLineNumberValue(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return '';
        if (num < 1) return '';
        return Math.floor(num);
    }

    function validateExternalTableRows(rows, tableColumns) {
        if (!Array.isArray(rows)) return { ok: true };
        const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
        if (lineNumberIndex < 0) return { ok: true };
        const maxCols = getExternalColumnCount(tableColumns);
        for (let i = 0; i < rows.length; i++) {
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

    function buildNormalizedCells(src, tableColumnsOrNumCols, options) {
        const cols = resolveNumCols(tableColumnsOrNumCols);
        const tableColumns = Array.isArray(tableColumnsOrNumCols)
            ? tableColumnsOrNumCols
            : null;
        const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
        const mode =
            options && options.inputMode === 'runtime' ? 'runtime' : 'external';
        const raw = Array.isArray(src) ? src.slice() : [];

        if (mode === 'external' && lineNumberIndex >= 0) {
            const externalCols = getExternalColumnCount(tableColumns);
            if (raw.length > externalCols) return null;
            const cells = new Array(cols).fill('');
            for (let i = 0; i < externalCols; i++) {
                cells[i + 1] = raw[i] !== undefined ? raw[i] : '';
            }
            return cells;
        }

        while (raw.length < cols) raw.push('');
        if (raw.length > cols) raw.length = cols;
        if (lineNumberIndex >= 0) {
            raw[lineNumberIndex] = normalizeLineNumberValue(raw[lineNumberIndex]);
        }
        return raw;
    }

    function normalizeRowToDataRow(row, tableColumnsOrNumCols, options) {
        const src = getRowCells(row);
        const cells = buildNormalizedCells(src, tableColumnsOrNumCols, options);
        if (!cells) return null;
        const lineNumberIndex = Array.isArray(tableColumnsOrNumCols)
            ? getLineNumberColumnIndex(tableColumnsOrNumCols)
            : -1;
        if (lineNumberIndex >= 0 && options && options.lineNumber != null) {
            cells[lineNumberIndex] = normalizeLineNumberValue(options.lineNumber);
        }
        let id = getRowId(row);
        if (!id) id = generateTableRowId();
        return { id, cells };
    }

    function normalizeTableRows(rows, tableColumnsOrNumCols, options) {
        if (!Array.isArray(rows)) return [];
        const out = [];
        for (let i = 0; i < rows.length; i++) {
            const normalized = normalizeRowToDataRow(
                rows[i],
                tableColumnsOrNumCols,
                options
            );
            if (normalized) out.push(normalized);
        }
        return out;
    }

    function stripTableDataForEmit(rows, tableColumns) {
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

    function cloneTableData(value) {
        if (!Array.isArray(value)) return [];
        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(value);
            }
        } catch (e) {
            /* fallback */
        }
        return value.map((row) => {
            if (
                row &&
                typeof row === 'object' &&
                !Array.isArray(row) &&
                Array.isArray(row.cells)
            ) {
                return { id: row.id || generateTableRowId(), cells: row.cells.slice() };
            }
            return Array.isArray(row) ? row.slice() : [];
        });
    }

    function cloneCellValueDeep(v) {
        if (v === null || v === undefined) return v;
        const t = typeof v;
        if (
            t === 'number' ||
            t === 'boolean' ||
            t === 'string' ||
            t === 'bigint'
        ) {
            return v;
        }
        if (v instanceof Date) return new Date(v.getTime());
        if (Array.isArray(v)) return v.map((x) => cloneCellValueDeep(x));
        if (t === 'object' && v.constructor === Object) {
            const o = {};
            for (const k of Object.keys(v)) {
                o[k] = cloneCellValueDeep(v[k]);
            }
            return o;
        }
        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(v);
            }
        } catch (e) {
            /* ignore */
        }
        return v;
    }

    function cloneTableRowDeep(row, tableColumns, options) {
        const cells = getRowCells(row).map((cell) => cloneCellValueDeep(cell));
        const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
        const keepLineNumber = !!(options && options.resetLineNumber === false);
        if (lineNumberIndex >= 0 && !keepLineNumber) {
            cells[lineNumberIndex] = '';
        }
        return { id: generateTableRowId(), cells };
    }

    function safeCellValue(row, cellIndex) {
        const cells = getRowCells(row);
        return cells[cellIndex] ?? '';
    }

    function nextLineNumber(rows, tableColumns) {
        const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
        if (lineNumberIndex < 0) return null;
        let maxValue = 0;
        const list = Array.isArray(rows) ? rows : [];
        for (let i = 0; i < list.length; i++) {
            const value = normalizeLineNumberValue(
                safeCellValue(list[i], lineNumberIndex)
            );
            if (value > maxValue) maxValue = value;
        }
        return maxValue + 1;
    }

    function assignRowLineNumber(row, tableColumns, value) {
        const lineNumberIndex = getLineNumberColumnIndex(tableColumns);
        if (lineNumberIndex < 0 || !row) return row;
        const cells = getRowCells(row).slice();
        cells[lineNumberIndex] = normalizeLineNumberValue(value);
        const id = getRowId(row) || generateTableRowId();
        return { id, cells };
    }

    Core.Utils.clamp = clamp;
    Core.Utils.generateTableRowId = generateTableRowId;
    Core.Utils.getRowCells = getRowCells;
    Core.Utils.getRowId = getRowId;
    Core.Utils.isLineNumberColumn = isLineNumberColumn;
    Core.Utils.getLineNumberColumnIndex = getLineNumberColumnIndex;
    Core.Utils.getExternalColumnCount = getExternalColumnCount;
    Core.Utils.validateExternalTableRows = validateExternalTableRows;
    Core.Utils.normalizeLineNumberValue = normalizeLineNumberValue;
    Core.Utils.normalizeRowToDataRow = normalizeRowToDataRow;
    Core.Utils.normalizeTableRows = normalizeTableRows;
    Core.Utils.stripTableDataForEmit = stripTableDataForEmit;
    Core.Utils.cloneTableData = cloneTableData;
    Core.Utils.cloneCellValueDeep = cloneCellValueDeep;
    Core.Utils.cloneTableRowDeep = cloneTableRowDeep;
    Core.Utils.safeCellValue = safeCellValue;
    Core.Utils.nextLineNumber = nextLineNumber;
    Core.Utils.assignRowLineNumber = assignRowLineNumber;

export {
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
    safeCellValue,
    stripTableDataForEmit,
    validateExternalTableRows
};

export default Core.Utils;
