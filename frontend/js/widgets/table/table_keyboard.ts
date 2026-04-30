import type { TableRuntimeVm } from './table_contract.ts';
import { rowMoveDuplicateOpsAllowed } from './table_menu_runtime.ts';
import { tableLog } from './table_debug.ts';
import { getCellByDisplayAddress, getCellFromEvent } from './table_dom.ts';
import { buildJumpOpts, jumpTarget } from './table_jump.ts';
import { resolveEditingBoundary } from './table_editing_model.ts';
import { buildClearCellPatchesForRuntime } from './table_selection.ts';
import { dispatchRuntimeCellPatches } from './table_runtime_commands.ts';
import { TABLE_RUNTIME_SYNC } from './table_runtime_state.ts';

type KeyboardVm = TableRuntimeVm;
type KeyboardCtx = {
    col: number;
    dropdownOpen?: Element | null;
    row: number;
    td?: HTMLElement | null;
};

const FALLBACK_FOCUS = { r: 0, c: 0 };

function callJump(vm: KeyboardVm, jumpRow: number, jumpCol: number, dr: number, dc: number) {
    return jumpTarget(buildJumpOpts(vm, jumpRow, jumpCol, dr, dc));
}

function editFocus(vm: KeyboardVm) {
    return vm.editingCell;
}

function getFocusCell(vm: KeyboardVm) {
    return vm.selFocus || FALLBACK_FOCUS;
}

function getAnchorCell(vm: KeyboardVm) {
    return vm.selAnchor || getFocusCell(vm);
}

function findEmbeddedWidgetRoot(target: EventTarget | null) {
    return (target as HTMLElement | null)?.closest?.('[data-table-embedded-widget="true"]') || null;
}

function normalizeConsumeKeys(root: Element | null) {
    return String(root?.getAttribute('data-table-consume-keys') || '')
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
}

function consumeKeyMatches(token: string, key: string) {
    if (!token || !key) return false;
    if (token === 'enter') return key === 'Enter';
    if (token === 'tab') return key === 'Tab';
    return token === 'arrows'
        ? ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)
        : token === String(key || '').toLowerCase();
}

function embeddedWidgetConsumesKey(target: EventTarget | null, key: string) {
    return normalizeConsumeKeys(findEmbeddedWidgetRoot(target)).some((token) =>
        consumeKeyMatches(token, key)
    );
}

function handleTabNavigation(vm: KeyboardVm, event: KeyboardEvent) {
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
    return typeof vm.tbodyRowCount === 'function' ? vm.tbodyRowCount() : vm.tableData.length;
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

    function isTextEditingTarget(vm: KeyboardVm, event: KeyboardEvent, ctx?: KeyboardCtx): boolean {
        const target = event.target as HTMLElement | null;
        return Boolean(
            ctx &&
            vm.isCellEditing(ctx.row, ctx.col) &&
            target &&
            (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
        );
    }

    function handleToolbarShortcuts(vm: KeyboardVm, event: KeyboardEvent, ctx?: KeyboardCtx) {
        if (vm.tableUiLocked) return false;
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
        const key = String(event.key || '').toLowerCase();

        if (key === 'z' && !event.shiftKey) {
            if (isTextEditingTarget(vm, event, ctx)) return false;
            event.preventDefault();
            vm.onTableToolbarAction('undo');
            return true;
        }
        if (key === 'y' || (key === 'z' && event.shiftKey)) {
            if (isTextEditingTarget(vm, event, ctx)) return false;
            event.preventDefault();
            vm.onTableToolbarAction('redo');
            return true;
        }

        if (event.shiftKey && key === 'x') {
            event.preventDefault();
            vm.onTableToolbarAction('strike');
            return true;
        }
        if (event.shiftKey) return false;

        const actionByKey: Record<string, string> = {
            b: 'bold',
            i: 'italic',
            u: 'underline'
        };
        const action = actionByKey[key];
        if (!action) return false;
        event.preventDefault();
        vm.onTableToolbarAction(action);
        return true;
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
            vm.setDisplaySelection(
                {
                    anchor: { r: r0, c: col },
                    focus: { r: row, c: col },
                    fullWidthRows: { r0, r1 }
                },
                'full row selection'
            );
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
            const patches = buildClearCellPatchesForRuntime(vm);
            if (!patches.length) return true;
            vm.dispatchTableCommand(
                { patches, type: 'PATCH_CELLS' },
                {},
                'clear selection',
                TABLE_RUNTIME_SYNC.ROWS_AND_SELECTION
            );
            vm.onInput();
            vm.$nextTick?.(() => vm._scheduleStickyTheadUpdate());
            return true;
        }
        if (!vm.editingCell) {
            event.preventDefault();
            const focus = getFocusCell(vm);
            const sr = focus.r;
            const sc = focus.c;
            const cell = vm.coreCellFromDisplay(sr, sc);
            if (cell) {
                dispatchRuntimeCellPatches(
                    vm,
                    [{ cell, value: vm.emptyCellValueForColumn(sc) }],
                    'clear focused cell'
                );
            }
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
        if (!tdForDropdown) {
            tdForDropdown = getCellByDisplayAddress(vm, row, col);
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

    function arrowDelta(key: string) {
        const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
        const dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
        return dr === 0 && dc === 0 ? null : { dc, dr };
    }

    function commandArrowJumpOrigin(vm: KeyboardVm, dr: number, dc: number) {
        const anchor = getAnchorCell(vm);
        let jumpRow = anchor.r;
        let jumpCol = anchor.c;
        const rect = vm.getSelRect();
        if (
            dr !== 0 &&
            dc === 0 &&
            (
                (vm.selectionIsFullRowBlock && vm.selectionIsFullRowBlock()) ||
                vm.selFullWidthRows ||
                (vm.selectionIsSingleColumnRect && vm.selectionIsSingleColumnRect())
            )
        ) {
            jumpRow = dr === 1 ? rect.r1 : rect.r0;
            jumpCol = getFocusCell(vm).c;
        } else if (
            dr === 0 &&
            dc !== 0 &&
            (
                (vm.selectionIsFullRowBlock && vm.selectionIsFullRowBlock()) ||
                vm.selFullWidthRows ||
                (vm.selectionIsSingleRowRect && vm.selectionIsSingleRowRect())
            )
        ) {
            jumpRow = getFocusCell(vm).r;
            jumpCol = dc === 1 ? rect.c1 : rect.c0;
        }
        return { anchor, jumpCol, jumpRow };
    }

    function handleCommandArrowNavigation(
        vm: KeyboardVm,
        event: KeyboardEvent,
        extendSelection: boolean
    ) {
        const delta = arrowDelta(event.key);
        if (!delta) return false;
        event.preventDefault();
        const { anchor, jumpCol, jumpRow } = commandArrowJumpOrigin(vm, delta.dr, delta.dc);
        const jump = callJump(vm, jumpRow, jumpCol, delta.dr, delta.dc);
        if (jump) {
            if (extendSelection) {
                vm.applyJumpExtendSelection(jump, anchor.r, delta.dr, delta.dc);
                tableLog('keydown extend-jump', jump, delta);
            } else {
                vm.applyJumpNavigate(jump);
                tableLog('keydown jump', jump);
            }
        }
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
            return handleCommandArrowNavigation(vm, event, true);
        }

        if (cmdOrCtrl && !event.shiftKey && !event.altKey) {
            return handleCommandArrowNavigation(vm, event, false);
        }

        if (t && t.tagName === 'SELECT' && !event.shiftKey) return false;

        if (event.shiftKey && !cmdOrCtrl) {
            event.preventDefault();
            const delta = arrowDelta(event.key);
            if (!delta) return false;
            if (!vm.extendSelectionWithArrow(delta.dr, delta.dc)) return false;
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
        handleToolbarShortcuts,
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

export { TableWidgetHandleKeydown };
