import type { TableDisplayRow, TableHeaderCell, TableRuntimeColumn } from './table_contract.ts';

import { formatCellValue as formatTableCellValue } from './table_format.ts';
import { defineTableRuntimeModule } from './table_method_helpers.ts';
import { parseTableAttrs } from './table_schema_parse.ts';
import { scheduleUpdate } from './table_scroll.ts';
import { bindStickyThead, unbindStickyThead, updateStickyThead } from './table_sticky_header.ts';
import { WidgetMeasure, WidgetUiCoords } from './table_widget_helpers.ts';
import { safeCellValue } from './table_utils.ts';

const ViewRuntimeMethods = defineTableRuntimeModule({
    leafColStyle(column: TableRuntimeColumn | null | undefined) {
        if (!column || !column.width) return {};
        return {
            width: column.width,
            minWidth: column.width,
            maxWidth: column.width
        };
    },

    headerThStyle(cell: TableHeaderCell | null | undefined) {
        if (!cell || !cell.width) return {};
        return {
            width: cell.width,
            minWidth: cell.width
        };
    },

    groupRowStyle(displayRow: TableDisplayRow | null | undefined) {
        const depth = displayRow && Number.isFinite(displayRow.depth) ? displayRow.depth : 0;
        return {
            '--widget-table-group-depth': depth
        };
    },

    isLeafHeaderRow(rIdx: number) {
        return rIdx === this.headerRows.length - 1;
    },

    showSortInHeaderCell(rIdx: number, cell: TableHeaderCell | null | undefined) {
        void rIdx;
        return (
            this.headerSortEnabled &&
            cell &&
            cell.colspan === 1 &&
            cell.runtimeColIndex != null
        );
    },

    thAriaSort(rIdx: number, cIdx: number, cell: TableHeaderCell | null | undefined) {
        void cIdx;
        if (!this.showSortInHeaderCell(rIdx, cell)) return undefined;
        if (!cell) return undefined;
        if (this.sortColumnIndex !== cell.runtimeColIndex) return undefined;
        return this.sortDirection === 'asc' ? 'ascending' : 'descending';
    },

    sortControlClass(colIdx: number) {
        return {
            'widget-table__sort-icons--active': this.sortColumnIndex === colIdx,
            'widget-table__sort-icons--asc':
                this.sortColumnIndex === colIdx && this.sortDirection === 'asc',
            'widget-table__sort-icons--desc':
                this.sortColumnIndex === colIdx && this.sortDirection === 'desc'
        };
    },

    sortAriaLabel(colIdx: number) {
        const col = this.tableColumns[colIdx];
        const name = col && col.label ? String(col.label) : String(colIdx + 1);
        if (this.sortColumnIndex !== colIdx) {
            return `Сортировать по столбцу «${name}». Шаги: по возрастанию, по убыванию, сброс.`;
        }
        if (this.sortDirection === 'asc') {
            return `Столбец «${name}»: по возрастанию. Следующий шаг — по убыванию.`;
        }
        return `Столбец «${name}»: по убыванию. Следующий шаг — сброс сортировки.`;
    },

    getTableEl() {
        const refs = (this.$refs || {}) as Record<string, unknown>;
        const root = refs.tableRoot as Element | null | undefined;
        if (root && root.nodeType === 1) return root;
        return this.$el && this.$el.querySelector('.widget-table');
    },

    headerSortAffordancePx() {
        return WidgetMeasure && WidgetMeasure.headerSortAffordancePx
            ? WidgetMeasure.headerSortAffordancePx(this.widgetConfig)
            : this.widgetConfig && this.widgetConfig.sort === false
              ? 0
              : 26;
    },

    computeAutoWidth(label: unknown) {
        if (WidgetMeasure && WidgetMeasure.computeAutoWidth) {
            return WidgetMeasure.computeAutoWidth(
                label,
                this.headerSortAffordancePx(),
                this.getTableEl()
            );
        }
        const sortExtra = this.headerSortAffordancePx();
        return `${Math.min(
            500,
            String(label || '').length * 10 + 24 + sortExtra
        )}px`;
    },

    safeCell(row: unknown, cellIndex: number) {
        return safeCellValue(row, cellIndex);
    },

    formatCellValue(value: unknown, column: TableRuntimeColumn | null | undefined) {
        return formatTableCellValue(
            value,
            ((column || {}) as { format?: string; type?: string })
        );
    },

    iconSrc(name: unknown) {
        if (WidgetUiCoords && WidgetUiCoords.contextMenuIconSrc) return WidgetUiCoords.contextMenuIconSrc(name);
        const normalized = String(name || '').trim();
        return normalized ? `/templates/icons/${normalized}` : '';
    },

    onCtxIconError(event: Event) {
        const image = event && (event.target as HTMLImageElement | null);
        if (image) image.style.display = 'none';
    },

    findCellOverflowContentEl(cellEl: Element | null | undefined) {
        if (!cellEl || !cellEl.querySelector) return null;
        return (
            cellEl.querySelector('.widget-table__cell-value') ||
            cellEl.querySelector('input.cell-input--view')
        );
    },

    syncCellOverflowHint(event: Event) {
        const cellEl = event && (event.currentTarget as HTMLElement | null);
        if (!cellEl || !cellEl.removeAttribute) return;
        cellEl.removeAttribute('title');
        if (this.wordWrapEnabled) return;
        const contentEl = this.findCellOverflowContentEl(cellEl);
        if (!contentEl) return;
        const inputEl = contentEl as HTMLInputElement | HTMLTextAreaElement;
        const text =
            contentEl.tagName === 'INPUT' || contentEl.tagName === 'TEXTAREA'
                ? String(inputEl.value || '').trim()
                : String(contentEl.textContent || '').trim();
        if (!text) return;
        const overflowX = contentEl.scrollWidth > contentEl.clientWidth + 1;
        const overflowY = contentEl.scrollHeight > contentEl.clientHeight + 1;
        if (overflowX || overflowY) {
            cellEl.setAttribute('title', text);
        }
    },

    clearCellOverflowHint(event: Event) {
        const cellEl = event && (event.currentTarget as HTMLElement | null);
        if (!cellEl || !cellEl.removeAttribute) return;
        cellEl.removeAttribute('title');
    },

    clearAllCellOverflowHints() {
        const table = this.getTableEl();
        if (!table || !table.querySelectorAll) return;
        table
            .querySelectorAll('tbody td[title]')
            .forEach((cellEl: Element) => (cellEl as HTMLElement).removeAttribute('title'));
    },

    _scheduleStickyTheadUpdate() {
        scheduleUpdate(this);
    },

    _updateStickyThead() {
        updateStickyThead(this);
    },

    _bindStickyThead() {
        bindStickyThead(this);
    },

    _unbindStickyThead() {
        unbindStickyThead(this);
    },

    parseTableAttrs(tableAttrs: unknown) {
        parseTableAttrs(this, tableAttrs);
    }
});

export { ViewRuntimeMethods };
export default ViewRuntimeMethods;
