/**
 * Чистые хелперы для table_widget: автоширина заголовков, геометрия меню/вставки, путь к иконке ПКМ.
 * Загрузка: после table_keyboard.js, до table_widget.js.
 */
(function (global) {
    'use strict';

    const C = global.TableWidgetCore;
    if (!C) return;

    let _measureCanvas = null;
    let _measureCtx = null;

    function getMeasureCtx() {
        if (_measureCtx) return _measureCtx;
        if (typeof document === 'undefined') return null;
        _measureCanvas = document.createElement('canvas');
        _measureCtx = _measureCanvas.getContext('2d');
        return _measureCtx;
    }

    C.WidgetMeasure = {
        headerSortAffordancePx(widgetConfig) {
            return widgetConfig && widgetConfig.sort === false ? 0 : 26;
        },

        computeAutoWidth(label, sortExtra, tableEl) {
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

    C.WidgetUiCoords = {
        cloneRect(rect) {
            return {
                r0: rect.r0,
                r1: rect.r1,
                c0: rect.c0,
                c1: rect.c1
            };
        },

        computePasteAnchorRect(rect, selFocus) {
            const { r0, r1, c0, c1 } = rect;
            if (r0 === r1 && c0 === c1) {
                return { r: selFocus.r, c: selFocus.c };
            }
            return { r: r0, c: c0 };
        },

        clampMenuPosition(event) {
            const x = (event.clientX || 0) + (global.scrollX || 0);
            const y = (event.clientY || 0) + (global.scrollY || 0);
            const pad = 8;
            const w = typeof global.innerWidth === 'number' ? global.innerWidth : 800;
            const h = typeof global.innerHeight === 'number' ? global.innerHeight : 600;
            const mw = 280;
            const mh = 400;
            return {
                x: Math.min(Math.max(pad, x), Math.max(pad, w - mw - pad)),
                y: Math.min(Math.max(pad, y), Math.max(pad, h - mh - pad))
            };
        },

        contextMenuIconSrc(name) {
            const n = String(name || '').trim();
            if (!n) return '';
            return '/templates/icons/' + n;
        }
    };
})(
    typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
          ? global
          : this
);
