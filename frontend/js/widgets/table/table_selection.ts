/**
 * Методы выделения ячеек для TableWidget (подмешиваются в methods).
 */
import type {
    TableCellAddress,
    TableRuntimeMethodSubset,
    TableSelectionRuntimeSurface,
    TableSelectionState
} from './table_contract.ts';
import { firstUserColumnIndex } from './table_column_navigation.ts';
import {
    buildCoreSelectionFromDisplay,
    displayCellToCore,
    runtimeDisplaySelection,
    setSelectionCommandFromCore,
    selectionRectFromDisplay
} from './table_selection_model.ts';
import { TABLE_RUNTIME_SYNC } from './table_runtime_state.ts';
import { clamp } from './table_utils.ts';

type SelectionVm = TableSelectionRuntimeSurface;
type ClearCellPatchOptions = {
    canMutateColumnIndex: (colIndex: number) => boolean;
    emptyCellValueForColumn: (colIndex: number) => unknown;
    tableColumns: SelectionVm['tableColumns'];
    viewModel: ReturnType<SelectionVm['tableViewModelSnapshot']>;
};
type ClearCellPatchRuntimeSurface = Pick<
    SelectionVm,
    | 'canMutateColumnIndex'
    | 'emptyCellValueForColumn'
    | 'getSelRect'
    | 'tableColumns'
    | 'tableViewModelSnapshot'
>;

function getSelectionAnchor(vm: SelectionVm) {
    return vm.selAnchor || { r: 0, c: 0 };
}

function getSelectionFocus(vm: SelectionVm) {
    return vm.selFocus || { r: 0, c: 0 };
}

function dispatchDisplaySelection(
    vm: SelectionVm,
    nextSelection: {
        anchor: { c: number; r: number };
        focus: { c: number; r: number };
        fullHeightCols?: { c0: number; c1: number } | null;
        fullWidthRows: { r0: number; r1: number } | null;
    },
    phase: string
) {
    const coreSelection = buildCoreSelectionFromDisplay(
        nextSelection,
        vm.tableColumns,
        vm.tableViewModelSnapshot()
    );
    vm.dispatchTableCoreCommand(
        setSelectionCommandFromCore(coreSelection),
        phase,
        TABLE_RUNTIME_SYNC.SELECTION_ONLY
    );
}

function buildClearCellPatches(
    rect: { c0: number; c1: number; r0: number; r1: number },
    options: ClearCellPatchOptions
) {
    const patches = [];
    for (let row = rect.r0; row <= rect.r1; row += 1) {
        for (let col = rect.c0; col <= rect.c1; col += 1) {
            if (!options.canMutateColumnIndex(col)) continue;
            const cell = displayCellToCore({ r: row, c: col }, options.tableColumns, options.viewModel);
            if (!cell) continue;
            patches.push({
                cell,
                value: options.emptyCellValueForColumn(col)
            });
        }
    }
    return patches;
}

function buildClearCellPatchesForRuntime(
    vm: ClearCellPatchRuntimeSurface,
    rect = vm.getSelRect()
) {
    return buildClearCellPatches(rect, {
        canMutateColumnIndex: (colIndex) => vm.canMutateColumnIndex(colIndex),
        emptyCellValueForColumn: (colIndex) => vm.emptyCellValueForColumn(colIndex),
        tableColumns: vm.tableColumns,
        viewModel: vm.tableViewModelSnapshot()
    });
}

const SelectionMethods = {
        setDisplaySelection(nextSelection: TableSelectionState, phase?: string) {
            dispatchDisplaySelection(this, nextSelection, phase || 'set selection');
        },
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
            const nextSelection = {
                anchor: getSelectionAnchor(this),
                focus: getSelectionFocus(this),
                fullHeightCols: null,
                fullWidthRows: { r0: lo, r1: hi }
            };
            dispatchDisplaySelection(this, nextSelection, 'set full row selection');
        },
        selectFullRow(row: number, focusCol?: number) {
            const normalizedRow = this.normRow(row);
            const normalizedCol = firstUserColumnIndex(this, focusCol);
            const focus = { r: normalizedRow, c: normalizedCol };
            dispatchDisplaySelection(
                this,
                {
                    anchor: focus,
                    focus,
                    fullHeightCols: null,
                    fullWidthRows: { r0: normalizedRow, r1: normalizedRow }
                },
                'select full row'
            );
            return focus;
        },
        setSelFullHeightColSpan(c0: number, c1: number) {
            const anchorCol = this.normCol(c0);
            const focusCol = this.normCol(c1);
            const lo = Math.min(anchorCol, focusCol);
            const hi = Math.max(anchorCol, focusCol);
            const row = this.normRow(0);
            const focus: TableCellAddress = { r: row, c: focusCol };
            const anchor: TableCellAddress = { r: row, c: anchorCol };
            dispatchDisplaySelection(
                this,
                {
                    anchor,
                    focus,
                    fullHeightCols: { c0: lo, c1: hi },
                    fullWidthRows: null
                },
                'set full column selection'
            );
            return focus;
        },
        selectAllTable() {
            const rowCount = this.tbodyRowCount ? this.tbodyRowCount() : this.tableData.length;
            const lastCol = this.tableColumns.length - 1;
            if (rowCount <= 0 || lastCol < 0) return getSelectionFocus(this);
            const firstUserCol = firstUserColumnIndex(this, 0);
            const anchor: TableCellAddress = { r: this.normRow(0), c: firstUserCol };
            const focus: TableCellAddress = anchor;
            dispatchDisplaySelection(
                this,
                {
                    anchor,
                    focus,
                    fullHeightCols: { c0: 0, c1: lastCol },
                    fullWidthRows: null
                },
                'select all table'
            );
            return focus;
        },
        getSelRect() {
            return selectionRectFromDisplay(
                runtimeDisplaySelection(this),
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
            if (this.selFullHeightCols) return false;
            const { c0, c1 } = this.getSelRect();
            return c0 === 0 && c1 === n - 1;
        },
        selectionIsFullColumnBlock() {
            return !!this.selFullHeightCols;
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
                'widget-table__cell--line-number': this.isLineNumberColumn(this.tableColumns[col]),
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
            const cell = { r: this.normRow(r), c: this.normCol(c) };
            dispatchDisplaySelection(
                this,
                { anchor: cell, focus: cell, fullHeightCols: null, fullWidthRows: null },
                'set selection'
            );
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
        cellTabindex(row: number, col: number) {
            if (this.isLineNumberColumn(this.tableColumns[col])) return -1;
            if (!this.isEditable) return -1;
            return getSelectionFocus(this).r === row && getSelectionFocus(this).c === col ? 0 : -1;
        },
        extendSelectionWithArrow(dr: number, dc: number) {
            const focus = getSelectionFocus(this);
            const nr = this.normRow(focus.r + dr);
            const nc = this.normCol(focus.c + dc);
            if (nr === focus.r && nc === focus.c) return false;
            if (this.selFullHeightCols && dr === 0 && dc !== 0) {
                if (this.isLineNumberColumn(this.tableColumns[nc])) return false;
                const anchor = getSelectionAnchor(this);
                const nextSelection = {
                    anchor,
                    focus: { r: focus.r, c: nc },
                    fullHeightCols: {
                        c0: Math.min(anchor.c, nc),
                        c1: Math.max(anchor.c, nc)
                    },
                    fullWidthRows: null
                };
                dispatchDisplaySelection(this, nextSelection, 'extend full column selection');
                return true;
            }
            if (this.selFullWidthRows && dr !== 0 && dc === 0) {
                const anchor = getSelectionAnchor(this);
                const nextSelection = {
                    anchor,
                    focus: { r: nr, c: focus.c },
                    fullHeightCols: null,
                    fullWidthRows: {
                        r0: Math.min(anchor.r, nr),
                        r1: Math.max(anchor.r, nr)
                    }
                };
                dispatchDisplaySelection(this, nextSelection, 'extend full row selection');
                return true;
            }
            const nextSelection = {
                anchor: getSelectionAnchor(this),
                focus: { r: nr, c: nc },
                fullHeightCols: null,
                fullWidthRows: null
            };
            dispatchDisplaySelection(this, nextSelection, 'extend selection');
            return true;
        },
        columnLetter(index: number) {
            const labels = Array.isArray(this.columnLetterLabels) ? this.columnLetterLabels : [];
            return labels[this.normCol(index)] || '';
        },
        onColumnLetterHeaderClick(event: MouseEvent, colIndex: number) {
            if (!this.isEditable || this.tableUiLocked) return;
            const normalizedCol = this.normCol(colIndex);
            if (this.isLineNumberColumn(this.tableColumns[normalizedCol])) {
                const focus = this.selectAllTable();
                this.exitCellEdit();
                this.$nextTick?.(() => this.focusSelectionCell(focus.r, focus.c));
                return;
            }
            const previousAnchorCol =
                event.shiftKey && this.selFullHeightCols
                    ? this.selFullHeightCols.c0
                    : normalizedCol;
            const anchorCol =
                this.isLineNumberColumn(this.tableColumns[this.normCol(previousAnchorCol)])
                    ? normalizedCol
                    : previousAnchorCol;
            const focus = this.setSelFullHeightColSpan(anchorCol, normalizedCol);
            this.exitCellEdit();
            if (!this.isLineNumberColumn(this.tableColumns[focus.c])) {
                this.$nextTick?.(() => this.focusSelectionCell(focus.r, focus.c));
            }
        }
    } satisfies TableRuntimeMethodSubset<SelectionVm>;

export {
    buildClearCellPatches,
    buildClearCellPatchesForRuntime,
    runtimeDisplaySelection,
    SelectionMethods
};
export default SelectionMethods;
