/**
 * Утилиты данных таблицы (без Vue).
 */
(function (global) {
    'use strict';

    const Core = global.TableWidgetCore || (global.TableWidgetCore = {});

    function clamp(v, min, max) {
        return Math.max(min, Math.min(v, max));
    }

    /**
     * Глубокая копия массива строк ячеек (примитивы).
     * structuredClone быстрее JSON и не ломает типы внутри ячеек (кроме несериализуемых).
     */
    function cloneTableData(value) {
        if (!Array.isArray(value)) return [];
        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(value);
            }
        } catch (e) {
            /* fallback */
        }
        return value.map((row) => (Array.isArray(row) ? row.slice() : []));
    }

    /**
     * Глубокая копия одной строки ячеек для дубликата: независимое редактирование копии
     * (multiselect list, вложенные массивы, plain objects). structuredClone — основной путь;
     * при недоступности или ошибке — рекурсивный fallback без общих ссылок.
     */
    function cloneCellValueDeep(v) {
        if (v === null || v === undefined) return v;
        const t = typeof v;
        if (t === 'number' || t === 'boolean' || t === 'string' || t === 'bigint') return v;
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

    function cloneTableRowDeep(row) {
        if (!Array.isArray(row)) return [];
        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(row);
            }
        } catch (e) {
            /* fallback */
        }
        return row.map((cell) => cloneCellValueDeep(cell));
    }

    Core.Utils.clamp = clamp;
    Core.Utils.cloneTableData = cloneTableData;
    Core.Utils.cloneCellValueDeep = cloneCellValueDeep;
    Core.Utils.cloneTableRowDeep = cloneTableRowDeep;
})(typeof window !== 'undefined' ? window : this);
