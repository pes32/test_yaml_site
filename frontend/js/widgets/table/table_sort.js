/**
 * Сравнение ячеек для сортировки строк (без DOM).
 */
(function (global) {
    'use strict';

    const Core = global.TableWidgetCore || (global.TableWidgetCore = {});

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

        if (t === 'int' || t === 'float') {
            const na = Number(va);
            const nb = Number(vb);
            if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) {
                return na < nb ? -1 : 1;
            }
            return String(va).localeCompare(String(vb), undefined, {
                numeric: true,
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
            numeric: true,
            sensitivity: 'base'
        });
    }

    /**
     * @param {Array} rowA
     * @param {Array} rowB
     * @param {number} colIndex
     * @param {Array} tableColumns
     * @param {function(object): boolean} listColumnIsMultiselect
     */
    function compareRows(rowA, rowB, colIndex, tableColumns, listColumnIsMultiselect) {
        const column = tableColumns[colIndex];
        const va = Array.isArray(rowA) ? rowA[colIndex] : undefined;
        const vb = Array.isArray(rowB) ? rowB[colIndex] : undefined;
        return compareCells(va, vb, column, listColumnIsMultiselect);
    }

    Core.Sort = {
        compareCells,
        compareRows,
        emptyForSort
    };
})(typeof window !== 'undefined' ? window : this);
