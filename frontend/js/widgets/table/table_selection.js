/**
 * Методы выделения ячеек для TableWidget (подмешиваются в methods).
 */
(function (global) {
    'use strict';

    const Core = global.TableWidgetCore || (global.TableWidgetCore = {});
    const clamp =
        (Core.Utils && Core.Utils.clamp) ||
        function (v, min, max) {
            return Math.max(min, Math.min(v, max));
        };

    Core.SelectionMethods = {
        normRow(r) {
            const max = this.tableData.length - 1;
            if (max < 0) return 0;
            return clamp(r, 0, max);
        },
        normCol(c) {
            const max = this.tableColumns.length - 1;
            if (max < 0) return 0;
            return clamp(c, 0, max);
        },
        /** Диапазон строк «вся ширина»; selAnchor/selFocus не меняются. */
        setSelFullWidthRowSpan(r0, r1) {
            const lo = this.normRow(Math.min(r0, r1));
            const hi = this.normRow(Math.max(r0, r1));
            this.selFullWidthRows = { r0: lo, r1: hi };
        },
        getSelRect() {
            if (this.selFullWidthRows) {
                const rLo = this.normRow(
                    Math.min(this.selFullWidthRows.r0, this.selFullWidthRows.r1)
                );
                const rHi = this.normRow(
                    Math.max(this.selFullWidthRows.r0, this.selFullWidthRows.r1)
                );
                const n = this.tableColumns.length;
                if (n === 0) return { r0: rLo, r1: rHi, c0: 0, c1: 0 };
                return { r0: rLo, r1: rHi, c0: 0, c1: n - 1 };
            }
            const ar = this.selAnchor.r;
            const ac = this.selAnchor.c;
            const fr = this.selFocus.r;
            const fc = this.selFocus.c;
            return {
                r0: Math.min(ar, fr),
                r1: Math.max(ar, fr),
                c0: Math.min(ac, fc),
                c1: Math.max(ac, fc)
            };
        },
        getSelectionCellCount() {
            const { r0, r1, c0, c1 } = this.getSelRect();
            return (r1 - r0 + 1) * (c1 - c0 + 1);
        },
        isMultiCellSelection() {
            return this.getSelectionCellCount() > 1;
        },
        selectionIsFullRowBlock() {
            const n = this.tableColumns.length;
            if (n === 0) return false;
            const { c0, c1 } = this.getSelRect();
            return c0 === 0 && c1 === n - 1;
        },
        /** Прямоугольник в один столбец (полоса по вертикали), в т.ч. одна ячейка. */
        selectionIsSingleColumnRect() {
            const { c0, c1 } = this.getSelRect();
            return c0 === c1;
        },
        /** Прямоугольник в одну строку (полоса по горизонтали), в т.ч. одна ячейка. */
        selectionIsSingleRowRect() {
            const { r0, r1 } = this.getSelRect();
            return r0 === r1;
        },
        isCellInSelection(r, c) {
            const { r0, r1, c0, c1 } = this.getSelRect();
            return r >= r0 && r <= r1 && c >= c0 && c <= c1;
        },
        cellSelectionOutlineStyle(r, c) {
            if (!this.isEditable || !this.isCellInSelection(r, c)) return {};
            /* Не рисовать рамку выделения до первого реального фокуса внутри таблицы (см. _tableFocusWithin). */
            if (!this._tableFocusWithin) return {};
            const { r0, r1, c0, c1 } = this.getSelRect();
            const multi = this.isMultiCellSelection();
            const fw =
                multi &&
                !this.selectionIsFullRowBlock() &&
                r === this.selFocus.r &&
                c === this.selFocus.c
                    ? 3
                    : 2;
            const parts = [];
            if (r === r0) parts.push(`inset 0 ${fw}px 0 0 var(--focus-color)`);
            if (r === r1) parts.push(`inset 0 -${fw}px 0 0 var(--focus-color)`);
            if (c === c0) parts.push(`inset ${fw}px 0 0 0 var(--focus-color)`);
            if (c === c1) parts.push(`inset -${fw}px 0 0 0 var(--focus-color)`);
            return { boxShadow: parts.join(', ') };
        },
        cellTdClass(row, col) {
            return {
                'widget-table__td-focusable': this.isEditable,
                'widget-table__cell--sel-anchor':
                    this.isEditable &&
                    this.isMultiCellSelection() &&
                    this.selAnchor.r === row &&
                    this.selAnchor.c === col
            };
        },
        setSelectionSingle(r, c) {
            this.selFullWidthRows = null;
            this.selAnchor = { r: this.normRow(r), c: this.normCol(c) };
            this.selFocus = { r: this.selAnchor.r, c: this.selAnchor.c };
        },
        isExactFullRowR(r) {
            const n = this.tableColumns.length;
            if (n === 0) return false;
            if (this.selFullWidthRows) {
                const { r0, r1 } = this.selFullWidthRows;
                return r0 === r1 && r0 === r;
            }
            const { r0, r1, c0, c1 } = this.getSelRect();
            return r0 === r1 && r0 === r && c0 === 0 && c1 === n - 1;
        },
        emptyCellValueForColumn(colIndex) {
            const column = this.tableColumns[colIndex];
            if (this.listColumnIsMultiselect(column)) return [];
            return '';
        },
        clearSelectedCells() {
            const { r0, r1, c0, c1 } = this.getSelRect();
            for (let r = r0; r <= r1; r++) {
                const updatedRow = [...this.tableData[r]];
                for (let c = c0; c <= c1; c++) {
                    updatedRow[c] = this.emptyCellValueForColumn(c);
                }
                this.tableData.splice(r, 1, updatedRow);
            }
            this.onInput();
        },
        cellTabindex(row, col) {
            if (!this.isEditable) return -1;
            return this.selFocus.r === row && this.selFocus.c === col ? 0 : -1;
        },
        extendSelectionWithArrow(dr, dc) {
            this.selFullWidthRows = null;
            const nr = this.normRow(this.selFocus.r + dr);
            const nc = this.normCol(this.selFocus.c + dc);
            if (nr === this.selFocus.r && nc === this.selFocus.c) return false;
            this.selFocus = { r: nr, c: nc };
            return true;
        }
    };
})(typeof window !== 'undefined' ? window : this);
