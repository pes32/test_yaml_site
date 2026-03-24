/**
 * Единая точка входа для модуля таблицы: namespace, DEBUG, DOM-адаптер.
 * Загружается первым; остальные скрипты наполняют TableWidgetCore.*.
 */
(function (global) {
    'use strict';

    global.TableWidgetCore = {
        /** Включить подробный лог (ввод ячеек, навигация и т.д.). */
        DEBUG: false,
        log() {
            if (!this.DEBUG) return;
            console.log('[TableWidget]', ...arguments);
        },
        Utils: {},
        Jump: {},
        Format: {},
        Keyboard: {},
        SelectionMethods: {},
        Sort: {},
        Clipboard: {},
        ContextMenu: {},
        /** DOM вне чистой логики: ячейка из события. */
        dom: {
            /**
             * @returns {{ td: HTMLElement, row: number, col: number } | null}
             */
            getCellFromEvent(vm, event) {
                const t = event && event.target;
                const td = t && t.closest ? t.closest('tbody td') : null;
                if (!td || !vm.$el || !vm.$el.contains(td)) return null;
                const row = parseInt(td.getAttribute('data-row'), 10);
                const col = parseInt(td.getAttribute('data-col'), 10);
                if (Number.isNaN(row) || Number.isNaN(col)) return null;
                return { td, row, col };
            },
            /**
             * Фокус внутри tbody этой таблицы (ячейка или редактор).
             */
            focusIsInsideTableBody(vm) {
                const ae = typeof document !== 'undefined' ? document.activeElement : null;
                if (!ae || !vm.$el || !ae.closest) return false;
                const td = ae.closest('tbody td');
                return !!(td && vm.$el.contains(td));
            }
        }
    };
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
