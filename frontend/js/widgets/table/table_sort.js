/**
 * Сравнение ячеек для сортировки строк (без DOM).
 */
import tableEngine from './table_core.js';

const Core = tableEngine;

    function emptyForSort(value, column, listColumnIsMultiselect) {
        const lm = listColumnIsMultiselect || (() => false);
        if (column && column.type === 'list' && lm(column)) {
            return !Array.isArray(value) || value.length === 0;
        }
        if (value == null) return true;
        return String(value).trim() === '';
    }

    function parseIpParts(s) {
        const parts = String(s || '')
            .split('.')
            .map((p) => parseInt(String(p).replace(/\D/g, ''), 10));
        const out = [];
        for (let i = 0; i < 4; i++) {
            const n = parts[i];
            out.push(Number.isFinite(n) ? n : -1);
        }
        return out;
    }

    function compareIp(a, b) {
        const pa = parseIpParts(a);
        const pb = parseIpParts(b);
        for (let i = 0; i < 4; i++) {
            if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
        }
        return 0;
    }

    function listSortKey(value, column, listColumnIsMultiselect) {
        const lm = listColumnIsMultiselect || (() => false);
        if (column && column.type === 'list' && lm(column)) {
            if (!Array.isArray(value)) return '';
            return [...value].map((x) => String(x)).sort().join('\u0001');
        }
        if (Array.isArray(value)) return value.map((x) => String(x)).join('\u0001');
        return String(value ?? '');
    }

    /**
     * @param {*} va
     * @param {*} vb
     * @param {object|null} column
     * @param {function(object): boolean} listColumnIsMultiselect
     * @returns {number}
     */
    function compareCells(va, vb, column, listColumnIsMultiselect) {
        const ea = emptyForSort(va, column, listColumnIsMultiselect);
        const eb = emptyForSort(vb, column, listColumnIsMultiselect);
        if (ea && eb) return 0;
        if (ea) return 1;
        if (eb) return -1;

        const col = column || {};
        const t = col.type;

        if (t === 'int' || t === 'float' || t === 'line_number') {
            const na = Number(va);
            const nb = Number(vb);
            const aNum = !Number.isNaN(na);
            const bNum = !Number.isNaN(nb);
            if (aNum && bNum && na !== nb) return na < nb ? -1 : 1;
            if (aNum && !bNum) return -1;
            if (!aNum && bNum) return 1;
            return String(va).localeCompare(String(vb), undefined, {
                numeric: false,
                sensitivity: 'base'
            });
        }

        if (t === 'ip' || t === 'ip_mask') {
            const c = compareIp(va, vb);
            if (c !== 0) return c;
            return String(va).localeCompare(String(vb), undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        }

        if (t === 'list') {
            const ka = listSortKey(va, col, listColumnIsMultiselect);
            const kb = listSortKey(vb, col, listColumnIsMultiselect);
            return ka.localeCompare(kb, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        }

        return String(va).localeCompare(String(vb), undefined, {
            numeric: false,
            sensitivity: 'base'
        });
    }

    function getCells(row) {
        if (row && typeof row === 'object' && !Array.isArray(row) && Array.isArray(row.cells)) {
            return row.cells;
        }
        return Array.isArray(row) ? row : [];
    }

    /**
     * @param {Array|{cells: Array}} rowA
     * @param {Array|{cells: Array}} rowB
     * @param {number} colIndex
     * @param {Array} tableColumns
     * @param {function(object): boolean} listColumnIsMultiselect
     */
    function compareRows(rowA, rowB, colIndex, tableColumns, listColumnIsMultiselect) {
        const column = tableColumns[colIndex];
        const ca = getCells(rowA);
        const cb = getCells(rowB);
        const va = ca[colIndex];
        const vb = cb[colIndex];
        return compareCells(va, vb, column, listColumnIsMultiselect);
    }

    /**
     * Многоуровневая сортировка; tie-breaker — id строки.
     * @param {{ col: number, dir: 'asc'|'desc' }[]} sortKeys
     */
    function compareRowsComposite(rowA, rowB, sortKeys, tableColumns, listColumnIsMultiselect) {
        if (!Array.isArray(sortKeys) || sortKeys.length === 0) return 0;
        for (let i = 0; i < sortKeys.length; i++) {
            const sk = sortKeys[i];
            const col = sk.col | 0;
            const dir = sk.dir === 'desc' ? -1 : 1;
            const cmp = compareRows(rowA, rowB, col, tableColumns, listColumnIsMultiselect);
            if (cmp !== 0) return dir * cmp;
        }
        const idA = rowA && rowA.id != null ? String(rowA.id) : '';
        const idB = rowB && rowB.id != null ? String(rowB.id) : '';
        return idA.localeCompare(idB, undefined, { numeric: false, sensitivity: 'base' });
    }

    Core.Sort = {
        compareCells,
        compareRows,
        compareRowsComposite,
        emptyForSort
    };

export {
    compareCells,
    compareRows,
    compareRowsComposite,
    emptyForSort
};

export default Core.Sort;
