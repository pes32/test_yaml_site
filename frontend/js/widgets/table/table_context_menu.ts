import type {
    TableContextMenuSnapshot,
    TableContextMenuTarget,
    TableRuntimeColumn,
    TableSortState
} from './table_contract.ts';
import { canAddGroupingLevel } from './table_grouping.ts';

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

const TableContextMenu = {
    isApplePlatform,
    modLabel,
    altLabel,
    rowMoveDuplicateOpsAllowed,
    normalizeMenuSeparators,
    buildMenuItems
};

export {
    altLabel,
    buildMenuItems,
    isApplePlatform,
    modLabel,
    normalizeMenuSeparators,
    rowMoveDuplicateOpsAllowed
};

export type {
    BuildMenuItemsOptions,
    RowMoveDuplicateOpsOptions,
    TableContextMenuItem
};

export default TableContextMenu;
