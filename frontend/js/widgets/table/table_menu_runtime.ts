import { canAddGroupingLevel } from './table_grouping.ts';
import { WidgetUiCoords } from './table_widget_helpers.ts';
import type {
    TableContextMenuSnapshot,
    TableContextMenuTarget,
    TableRuntimeColumn,
    TableRuntimeMethodSubset,
    TableSortState
} from './table_contract.ts';
type TableContextMenuBodyMode = 'cell' | 'cells' | 'row' | null;
type TableContextMenuItem = {
    disabled: boolean;
    icon: string | null;
    iconClass?: string;
    id: string;
    kbd: string;
    label: string;
    separatorBefore: boolean;
    visible: boolean;
};
type RowMoveDuplicateOpsOptions = {
    bodyMode: TableContextMenuBodyMode;
    isEditable: boolean;
    isEditingCell: boolean;
    numCols: number;
    tableDataLength: number;
};
type ContextMenuSnapshotLike = Partial<TableContextMenuSnapshot> & {
    anchorRow?: number;
    bodyMode?: TableContextMenuBodyMode;
    groupingLevelsSnapshot?: number[];
    headerCol?: number | null;
    sortKeys?: TableSortState[];
};
type BuildMenuItemsOptions = {
    groupingActive?: boolean;
    groupingCanAddLevel?: boolean;
    groupingLevelsLen?: number;
    headerColumn?: TableRuntimeColumn | null;
    headerSortEnabled: boolean;
    isApple: boolean;
    isEditable: boolean;
    isEditingCell: boolean;
    isFullyLoaded?: boolean;
    lineNumbersEnabled?: boolean;
    numCols: number;
    snapshot: ContextMenuSnapshotLike | null;
    stickyHeaderEnabled?: boolean;
    tableDataLength: number;
    tableUiLocked?: boolean;
    target: TableContextMenuTarget | null;
    wordWrapEnabled?: boolean;
};
function isApplePlatform(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '')
    );
}
function modLabel(isApple: boolean): string {
    return isApple ? '⌘' : 'Ctrl';
}
function rowShortcutsKbd() {
    return { below: '⇧+Ctrl++', deleteRow: 'Ctrl−' };
}
function altLabel(isApple: boolean): string {
    return isApple ? '⌥' : 'Alt';
}
function rowMoveDuplicateOpsAllowed(options: RowMoveDuplicateOpsOptions): boolean {
    const len = options.tableDataLength | 0;
    const nCols = options.numCols | 0;
    const modeOk =
        options.bodyMode === 'row' ||
        options.bodyMode === 'cell' ||
        options.bodyMode === 'cells';
    return Boolean(options.isEditable && len > 0 && nCols > 0 && modeOk && !options.isEditingCell);
}
function normalizeMenuSeparators(items: readonly TableContextMenuItem[]): TableContextMenuItem[] {
    const list = items
        .filter((item) => item.visible !== false)
        .map((item) => ({ ...item }));
    let prevSep = false;
    for (let index = 0; index < list.length; index += 1) {
        if (index === 0) {
            list[index].separatorBefore = false;
            prevSep = false;
            continue;
        }
        let hasSeparator = Boolean(list[index].separatorBefore);
        if (hasSeparator && prevSep) {
            hasSeparator = false;
        }
        list[index].separatorBefore = hasSeparator;
        prevSep = hasSeparator;
    }
    return list;
}
function buildMenuItems(options: BuildMenuItemsOptions): TableContextMenuItem[] {
    const target = options.target || null;
    const snapshot = options.snapshot || {};
    const isApple = Boolean(options.isApple);
    const mod = `${modLabel(isApple)}+`;
    const rowKbd = rowShortcutsKbd();
    const alt = altLabel(isApple);
    const len = options.tableDataLength | 0;
    const nCols = options.numCols | 0;
    const isEditingCell = Boolean(options.isEditingCell);
    const groupingActive = Boolean(options.groupingActive);
    const tableUiLocked = Boolean(options.tableUiLocked);
    const groupingLevelsLen = options.groupingLevelsLen ?? 0;
    const lineNumbersEnabled = Boolean(options.lineNumbersEnabled);
    const stickyHeaderEnabled = Boolean(options.stickyHeaderEnabled);
    const wordWrapEnabled = Boolean(options.wordWrapEnabled);
    const headerColumn = options.headerColumn || null;
    const canAddLevel = options.groupingCanAddLevel === undefined
        ? canAddGroupingLevel(nCols, groupingLevelsLen)
        : Boolean(options.groupingCanAddLevel);
    const isLineNumberHeader = Boolean(
        headerColumn &&
            (headerColumn.isLineNumber === true || headerColumn.type === 'line_number')
    );
    if (target?.kind === 'header' && nCols > 0) {
        const col = snapshot.headerCol ?? null;
        const isGlobalHeader = col == null || col < 0;
        const items: TableContextMenuItem[] = [];
        const hasSortBlock = Boolean(options.headerSortEnabled && col != null && col >= 0);
        const canResetAnySort = isGlobalHeader && Array.isArray(snapshot.sortKeys) && snapshot.sortKeys.length > 0;
        const canToggleSticky = nCols > 0;
        let placedSepBeforeGroupingBlock = false;
        const separatorBeforeGroupingBlock = () => {
            if (placedSepBeforeGroupingBlock) {
                return false;
            }
            placedSepBeforeGroupingBlock = true;
            return items.length > 0;
        };
        if (hasSortBlock) {
            const sortKeys = Array.isArray(snapshot.sortKeys) ? snapshot.sortKeys : [];
            const activeHere = sortKeys.some((item) => item?.col === col);
            items.push(
                {
                    id: 'sort_asc',
                    icon: 'sort.svg',
                    iconClass: 'widget-table-ctx__sort-asc',
                    label: 'По возрастанию',
                    kbd: '',
                    visible: true,
                    disabled: false,
                    separatorBefore: false
                },
                {
                    id: 'sort_desc',
                    icon: 'sort.svg',
                    label: 'По убыванию',
                    kbd: '',
                    visible: true,
                    disabled: false,
                    separatorBefore: false
                },
                {
                    id: 'sort_reset',
                    icon: null,
                    label: 'Сбросить',
                    kbd: '',
                    visible: true,
                    disabled: !activeHere,
                    separatorBefore: false
                }
            );
        } else if (canResetAnySort) {
            items.push({
                id: 'sort_reset',
                icon: null,
                label: 'Сбросить сортировку',
                kbd: '',
                visible: true,
                disabled: false,
                separatorBefore: false
            });
        }
        if (canToggleSticky) {
            items.push({
                id: 'toggle_sticky_header',
                icon: null,
                label: stickyHeaderEnabled ? 'Открепить заголовки' : 'Закрепить заголовки',
                kbd: '',
                visible: true,
                disabled: tableUiLocked,
                separatorBefore: items.length > 0
            });
            items.push({
                id: 'toggle_word_wrap',
                icon: null,
                label: wordWrapEnabled ? 'Отключить перенос по словам' : 'Перенос по словам',
                kbd: '',
                visible: true,
                disabled: tableUiLocked,
                separatorBefore: false
            });
            items.push({
                id: 'toggle_line_numbers',
                icon: null,
                label: lineNumbersEnabled ? 'Отключить нумерацию строк' : 'Включить нумерацию строк',
                kbd: '',
                visible: true,
                disabled: tableUiLocked,
                separatorBefore: false
            });
        }
        if (isLineNumberHeader) {
            items.push({
                id: 'recalculate_line_numbers',
                icon: null,
                label: 'Пересчитать нумерацию',
                kbd: '',
                visible: true,
                disabled: tableUiLocked,
                separatorBefore: items.length > 0
            });
        }
        if (!isGlobalHeader && col != null && col >= 0 && canAddLevel && !isLineNumberHeader) {
            const isDuplicateLevel = Array.isArray(snapshot.groupingLevelsSnapshot) &&
                snapshot.groupingLevelsSnapshot.includes(col);
            items.push({
                id: 'group_add_level',
                icon: 'grouping.svg',
                label: 'Группировка',
                kbd: '',
                visible: true,
                disabled: tableUiLocked || isDuplicateLevel,
                separatorBefore: separatorBeforeGroupingBlock()
            });
        }
        if (!isGlobalHeader && groupingActive) {
            items.push({
                id: 'group_clear',
                icon: null,
                label: 'Снять группировку',
                kbd: '',
                visible: true,
                disabled: tableUiLocked,
                separatorBefore: separatorBeforeGroupingBlock()
            });
        }
        if (items.length > 0) {
            return normalizeMenuSeparators(items);
        }
    }
    const bodyMode = snapshot.bodyMode || null;
    const rowMode = bodyMode === 'row';
    const cellLike = bodyMode === 'cell' || bodyMode === 'cells';
    const canAddRows = (rowMode || cellLike) && nCols > 0 && !groupingActive && !tableUiLocked;
    const canDeleteRow = rowMode && nCols > 0 && !groupingActive && !tableUiLocked;
    const items: TableContextMenuItem[] = [];
    if (canAddRows) {
        items.push(
            {
                id: 'add_row_above',
                icon: 'plus.svg',
                label: 'Добавить строку выше',
                kbd: '',
                visible: true,
                disabled: false,
                separatorBefore: false
            },
            {
                id: 'add_row_below',
                icon: 'plus.svg',
                label: 'Добавить строку ниже',
                kbd: rowMode ? rowKbd.below : '',
                visible: true,
                disabled: false,
                separatorBefore: false
            }
        );
    }
    if (canDeleteRow) {
        items.push({
            id: 'delete_row',
            icon: 'delete.svg',
            label: 'Удалить строку',
            kbd: rowKbd.deleteRow,
            visible: true,
            disabled: len <= 1,
            separatorBefore: false
        });
    }
    const anchorRow = snapshot.anchorRow ?? 0;
    const rowMoveOk = !groupingActive && !tableUiLocked && rowMoveDuplicateOpsAllowed({
        isEditable: options.isEditable,
        tableDataLength: len,
        numCols: nCols,
        bodyMode,
        isEditingCell
    });
    if (rowMoveOk) {
        items.push(
            {
                id: 'move_row_up',
                icon: 'arrow_3.svg',
                label: 'Переместить строку вверх',
                kbd: `${alt}↑`,
                visible: true,
                disabled: anchorRow <= 0,
                separatorBefore: false
            },
            {
                id: 'move_row_down',
                icon: 'arrow_3.svg',
                iconClass: 'widget-table-ctx__arrow-down',
                label: 'Переместить строку вниз',
                kbd: `${alt}↓`,
                visible: true,
                disabled: anchorRow < 0 || anchorRow >= len - 1,
                separatorBefore: false
            },
            {
                id: 'duplicate_row_above',
                icon: 'plus.svg',
                label: 'Дублировать строку выше',
                kbd: `${isApple ? '⇧+⌥+' : 'Shift+Alt+'}↑`,
                visible: true,
                disabled: false,
                separatorBefore: false
            },
            {
                id: 'duplicate_row_below',
                icon: 'plus.svg',
                label: 'Дублировать строку ниже',
                kbd: `${isApple ? '⇧+⌥+' : 'Shift+Alt+'}↓`,
                visible: true,
                disabled: false,
                separatorBefore: false
            }
        );
    }
    const clipboardEnabled = !groupingActive && !tableUiLocked;
    items.push(
        {
            id: 'copy',
            icon: 'content_copy.svg',
            label: 'Копировать',
            kbd: `${mod}C`,
            visible: true,
            disabled: nCols === 0 || len === 0 || !clipboardEnabled,
            separatorBefore: items.length > 0
        },
        {
            id: 'cut',
            icon: 'content_cut.svg',
            label: 'Вырезать',
            kbd: `${mod}X`,
            visible: true,
            disabled: nCols === 0 || len === 0 || !clipboardEnabled,
            separatorBefore: false
        },
        {
            id: 'paste',
            icon: 'content_paste_.svg',
            label: 'Вставить',
            kbd: `${mod}V`,
            visible: true,
            disabled: nCols === 0 || len === 0 || !clipboardEnabled,
            separatorBefore: false
        },
        {
            id: 'clear',
            icon: 'delete.svg',
            label: 'Очистить',
            kbd: 'Del',
            visible: true,
            disabled: nCols === 0 || len === 0 || !clipboardEnabled,
            separatorBefore: false
        }
    );
    return normalizeMenuSeparators(items);
}
const MenuRuntimeMethods = {
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
            ? this.sortKeys.map((item: TableSortState) => ({ col: item.col, dir: item.dir }))
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
            lineNumbersEnabled: this.lineNumbersRuntimeEnabled,
            stickyHeaderEnabled: this.stickyHeaderEnabled,
            wordWrapEnabled: this.wordWrapEnabled
        };
    },
    buildClipboardActionSnapshot() {
        const rect = this.cloneRect(this.getSelRect());
        const pasteAnchor = this.computePasteAnchorRect(this.getSelRect());
        const sortKeys = Array.isArray(this.sortKeys)
            ? this.sortKeys.map((item: TableSortState) => ({ col: item.col, dir: item.dir }))
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
            lineNumbersEnabled: this.lineNumbersRuntimeEnabled,
            stickyHeaderEnabled: this.stickyHeaderEnabled,
            wordWrapEnabled: this.wordWrapEnabled
        };
    },
    clampMenuPosition(event: MouseEvent) {
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
        this._contextMenuClickHandler = (event: MouseEvent) => {
            const element = this.$refs.contextMenuEl;
            if (element && event.target instanceof Node && element.contains(event.target)) return;
            this.hideContextMenu();
        };
        this._contextMenuKeydownHandler = (event: KeyboardEvent) => {
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
        const target = event.target;
        const td = target instanceof Element ? target.closest('tbody td') : null;
        if (!td || !this.$el || !this.$el.contains(td)) return;
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
    onColumnNumberHeaderContextMenu(event, colIndex) {
        const normalizedCol = this.normCol(colIndex);
        this.onTableHeaderContextMenu(
            event,
            -1,
            {
                colspan: 1,
                label: '',
                leafColIndex: null,
                rowspan: 1,
                runtimeColIndex: normalizedCol,
                width: null
            },
            normalizedCol
        );
    },
    onGroupHeaderContextMenu(event) {
        if (this.tableColumns.length === 0) return;
        event.preventDefault();
        this._openContextMenuPrepare();
        this.exitCellEdit();
        this.contextMenuSessionId += 1;
        this.contextMenuTarget = { kind: 'header', col: -1 };
        this.contextMenuContext = this.buildContextMenuSnapshot('header', -1, -1, null);
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
        const sortIds = new Set(['sort_asc', 'sort_desc', 'sort_reset']);
        const groupIds = new Set(['group_add_level', 'group_clear']);
        const stickyIds = new Set(['toggle_sticky_header']);
        const lineNumberIds = new Set(['toggle_line_numbers', 'recalculate_line_numbers']);
        const wrapIds = new Set(['toggle_word_wrap']);
        if (
            !this.isEditable &&
            id !== 'copy' &&
            !sortIds.has(id) &&
            !groupIds.has(id) &&
            !stickyIds.has(id) &&
            !lineNumberIds.has(id) &&
            !wrapIds.has(id)
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
                this.onGroupClearFromSnapshot();
                break;
            case 'toggle_sticky_header':
                this.toggleStickyHeaderFromSnapshot();
                break;
            case 'toggle_line_numbers':
                this.toggleLineNumbersFromSnapshot(snapshot);
                break;
            case 'toggle_word_wrap':
                this.toggleWordWrapFromSnapshot();
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
        this.hideContextMenu();
        if (col == null || col < 0) {
            if (!this.sortKeys.length) return;
            this.sortKeys = [];
            this.restoreSortCycleRowOrder();
            this.refreshGroupingViewFromData();
            this.onInput();
            return;
        }
        const next = this.sortKeys.filter((item: TableSortState) => item.col !== col);
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
} satisfies TableRuntimeMethodSubset;
export {
    altLabel,
    buildMenuItems,
    isApplePlatform,
    MenuRuntimeMethods,
    modLabel,
    normalizeMenuSeparators,
    rowMoveDuplicateOpsAllowed
};
export default MenuRuntimeMethods;
