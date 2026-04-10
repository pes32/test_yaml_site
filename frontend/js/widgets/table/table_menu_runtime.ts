import { canAddGroupingLevel } from './table_grouping.ts';
import { defineTableRuntimeModule } from './table_method_helpers.ts';
import { WidgetUiCoords } from './table_widget_helpers.ts';

const MenuRuntimeMethods = defineTableRuntimeModule({
    computeBodyModeForMenu() {
        if (this.selectionIsFullRowBlock()) return 'row';
        const { r0, r1, c0, c1 } = this.getSelRect();
        if (r0 === r1 && c0 === c1) return 'cell';
        return 'cells';
    },

    computePasteAnchorRect(rect) {
        if (WidgetUiCoords && WidgetUiCoords.computePasteAnchorRect) {
            return WidgetUiCoords.computePasteAnchorRect(rect, this.selFocus);
        }
        const { r0, r1, c0, c1 } = rect;
        if (r0 === r1 && c0 === c1) {
            return { r: this.selFocus.r, c: this.selFocus.c };
        }
        return { r: r0, c: c0 };
    },

    cloneRect(rect) {
        return WidgetUiCoords && WidgetUiCoords.cloneRect
            ? WidgetUiCoords.cloneRect(rect)
            : { r0: rect.r0, r1: rect.r1, c0: rect.c0, c1: rect.c1 };
    },

    buildContextMenuSnapshot(kind, anchorRow, anchorCol, headerCol) {
        const rect = this.cloneRect(this.getSelRect());
        const pasteAnchor = this.computePasteAnchorRect(this.getSelRect());
        const bodyMode =
            kind === 'header' ? null : this.computeBodyModeForMenu();
        const sortKeys = Array.isArray(this.sortKeys)
            ? this.sortKeys.map((item) => ({ col: item.col, dir: item.dir }))
            : [];
        return {
            sessionId: this.contextMenuSessionId,
            bodyMode,
            anchorRow,
            anchorCol,
            rect,
            headerCol: headerCol != null ? headerCol : null,
            pasteAnchor: { r: pasteAnchor.r, c: pasteAnchor.c },
            sortKeys,
            groupingLevelsSnapshot: (this.groupingState.levels || []).slice(),
            stickyHeaderEnabled: this.stickyHeaderEnabled,
            wordWrapEnabled: this.wordWrapEnabled
        };
    },

    buildClipboardActionSnapshot() {
        const rect = this.cloneRect(this.getSelRect());
        const pasteAnchor = this.computePasteAnchorRect(this.getSelRect());
        const sortKeys = Array.isArray(this.sortKeys)
            ? this.sortKeys.map((item) => ({ col: item.col, dir: item.dir }))
            : [];
        return {
            sessionId: this.contextMenuSessionId,
            bodyMode: this.computeBodyModeForMenu(),
            anchorRow: this.selFocus.r,
            anchorCol: this.selFocus.c,
            rect,
            headerCol: null,
            pasteAnchor: { r: pasteAnchor.r, c: pasteAnchor.c },
            sortKeys,
            groupingLevelsSnapshot: (this.groupingState.levels || []).slice(),
            stickyHeaderEnabled: this.stickyHeaderEnabled,
            wordWrapEnabled: this.wordWrapEnabled
        };
    },

    clampMenuPosition(event) {
        if (WidgetUiCoords && WidgetUiCoords.clampMenuPosition) return WidgetUiCoords.clampMenuPosition(event);
        const x = (event.clientX || 0) + (window.scrollX || 0);
        const y = (event.clientY || 0) + (window.scrollY || 0);
        const pad = 8;
        const width = typeof window !== 'undefined' ? window.innerWidth : 800;
        const height = typeof window !== 'undefined' ? window.innerHeight : 600;
        const menuWidth = 280;
        const menuHeight = 400;
        return {
            x: Math.min(Math.max(pad, x), Math.max(pad, width - menuWidth - pad)),
            y: Math.min(Math.max(pad, y), Math.max(pad, height - menuHeight - pad))
        };
    },

    _detachContextMenuGlobalListeners() {
        if (this._contextMenuClickHandler) {
            document.removeEventListener('mousedown', this._contextMenuClickHandler, true);
            this._contextMenuClickHandler = null;
        }
        if (this._contextMenuKeydownHandler) {
            document.removeEventListener('keydown', this._contextMenuKeydownHandler, true);
            this._contextMenuKeydownHandler = null;
        }
    },

    _attachContextMenuGlobalListeners() {
        this._detachContextMenuGlobalListeners();
        this._contextMenuClickHandler = (event) => {
            const element = this.$refs.contextMenuEl;
            if (element && element.contains(event.target)) return;
            this.hideContextMenu();
        };
        this._contextMenuKeydownHandler = (event) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                this.hideContextMenu();
            }
        };
        document.addEventListener('mousedown', this._contextMenuClickHandler, true);
        document.addEventListener('keydown', this._contextMenuKeydownHandler, true);
    },

    onTbodyMouseDownCapture(event) {
        if (!this.isEditable) return;
        if (event.button !== 2) return;
        const td = event.target.closest?.('tbody td');
        if (!td || !this.$el.contains(td)) return;
        this._tableContextMenuMouseDown = true;
        setTimeout(() => {
            if (this._tableContextMenuMouseDown && !this.contextMenuOpen) {
                this._tableContextMenuMouseDown = false;
            }
        }, 0);
    },

    onBodyContextMenu(event, row, col) {
        if (!this.isEditable) return;
        event.preventDefault();
        this._tableContextMenuMouseDown = false;
        this._openContextMenuPrepare();
        const normalizedRow = this.normRow(row);
        const normalizedCol = this.normCol(col);
        const inside =
            this.getSelectionCellCount() > 0 &&
            this.isCellInSelection(normalizedRow, normalizedCol);
        if (!inside) {
            this.setSelectionSingle(normalizedRow, normalizedCol);
        }
        this.selectedRowIndex = normalizedRow;
        this.exitCellEdit();
        this.contextMenuSessionId += 1;
        this.contextMenuTarget = { kind: 'body', row: normalizedRow, col: normalizedCol };
        this.contextMenuContext = this.buildContextMenuSnapshot(
            'body',
            normalizedRow,
            normalizedCol,
            null
        );
        this.contextMenuPosition = this.clampMenuPosition(event);
        this.contextMenuOpen = true;
        this._attachContextMenuGlobalListeners();
    },

    onTableHeaderContextMenu(event, rowIndex, cell, colIndex) {
        void rowIndex;
        if (!cell || cell.colspan !== 1 || colIndex == null) return;
        const numCols = this.tableColumns.length;
        const headerColumn = colIndex >= 0 ? this.tableColumns[colIndex] : null;
        const isLineNumber = this.isLineNumberColumn(headerColumn);
        const canGroup =
            canAddGroupingLevel(numCols, (this.groupingState.levels || []).length) &&
            colIndex >= 0 &&
            !isLineNumber;
        const canToggleSticky = colIndex >= 0 && numCols > 0;
        const canToggleWordWrap = numCols > 0;
        const showMenu =
            this.headerSortEnabled ||
            this.groupingActive ||
            canGroup ||
            canToggleSticky ||
            canToggleWordWrap ||
            isLineNumber;
        if (!showMenu) return;
        event.preventDefault();
        this._openContextMenuPrepare();
        this.exitCellEdit();
        this.contextMenuSessionId += 1;
        this.contextMenuTarget = { kind: 'header', col: colIndex };
        this.contextMenuContext = this.buildContextMenuSnapshot('header', -1, -1, colIndex);
        this.contextMenuPosition = this.clampMenuPosition(event);
        this.contextMenuOpen = true;
        this._attachContextMenuGlobalListeners();
    },

    _openContextMenuPrepare() {
        this._detachContextMenuGlobalListeners();
        this.contextMenuOpen = false;
        this.contextMenuContext = null;
        this.contextMenuTarget = null;
    },

    hideContextMenu() {
        this._tableContextMenuMouseDown = false;
        this._detachContextMenuGlobalListeners();
        this.contextMenuOpen = false;
        this.contextMenuContext = null;
        this.contextMenuTarget = null;
        this.$nextTick(() => {
            if (this.tableColumns.length > 0 && this.tableData.length > 0) {
                this.focusSelectionCell(this.selFocus.r, this.selFocus.c);
            }
        });
    },

    onContextMenuItemActivate(item) {
        if (!item || item.disabled) return;
        const snapshot = this.contextMenuContext;
        if (!snapshot) return;
        this.runContextMenuAction(item.id, snapshot);
    },

    runContextMenuAction(id, snapshot) {
        const sortIds = { sort_asc: 1, sort_desc: 1, sort_reset: 1 };
        const groupIds = { group_add_level: 1, group_clear: 1 };
        const stickyIds = { toggle_sticky_header: 1 };
        const wrapIds = { toggle_word_wrap: 1 };
        if (
            !this.isEditable &&
            id !== 'copy' &&
            !sortIds[id] &&
            !groupIds[id] &&
            !stickyIds[id] &&
            !wrapIds[id]
        ) {
            return;
        }
        if (this.tableUiLocked) return;
        if (!snapshot) return;
        switch (id) {
            case 'add_row_above':
                this.addRowAboveFromSnapshot(snapshot);
                break;
            case 'add_row_below':
                this.addRowBelowFromSnapshot(snapshot);
                break;
            case 'delete_row':
                this.deleteRowFromSnapshot(snapshot);
                break;
            case 'move_row_up':
                this.moveRowUpFromSnapshot(snapshot);
                break;
            case 'move_row_down':
                this.moveRowDownFromSnapshot(snapshot);
                break;
            case 'duplicate_row_above':
                this.duplicateRowAboveFromSnapshot(snapshot);
                break;
            case 'duplicate_row_below':
                this.duplicateRowBelowFromSnapshot(snapshot);
                break;
            case 'copy':
                this.copySelection(snapshot);
                break;
            case 'cut':
                this.cutSelection(snapshot);
                break;
            case 'paste':
                this.pasteFromClipboard(snapshot);
                break;
            case 'clear':
                this.clearSelectionFromSnapshot(snapshot);
                break;
            case 'sort_asc':
                this.applySortFromMenu(snapshot, 'asc');
                break;
            case 'sort_desc':
                this.applySortFromMenu(snapshot, 'desc');
                break;
            case 'sort_reset':
                this.applySortResetFromMenu(snapshot);
                break;
            case 'group_add_level':
                this.onGroupAddLevelFromSnapshot(snapshot);
                break;
            case 'group_clear':
                this.onGroupClearFromSnapshot(snapshot);
                break;
            case 'toggle_sticky_header':
                this.toggleStickyHeaderFromSnapshot(snapshot);
                break;
            case 'toggle_word_wrap':
                this.toggleWordWrapFromSnapshot(snapshot);
                break;
            case 'recalculate_line_numbers':
                this.recalculateLineNumbersFromSnapshot(snapshot);
                break;
            default:
                break;
        }
    },

    toggleStickyHeaderFromSnapshot() {
        this.hideContextMenu();
        this.stickyHeaderRuntimeEnabled = !this.stickyHeaderRuntimeEnabled;
    },

    toggleWordWrapFromSnapshot() {
        this.hideContextMenu();
        this.wordWrapRuntimeEnabled = !this.wordWrapRuntimeEnabled;
        if (this.wordWrapEnabled) {
            this.$nextTick(() => this.clearAllCellOverflowHints());
        }
    },

    applySortFromMenu(snapshot, direction) {
        if (this.tableUiLocked) return;
        const col = snapshot.headerCol;
        if (col == null || col < 0) return;
        this.hideContextMenu();
        this._sortCycleRowOrder = this.tableData.slice();
        this.sortKeys = [{ col, dir: direction === 'asc' ? 'asc' : 'desc' }];
        this.sortTableDataInPlace();
        this.refreshGroupingViewFromData();
        this.onInput();
    },

    applySortResetFromMenu(snapshot) {
        if (this.tableUiLocked) return;
        const col = snapshot.headerCol;
        if (col == null) return;
        this.hideContextMenu();
        const next = this.sortKeys.filter((item) => item.col !== col);
        if (next.length === this.sortKeys.length) return;
        this.sortKeys = next;
        if (next.length === 0) {
            this.restoreSortCycleRowOrder();
        } else {
            this.sortTableDataInPlace();
        }
        this.refreshGroupingViewFromData();
        this.onInput();
    },

    onGroupAddLevelFromSnapshot(snapshot) {
        const col = snapshot.headerCol;
        this.hideContextMenu();
        if (col == null || col < 0) return;
        if (this.isLineNumberColumn(this.tableColumns[col])) return;
        if (this.groupingState.levels.indexOf(col) >= 0) return;
        const prevLevels = this.groupingState.levels.slice();
        const prevExpanded = new Set(this.groupingState.expanded);
        const prevPending = this._lazyPendingRows.slice();
        const prevFull = this.isFullyLoaded;
        this.tableUiLocked = true;
        try {
            if (!this.isFullyLoaded) {
                const ok = this.flushLazyFullLoadInternal();
                if (!ok) {
                    this._lazyPendingRows = prevPending;
                    this.isFullyLoaded = prevFull;
                    this.showTableError(
                        'Не удалось полностью загрузить данные для группировки.'
                    );
                    return;
                }
            }
            this.groupingState = {
                levels: prevLevels.concat(col),
                expanded: new Set()
            };
            this.sortTableDataInPlace();
            this.refreshGroupingViewFromData();
            this.onInput();
        } catch (error) {
            this.groupingState = { levels: prevLevels, expanded: prevExpanded };
            this.refreshGroupingViewFromData();
            this.showTableError('Не удалось применить группировку.', {
                cause: error,
                details: {
                    action: 'group_add_level'
                }
            });
        } finally {
            this.tableUiLocked = false;
        }
    },

    onGroupClearFromSnapshot() {
        this.hideContextMenu();
        this.groupingViewCache = null;
        this.groupingState = { levels: [], expanded: new Set() };
        this.onInput();
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    }
});

export { MenuRuntimeMethods };
export default MenuRuntimeMethods;
