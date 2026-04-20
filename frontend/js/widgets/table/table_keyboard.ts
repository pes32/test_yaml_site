/**
 * Клавиатура редактируемой таблицы: цепочка обработчиков + диспетчер.
 */
import type { TableRuntimeVm } from './table_contract.ts';
import { rowMoveDuplicateOpsAllowed } from './table_menu_runtime.ts';
import { tableLog } from './table_debug.ts';
import { getCellFromEvent } from './table_dom.ts';
import { buildJumpOpts, jumpTarget } from './table_jump.ts';
import { resolveEditingBoundary } from './table_editing_model.ts';

    type KeyboardVm = TableRuntimeVm;
    type KeyboardCtx = {
        col: number;
        dropdownOpen?: Element | null;
        row: number;
        td?: HTMLElement | null;
    };

    function callJump(vm: KeyboardVm, jumpRow: number, jumpCol: number, dr: number, dc: number) {
        return jumpTarget(buildJumpOpts(vm, jumpRow, jumpCol, dr, dc));
    }

    function editFocus(vm: KeyboardVm) {
        return vm.editingCell;
    }

    function getFocusCell(vm: KeyboardVm) {
        return vm.selFocus || { r: 0, c: 0 };
    }

    function getAnchorCell(vm: KeyboardVm) {
        return vm.selAnchor || getFocusCell(vm);
    }

    function findEmbeddedWidgetRoot(target: EventTarget | null) {
        const element = target as HTMLElement | null;
        return element && element.closest
            ? element.closest('[data-table-embedded-widget="true"]')
            : null;
    }

    function normalizeConsumeKeys(root: Element | null) {
        if (!root) return [];
        const raw = root.getAttribute('data-table-consume-keys') || '';
        return String(raw)
            .split(',')
            .map((part) => part.trim().toLowerCase())
            .filter(Boolean);
    }

    function consumeKeyMatches(token: string, key: string) {
        if (!token || !key) return false;
        if (token === 'enter') return key === 'Enter';
        if (token === 'tab') return key === 'Tab';
        if (token === 'arrows') {
            return (
                key === 'ArrowLeft' ||
                key === 'ArrowRight' ||
                key === 'ArrowUp' ||
                key === 'ArrowDown'
            );
        }
        return token === String(key || '').toLowerCase();
    }

    function embeddedWidgetConsumesKey(target: EventTarget | null, key: string) {
        const root = findEmbeddedWidgetRoot(target);
        if (!root) return false;
        const consume = normalizeConsumeKeys(root);
        for (let i = 0; i < consume.length; i++) {
            if (consumeKeyMatches(consume[i], key)) return true;
        }
        return false;
    }

    function handleTabNavigation(vm: KeyboardVm, event: KeyboardEvent /* , ctx */) {
        if (event.key !== 'Tab') return false;
        const ed = editFocus(vm);
        const focus = getFocusCell(vm);
        const r = ed ? ed.r : focus.r;
        const c = ed ? ed.c : focus.c;
        const boundary = resolveEditingBoundary({
            colCount: vm.tableColumns.length,
            current: { r, c },
            key: 'Tab',
            rowCount: tbodyRowCount(vm),
            shiftKey: !!event.shiftKey
        });
        if (typeof vm.navigateTableByTabFromCell === 'function') {
            if (!vm.navigateTableByTabFromCell(r, c, !!event.shiftKey)) {
                return false;
            }
            event.preventDefault();
            tableLog('keydown Tab →', focus.r, focus.c);
            return true;
        }
        const lastRow = tbodyRowCount(vm) - 1;
        const lastCol = vm.tableColumns.length - 1;
        if (lastRow < 0 || lastCol < 0) return false;
        if (!boundary.nextCell) return false;
        const nr = boundary.nextCell.r;
        const nc = boundary.nextCell.c;
        event.preventDefault();
        vm.exitCellEdit();
        vm.setSelectionSingle(nr, nc);
        vm.$nextTick?.(() => vm.focusSelectionCell(nr, nc));
        tableLog('keydown Tab →', nr, nc);
        return true;
    }

    function tbodyRowCount(vm: KeyboardVm): number {
        if (typeof vm.tbodyRowCount === 'function') return vm.tbodyRowCount();
        return vm.tableData.length;
    }

    function handleClipboardShortcuts(vm: KeyboardVm, event: KeyboardEvent, ctx?: KeyboardCtx) {
        if (!vm.isEditable) return false;
        if (vm.groupingActive || vm.tableUiLocked) return false;
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
        const k = event.key && String(event.key).toLowerCase();
        if (k !== 'c' && k !== 'x' && k !== 'v') return false;

        const t = event.target as HTMLElement | null;
        if (
            ctx &&
            vm.isCellEditing(ctx.row, ctx.col) &&
            t &&
            (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')
        ) {
            return false;
        }

        if (vm.tableData.length === 0 || vm.tableColumns.length === 0) return false;
        if (vm.getSelectionCellCount() < 1) return false;

        const snap = vm.buildClipboardActionSnapshot();

        if (k === 'c') {
            event.preventDefault();
            vm.copySelection(snap);
            return true;
        }
        if (k === 'x') {
            event.preventDefault();
            vm.cutSelection(snap);
            return true;
        }
        if (k === 'v') {
            event.preventDefault();
            vm.pasteFromClipboard(snap);
            return true;
        }
        return false;
    }

    function handleEditingShortcuts(vm: KeyboardVm, event: KeyboardEvent /* , ctx */) {
        if (event.key === 'F2') {
            event.preventDefault();
            const focus = getFocusCell(vm);
            vm.enterCellEditAt(focus.r, focus.c, { caretEnd: true });
            return true;
        }
        if (event.key === 'Escape' && vm.editingCell) {
            event.preventDefault();
            vm.exitCellEdit();
            const focus = getFocusCell(vm);
            vm.$nextTick?.(() =>
                vm.focusSelectionCell(focus.r, focus.c)
            );
            return true;
        }
        return false;
    }

    function handleShiftSpaceFullRow(vm: KeyboardVm, event: KeyboardEvent, ctx: KeyboardCtx) {
        if (vm.groupingActive || vm.tableUiLocked) return false;
        const row = ctx.row;
        const col = ctx.col;
        if (
            event.key !== ' ' ||
            !event.shiftKey ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey
        ) {
            return false;
        }
        event.preventDefault();
        const n = vm.tableColumns.length;
        if (n === 0) return true;
        if (vm.isExactFullRowR(row)) {
            vm.setSelectionSingle(row, col);
            vm.exitCellEdit();
            vm.$nextTick?.(() => vm.focusSelectionCell(row, col));
        } else {
            const rect = vm.getSelRect();
            const useExistingRowRange =
                vm.getSelectionCellCount() > 1 &&
                row >= rect.r0 &&
                row <= rect.r1;
            const r0 = useExistingRowRange ? rect.r0 : row;
            const r1 = useExistingRowRange ? rect.r1 : row;
            vm.selFullWidthRows = { r0, r1 };
            vm.selAnchor = { r: r0, c: col };
            vm.selFocus = { r: row, c: col };
            vm.exitCellEdit();
            vm.focusSelectionCell(row, col);
        }
        return true;
    }

    function handleDeleteBackspace(vm: KeyboardVm, event: KeyboardEvent /* , ctx */) {
        if (vm.tableUiLocked) return false;
        if (event.key !== 'Delete' && event.key !== 'Backspace') return false;
        if (vm.isMultiCellSelection()) {
            if (vm.groupingActive) return false;
            event.preventDefault();
            vm.clearSelectedCells();
            return true;
        }
        if (!vm.editingCell) {
            event.preventDefault();
            const focus = getFocusCell(vm);
            const sr = focus.r;
            const sc = focus.c;
            vm.patchCellValue(sr, sc, vm.emptyCellValueForColumn(sc));
            return true;
        }
        return false;
    }

    function handleRowInsertDeleteShortcuts(vm: KeyboardVm, event: KeyboardEvent /* , ctx */) {
        if (vm.groupingActive || vm.tableUiLocked) return false;
        const cmd = event.ctrlKey || event.metaKey;
        if (
            cmd &&
            !event.shiftKey &&
            !event.altKey &&
            (event.code === 'Minus' || event.code === 'NumpadSubtract')
        ) {
            if (!vm.selectionIsFullRowBlock()) return false;
            event.preventDefault();
            vm.deleteKeyboardSelectedRows();
            return true;
        }
        if (
            cmd &&
            event.shiftKey &&
            !event.altKey &&
            (event.code === 'Equal' ||
                event.code === 'NumpadAdd' ||
                event.key === '+')
        ) {
            if (!vm.selectionIsFullRowBlock()) return false;
            event.preventDefault();
            vm.insertRowBelowFullSelection();
            return true;
        }
        return false;
    }

    /**
     * ⌥/Alt + ↑↓ — переместить строку; ⇧+⌥ + ↑↓ — дубликат (repeat только для move).
     * ctx приоритетнее selFocus при расхождении; без _tableFocusWithin не перехватываем.
     */
    function handleAltRowMoveDuplicate(vm: KeyboardVm, event: KeyboardEvent) {
        if (vm.groupingActive || vm.tableUiLocked) return false;
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return false;
        if (!event.altKey || event.ctrlKey || event.metaKey) return false;

        const len = vm.tableData.length;
        const nCols = vm.tableColumns.length;
        if (len === 0 || nCols === 0) return false;

        if (
            !rowMoveDuplicateOpsAllowed({
                isEditable: !!vm.isEditable,
                tableDataLength: len,
                numCols: nCols,
                bodyMode:
                    typeof vm.computeBodyModeForMenu === 'function'
                        ? vm.computeBodyModeForMenu()
                        : null,
                isEditingCell: !!vm.editingCell
            })
        ) {
            return false;
        }

        if (!vm._tableFocusWithin) return false;

        const ctxCell = getCellFromEvent(vm, event);
        const sf = vm.selFocus;
        const sfOk =
            sf &&
            sf.r >= 0 &&
            sf.r < len &&
            sf.c >= 0 &&
            sf.c < nCols;
        const ctxOk =
            ctxCell &&
            ctxCell.row >= 0 &&
            ctxCell.row < len &&
            ctxCell.col >= 0 &&
            ctxCell.col < nCols;
        const inTable = ctxOk || sfOk;
        if (!inTable) return false;

        let row: number;
        let col: number;
        if (ctxOk) {
            row = ctxCell.row;
            col = ctxCell.col;
        } else {
            row = sf!.r;
            col = sf!.c;
        }

        let tdForDropdown = ctxCell ? ctxCell.td : null;
        if (!tdForDropdown && typeof vm.getTableEl === 'function') {
            const te = vm.getTableEl();
            if (te) {
                tdForDropdown = te.querySelector(
                    `tbody td[data-row="${row}"][data-col="${col}"]`
                );
            }
        }
        if (
            tdForDropdown &&
            tdForDropdown.querySelector(
                '.dropdown.show, [data-dropdown-open="true"]'
            )
        ) {
            return false;
        }

        const dup = event.shiftKey;
        if (dup && event.repeat) {
            event.preventDefault();
            return true;
        }

        const down = event.key === 'ArrowDown';
        const dr = down ? 1 : -1;

        if (!dup) {
            event.preventDefault();
            if (row + dr < 0 || row + dr >= len) {
                return true;
            }
            vm.moveTableRowRelative(row, dr, col);
            return true;
        }

        event.preventDefault();
        if (event.key === 'ArrowUp') {
            vm.duplicateTableRowRelative(row, 'above', col);
        } else {
            vm.duplicateTableRowRelative(row, 'below', col);
        }
        return true;
    }

    function handleEnter(vm: KeyboardVm, event: KeyboardEvent, ctx: KeyboardCtx) {
        const row = ctx.row;
        const col = ctx.col;
        if (event.key !== 'Enter') return false;
        event.preventDefault();
        const boundary = resolveEditingBoundary({
            addRowOnFinalEnter: true,
            colCount: vm.tableColumns.length,
            current: { r: row, c: col },
            key: 'Enter',
            rowCount: tbodyRowCount(vm)
        });
        if (vm.isCellEditing(row, col)) vm.exitCellEdit();
        if (boundary.shouldAddRow) {
            vm.addNewRow();
            return true;
        }
        if (!boundary.nextCell) return true;
        vm.setSelectionSingle(boundary.nextCell.r, boundary.nextCell.c);
        vm.$nextTick?.(() => vm.focusSelectionCell(boundary.nextCell!.r, boundary.nextCell!.c));
        return true;
    }

    function handlePrintableReplace(vm: KeyboardVm, event: KeyboardEvent, ctx: KeyboardCtx) {
        const dropdownOpen = ctx.dropdownOpen;
        if (vm.tableUiLocked) return false;
        if (
            vm.editingCell ||
            vm.isMultiCellSelection() ||
            !vm.isPrintableCellKey(event)
        ) {
            return false;
        }
        if (dropdownOpen) return false;
        event.preventDefault();
        vm.startTypingReplacingCell(
            getFocusCell(vm).r,
            getFocusCell(vm).c,
            event.key
        );
        return true;
    }

    function handleArrowNavigation(vm: KeyboardVm, event: KeyboardEvent, ctx: KeyboardCtx) {
        const row = ctx.row;
        const col = ctx.col;
        const dropdownOpen = ctx.dropdownOpen;
        const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (!navKeys.includes(event.key)) return false;
        if (event.defaultPrevented) return false;
        if (dropdownOpen) return false;

        const t = event.target as HTMLInputElement | HTMLSelectElement | HTMLElement | null;
        const cmdOrCtrl = event.metaKey || event.ctrlKey;
        if (vm.groupingActive && cmdOrCtrl) return false;
        const isTextLikeInput =
            !!t &&
            t.tagName === 'INPUT' &&
            ['text', 'search', 'tel', 'url', 'password'].includes((t as HTMLInputElement).type || 'text');

        if (vm.isCellEditing(row, col) && isTextLikeInput && (event.shiftKey || cmdOrCtrl)) {
            return false;
        }

        if (cmdOrCtrl && event.shiftKey && !event.altKey) {
            const dr =
                event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
            const dc =
                event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
            if (dr === 0 && dc === 0) return false;
            event.preventDefault();
            const anchor = getAnchorCell(vm);
            const ar = anchor.r;
            const ac = anchor.c;
            let jumpRow = ar;
            let jumpCol = ac;
            const br = vm.getSelRect();
            if (dr !== 0 && dc === 0) {
                if (
                    (vm.selectionIsFullRowBlock && vm.selectionIsFullRowBlock()) ||
                    vm.selFullWidthRows ||
                    (vm.selectionIsSingleColumnRect &&
                        vm.selectionIsSingleColumnRect())
                ) {
                    jumpRow = dr === 1 ? br.r1 : br.r0;
                    jumpCol = getFocusCell(vm).c;
                }
            } else if (dr === 0 && dc !== 0) {
                if (
                    (vm.selectionIsFullRowBlock && vm.selectionIsFullRowBlock()) ||
                    vm.selFullWidthRows ||
                    (vm.selectionIsSingleRowRect && vm.selectionIsSingleRowRect())
                ) {
                    jumpRow = getFocusCell(vm).r;
                    jumpCol = dc === 1 ? br.c1 : br.c0;
                }
            }
            const j = callJump(vm, jumpRow, jumpCol, dr, dc);
            if (j) {
                vm.applyJumpExtendSelection(j, ar, dr, dc);
                tableLog('keydown extend-jump', j, { dr, dc });
            }
            return true;
        }

        if (cmdOrCtrl && !event.shiftKey && !event.altKey) {
            const dr =
                event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
            const dc =
                event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
            if (dr === 0 && dc === 0) return false;
            event.preventDefault();
            const anchor = getAnchorCell(vm);
            const ar = anchor.r;
            const ac = anchor.c;
            let jumpRow = ar;
            let jumpCol = ac;
            const br2 = vm.getSelRect();
            if (dr !== 0 && dc === 0) {
                if (
                    (vm.selectionIsFullRowBlock && vm.selectionIsFullRowBlock()) ||
                    vm.selFullWidthRows ||
                    (vm.selectionIsSingleColumnRect &&
                        vm.selectionIsSingleColumnRect())
                ) {
                    jumpRow = dr === 1 ? br2.r1 : br2.r0;
                    jumpCol = getFocusCell(vm).c;
                }
            } else if (dr === 0 && dc !== 0) {
                if (
                    (vm.selectionIsFullRowBlock && vm.selectionIsFullRowBlock()) ||
                    vm.selFullWidthRows ||
                    (vm.selectionIsSingleRowRect && vm.selectionIsSingleRowRect())
                ) {
                    jumpRow = getFocusCell(vm).r;
                    jumpCol = dc === 1 ? br2.c1 : br2.c0;
                }
            }
            const j = callJump(vm, jumpRow, jumpCol, dr, dc);
            if (j) {
                vm.applyJumpNavigate(j);
                tableLog('keydown jump', j);
            }
            return true;
        }

        if (t && t.tagName === 'SELECT' && !event.shiftKey) return false;

        if (event.shiftKey && !cmdOrCtrl) {
            event.preventDefault();
            const dr =
                event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
            const dc =
                event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
            if (dr === 0 && dc === 0) return false;
            if (!vm.extendSelectionWithArrow(dr, dc)) return false;
            vm.exitCellEdit();
            const focus = getFocusCell(vm);
            vm.focusSelectionCell(focus.r, focus.c);
            return true;
        }

        if (
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
            isTextLikeInput &&
            vm.isCellEditing(row, col)
        ) {
            const textInput = t as HTMLInputElement;
            const start = textInput.selectionStart;
            const end = textInput.selectionEnd;
            const len = (textInput.value || '').length;
            if (start == null || end == null) return false;
            if (event.key === 'ArrowLeft' && (start !== 0 || end !== 0)) return false;
            if (event.key === 'ArrowRight' && (start !== len || end !== len)) return false;
        }

        let nextR = row;
        let nextC = col;
        if (event.key === 'ArrowLeft') nextC = col - 1;
        else if (event.key === 'ArrowRight') nextC = col + 1;
        else if (event.key === 'ArrowUp') nextR = row - 1;
        else if (event.key === 'ArrowDown') nextR = row + 1;

        if (nextC < 0 || nextC >= vm.tableColumns.length) return false;
        if (nextR < 0 || nextR >= tbodyRowCount(vm)) return false;

        event.preventDefault();
        vm.exitCellEdit();
        vm.setSelectionSingle(nextR, nextC);
        vm.$nextTick?.(() => vm.focusSelectionCell(nextR, nextC));
        return true;
    }

    const KEYBOARD_HANDLERS = [
        handleTabNavigation,
        handleClipboardShortcuts,
        handleEditingShortcuts,
        handleShiftSpaceFullRow,
        handleDeleteBackspace,
        handleRowInsertDeleteShortcuts,
        handleEnter,
        handlePrintableReplace,
        handleArrowNavigation
    ];

    function TableWidgetHandleKeydown(vm: KeyboardVm, event: KeyboardEvent) {
        if (!vm.isEditable) return;
        const cell = getCellFromEvent(vm, event);
        if (!cell) return;
        if (embeddedWidgetConsumesKey(event.target, event.key)) return;
        if (handleAltRowMoveDuplicate(vm, event)) return;

        const dropdownOpen = cell.td.querySelector(
            '.dropdown.show, [data-dropdown-open="true"]'
        );
        const ctx = {
            row: cell.row,
            col: cell.col,
            td: cell.td,
            dropdownOpen
        };

        for (let i = 0; i < KEYBOARD_HANDLERS.length; i++) {
            const handler = KEYBOARD_HANDLERS[i];
            if (handler && handler(vm, event, ctx)) return;
        }
    }

const TableKeyboard = {
    handleKeydown: TableWidgetHandleKeydown
};

export { TableWidgetHandleKeydown };
export default TableKeyboard;
