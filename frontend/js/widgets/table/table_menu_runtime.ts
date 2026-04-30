import { canAddGroupingLevel } from './table_grouping.ts';
import { buildContextMenuSnapshot, isContextMenuSnapshotCurrent } from './table_context_menu_model.ts';
import {
    buildCoreSelectionFromDisplay,
    runtimeDisplaySelection
} from './table_selection_model.ts';
import { TABLE_RUNTIME_SYNC } from './table_runtime_state.ts';
import { columnIndexByKey, columnKeyAt } from './table_state_core.ts';
import { isApplePlatform } from './table_platform.ts';
import { WidgetUiCoords } from './table_widget_helpers.ts';
import type {
    TableContextMenuItem,
    TableContextMenuSnapshot,
    TableContextMenuTarget,
    TableCoreSortState,
    TableHeaderCell,
    TableRuntimeColumn,
    TableRuntimeMethodSubset,
    TableSelectionRect,
    TableSortState
} from './table_contract.ts';
import { firstUserColumnIndex, type UserColumnRuntime } from './table_column_navigation.ts';
type TableContextMenuBodyMode = 'cell' | 'cells' | 'row' | null;
type RowMoveDuplicateOpsOptions = {
    bodyMode: TableContextMenuBodyMode;
    isEditable: boolean;
    isEditingCell: boolean;
    numCols: number;
    tableDataLength: number;
};
type ContextMenuSnapshotLike = Partial<TableContextMenuSnapshot> & {
    anchorRow?: number;
    anchorSourceRow?: number | null;
    bodyMode?: TableContextMenuBodyMode;
    groupingLevelsSnapshot?: number[];
    headerCol?: number | null;
    sortKeys?: TableSortState[];
};
type RuntimeContextMenuSnapshotOverrides = {
    anchorCol: number;
    anchorRow: number;
    bodyMode: TableContextMenuBodyMode;
    headerCol: number | null;
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

const SORT_MENU_IDS = new Set(['sort_asc', 'sort_desc', 'sort_reset']);
const GROUP_MENU_IDS = new Set(['group_add_level', 'group_clear']);
const STICKY_MENU_IDS = new Set(['toggle_sticky_header']);
const LINE_NUMBER_MENU_IDS = new Set(['toggle_line_numbers', 'recalculate_line_numbers']);
const WRAP_MENU_IDS = new Set(['toggle_word_wrap']);
const CONTEXT_MENU_ACTION_HANDLERS = {
    add_row_above: 'addRowAboveFromSnapshot',
    add_row_below: 'addRowBelowFromSnapshot',
    delete_row: 'deleteRowFromSnapshot',
    move_row_up: 'moveRowUpFromSnapshot',
    move_row_down: 'moveRowDownFromSnapshot',
    duplicate_row_above: 'duplicateRowAboveFromSnapshot',
    duplicate_row_below: 'duplicateRowBelowFromSnapshot',
    copy: 'copySelection',
    cut: 'cutSelection',
    paste: 'pasteFromClipboard',
    clear: 'clearSelectionFromSnapshot',
    sort_reset: 'applySortResetFromMenu',
    group_add_level: 'onGroupAddLevelFromSnapshot',
    group_clear: 'onGroupClearFromSnapshot',
    toggle_sticky_header: 'toggleStickyHeaderFromSnapshot',
    toggle_line_numbers: 'toggleLineNumbersFromSnapshot',
    toggle_word_wrap: 'toggleWordWrapFromSnapshot',
    recalculate_line_numbers: 'recalculateLineNumbersFromSnapshot'
} as const;
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

function menuItem(
    options: Pick<TableContextMenuItem, 'id' | 'label'> &
        Partial<Omit<TableContextMenuItem, 'id' | 'label'>>
): TableContextMenuItem {
    return {
        disabled: false,
        icon: null,
        kbd: '',
        separatorBefore: false,
        visible: true,
        ...options
    };
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
                menuItem({
                    id: 'sort_asc',
                    icon: 'sort.svg',
                    iconClass: 'widget-table-ctx__sort-asc',
                    label: 'По возрастанию'
                }),
                menuItem({
                    id: 'sort_desc',
                    icon: 'sort.svg',
                    label: 'По убыванию'
                }),
                menuItem({
                    id: 'sort_reset',
                    label: 'Сбросить',
                    disabled: !activeHere
                })
            );
        } else if (canResetAnySort) {
            items.push(menuItem({
                id: 'sort_reset',
                label: 'Сбросить сортировку',
            }));
        }
        if (canToggleSticky) {
            items.push(menuItem({
                id: 'toggle_sticky_header',
                label: stickyHeaderEnabled ? 'Открепить заголовки' : 'Закрепить заголовки',
                disabled: tableUiLocked,
                separatorBefore: items.length > 0
            }));
            items.push(menuItem({
                id: 'toggle_word_wrap',
                label: wordWrapEnabled ? 'Отключить перенос по словам' : 'Перенос по словам',
                disabled: tableUiLocked
            }));
            items.push(menuItem({
                id: 'toggle_line_numbers',
                label: lineNumbersEnabled ? 'Отключить нумерацию строк' : 'Включить нумерацию строк',
                disabled: tableUiLocked
            }));
        }
        if (isLineNumberHeader) {
            items.push(menuItem({
                id: 'recalculate_line_numbers',
                label: 'Пересчитать нумерацию',
                disabled: tableUiLocked,
                separatorBefore: items.length > 0
            }));
        }
        if (!isGlobalHeader && col != null && col >= 0 && canAddLevel && !isLineNumberHeader) {
            const isDuplicateLevel = Array.isArray(snapshot.groupingLevelsSnapshot) &&
                snapshot.groupingLevelsSnapshot.includes(col);
            items.push(menuItem({
                id: 'group_add_level',
                icon: 'grouping.svg',
                label: 'Группировка',
                disabled: tableUiLocked || isDuplicateLevel,
                separatorBefore: separatorBeforeGroupingBlock()
            }));
        }
        if (!isGlobalHeader && groupingActive) {
            items.push(menuItem({
                id: 'group_clear',
                label: 'Снять группировку',
                disabled: tableUiLocked,
                separatorBefore: separatorBeforeGroupingBlock()
            }));
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
            menuItem({
                id: 'add_row_above',
                icon: 'plus.svg',
                label: 'Добавить строку выше'
            }),
            menuItem({
                id: 'add_row_below',
                icon: 'plus.svg',
                label: 'Добавить строку ниже',
                kbd: rowMode ? rowKbd.below : ''
            })
        );
    }
    if (canDeleteRow) {
        items.push(menuItem({
            id: 'delete_row',
            icon: 'delete.svg',
            label: 'Удалить строку',
            kbd: rowKbd.deleteRow,
            disabled: len <= 1
        }));
    }
    const anchorSourceRow =
        snapshot.anchorSourceRow == null ? (snapshot.anchorRow ?? 0) : snapshot.anchorSourceRow;
    const rowMoveOk = !groupingActive && !tableUiLocked && rowMoveDuplicateOpsAllowed({
        isEditable: options.isEditable,
        tableDataLength: len,
        numCols: nCols,
        bodyMode,
        isEditingCell
    });
    if (rowMoveOk) {
        items.push(
            menuItem({
                id: 'move_row_up',
                icon: 'arrow_3.svg',
                label: 'Переместить строку вверх',
                kbd: `${alt}↑`,
                disabled: anchorSourceRow <= 0
            }),
            menuItem({
                id: 'move_row_down',
                icon: 'arrow_3.svg',
                iconClass: 'widget-table-ctx__arrow-down',
                label: 'Переместить строку вниз',
                kbd: `${alt}↓`,
                disabled: anchorSourceRow < 0 || anchorSourceRow >= len - 1
            }),
            menuItem({
                id: 'duplicate_row_above',
                icon: 'plus.svg',
                label: 'Дублировать строку выше',
                kbd: `${isApple ? '⇧+⌥+' : 'Shift+Alt+'}↑`
            }),
            menuItem({
                id: 'duplicate_row_below',
                icon: 'plus.svg',
                label: 'Дублировать строку ниже',
                kbd: `${isApple ? '⇧+⌥+' : 'Shift+Alt+'}↓`
            })
        );
    }
    const clipboardEnabled = !groupingActive && !tableUiLocked;
    items.push(
        menuItem({
            id: 'copy',
            icon: 'content_copy.svg',
            label: 'Копировать',
            kbd: `${mod}C`,
            disabled: nCols === 0 || len === 0 || !clipboardEnabled,
            separatorBefore: items.length > 0
        }),
        menuItem({
            id: 'cut',
            icon: 'content_cut.svg',
            label: 'Вырезать',
            kbd: `${mod}X`,
            disabled: nCols === 0 || len === 0 || !clipboardEnabled
        }),
        menuItem({
            id: 'paste',
            icon: 'content_paste_.svg',
            label: 'Вставить',
            kbd: `${mod}V`,
            disabled: nCols === 0 || len === 0 || !clipboardEnabled
        }),
        menuItem({
            id: 'clear',
            icon: 'delete.svg',
            label: 'Очистить',
            kbd: 'Del',
            disabled: nCols === 0 || len === 0 || !clipboardEnabled
        })
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
    computePasteAnchorRect(rect: TableSelectionRect) {
        if (WidgetUiCoords && WidgetUiCoords.computePasteAnchorRect) {
            const anchor = WidgetUiCoords.computePasteAnchorRect(rect, this.selFocus);
            return {
                r: anchor.r,
                c: this.selectionIsFullRowBlock()
                    ? firstUserPasteColumn(this, anchor.c)
                    : anchor.c
            };
        }
        const { r0, r1, c0, c1 } = rect;
        if (r0 === r1 && c0 === c1) {
            return {
                r: this.selFocus.r,
                c: this.selectionIsFullRowBlock()
                    ? firstUserPasteColumn(this, this.selFocus.c)
                    : this.selFocus.c
            };
        }
        return {
            r: r0,
            c: this.selectionIsFullRowBlock()
                ? firstUserPasteColumn(this, c0)
                : c0
        };
    },
    cloneRect(rect: TableSelectionRect) {
        return WidgetUiCoords && WidgetUiCoords.cloneRect
            ? WidgetUiCoords.cloneRect(rect)
            : { r0: rect.r0, r1: rect.r1, c0: rect.c0, c1: rect.c1 };
    },
    buildSelectionSnapshotFromDisplay() {
        return buildCoreSelectionFromDisplay(
            runtimeDisplaySelection(this),
            this.tableColumns,
            this.tableViewModelSnapshot()
        );
    },
    buildBaseContextMenuSnapshot(overrides: RuntimeContextMenuSnapshotOverrides) {
        const rect = this.cloneRect(this.getSelRect());
        const pasteAnchor = this.computePasteAnchorRect(this.getSelRect());
        return buildContextMenuSnapshot({
            columns: this.tableColumns,
            groupingLevels: this.groupingState.levels || [],
            lineNumbersEnabled: this.lineNumbersRuntimeEnabled,
            pasteAnchor: { r: pasteAnchor.r, c: pasteAnchor.c },
            rect,
            selectionSnapshot: this.buildSelectionSnapshotFromDisplay(),
            sessionId: this.contextMenuSessionId,
            sortKeys: this.sortKeys || [],
            stickyHeaderEnabled: this.stickyHeaderEnabled,
            viewModel: this.tableViewModelSnapshot(),
            wordWrapEnabled: this.wordWrapEnabled,
            ...(overrides || {})
        });
    },
    buildContextMenuSnapshot(
        kind: 'body' | 'header',
        anchorRow: number,
        anchorCol: number,
        headerCol: number | null
    ) {
        const bodyMode =
            kind === 'header' ? null : this.computeBodyModeForMenu();
        return this.buildBaseContextMenuSnapshot({
            anchorCol,
            anchorRow,
            bodyMode,
            headerCol: headerCol != null ? headerCol : null
        });
    },
    buildClipboardActionSnapshot() {
        return this.buildBaseContextMenuSnapshot({
            anchorCol: this.selFocus.c,
            anchorRow: this.selFocus.r,
            bodyMode: this.computeBodyModeForMenu(),
            headerCol: null
        });
    },
    clampMenuPosition(event: MouseEvent) {
        return WidgetUiCoords.clampMenuPosition(event);
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
        const clickHandler = (event: Event) => {
            const element = this.$refs.contextMenuEl;
            if (element && event.target instanceof Node && element.contains(event.target)) return;
            this.hideContextMenu();
        };
        const keydownHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                this.hideContextMenu();
            }
        };
        this._contextMenuClickHandler = clickHandler;
        this._contextMenuKeydownHandler = keydownHandler;
        document.addEventListener('mousedown', clickHandler, true);
        document.addEventListener('keydown', keydownHandler, true);
    },
    onTbodyMouseDownCapture(event: MouseEvent) {
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
    onBodyContextMenu(event: MouseEvent, row: number, col: number) {
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
            if (this.isLineNumberColumn(this.tableColumns[normalizedCol])) {
                this.selectFullRow(normalizedRow);
            } else {
                this.setSelectionSingle(normalizedRow, normalizedCol);
            }
        }
        this.selectedRowIndex = normalizedRow;
        this.exitCellEdit();
        this.contextMenuSessionId += 1;
        this.showContextMenuSnapshot(
            event,
            { kind: 'body', row: normalizedRow, col: normalizedCol },
            this.buildContextMenuSnapshot('body', normalizedRow, normalizedCol, null)
        );
    },
    onTableHeaderContextMenu(
        event: MouseEvent,
        rowIndex: number,
        cell: TableHeaderCell | null,
        colIndex: number | null | undefined
    ) {
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
        this.openContextMenuFromEvent(
            event,
            { kind: 'header', col: colIndex },
            this.buildContextMenuSnapshot('header', -1, -1, colIndex)
        );
    },
    onColumnNumberHeaderContextMenu(event: MouseEvent, colIndex: number) {
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
    onGroupHeaderContextMenu(event: MouseEvent) {
        if (this.tableColumns.length === 0) return;
        this.openContextMenuFromEvent(
            event,
            { kind: 'header', col: -1 },
            this.buildContextMenuSnapshot('header', -1, -1, null)
        );
    },
    openContextMenuFromEvent(
        event: MouseEvent,
        target: TableContextMenuTarget,
        snapshot: TableContextMenuSnapshot
    ) {
        event.preventDefault();
        this._openContextMenuPrepare();
        this.exitCellEdit();
        this.contextMenuSessionId += 1;
        this.showContextMenuSnapshot(event, target, snapshot);
    },
    showContextMenuSnapshot(
        event: MouseEvent,
        target: TableContextMenuTarget,
        snapshot: TableContextMenuSnapshot
    ) {
        this.contextMenuTarget = target;
        this.contextMenuPosition = this.clampMenuPosition(event);
        this.dispatchTableCoreCommand(
            { snapshot, type: 'OPEN_CONTEXT_MENU' },
            'open context menu',
            TABLE_RUNTIME_SYNC.CONTEXT_MENU_ONLY
        );
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
        this.dispatchTableCoreCommand(
            { type: 'CLOSE_CONTEXT_MENU' },
            'close context menu',
            TABLE_RUNTIME_SYNC.CONTEXT_MENU_ONLY
        );
        this.$nextTick(() => {
            if (this.tableColumns.length > 0 && this.tableData.length > 0) {
                this.focusSelectionCell(this.selFocus.r, this.selFocus.c);
            }
        });
    },
    onContextMenuItemActivate(item: TableContextMenuItem | null | undefined) {
        if (!item || item.disabled) return;
        const snapshot = this.contextMenuContext;
        if (!snapshot) return;
        this.runContextMenuAction(item.id, snapshot);
    },
    runContextMenuAction(id: string, snapshot: TableContextMenuSnapshot) {
        if (
            !this.isEditable &&
            id !== 'copy' &&
            !SORT_MENU_IDS.has(id) &&
            !GROUP_MENU_IDS.has(id) &&
            !STICKY_MENU_IDS.has(id) &&
            !LINE_NUMBER_MENU_IDS.has(id) &&
            !WRAP_MENU_IDS.has(id)
        ) {
            return;
        }
        if (this.tableUiLocked) return;
        if (!snapshot) return;
        if (!isContextMenuSnapshotCurrent(snapshot, this.contextMenuSessionId)) {
            this.hideContextMenu();
            return;
        }
        if (id === 'sort_asc' || id === 'sort_desc') {
            this.applySortFromMenu(snapshot, id === 'sort_desc' ? 'desc' : 'asc');
            return;
        }

        const handlerName = CONTEXT_MENU_ACTION_HANDLERS[
            id as keyof typeof CONTEXT_MENU_ACTION_HANDLERS
        ];
        if (!handlerName) {
            return;
        }

        const handler = this[handlerName] as ((value: TableContextMenuSnapshot) => void) | undefined;
        handler?.call(this, snapshot);
    },
    toggleStickyHeaderFromSnapshot(snapshot: TableContextMenuSnapshot) {
        this.hideContextMenu();
        this.stickyHeaderRuntimeEnabled = !snapshot.stickyHeaderEnabled;
    },
    toggleWordWrapFromSnapshot(snapshot: TableContextMenuSnapshot) {
        this.hideContextMenu();
        this.wordWrapRuntimeEnabled = !snapshot.wordWrapEnabled;
        if (this.wordWrapEnabled) {
            this.$nextTick(() => this.clearAllCellOverflowHints());
        }
    },
    applySortFromMenu(snapshot: TableContextMenuSnapshot, direction: 'asc' | 'desc') {
        if (this.tableUiLocked) return;
        const colKey = snapshot.headerColumnKey;
        if (!colKey) return;
        this.hideContextMenu();
        this.applySortKeysFromCore(
            [{ colKey, dir: direction === 'asc' ? 'asc' : 'desc' }],
            'sort'
        );
    },
    applySortResetFromMenu(snapshot: TableContextMenuSnapshot) {
        if (this.tableUiLocked) return;
        const colKey = snapshot.headerColumnKey;
        this.hideContextMenu();
        const sortKeyColumns = Array.isArray(snapshot.sortKeyColumnsSnapshot)
            ? snapshot.sortKeyColumnsSnapshot
            : [];
        if (!colKey) {
            if (!sortKeyColumns.length) return;
            this.applySortKeysFromCore([], 'sort reset');
            return;
        }
        const next = sortKeyColumns.filter((item: TableCoreSortState) => item.colKey !== colKey);
        if (next.length === sortKeyColumns.length) return;
        this.applySortKeysFromCore(next, 'sort reset');
    },
    onGroupAddLevelFromSnapshot(snapshot: TableContextMenuSnapshot) {
        const colKey = snapshot.headerColumnKey;
        this.hideContextMenu();
        if (!colKey) return;
        const col = columnIndexByKey(this.tableColumns, colKey);
        if (col < 0 || this.isLineNumberColumn(this.tableColumns[col])) return;
        const snapshotLevels = Array.isArray(snapshot.groupingLevelKeysSnapshot)
            ? snapshot.groupingLevelKeysSnapshot.slice()
            : [];
        if (snapshotLevels.indexOf(colKey) >= 0) return;
        const prevLevels = this.groupingState.levels.slice();
        const prevExpanded = new Set(this.groupingState.expanded);
        const prevPending = this._lazyPendingRows.slice();
        const prevFull = this.isFullyLoaded;
        this.tableUiLocked = true;
        try {
            if (!this.flushLazyFullLoadOrWarn(
                'Не удалось полностью загрузить данные для группировки.'
            )) {
                this._lazyPendingRows = prevPending;
                this.isFullyLoaded = prevFull;
                return;
            }
            this.dispatchTableCoreCommand(
                {
                    colKeys: snapshotLevels.concat(colKey),
                    expandedPathKeys: [],
                    type: 'SET_GROUP_LEVELS'
                },
                'group add level',
                TABLE_RUNTIME_SYNC.GROUPING_ONLY
            );
            this.refreshGroupingViewFromData();
            this.onInput();
        } catch (error) {
            this.dispatchTableCoreCommand(
                {
                    colKeys: prevLevels
                        .map((col) => columnKeyAt(this.tableColumns, col))
                        .filter((colKey): colKey is string => colKey != null),
                    expandedPathKeys: [...prevExpanded],
                    type: 'SET_GROUP_LEVELS'
                },
                'group add level rollback',
                TABLE_RUNTIME_SYNC.GROUPING_ONLY
            );
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
    onGroupClearFromSnapshot(snapshot: TableContextMenuSnapshot) {
        this.hideContextMenu();
        const snapshotLevels = Array.isArray(snapshot.groupingLevelKeysSnapshot)
            ? snapshot.groupingLevelKeysSnapshot
            : [];
        if (!snapshotLevels.length) return;
        this.dispatchTableCoreCommand(
            { colKeys: [], expandedPathKeys: [], type: 'SET_GROUP_LEVELS' },
            'clear grouping',
            TABLE_RUNTIME_SYNC.GROUPING_ONLY
        );
        this.onInput();
        this.$nextTick(() => this._scheduleStickyTheadUpdate());
    }
} satisfies TableRuntimeMethodSubset;
export {
    altLabel,
    buildMenuItems,
    MenuRuntimeMethods,
    modLabel,
    normalizeMenuSeparators,
    rowMoveDuplicateOpsAllowed
};

function firstUserPasteColumn(vm: UserColumnRuntime, preferredCol: number): number {
    return firstUserColumnIndex(vm, preferredCol, { requireMutable: true });
}
export default MenuRuntimeMethods;
