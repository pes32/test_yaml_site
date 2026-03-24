/**
 * Клавиатура редактируемой таблицы: цепочка обработчиков + диспетчер.
 */
(function (global) {
    'use strict';

    const Core = global.TableWidgetCore || (global.TableWidgetCore = {});

    function callJump(vm, jumpRow, jumpCol, dr, dc) {
        const J = Core.Jump;
        if (!J || typeof J.jumpTarget !== 'function' || typeof J.buildJumpOpts !== 'function') {
            return null;
        }
        return J.jumpTarget(J.buildJumpOpts(vm, jumpRow, jumpCol, dr, dc));
    }

    function editFocus(vm) {
        return vm.editingCell;
    }

    function handleTabNavigation(vm, event /* , ctx */) {
        if (event.key !== 'Tab') return false;
        const lastRow = vm.tableData.length - 1;
        const lastCol = vm.tableColumns.length - 1;
        if (lastRow < 0 || lastCol < 0) return false;
        const ed = editFocus(vm);
        const r = ed ? ed.r : vm.selFocus.r;
        const c = ed ? ed.c : vm.selFocus.c;
        let nr;
        let nc;
        if (event.shiftKey) {
            if (c > 0) {
                nr = r;
                nc = c - 1;
            } else if (r > 0) {
                nr = r - 1;
                nc = lastCol;
            } else {
                return false;
            }
        } else if (c < lastCol) {
            nr = r;
            nc = c + 1;
        } else if (r < lastRow) {
            nr = r + 1;
            nc = 0;
        } else {
            return false;
        }
        event.preventDefault();
        vm.exitCellEdit();
        vm.setSelectionSingle(nr, nc);
        vm.$nextTick(() => vm.focusSelectionCell(nr, nc));
        Core.log('keydown Tab →', nr, nc);
        return true;
    }

    function handleClipboardShortcuts(vm, event, ctx) {
        if (!vm.isEditable) return false;
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
        const k = event.key && String(event.key).toLowerCase();
        if (k !== 'c' && k !== 'x' && k !== 'v') return false;

        const t = event.target;
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

    function handleEditingShortcuts(vm, event /* , ctx */) {
        if (event.key === 'F2') {
            event.preventDefault();
            vm.enterCellEditAt(vm.selFocus.r, vm.selFocus.c, { caretEnd: true });
            return true;
        }
        if (event.key === 'Escape' && vm.editingCell) {
            event.preventDefault();
            vm.exitCellEdit();
            vm.$nextTick(() =>
                vm.focusSelectionCell(vm.selFocus.r, vm.selFocus.c)
            );
            return true;
        }
        return false;
    }

    function handleShiftSpaceFullRow(vm, event, ctx) {
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
            vm.$nextTick(() => vm.focusSelectionCell(row, col));
        } else {
            const last = n - 1;
            vm.selFullWidthRows = { r0: row, r1: row };
            vm.selAnchor = { r: row, c: col };
            if (last === 0) {
                vm.selFocus = { r: row, c: 0 };
            } else if (col === 0) {
                vm.selFocus = { r: row, c: last };
            } else if (col === last) {
                vm.selFocus = { r: row, c: 0 };
            } else {
                vm.selFocus =
                    col * 2 <= last
                        ? { r: row, c: last }
                        : { r: row, c: 0 };
            }
            vm.exitCellEdit();
            vm.focusSelectionCell(vm.selFocus.r, vm.selFocus.c);
        }
        return true;
    }

    function handleDeleteBackspace(vm, event /* , ctx */) {
        if (event.key !== 'Delete' && event.key !== 'Backspace') return false;
        if (vm.isMultiCellSelection()) {
            event.preventDefault();
            vm.clearSelectedCells();
            return true;
        }
        if (!vm.editingCell) {
            event.preventDefault();
            const sr = vm.selFocus.r;
            const sc = vm.selFocus.c;
            vm.patchCellValue(sr, sc, vm.emptyCellValueForColumn(sc));
            return true;
        }
        return false;
    }

    function handleRowInsertDeleteShortcuts(vm, event /* , ctx */) {
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
    function handleAltRowMoveDuplicate(vm, event) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return false;
        if (!event.altKey || event.ctrlKey || event.metaKey) return false;

        const len = vm.tableData.length;
        const nCols = vm.tableColumns.length;
        if (len === 0 || nCols === 0) return false;

        const CM = Core.ContextMenu;
        const allow = CM && CM.rowMoveDuplicateOpsAllowed;
        if (
            !allow ||
            !allow({
                isEditable: vm.isEditable,
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

        const dom = Core.dom;
        const ctxCell =
            dom && typeof dom.getCellFromEvent === 'function'
                ? dom.getCellFromEvent(vm, event)
                : null;
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

        let row;
        let col;
        if (ctxOk) {
            row = ctxCell.row;
            col = ctxCell.col;
        } else {
            row = sf.r;
            col = sf.c;
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

    function handleEnter(vm, event, ctx) {
        const row = ctx.row;
        const col = ctx.col;
        if (event.key !== 'Enter') return false;
        event.preventDefault();
        const lastRow = vm.tableData.length - 1;
        const lastCol = vm.tableColumns.length - 1;
        if (vm.isCellEditing(row, col)) {
            vm.exitCellEdit();
            if (row < lastRow) {
                vm.setSelectionSingle(row + 1, col);
                vm.$nextTick(() => vm.focusSelectionCell(row + 1, col));
            } else if (col === lastCol) {
                vm.addNewRow();
            } else {
                vm.setSelectionSingle(row, col + 1);
                vm.$nextTick(() => vm.focusSelectionCell(row, col + 1));
            }
            return true;
        }
        if (row < lastRow) {
            vm.setSelectionSingle(row + 1, col);
            vm.$nextTick(() => vm.focusSelectionCell(row + 1, col));
        } else if (col === lastCol) {
            vm.addNewRow();
        } else {
            vm.setSelectionSingle(row, col + 1);
            vm.$nextTick(() => vm.focusSelectionCell(row, col + 1));
        }
        return true;
    }

    function handlePrintableReplace(vm, event, ctx) {
        const dropdownOpen = ctx.dropdownOpen;
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
            vm.selFocus.r,
            vm.selFocus.c,
            event.key
        );
        return true;
    }

    function handleArrowNavigation(vm, event, ctx) {
        const row = ctx.row;
        const col = ctx.col;
        const dropdownOpen = ctx.dropdownOpen;
        const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (!navKeys.includes(event.key)) return false;
        if (event.defaultPrevented) return false;
        if (dropdownOpen) return false;

        const t = event.target;
        const cmdOrCtrl = event.metaKey || event.ctrlKey;
        const isTextLikeInput =
            t.tagName === 'INPUT' &&
            ['text', 'search', 'tel', 'url', 'password'].includes(t.type || 'text');

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
            const ar = vm.selAnchor.r;
            const ac = vm.selAnchor.c;
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
                    jumpCol = vm.selFocus.c;
                }
            } else if (dr === 0 && dc !== 0) {
                if (
                    (vm.selectionIsFullRowBlock && vm.selectionIsFullRowBlock()) ||
                    vm.selFullWidthRows ||
                    (vm.selectionIsSingleRowRect && vm.selectionIsSingleRowRect())
                ) {
                    jumpRow = vm.selFocus.r;
                    jumpCol = dc === 1 ? br.c1 : br.c0;
                }
            }
            const j = callJump(vm, jumpRow, jumpCol, dr, dc);
            if (j) {
                vm.applyJumpExtendSelection(j, ar, dr, dc);
                Core.log('keydown extend-jump', j, { dr, dc });
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
            const ar = vm.selAnchor.r;
            const ac = vm.selAnchor.c;
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
                    jumpCol = vm.selFocus.c;
                }
            } else if (dr === 0 && dc !== 0) {
                if (
                    (vm.selectionIsFullRowBlock && vm.selectionIsFullRowBlock()) ||
                    vm.selFullWidthRows ||
                    (vm.selectionIsSingleRowRect && vm.selectionIsSingleRowRect())
                ) {
                    jumpRow = vm.selFocus.r;
                    jumpCol = dc === 1 ? br2.c1 : br2.c0;
                }
            }
            const j = callJump(vm, jumpRow, jumpCol, dr, dc);
            if (j) {
                vm.applyJumpNavigate(j);
                Core.log('keydown jump', j);
            }
            return true;
        }

        if (t.tagName === 'SELECT' && !event.shiftKey) return false;

        if (event.shiftKey && !cmdOrCtrl) {
            event.preventDefault();
            const dr =
                event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
            const dc =
                event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
            if (dr === 0 && dc === 0) return false;
            if (!vm.extendSelectionWithArrow(dr, dc)) return false;
            vm.exitCellEdit();
            vm.focusSelectionCell(vm.selFocus.r, vm.selFocus.c);
            return true;
        }

        if (
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
            isTextLikeInput &&
            vm.isCellEditing(row, col)
        ) {
            const start = t.selectionStart;
            const end = t.selectionEnd;
            const len = (t.value || '').length;
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
        if (nextR < 0 || nextR >= vm.tableData.length) return false;

        event.preventDefault();
        vm.exitCellEdit();
        vm.setSelectionSingle(nextR, nextC);
        vm.$nextTick(() => vm.focusSelectionCell(nextR, nextC));
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

    function TableWidgetHandleKeydown(vm, event) {
        if (!vm.isEditable) return;
        if (handleAltRowMoveDuplicate(vm, event)) return;

        const dom = Core.dom;
        const cell =
            dom && typeof dom.getCellFromEvent === 'function'
                ? dom.getCellFromEvent(vm, event)
                : null;
        if (!cell) return;

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
            if (KEYBOARD_HANDLERS[i](vm, event, ctx)) return;
        }
    }

    Core.Keyboard.handleKeydown = TableWidgetHandleKeydown;
})(typeof window !== 'undefined' ? window : this);
