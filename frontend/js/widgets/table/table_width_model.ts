import type { TableColumnKey, TableRuntimeColumn, TableWidgetConfig } from './table_contract.ts';
import { columnKeyAt } from './table_state_core.ts';

const AUTO_WIDTH_MAX = 300;
const AUTO_WIDTH_MIN = 50;
const HEADER_AUTOWIDTH_MAX = 500;
const DEFAULT_HEADER_SORT_AFFORDANCE = 26;
const HEADER_HORIZONTAL_PADDING_FALLBACK = 24;
const HEADER_WIDTH_GUARD = 8;

let measureContext: CanvasRenderingContext2D | null = null;

type AutoFitCellSample = {
    bold?: boolean | null;
    column?: TableRuntimeColumn | null;
    fontSize?: number | null;
    italic?: boolean | null;
    text: unknown;
};

function captureInitialColumnWidths(
    columns: readonly TableRuntimeColumn[]
): Record<TableColumnKey, string | null> {
    const out: Record<TableColumnKey, string | null> = {};
    columns.forEach((column, index) => {
        const key = columnKeyAt(columns, index);
        if (key) out[key] = column.width || null;
    });
    return out;
}

function resolveRuntimeColumnWidth(
    columns: readonly TableRuntimeColumn[],
    column: TableRuntimeColumn | null | undefined,
    fallbackIndex: number,
    overrides: Record<TableColumnKey, string | null> | null | undefined
): string | null {
    if (!column) return null;
    const key = columnKeyAt(columns, fallbackIndex);
    if (key && overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
        return overrides[key];
    }
    return column.width || null;
}

function textWidthFallback(text: unknown): number {
    return String(text ?? '').length * 8;
}

function cssPx(value: unknown): number {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function horizontalBoxPx(style: CSSStyleDeclaration): number {
    return (
        cssPx(style.paddingLeft) +
        cssPx(style.paddingRight) +
        cssPx(style.borderLeftWidth) +
        cssPx(style.borderRightWidth)
    );
}

function headerSortAffordancePx(widgetConfig: TableWidgetConfig | null | undefined): number {
    return widgetConfig && widgetConfig.sort === false ? 0 : DEFAULT_HEADER_SORT_AFFORDANCE;
}

function fontFromStyle(style: CSSStyleDeclaration | null | undefined): string {
    if (!style) return '14px sans-serif';
    const font = style.font && style.font !== '' ? style.font : '';
    if (font) return font;
    return [
        style.fontStyle || 'normal',
        style.fontVariant || 'normal',
        style.fontWeight || '400',
        style.fontSize || '14px',
        style.fontFamily || 'sans-serif'
    ].join(' ');
}

function resolveHeaderCell(
    tableEl: HTMLTableElement | null | undefined,
    columnIndex: number | null | undefined
): HTMLTableCellElement | null {
    if (!tableEl || typeof window === 'undefined') return null;
    if (columnIndex != null && columnIndex >= 0) {
        const exact = tableEl.querySelector(`thead th[data-runtime-col-index="${columnIndex}"]`);
        if (exact instanceof HTMLTableCellElement) return exact;
    }
    const first = tableEl.querySelector('thead th[data-runtime-col-index]');
    return first instanceof HTMLTableCellElement ? first : null;
}

function headerLabelElement(cell: HTMLTableCellElement | null | undefined): HTMLElement | null {
    if (!cell) return null;
    const label = cell.querySelector('.widget-table__th-text');
    if (label instanceof HTMLElement) return label;
    return cell;
}

function headerChromeWidth(
    cell: HTMLTableCellElement | null | undefined,
    sortExtra: number | null | undefined
): number {
    const fallback = HEADER_HORIZONTAL_PADDING_FALLBACK + (sortExtra == null ? DEFAULT_HEADER_SORT_AFFORDANCE : sortExtra);
    if (!cell || typeof window === 'undefined') return fallback;
    const inner = cell.querySelector('.widget-table__th-inner');
    const container = inner instanceof HTMLElement ? inner : cell;
    const containerStyle = window.getComputedStyle(container);
    const cellStyle = window.getComputedStyle(cell);
    const sortIcons = container.querySelector('.widget-table__sort-icons');
    const sortIconWidth =
        sortIcons instanceof HTMLElement
            ? sortIcons.getBoundingClientRect().width || sortIcons.scrollWidth || 0
            : 0;
    const gap = sortIconWidth > 0 ? cssPx(containerStyle.columnGap || containerStyle.gap) : 0;
    const domChrome =
        horizontalBoxPx(containerStyle) +
        horizontalBoxPx(cellStyle) +
        sortIconWidth +
        gap +
        HEADER_WIDTH_GUARD;
    return Math.max(fallback, domChrome);
}

function measureAutoFitHeaderWidthPx(options: {
    columnIndex?: number | null;
    headerCell?: HTMLTableCellElement | null;
    headerText: unknown;
    sortExtra?: number | null;
    tableEl?: HTMLTableElement | null;
}): number {
    const cell = options.headerCell || resolveHeaderCell(options.tableEl, options.columnIndex);
    const labelEl = headerLabelElement(cell);
    const style = labelEl && typeof window !== 'undefined'
        ? window.getComputedStyle(labelEl)
        : options.tableEl && typeof window !== 'undefined'
          ? window.getComputedStyle(options.tableEl)
          : null;
    const textWidth = Math.ceil(measureTextWidth(options.headerText, style, options.tableEl));
    return textWidth + headerChromeWidth(cell, options.sortExtra);
}

function autoFitHeaderWidth(options: {
    columnIndex?: number | null;
    headerText: unknown;
    max?: number;
    min?: number;
    sortExtra?: number | null;
    tableEl?: HTMLTableElement | null;
}): string {
    const min = options.min ?? AUTO_WIDTH_MIN;
    const max = options.max ?? HEADER_AUTOWIDTH_MAX;
    const width = measureAutoFitHeaderWidthPx(options);
    return `${Math.round(Math.max(min, Math.min(max, width)))}px`;
}

function measureTextWithFont(text: unknown, font: string, letterSpacing = 0): number {
    const value = String(text ?? '');
    if (typeof document === 'undefined') return textWidthFallback(text);
    if (!measureContext) {
        measureContext = document.createElement('canvas').getContext('2d');
    }
    const ctx = measureContext;
    if (!ctx) return textWidthFallback(text);
    ctx.font = font || '14px sans-serif';
    const letterSpacingWidth = letterSpacing > 0 ? Math.max(0, value.length - 1) * letterSpacing : 0;
    return ctx.measureText(value).width + letterSpacingWidth;
}

function measureTextWidth(
    text: unknown,
    style?: CSSStyleDeclaration | null,
    tableEl?: HTMLTableElement | null
): number {
    const resolvedStyle = style || (tableEl ? window.getComputedStyle(tableEl) : null);
    return measureTextWithFont(text, fontFromStyle(resolvedStyle), cssPx(resolvedStyle?.letterSpacing));
}

function displayChromeWidth(column: TableRuntimeColumn | null | undefined): number {
    const type = String(column?.type || '').trim();
    if (type === 'datetime') return 92;
    if (type === 'date' || type === 'time') return 56;
    if (type === 'list' || type === 'voc') return 42;
    return 0;
}

function letterSpacingForColumn(column: TableRuntimeColumn | null | undefined, fontSize: number): number {
    const type = String(column?.type || '').trim();
    if (type === 'ip' || type === 'ip_mask') return fontSize * 0.1;
    if (type === 'date' || type === 'time' || type === 'datetime') return fontSize * 0.02;
    return 0;
}

function measureCellSampleWidth(
    sample: AutoFitCellSample,
    tableEl?: HTMLTableElement | null
): number {
    const tableStyle = tableEl && typeof window !== 'undefined' ? window.getComputedStyle(tableEl) : null;
    const fontSize = Number(sample.fontSize) || cssPx(tableStyle?.fontSize) || 14;
    const fontStyle = sample.italic ? 'italic' : tableStyle?.fontStyle || 'normal';
    const fontWeight = sample.bold ? '700' : tableStyle?.fontWeight || '400';
    const fontFamily = tableStyle?.fontFamily || 'sans-serif';
    const font = `${fontStyle} normal ${fontWeight} ${fontSize}px ${fontFamily}`;
    return (
        measureTextWithFont(sample.text, font, letterSpacingForColumn(sample.column, fontSize)) +
        displayChromeWidth(sample.column) +
        28
    );
}

function cellTextValue(element: HTMLElement): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return String(element.value ?? '');
    }
    return String(element.textContent ?? '');
}

function actionReserveWidth(cell: HTMLTableCellElement, contentStyle: CSSStyleDeclaration): number {
    const actions = cell.querySelector('.widget-table__cell-actions');
    if (!(actions instanceof HTMLElement)) return 0;
    const actionsWidth = actions.getBoundingClientRect().width || actions.scrollWidth || 0;
    return Math.max(0, actionsWidth - cssPx(contentStyle.paddingRight));
}

function measureBodyCellWidth(cell: HTMLTableCellElement, tableEl?: HTMLTableElement | null): number {
    const content =
        cell.querySelector('.widget-table__cell-value') ||
        cell.querySelector('input.cell-input--view') ||
        cell.querySelector('input') ||
        cell;
    const contentEl = content instanceof HTMLElement ? content : cell;
    const cellStyle = window.getComputedStyle(cell);
    const contentStyle = window.getComputedStyle(contentEl);
    const textWidth = measureTextWidth(cellTextValue(contentEl), contentStyle, tableEl);
    return (
        textWidth +
        horizontalBoxPx(contentStyle) +
        actionReserveWidth(cell, contentStyle) +
        horizontalBoxPx(cellStyle)
    );
}

function measureHeaderCellWidth(
    cell: HTMLTableCellElement,
    tableEl?: HTMLTableElement | null,
    sortExtra?: number | null
): number {
    const labelEl = headerLabelElement(cell);
    const text = String(labelEl?.textContent ?? cell.textContent ?? '').trim();
    return measureAutoFitHeaderWidthPx({
        headerCell: cell,
        headerText: text,
        sortExtra,
        tableEl
    });
}

function measureDomColumnWidth(
    tableEl: HTMLTableElement | null | undefined,
    columnIndex: number | null | undefined,
    sortExtra?: number | null
): number {
    if (!tableEl || columnIndex == null || columnIndex < 0 || typeof window === 'undefined') {
        return 0;
    }
    let width = 0;
    tableEl
        .querySelectorAll(`thead th[data-runtime-col-index="${columnIndex}"]`)
        .forEach((cell) => {
            if (cell instanceof HTMLTableCellElement) {
                width = Math.max(width, measureHeaderCellWidth(cell, tableEl, sortExtra));
            }
        });
    tableEl
        .querySelectorAll(`tbody td[data-col="${columnIndex}"]`)
        .forEach((cell) => {
            if (cell instanceof HTMLTableCellElement) {
                width = Math.max(width, measureBodyCellWidth(cell, tableEl));
            }
        });
    return width;
}

function autoFitColumnWidth(options: {
    cellTexts: readonly unknown[];
    cellSamples?: readonly AutoFitCellSample[];
    column?: TableRuntimeColumn | null;
    columnIndex?: number | null;
    headerText: unknown;
    headerSortExtra?: number | null;
    max?: number;
    min?: number;
    tableEl?: HTMLTableElement | null;
}): string {
    const min = options.min ?? AUTO_WIDTH_MIN;
    const max = options.max ?? AUTO_WIDTH_MAX;
    const chromeWidth = displayChromeWidth(options.column);
    const headerWidth = measureAutoFitHeaderWidthPx({
        columnIndex: options.columnIndex,
        headerText: options.headerText,
        sortExtra: options.headerSortExtra,
        tableEl: options.tableEl
    });
    const fallbackWidth = (options.cellTexts || []).reduce<number>(
        (best, text) => Math.max(best, measureTextWidth(text, null, options.tableEl) + chromeWidth + 28),
        min
    );
    const sampleWidth = (options.cellSamples || []).reduce<number>(
        (best, sample) => Math.max(best, measureCellSampleWidth(sample, options.tableEl)),
        0
    );
    const domWidth = measureDomColumnWidth(options.tableEl, options.columnIndex, options.headerSortExtra);
    const width = Math.max(headerWidth, fallbackWidth, sampleWidth, domWidth);
    return `${Math.round(Math.max(min, Math.min(max, width)))}px`;
}

export {
    AUTO_WIDTH_MAX,
    AUTO_WIDTH_MIN,
    autoFitHeaderWidth,
    autoFitColumnWidth,
    captureInitialColumnWidths,
    headerSortAffordancePx,
    measureAutoFitHeaderWidthPx,
    resolveRuntimeColumnWidth
};
export type { AutoFitCellSample };
