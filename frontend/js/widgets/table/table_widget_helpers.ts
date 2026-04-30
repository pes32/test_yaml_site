/**
 * Чистые хелперы для table_widget: автоширина заголовков, геометрия меню/вставки, путь к иконке ПКМ.
 * Загрузка: после table_keyboard.ts, до TableWidget.vue.
 */
import type {
    TableCellAddress,
    TableSelectionRect,
} from './table_contract.ts';
import numberUtils from '../../shared/number_utils.ts';

const { clampNumber } = numberUtils;

const WidgetUiCoords = {
        cloneRect(rect: TableSelectionRect): TableSelectionRect {
            return {
                r0: rect.r0,
                r1: rect.r1,
                c0: rect.c0,
                c1: rect.c1
            };
        },

        computePasteAnchorRect(rect: TableSelectionRect, selFocus: TableCellAddress): TableCellAddress {
            const { r0, r1, c0, c1 } = rect;
            if (r0 === r1 && c0 === c1) {
                return { r: selFocus.r, c: selFocus.c };
            }
            return { r: r0, c: c0 };
        },

        clampMenuPosition(event: MouseEvent): { x: number; y: number } {
            const scrollX = typeof window !== 'undefined' ? window.scrollX || 0 : 0;
            const scrollY = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
            const x = (event.clientX || 0) + scrollX;
            const y = (event.clientY || 0) + scrollY;
            const pad = 8;
            const w = typeof window !== 'undefined' && typeof window.innerWidth === 'number' ? window.innerWidth : 800;
            const h = typeof window !== 'undefined' && typeof window.innerHeight === 'number' ? window.innerHeight : 600;
            const mw = 280;
            const mh = 400;
            return {
                x: clampNumber(x, pad, Math.max(pad, w - mw - pad)),
                y: clampNumber(y, pad, Math.max(pad, h - mh - pad))
            };
        },

        contextMenuIconSrc(name: unknown): string {
            const n = String(name || '').trim();
            if (!n) return '';
            return '/templates/icons/' + n;
        }
    };

export { WidgetUiCoords };
