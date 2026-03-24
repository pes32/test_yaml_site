/**
 * TSV clipboard: serialize selection / deserialize paste. Без Vue.
 */
(function (global) {
    'use strict';

    const Core = global.TableWidgetCore || (global.TableWidgetCore = {});

    /**
     * CRLF → \n, затем убрать ровно один завершающий \n у всего текста.
     * @param {string|null|undefined} text
     * @returns {string}
     */
    function normalizeTsvInput(text) {
        if (text == null) return '';
        let s = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        if (s.endsWith('\n')) s = s.slice(0, -1);
        return s;
    }

    function sanitizeForTsvCell(v) {
        if (v == null) return '';
        return String(v)
            .replace(/\t/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ');
    }

    /**
     * @param {*} value
     * @param {object|undefined} column
     * @param {(colIdx: number) => boolean} listMultiFn
     * @param {number} colIdx
     */
    function cellToTsvString(value, column, listMultiFn, colIdx) {
        const isMulti = listMultiFn && listMultiFn(colIdx);
        if (isMulti) {
            if (!Array.isArray(value)) return sanitizeForTsvCell(value);
            return value.map((x) => sanitizeForTsvCell(x)).join(', ');
        }
        if (Array.isArray(value)) return value.map((x) => sanitizeForTsvCell(x)).join(', ');
        return sanitizeForTsvCell(value);
    }

    /**
     * @param {string} raw поле TSV
     * @param {number} colIdx
     * @param {object[]} tableColumns
     * @param {(colIdx: number) => boolean} listMultiFn
     */
    function parsePastedCell(raw, colIdx, tableColumns, listMultiFn) {
        const col = tableColumns[colIdx];
        const isMulti = listMultiFn && listMultiFn(colIdx);
        if (isMulti) {
            if (!raw || !String(raw).trim()) return [];
            return String(raw)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }
        const t = col && (col.type === 'int' || col.type === 'float');
        if (t && String(raw).trim() !== '' && !Number.isNaN(Number(raw))) {
            return col.type === 'int' ? parseInt(raw, 10) : Number(raw);
        }
        return raw;
    }

    /**
     * @param {string} text
     * @param {object[]} tableColumns
     * @param {(colIdx: number) => boolean} listMultiFn
     * @returns {Array<Array<*>>}
     */
    function deserializeTsvToMatrix(text, tableColumns, listMultiFn) {
        const normalized = normalizeTsvInput(text);
        if (!normalized || !String(normalized).trim()) return [];
        const lines = normalized.split('\n');
        const nCols = Array.isArray(tableColumns) ? tableColumns.length : 0;
        const rows = [];
        for (let li = 0; li < lines.length; li++) {
            const parts = lines[li].split('\t');
            const row = [];
            const width = nCols > 0 ? nCols : parts.length;
            for (let c = 0; c < width; c++) {
                const raw = parts[c] != null ? parts[c] : '';
                if (nCols > 0) {
                    row.push(parsePastedCell(raw, c, tableColumns, listMultiFn));
                } else {
                    row.push(raw);
                }
            }
            rows.push(row);
        }
        return rows;
    }

    /**
     * @param {Array<Array<*>>} tableData
     * @param {object[]} tableColumns
     * @param {{ r0: number, r1: number, c0: number, c1: number }} rect
     * @param {(colIdx: number) => boolean} listMultiFn
     */
    function serializeSelectionToTsv(tableData, tableColumns, rect, listMultiFn) {
        const { r0, r1, c0, c1 } = rect;
        const lines = [];
        for (let r = r0; r <= r1; r++) {
            const row = Array.isArray(tableData[r]) ? tableData[r] : [];
            const cells = [];
            for (let c = c0; c <= c1; c++) {
                cells.push(cellToTsvString(row[c], tableColumns[c], listMultiFn, c));
            }
            lines.push(cells.join('\t'));
        }
        return lines.join('\n');
    }

    Core.Clipboard = {
        normalizeTsvInput,
        sanitizeForTsvCell,
        cellToTsvString,
        deserializeTsvToMatrix,
        serializeSelectionToTsv
    };
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
