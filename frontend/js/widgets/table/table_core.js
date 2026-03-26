/**
 * Внутренний engine таблицы: shared runtime utilities без глобального window-namespace.
 */

const tableEngine = {
    DEBUG: false,
    log(...args) {
        if (!this.DEBUG) return;
        console.log('[TableWidget]', ...args);
    },
    Utils: {},
    Jump: {},
    Format: {},
    Keyboard: {},
    SelectionMethods: {},
    Sort: {},
    TableSchema: {},
    Grouping: {},
    Clipboard: {},
    ContextMenu: {},
    Sticky: {},
    WidgetMeasure: {},
    WidgetUiCoords: {},
    dom: {
        /**
         * @returns {{ td: HTMLElement, row: number, col: number } | null}
         */
        getCellFromEvent(vm, event) {
            const target = event && event.target;
            const td = target && target.closest ? target.closest('tbody td') : null;
            if (!td || !vm.$el || !vm.$el.contains(td)) return null;
            const row = parseInt(td.getAttribute('data-row'), 10);
            const col = parseInt(td.getAttribute('data-col'), 10);
            if (Number.isNaN(row) || Number.isNaN(col)) return null;
            return { td, row, col };
        },
        focusIsInsideTableBody(vm) {
            const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
            if (!activeElement || !vm.$el || !activeElement.closest) return false;
            const td = activeElement.closest('tbody td');
            return !!(td && vm.$el.contains(td));
        }
    }
};

export { tableEngine };
export default tableEngine;
