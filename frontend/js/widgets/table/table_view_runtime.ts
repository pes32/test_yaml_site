import type { TableDisplayRow, TableHeaderCell, TableRuntimeColumn, TableRuntimeMethodSubset } from './table_contract.ts';

import { formatCellValue as formatTableCellValue } from './table_format.ts';
import { parseTableAttrs } from './table_parse_attrs.ts';
import { scheduleUpdate } from './table_scroll.ts';
import { bindStickyThead, unbindStickyThead, updateStickyThead } from './table_sticky_header.ts';
import { columnIndexByKey } from './table_state_core.ts';
import { WidgetUiCoords } from './table_widget_helpers.ts';
import { autoFitHeaderWidth, headerSortAffordancePx } from './table_width_model.ts';
import { safeCellValue } from './table_utils.ts';

const ViewRuntimeMethods = {
    leafColStyle(column: TableRuntimeColumn | null | undefined) {
        const index = this.tableColumns.indexOf(column as TableRuntimeColumn);
        const width = index >= 0 ? this.runtimeColumnWidth(index) : column?.width;
        if (!column || !width) return {};
        return {
            width,
            minWidth: width,
            maxWidth: width
        };
    },

    headerThStyle(cell: TableHeaderCell | null | undefined) {
        const width =
            cell && cell.runtimeColIndex != null && cell.colspan === 1
                ? this.runtimeColumnWidth(cell.runtimeColIndex)
                : cell?.width;
        if (!cell || !width) return {};
        return {
            width,
            minWidth: width
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
        return !!(
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

    sortControlClass(colIdx: number | null) {
        return {
            'widget-table__sort-icons--active': this.sortColumnIndex === colIdx,
            'widget-table__sort-icons--asc':
                this.sortColumnIndex === colIdx && this.sortDirection === 'asc',
            'widget-table__sort-icons--desc':
                this.sortColumnIndex === colIdx && this.sortDirection === 'desc'
        };
    },

    sortAriaLabel(colIdx: number | null) {
        if (colIdx == null || colIdx < 0) return 'Сортировка недоступна.';
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
        const root = this.$refs.tableRoot;
        if (root instanceof HTMLTableElement) return root;
        const table = this.$el?.querySelector('.widget-table');
        return table instanceof HTMLTableElement ? table : null;
    },

    headerSortAffordancePx() {
        return headerSortAffordancePx(this.widgetConfig);
    },

    computeAutoWidth(label: unknown) {
        return autoFitHeaderWidth({
            headerText: label,
            max: 500,
            sortExtra: this.headerSortAffordancePx(),
            tableEl: this.getTableEl()
        });
    },

    safeCell(row: unknown, cellIndex: number) {
        return safeCellValue(row, cellIndex);
    },

    dataRowByIdentity(rowId: string) {
        const key = String(rowId || '');
        if (!key) return null;
        const index = this.tableRowIdToDataIndex.get(key);
        return index == null ? null : this.tableData[index] || null;
    },

    cellValueByIdentity(rowId: string, colKey: string, fallbackCol: number) {
        const colIndex = columnIndexByKey(this.tableColumns, String(colKey || ''));
        const safeCol = colIndex >= 0 ? colIndex : this.normCol(fallbackCol);
        return this.safeCell(this.dataRowByIdentity(rowId), safeCol);
    },

    formatCellValue(value: unknown, column: TableRuntimeColumn | null | undefined) {
        return formatTableCellValue(
            value,
            ((column || {}) as { format?: string; type?: string })
        );
    },

    formatCellValueByIdentity(
        rowId: string,
        colKey: string,
        column: TableRuntimeColumn | null | undefined,
        fallbackCol: number
    ) {
        const effectiveColumn =
            typeof this.effectiveCellColumnByIdentity === 'function'
                ? this.effectiveCellColumnByIdentity(rowId, colKey, fallbackCol, column)
                : column;
        return this.formatCellValue(
            this.cellValueByIdentity(rowId, colKey, fallbackCol),
            effectiveColumn
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
        const contentEl = (
            cellEl.querySelector('.widget-table__cell-value') ||
            cellEl.querySelector('input.cell-input--view')
        );
        return contentEl instanceof HTMLElement ? contentEl : null;
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
} satisfies TableRuntimeMethodSubset;

export { ViewRuntimeMethods };
export default ViewRuntimeMethods;
