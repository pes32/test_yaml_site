/**
 * Контекстное меню таблицы: пункты (icon, label, kbd, visible, disabled, separatorBefore).
 */
import tableEngine from './table_core.js';

const Core = tableEngine;

    function isApplePlatform() {
        return (
            typeof navigator !== 'undefined' &&
            /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '')
        );
    }

    /** Подпись модификатора для меню: ⌘ или Ctrl (буфер обмена и т.п.). */
    function modLabel(isApple) {
        return isApple ? '⌘' : 'Ctrl';
    }

    /** Строки таблицы: в Excel на macOS — ⇧+Ctrl++ и Ctrl+−, без ⌘. Подписи меню совпадают с этим. */
    function rowShortcutsKbd() {
        return { below: '⇧+Ctrl++', deleteRow: 'Ctrl−' };
    }

    function altLabel(isApple) {
        return isApple ? '⌥' : 'Alt';
    }

    /**
     * Единый предикат: клавиатура и меню (move/duplicate). v1: при правке ячейки пункты скрыты — намеренно.
     * @param {{ isEditable: boolean, tableDataLength: number, numCols: number, bodyMode: string|null, isEditingCell: boolean }} p
     */
    function rowMoveDuplicateOpsAllowed(p) {
        const len = p.tableDataLength | 0;
        const nCols = p.numCols | 0;
        const bm = p.bodyMode;
        const modeOk = bm === 'row' || bm === 'cell' || bm === 'cells';
        return !!(
            p.isEditable &&
            len > 0 &&
            nCols > 0 &&
            modeOk &&
            !p.isEditingCell
        );
    }

    /**
     * После фильтра visible: нет разделителя перед первым; нет двух подряд.
     * @param {Array<{ visible?: boolean, separatorBefore?: boolean, [k: string]: * }>} items
     */
    function normalizeMenuSeparators(items) {
        const list = items
            .filter((i) => i.visible !== false)
            .map((i) => Object.assign({}, i));
        let prevSep = false;
        for (let i = 0; i < list.length; i++) {
            if (i === 0) {
                list[i].separatorBefore = false;
                prevSep = false;
                continue;
            }
            let s = !!list[i].separatorBefore;
            if (s && prevSep) s = false;
            list[i].separatorBefore = s;
            prevSep = s;
        }
        return list;
    }

    /**
     * @param {object} p
     * @param {{ kind: 'body'|'header' }} p.target
     * @param {object} p.snapshot
     * @param {boolean} p.isApple
     * @param {number} p.tableDataLength
     * @param {number} p.numCols
     * @param {boolean} p.headerSortEnabled
     * @param {boolean} p.isEditingCell — v1: при true move/duplicate скрыты (согласовано с клавиатурой)
     * @param {boolean} [p.groupingActive]
     * @param {boolean} [p.tableUiLocked]
     * @param {boolean} [p.isFullyLoaded]
     * @param {number} [p.groupingLevelsLen]
     * @param {boolean} [p.groupingCanAddLevel] — предрасчёт из table grouping runtime
     * @param {boolean} [p.stickyHeaderEnabled]
     * @param {boolean} [p.wordWrapEnabled]
     * @param {object|null} [p.headerColumn]
     */
    function buildMenuItems(p) {
        const target = p.target || {};
        const snap = p.snapshot || {};
        const isApple = !!p.isApple;
        const m = modLabel(isApple);
        const len = p.tableDataLength | 0;
        const nCols = p.numCols | 0;
        const mod = m + '+';
        const rowKbd = rowShortcutsKbd();
        const alt = altLabel(isApple);
        const isEditingCell = !!p.isEditingCell;
        const groupingActive = !!p.groupingActive;
        const tableUiLocked = !!p.tableUiLocked;
        const isFullyLoaded = p.isFullyLoaded !== false;
        const gLevelsLen = p.groupingLevelsLen | 0;
        const stickyHeaderEnabled = !!p.stickyHeaderEnabled;
        const wordWrapEnabled = !!p.wordWrapEnabled;
        const G = Core.Grouping;
        const canAddComputed =
            G && typeof G.canAddGroupingLevel === 'function'
                ? G.canAddGroupingLevel(nCols, gLevelsLen)
                : false;
        const canAddLevel = p.groupingCanAddLevel !== undefined ? !!p.groupingCanAddLevel : canAddComputed;
        const headerColumn = p.headerColumn || null;
        const isLineNumberHeader = !!(
            headerColumn &&
            (headerColumn.isLineNumber === true ||
                headerColumn.type === 'line_number')
        );

        if (target.kind === 'header' && nCols > 0) {
            const col = snap.headerCol;
            const items = [];
            const hasSortBlock = !!(p.headerSortEnabled && col != null && col >= 0);
            const canToggleSticky = col != null && col >= 0;
            let placedSepBeforeGroupingBlock = false;
            function separatorBeforeGroupingBlock() {
                if (placedSepBeforeGroupingBlock) return false;
                placedSepBeforeGroupingBlock = true;
                return items.length > 0;
            }
            if (hasSortBlock) {
                const skList = Array.isArray(snap.sortKeys) ? snap.sortKeys : [];
                const activeHere = skList.some((x) => x && x.col === col);
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
                    label: wordWrapEnabled
                        ? 'Отключить перенос по словам'
                        : 'Перенос по словам',
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
            if (col != null && col >= 0 && canAddLevel && !isLineNumberHeader) {
                const dup = snap.groupingLevelsSnapshot && snap.groupingLevelsSnapshot.indexOf(col) >= 0;
                items.push({
                    id: 'group_add_level',
                    icon: 'grouping.svg',
                    label: 'Группировка',
                    kbd: '',
                    visible: true,
                    disabled: tableUiLocked || dup,
                    separatorBefore: separatorBeforeGroupingBlock()
                });
            }
            if (groupingActive) {
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
            if (items.length > 0) return normalizeMenuSeparators(items);
        }

        const bodyMode = snap.bodyMode;
        const rowMode = bodyMode === 'row';
        const cellLike = bodyMode === 'cell' || bodyMode === 'cells';
        const canAddRows =
            (rowMode || cellLike) && nCols > 0 && !groupingActive && !tableUiLocked;
        const canDeleteRow = rowMode && nCols > 0 && !groupingActive && !tableUiLocked;

        const items = [];

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

        /* v1 ordering contract: add above/below → delete → move up/down → duplicate above/below → clipboard */
        const anchorRow = snap.anchorRow | 0;
        const rowMoveOk =
            !groupingActive &&
            !tableUiLocked &&
            rowMoveDuplicateOpsAllowed({
                isEditable: !!p.isEditable,
                tableDataLength: len,
                numCols: nCols,
                bodyMode: bodyMode,
                isEditingCell: isEditingCell
            });
        if (rowMoveOk) {
            items.push(
                {
                    id: 'move_row_up',
                    icon: 'arrow_3.svg',
                    label: 'Переместить строку вверх',
                    kbd: alt + '↑',
                    visible: true,
                    disabled: anchorRow <= 0,
                    separatorBefore: false
                },
                {
                    id: 'move_row_down',
                    icon: 'arrow_3.svg',
                    iconClass: 'widget-table-ctx__arrow-down',
                    label: 'Переместить строку вниз',
                    kbd: alt + '↓',
                    visible: true,
                    disabled: anchorRow < 0 || anchorRow >= len - 1,
                    separatorBefore: false
                },
                {
                    id: 'duplicate_row_above',
                    icon: 'plus.svg',
                    label: 'Дублировать строку выше',
                    kbd: (isApple ? '⇧+⌥+' : 'Shift+Alt+') + '↑',
                    visible: true,
                    disabled: false,
                    separatorBefore: false
                },
                {
                    id: 'duplicate_row_below',
                    icon: 'plus.svg',
                    label: 'Дублировать строку ниже',
                    kbd: (isApple ? '⇧+⌥+' : 'Shift+Alt+') + '↓',
                    visible: true,
                    disabled: false,
                    separatorBefore: false
                }
            );
        }

        const clipOk = !groupingActive && !tableUiLocked;
        items.push(
            {
                id: 'copy',
                icon: 'content_copy.svg',
                label: 'Копировать',
                kbd: mod + 'C',
                visible: true,
                disabled: nCols === 0 || len === 0 || !clipOk,
                separatorBefore: items.length > 0
            },
            {
                id: 'cut',
                icon: 'content_cut.svg',
                label: 'Вырезать',
                kbd: mod + 'X',
                visible: true,
                disabled: nCols === 0 || len === 0 || !clipOk,
                separatorBefore: false
            },
            {
                id: 'paste',
                icon: 'content_paste_.svg',
                label: 'Вставить',
                kbd: mod + 'V',
                visible: true,
                disabled: nCols === 0 || len === 0 || !clipOk,
                separatorBefore: false
            },
            {
                id: 'clear',
                icon: 'delete.svg',
                label: 'Очистить',
                kbd: 'Del',
                visible: true,
                disabled: nCols === 0 || len === 0 || !clipOk,
                separatorBefore: false
            }
        );

        return normalizeMenuSeparators(items);
    }

    Core.ContextMenu = {
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

export default Core.ContextMenu;
