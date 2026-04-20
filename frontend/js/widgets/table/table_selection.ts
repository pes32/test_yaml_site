/**
 * Методы выделения ячеек для TableWidget (подмешиваются в methods).
 */
import type { TableRuntimeMethodSubset, TableSelectionRuntimeSurface } from './table_contract.ts';
import { selectionRectFromDisplay } from './table_selection_model.ts';
import { clamp, getRowCells } from './table_utils.ts';

type SelectionVm = TableSelectionRuntimeSurface;

function getSelectionAnchor(vm: SelectionVm) {
    return vm.selAnchor || { r: 0, c: 0 };
}

function getSelectionFocus(vm: SelectionVm) {
    return vm.selFocus || { r: 0, c: 0 };
}

const SelectionMethods = {
        normRow(r: number) {
            const max = this.tableData.length - 1;
            if (max < 0) return 0;
            return clamp(r, 0, max);
        },
        normCol(c: number) {
            const max = this.tableColumns.length - 1;
            if (max < 0) return 0;
            return clamp(c, 0, max);
        },
        /** Диапазон строк «вся ширина»; selAnchor/selFocus не меняются. */
        setSelFullWidthRowSpan(r0: number, r1: number) {
            const lo = this.normRow(Math.min(r0, r1));
            const hi = this.normRow(Math.max(r0, r1));
            this.selFullWidthRows = { r0: lo, r1: hi };
        },
        getSelRect() {
            return selectionRectFromDisplay(
                {
                    anchor: getSelectionAnchor(this),
                    focus: getSelectionFocus(this),
                    fullWidthRows: this.selFullWidthRows
                },
                this.tbodyRowCount ? this.tbodyRowCount() : this.tableData.length,
                this.tableColumns.length
            );
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
        isCellInSelection(r: number, c: number) {
            const { r0, r1, c0, c1 } = this.getSelRect();
            return r >= r0 && r <= r1 && c >= c0 && c <= c1;
        },
        cellSelectionOutlineStyle(r: number, c: number) {
            const hasError =
                typeof this.cellHasCommitError === 'function' &&
                this.cellHasCommitError(r, c);
            const inSelection = this.isEditable && this.isCellInSelection(r, c);
            const selectionVisible = inSelection && this._tableFocusWithin;
            if (!selectionVisible && !hasError) return {};
            const color = hasError
                ? 'var(--bs-danger, #dc3545)'
                : 'var(--focus-color)';
            const style: Record<string, string> = {
                '--widget-table-cell-outline-color': color
            };
            if (!selectionVisible) {
                style.boxShadow = [
                    `inset 0 2px 0 0 ${color}`,
                    `inset 0 -2px 0 0 ${color}`,
                    `inset 2px 0 0 0 ${color}`,
                    `inset -2px 0 0 0 ${color}`
                ].join(', ');
                return style;
            }
            const { r0, r1, c0, c1 } = this.getSelRect();
            const multi = this.isMultiCellSelection();
            const fw =
                multi &&
                !this.selectionIsFullRowBlock() &&
                r === getSelectionFocus(this).r &&
                c === getSelectionFocus(this).c
                    ? 3
                    : 2;
            const parts = [];
            if (r === r0) parts.push(`inset 0 ${fw}px 0 0 ${color}`);
            if (r === r1) parts.push(`inset 0 -${fw}px 0 0 ${color}`);
            if (c === c0) parts.push(`inset ${fw}px 0 0 0 ${color}`);
            if (c === c1) parts.push(`inset -${fw}px 0 0 0 ${color}`);
            style.boxShadow = parts.join(', ');
            return style;
        },
        cellTdClass(row: number, col: number) {
            return {
                'widget-table__td-focusable': this.isEditable,
                'widget-table__cell--error':
                    typeof this.cellHasCommitError === 'function' &&
                    this.cellHasCommitError(row, col),
                'widget-table__cell--sel-anchor':
                    this.isEditable &&
                    this.isMultiCellSelection() &&
                    getSelectionAnchor(this).r === row &&
                    getSelectionAnchor(this).c === col
            };
        },
        setSelectionSingle(r: number, c: number) {
            this.selFullWidthRows = null;
            this.selAnchor = { r: this.normRow(r), c: this.normCol(c) };
            this.selFocus = { r: this.selAnchor.r, c: this.selAnchor.c };
        },
        isExactFullRowR(r: number) {
            const n = this.tableColumns.length;
            if (n === 0) return false;
            if (this.selFullWidthRows) {
                const { r0, r1 } = this.selFullWidthRows;
                return r0 === r1 && r0 === r;
            }
            const { r0, r1, c0, c1 } = this.getSelRect();
            return r0 === r1 && r0 === r && c0 === 0 && c1 === n - 1;
        },
        emptyCellValueForColumn(colIndex: number) {
            if (typeof this.blankCellValueForColumn === 'function') {
                return this.blankCellValueForColumn(colIndex);
            }
            const column = this.tableColumns[colIndex];
            if (this.listColumnIsMultiselect(column)) return [];
            return '';
        },
        clearSelectedCells() {
            const { r0, r1, c0, c1 } = this.getSelRect();
            for (let r = r0; r <= r1; r++) {
                const dataIndex =
                    typeof this.resolveDataRowIndex === 'function'
                        ? this.resolveDataRowIndex(r)
                        : r;
                if (dataIndex < 0) continue;
                const row = this.tableData[dataIndex];
                const base = [...getRowCells(row)];
                for (let c = c0; c <= c1; c++) {
                    if (
                        typeof this.canMutateColumnIndex === 'function' &&
                        !this.canMutateColumnIndex(c)
                    ) {
                        continue;
                    }
                    base[c] = this.emptyCellValueForColumn(c);
                }
                if (row && typeof row === 'object' && row.id != null && !Array.isArray(row)) {
                    this.tableData.splice(dataIndex, 1, { id: row.id, cells: base });
                } else {
                    this.tableData.splice(dataIndex, 1, { id: `row_${dataIndex}`, cells: base });
                }
            }
            this.onInput();
        },
        cellTabindex(row: number, col: number) {
            if (!this.isEditable) return -1;
            return getSelectionFocus(this).r === row && getSelectionFocus(this).c === col ? 0 : -1;
        },
        extendSelectionWithArrow(dr: number, dc: number) {
            const focus = getSelectionFocus(this);
            const nr = this.normRow(focus.r + dr);
            const nc = this.normCol(focus.c + dc);
            if (nr === focus.r && nc === focus.c) return false;
            if (this.selFullWidthRows && dr !== 0 && dc === 0) {
                this.selFocus = { r: nr, c: focus.c };
                this.setSelFullWidthRowSpan(getSelectionAnchor(this).r, nr);
                return true;
            }
            this.selFullWidthRows = null;
            this.selFocus = { r: nr, c: nc };
            return true;
        }
    } satisfies TableRuntimeMethodSubset;

export { SelectionMethods };
export default SelectionMethods;
