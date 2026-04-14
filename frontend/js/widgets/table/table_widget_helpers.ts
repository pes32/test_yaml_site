/**
 * Чистые хелперы для table_widget: автоширина заголовков, геометрия меню/вставки, путь к иконке ПКМ.
 * Загрузка: после table_keyboard.ts, до TableWidget.vue.
 */
import type {
    TableCellAddress,
    TableRuntimeColumn,
    TableSelectionRect,
    TableWidgetConfig
} from './table_contract.ts';

let _measureCanvas: HTMLCanvasElement | null = null;
let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
    if (_measureCtx) return _measureCtx;
    if (typeof document === 'undefined') return null;
    _measureCanvas = document.createElement('canvas');
    _measureCtx = _measureCanvas.getContext('2d');
    return _measureCtx;
}

const WidgetMeasure = {
        headerSortAffordancePx(widgetConfig: TableWidgetConfig | null | undefined): number {
            return widgetConfig && widgetConfig.sort === false ? 0 : 26;
        },

        normalizeWidthToPx(width: unknown): number | null {
            const raw = String(width == null ? '' : width).trim();
            if (!raw) return null;
            const match = raw.match(/^(\d+(?:\.\d+)?)(px)?$/i);
            if (!match) return null;
            const value = Number(match[1]);
            return Number.isFinite(value) ? value : null;
        },

        sumColumnWidthsPx(columns: TableRuntimeColumn[]): string | null {
            if (!Array.isArray(columns) || !columns.length) return null;
            let total = 0;
            for (const column of columns) {
                const px = this.normalizeWidthToPx(column && column.width);
                if (px == null) return null;
                total += px;
            }
            return total > 0 ? `${Math.ceil(total)}px` : null;
        },

        computeAutoWidth(
            label: unknown,
            sortExtra: number | null | undefined,
            tableEl: Element | null | undefined
        ): string {
            const se = sortExtra == null ? 26 : sortExtra;
            try {
                const ctx = getMeasureCtx();
                if (!ctx) {
                    return `${Math.min(
                        500,
                        String(label || '').length * 10 + 24 + se
                    )}px`;
                }
                const th =
                    tableEl && tableEl.querySelector
                        ? tableEl.querySelector('thead th')
                        : null;
                ctx.font = th
                    ? getComputedStyle(th).font
                    : '500 16px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
                const textWidth = Math.ceil(
                    ctx.measureText(String(label || '')).width
                );
                const padding = 24;
                const max = 500;
                return `${Math.min(max, textWidth + padding + se)}px`;
            } catch (e) {
                return `${Math.min(
                    500,
                    (String(label || '').length * 10) + 24 + se
                )}px`;
            }
        }
    };

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
                x: Math.min(Math.max(pad, x), Math.max(pad, w - mw - pad)),
                y: Math.min(Math.max(pad, y), Math.max(pad, h - mh - pad))
            };
        },

        contextMenuIconSrc(name: unknown): string {
            const n = String(name || '').trim();
            if (!n) return '';
            return '/templates/icons/' + n;
        }
    };

export { WidgetMeasure, WidgetUiCoords };
