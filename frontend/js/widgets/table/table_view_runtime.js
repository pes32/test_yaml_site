import tableEngine from './table_core.js';

const Core = tableEngine;

const ViewRuntimeMethods = {
    leafColStyle(column) {
        if (!column || !column.width) return {};
        return {
            width: column.width,
            minWidth: column.width,
            maxWidth: column.width
        };
    },

    headerThStyle(cell) {
        if (!cell || !cell.width) return {};
        return {
            width: cell.width,
            minWidth: cell.width
        };
    },

    groupRowStyle(displayRow) {
        const depth = displayRow && Number.isFinite(displayRow.depth) ? displayRow.depth : 0;
        return {
            '--widget-table-group-depth': depth
        };
    },

    isLeafHeaderRow(rIdx) {
        return rIdx === this.headerRows.length - 1;
    },

    showSortInHeaderCell(rIdx, cell) {
        void rIdx;
        return (
            this.headerSortEnabled &&
            cell &&
            cell.colspan === 1 &&
            cell.runtimeColIndex != null
        );
    },

    thAriaSort(rIdx, cIdx, cell) {
        void cIdx;
        if (!this.showSortInHeaderCell(rIdx, cell)) return undefined;
        if (this.sortColumnIndex !== cell.runtimeColIndex) return undefined;
        return this.sortDirection === 'asc' ? 'ascending' : 'descending';
    },

    sortControlClass(colIdx) {
        return {
            'widget-table__sort-icons--active': this.sortColumnIndex === colIdx,
            'widget-table__sort-icons--asc':
                this.sortColumnIndex === colIdx && this.sortDirection === 'asc',
            'widget-table__sort-icons--desc':
                this.sortColumnIndex === colIdx && this.sortDirection === 'desc'
        };
    },

    sortAriaLabel(colIdx) {
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
        if (root && root.nodeType === 1) return root;
        return this.$el && this.$el.querySelector('.widget-table');
    },

    headerSortAffordancePx() {
        const Measure = tableEngine.WidgetMeasure;
        return Measure && Measure.headerSortAffordancePx
            ? Measure.headerSortAffordancePx(this.widgetConfig)
            : this.widgetConfig && this.widgetConfig.sort === false
              ? 0
              : 26;
    },

    computeAutoWidth(label) {
        const Measure = tableEngine.WidgetMeasure;
        if (Measure && Measure.computeAutoWidth) {
            return Measure.computeAutoWidth(
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

    safeCell(row, cellIndex) {
        const Utils = tableEngine.Utils;
        if (Utils && Utils.safeCellValue) return Utils.safeCellValue(row, cellIndex);
        if (!Array.isArray(row)) return '';
        return row[cellIndex] ?? '';
    },

    formatCellValue(value, column) {
        const Format = tableEngine.Format;
        const format = Format && Format.formatCellValue;
        if (format) return format(value, column);
        return value === null || value === undefined ? '' : String(value);
    },

    iconSrc(name) {
        const Ui = tableEngine.WidgetUiCoords;
        if (Ui && Ui.contextMenuIconSrc) return Ui.contextMenuIconSrc(name);
        const normalized = String(name || '').trim();
        return normalized ? `/templates/icons/${normalized}` : '';
    },

    onCtxIconError(event) {
        const image = event && event.target;
        if (image) image.style.display = 'none';
    },

    findCellOverflowContentEl(cellEl) {
        if (!cellEl || !cellEl.querySelector) return null;
        return (
            cellEl.querySelector('.widget-table__cell-value') ||
            cellEl.querySelector('input.cell-input--view')
        );
    },

    syncCellOverflowHint(event) {
        const cellEl = event && event.currentTarget;
        if (!cellEl || !cellEl.removeAttribute) return;
        cellEl.removeAttribute('title');
        if (this.wordWrapEnabled) return;
        const contentEl = this.findCellOverflowContentEl(cellEl);
        if (!contentEl) return;
        const text =
            contentEl.tagName === 'INPUT' || contentEl.tagName === 'TEXTAREA'
                ? String(contentEl.value || '').trim()
                : String(contentEl.textContent || '').trim();
        if (!text) return;
        const overflowX = contentEl.scrollWidth > contentEl.clientWidth + 1;
        const overflowY = contentEl.scrollHeight > contentEl.clientHeight + 1;
        if (overflowX || overflowY) {
            cellEl.setAttribute('title', text);
        }
    },

    clearCellOverflowHint(event) {
        const cellEl = event && event.currentTarget;
        if (!cellEl || !cellEl.removeAttribute) return;
        cellEl.removeAttribute('title');
    },

    clearAllCellOverflowHints() {
        const table = this.getTableEl();
        if (!table || !table.querySelectorAll) return;
        table
            .querySelectorAll('tbody td[title]')
            .forEach((cellEl) => cellEl.removeAttribute('title'));
    },

    _scheduleStickyTheadUpdate() {
        const Sticky = tableEngine.Sticky;
        if (Sticky && typeof Sticky.scheduleUpdate === 'function') {
            Sticky.scheduleUpdate(this);
        }
    },

    _updateStickyThead() {
        const Sticky = tableEngine.Sticky;
        if (Sticky && typeof Sticky.updateStickyThead === 'function') {
            Sticky.updateStickyThead(this);
        }
    },

    _bindStickyThead() {
        const Sticky = tableEngine.Sticky;
        if (Sticky && typeof Sticky.bindStickyThead === 'function') {
            Sticky.bindStickyThead(this);
        }
    },

    _unbindStickyThead() {
        const Sticky = tableEngine.Sticky;
        if (Sticky && typeof Sticky.unbindStickyThead === 'function') {
            Sticky.unbindStickyThead(this);
        }
    },

    parseTableAttrs(tableAttrs) {
        const parse =
            tableEngine && typeof tableEngine.parseTableAttrs === 'function'
                ? tableEngine.parseTableAttrs
                : null;
        if (parse) parse(this, tableAttrs);
    }
};

Core.ViewRuntimeMethods = ViewRuntimeMethods;

export { ViewRuntimeMethods };
export default ViewRuntimeMethods;
