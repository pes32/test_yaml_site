import type { TableToolbarState } from './table_contract.ts';
import { isApplePlatform } from './table_platform.ts';

type TableToolbarButton = {
    icon: string;
    id: string;
    label: string;
    shortcut?: string;
};

type TableToolbarButtonState = TableToolbarButton & {
    active?: boolean;
    disabled?: boolean;
    expanded?: 'true' | 'false';
};

type TableToolbarTypeOption = {
    label: string;
    value: string;
};

const TABLE_TOOLBAR_DEFAULT_FONT_SIZE = 16;
const TABLE_TOOLBAR_DEFAULT_FILL_COLOR = '#fff2cc';
const TABLE_TOOLBAR_DEFAULT_TEXT_COLOR = '#c00000';
const TABLE_TOOLBAR_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

const TABLE_TOOLBAR_STANDARD_COLORS = [
    'rgb(255,255,255)',
    'rgb(0,0,0)',
    'rgb(230,230,230)',
    'rgb(71,84,105)',
    'rgb(77,114,194)',
    'rgb(226,131,58)',
    'rgb(165,165,165)',
    'rgb(247,194,37)',
    'rgb(103,164,211)',
    'rgb(122,171,74)'
];

const TABLE_TOOLBAR_COLOR_COLUMNS = [
    ['rgb(242,242,242)', 'rgb(216,216,216)', 'rgb(191,191,191)', 'rgb(165,165,165)', 'rgb(127,127,127)'],
    ['rgb(127,127,127)', 'rgb(89,89,89)', 'rgb(63,63,63)', 'rgb(38,38,38)', 'rgb(12,12,12)'],
    ['rgb(208,208,208)', 'rgb(171,171,171)', 'rgb(112,112,112)', 'rgb(56,56,56)', 'rgb(22,22,22)'],
    ['rgb(215,220,228)', 'rgb(175,185,201)', 'rgb(135,150,175)', 'rgb(52,63,79)', 'rgb(35,42,53)'],
    ['rgb(218,226,242)', 'rgb(183,198,230)', 'rgb(146,170,218)', 'rgb(54,84,149)', 'rgb(36,56,99)'],
    ['rgb(248,230,214)', 'rgb(242,205,174)', 'rgb(236,180,134)', 'rgb(187,97,30)', 'rgb(124,64,19)'],
    ['rgb(237,237,237)', 'rgb(219,219,219)', 'rgb(201,201,201)', 'rgb(123,123,123)', 'rgb(82,82,82)'],
    ['rgb(253,242,205)', 'rgb(251,230,156)', 'rgb(250,218,107)', 'rgb(185,146,25)', 'rgb(123,97,13)'],
    ['rgb(224,235,246)', 'rgb(193,214,237)', 'rgb(162,194,228)', 'rgb(62,116,179)', 'rgb(41,77,120)'],
    ['rgb(228,238,217)', 'rgb(201,223,180)', 'rgb(174,206,143)', 'rgb(91,127,56)', 'rgb(60,85,37)']
];

const TABLE_TOOLBAR_TYPE_OPTIONS: TableToolbarTypeOption[] = [
    { label: 'Общий', value: 'general' },
    { label: 'Текст', value: 'text' },
    { label: 'Целое', value: 'int' },
    { label: 'Дробное', value: 'float' },
    { label: 'Эксп.', value: 'exponent' },
    { label: 'Дата', value: 'date' },
    { label: 'Время', value: 'time' },
    { label: 'Дата-время', value: 'datetime' },
    { label: 'IP', value: 'ip' },
    { label: 'IP/mask', value: 'ip_mask' }
];

function createDefaultTableToolbarState(): TableToolbarState {
    return {
        activeButtons: [],
        canApplyNumericFormat: false,
        fontSize: TABLE_TOOLBAR_DEFAULT_FONT_SIZE,
        precision: null,
        thousands: false,
        type: 'general',
        typeLocked: false
    };
}

function tableToolbarIconSrc(icons: Record<string, string> | null | undefined, name: string): string {
    const mapped = icons?.[name];
    return mapped || `/templates/icons/table_icons/${name}`;
}

function tableToolbarShortcutLabel(shortcut: string | undefined): string {
    if (!shortcut) return '';
    const isApple = isApplePlatform();
    return shortcut
        .split('+')
        .map((part) => {
            const key = part.trim().toLowerCase();
            if (key === 'mod') return isApple ? '⌘' : 'Ctrl';
            if (key === 'shift') return isApple ? '⇧' : 'Shift';
            return part.trim().toUpperCase();
        })
        .join('+');
}

function tableToolbarButtonTooltip(button: TableToolbarButton): string {
    const shortcut = tableToolbarShortcutLabel(button.shortcut);
    return shortcut ? `${button.label} (${shortcut})` : button.label;
}

export {
    TABLE_TOOLBAR_COLOR_COLUMNS,
    TABLE_TOOLBAR_DEFAULT_FILL_COLOR,
    TABLE_TOOLBAR_DEFAULT_FONT_SIZE,
    TABLE_TOOLBAR_DEFAULT_TEXT_COLOR,
    TABLE_TOOLBAR_FONT_SIZES,
    TABLE_TOOLBAR_STANDARD_COLORS,
    TABLE_TOOLBAR_TYPE_OPTIONS,
    createDefaultTableToolbarState,
    tableToolbarButtonTooltip,
    tableToolbarIconSrc
};
export type {
    TableToolbarButton,
    TableToolbarButtonState,
    TableToolbarTypeOption
};
