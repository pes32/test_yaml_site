/**
 * Чистая логика группировки таблицы: дерево отображения, pathKey, prune expanded.
 */
import tableEngine from './table_core.js';

const Core = tableEngine;

    /** Порог «тяжёлой» таблицы для ленивой дозагрузки (v1). */
    const TABLE_LAZY_THRESHOLD = 100;

    function normalizePathSegment(value) {
        if (value == null) return '';
        return String(value);
    }

    function buildPathKey(segments) {
        return segments.map((s) => encodeURIComponent(normalizePathSegment(s))).join('/');
    }

    function sortGroupKeys(groups) {
        return [...groups.keys()].sort((a, b) =>
            String(a).localeCompare(String(b), undefined, {
                numeric: false,
                sensitivity: 'base'
            })
        );
    }

    function groupRowsByColumn(data, rowsIndices, col) {
        const groups = new Map();
        for (const ri of rowsIndices) {
            const row = data[ri];
            const cells = row && Array.isArray(row.cells) ? row.cells : [];
            const key = normalizePathSegment(cells[col]);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(ri);
        }
        return groups;
    }

    function normalizeLevels(levels, columns) {
        const cols = Array.isArray(columns) ? columns : [];
        return Array.isArray(levels)
            ? levels.filter((c) => c >= 0 && c < (cols.length || 999))
            : [];
    }

    /**
     * @param {number} totalCols
     * @param {number} levelsLen
     */
    function canAddGroupingLevel(totalCols, levelsLen) {
        const n = totalCols | 0;
        if (n < 2) return false;
        return levelsLen < n - 1;
    }

    /**
     * @param {Array<{ id: string, cells: Array }>} tableData
     * @param {number[]} levels — канонические индексы колонок
     * @param {Set<string>} expandedSet
     * @param {object[]} columns — для совместимости API (форматирование вне модуля)
     * @returns {{ displayRows: object[], rowMap: Map<string, number>, validPathKeys: Set<string> }}
     */
    function buildDisplayRows(tableData, levels, expandedSet, columns) {
        const displayRows = [];
        const rowMap = new Map();
        const validPathKeys = new Set();

        const data = Array.isArray(tableData) ? tableData : [];
        const cols = Array.isArray(columns) ? columns : [];
        const lv = normalizeLevels(levels, cols);

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const id = row && row.id != null ? String(row.id) : '';
            if (id) rowMap.set(id, i);
        }

        if (lv.length === 0) {
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const id = row && row.id != null ? String(row.id) : 'r' + i;
                const pk = 'leaf:' + id;
                displayRows.push({
                    kind: 'data',
                    pathKey: pk,
                    dataIndex: i,
                    rowId: id,
                    depth: 0
                });
                validPathKeys.add(pk);
            }
            return { displayRows, rowMap, validPathKeys };
        }

        function walk(rowsIndices, level, prefixSegments) {
            if (level >= lv.length) {
                for (const ri of rowsIndices) {
                    const row = data[ri];
                    const id = row && row.id != null ? String(row.id) : 'r' + ri;
                    const pk =
                        prefixSegments.length > 0
                            ? buildPathKey(prefixSegments) + '/leaf:' + id
                            : 'leaf:' + id;
                    displayRows.push({
                        kind: 'data',
                        pathKey: pk,
                        dataIndex: ri,
                        rowId: id,
                        depth: level
                    });
                    validPathKeys.add(pk);
                }
                return;
            }
            const col = lv[level];
            const groups = groupRowsByColumn(data, rowsIndices, col);
            const keysSorted = sortGroupKeys(groups);
            const colMeta = cols[col];
            const columnTitle =
                colMeta &&
                colMeta.label != null &&
                String(colMeta.label).trim() !== ''
                    ? String(colMeta.label).trim()
                    : 'Столбец ' + (col + 1);
            for (const gkey of keysSorted) {
                const childSegs = prefixSegments.concat([gkey]);
                const pathKey = buildPathKey(childSegs);
                validPathKeys.add(pathKey);
                displayRows.push({
                    kind: 'group',
                    pathKey,
                    depth: level,
                    level,
                    label: columnTitle + ': ' + gkey,
                    colIndex: col,
                    value: gkey,
                    columnLabel: columnTitle
                });
                const ex = expandedSet && expandedSet.has && expandedSet.has(pathKey);
                if (ex) {
                    walk(groups.get(gkey), level + 1, childSegs);
                }
            }
        }

        walk(
            data.map((_, i) => i),
            0,
            []
        );
        return { displayRows, rowMap, validPathKeys };
    }

    function buildGroupedDataOrder(tableData, levels, columns) {
        const data = Array.isArray(tableData) ? tableData : [];
        const cols = Array.isArray(columns) ? columns : [];
        const lv = normalizeLevels(levels, cols);
        if (lv.length === 0) {
            return data.map((_, index) => index);
        }
        const ordered = [];

        function walk(rowsIndices, level) {
            if (level >= lv.length) {
                rowsIndices.forEach((ri) => ordered.push(ri));
                return;
            }
            const col = lv[level];
            const groups = groupRowsByColumn(data, rowsIndices, col);
            const keysSorted = sortGroupKeys(groups);
            keysSorted.forEach((key) => walk(groups.get(key), level + 1));
        }

        walk(
            data.map((_, index) => index),
            0
        );
        return ordered;
    }

    /**
     * @param {Set<string>} expandedSet
     * @param {Set<string>|undefined} validPathKeys
     * @returns {Set<string>}
     */
    function pruneExpanded(expandedSet, validPathKeys) {
        const next = new Set();
        if (!expandedSet || !validPathKeys) return next;
        for (const k of expandedSet) {
            if (validPathKeys.has(k)) next.add(k);
        }
        return next;
    }

    Core.Grouping = {
        TABLE_LAZY_THRESHOLD,
        normalizePathSegment,
        buildPathKey,
        canAddGroupingLevel,
        buildDisplayRows,
        buildGroupedDataOrder,
        pruneExpanded
    };

export {
    TABLE_LAZY_THRESHOLD,
    buildDisplayRows,
    buildGroupedDataOrder,
    buildPathKey,
    canAddGroupingLevel,
    normalizePathSegment,
    pruneExpanded
};

export default Core.Grouping;
