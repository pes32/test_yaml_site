<template>
  <div class="widget-table-toolbar" role="toolbar" aria-label="Панель таблицы">
    <div
      v-for="column in toolbarColumns"
      :key="column.key"
      class="widget-table-toolbar__column"
      :class="column.columnClass"
    >
      <template v-if="column.mode === 'colors'">
        <div
          v-for="button in colorButtons"
          :key="button.id"
          class="widget-table-toolbar__row widget-table-toolbar__color-picker"
        >
          <div class="widget-table-toolbar__color-split">
            <button
              type="button"
              class="widget-table-toolbar__button widget-table-toolbar__color-main"
              :disabled="disabled"
              :style="{ '--widget-table-toolbar-current-color': currentColorForAction(button.id) }"
              :title="buttonTooltip(button)"
              :aria-label="buttonTooltip(button)"
              @click="applyCurrentColor(button.id)"
            >
              <img :src="iconSrc(button.icon)" alt="" aria-hidden="true">
              <span class="widget-table-toolbar__color-strip" aria-hidden="true"></span>
            </button>
            <button
              type="button"
              class="widget-table-toolbar__button widget-table-toolbar__color-arrow"
              :class="{ 'widget-table-toolbar__button--active': activeColorMenu === button.id }"
              :disabled="disabled"
              :title="button.label + ': выбрать цвет'"
              :aria-label="button.label + ': выбрать цвет'"
              aria-haspopup="menu"
              :aria-expanded="activeColorMenu === button.id ? 'true' : 'false'"
              @click="toggleColorMenu(button.id)"
            >
              <dropdown-chevron-icon class="widget-table-toolbar__chevron"></dropdown-chevron-icon>
            </button>
          </div>
          <div
            v-if="activeColorMenu === button.id"
            class="widget-table-toolbar__popover widget-table-toolbar__palette"
            role="menu"
          >
            <button
              type="button"
              class="widget-table-toolbar__palette-reset"
              @click="emitColorResetAction(button.id)"
              v-text="'Сбросить'"
            ></button>
            <div class="widget-table-toolbar__standard-colors" role="group" aria-label="Стандартные цвета">
              <button
                v-for="color in standardColors"
                :key="button.id + '-standard-' + color"
                type="button"
                class="widget-table-toolbar__swatch"
                :style="{ backgroundColor: color }"
                :aria-label="button.label + ': ' + color"
                @click="emitColorAction(button.id, color)"
              ></button>
            </div>
            <div class="widget-table-toolbar__palette-columns" role="group" aria-label="Цвета">
              <div
                v-for="(paletteColumn, columnIndex) in colorColumns"
                :key="button.id + '-column-' + columnIndex"
                class="widget-table-toolbar__palette-column"
              >
                <button
                  v-for="color in paletteColumn"
                  :key="button.id + '-' + color"
                  type="button"
                  class="widget-table-toolbar__swatch"
                  :style="{ backgroundColor: color }"
                  :aria-label="button.label + ': ' + color"
                  @click="emitColorAction(button.id, color)"
                ></button>
              </div>
            </div>
            <label
              class="widget-table-toolbar__custom-color"
              :title="button.label + ': дополнительные цвета'"
              :aria-label="button.label + ': дополнительные цвета'"
            >
              <img :src="iconSrc('palette.svg')" alt="" aria-hidden="true">
              <span>Дополнительные цвета...</span>
              <input
                type="color"
                class="widget-table-toolbar__custom-color-input"
                :value="colorInputValue(button.id)"
                @change="emitCustomColorAction(button.id, $event)"
              >
            </label>
          </div>
        </div>
      </template>
      <template v-else-if="column.mode === 'tools'">
        <div
          v-for="(row, rowIndex) in toolButtonRows"
          :key="'tools-row-' + rowIndex"
          class="widget-table-toolbar__row"
        >
          <div
            v-for="button in row"
            :key="button.id"
            class="widget-table-toolbar__tool-button-wrap"
            :class="{ 'widget-table-toolbar__group--filter': button.id === 'filter' }"
          >
            <button
              type="button"
              class="widget-table-toolbar__button"
              :class="{ 'widget-table-toolbar__button--active': button.id === 'filter' ? filterOpen : Boolean(button.active) }"
              :disabled="disabled || Boolean(button.disabled)"
              :title="buttonTooltip(button)"
              :aria-label="button.label"
              :aria-expanded="button.id === 'filter' ? (filterOpen ? 'true' : 'false') : undefined"
              @click="onToolButtonPress(button.id)"
            >
              <img :src="iconSrc(button.icon)" alt="" aria-hidden="true">
            </button>
            <div v-if="button.id === 'filter' && filterOpen" class="widget-table-toolbar__popover" role="status">
              Фильтры будут добавлены позже
            </div>
          </div>
        </div>
      </template>
      <div
        v-else
        v-for="row in column.rows"
        :key="row.key"
        class="widget-table-toolbar__row"
        :class="row.rowClass"
      >
        <select
          v-if="row.select === 'font-size'"
          class="widget-table-toolbar__select widget-table-toolbar__select--font-size"
          :disabled="disabled"
          :value="toolbarFontSize"
          aria-label="Размер шрифта"
          @change="emitSelectAction('font-size', $event)"
        >
          <option v-for="size in fontSizeOptions" :key="size" :value="size" v-text="size"></option>
        </select>
        <select
          v-else-if="row.select === 'type'"
          class="widget-table-toolbar__select widget-table-toolbar__select--type"
          :disabled="disabled"
          :value="toolbarType"
          aria-label="Тип данных"
          @change="emitSelectAction('type', $event)"
        >
          <option v-for="option in typeOptions" :key="option.value" :value="option.value" v-text="option.label"></option>
        </select>
        <table-toolbar-icon-button
          v-for="button in row.buttons"
          :key="button.id"
          :button="button"
          :active="Boolean(button.active)"
          :disabled="rowButtonDisabled(row, button)"
          :icon-src="iconSrc(button.icon)"
          :tooltip="buttonTooltip(button)"
          @press="emitAction"
        ></table-toolbar-icon-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TableToolbarState } from './table_contract.ts';
import DropdownChevronIcon from '../common/DropdownChevronIcon.vue';
import TableToolbarIconButton from './TableToolbarIconButton.vue';
import {
  TABLE_TOOLBAR_COLOR_COLUMNS,
  TABLE_TOOLBAR_DEFAULT_FILL_COLOR,
  TABLE_TOOLBAR_DEFAULT_FONT_SIZE,
  TABLE_TOOLBAR_DEFAULT_TEXT_COLOR,
  TABLE_TOOLBAR_FONT_SIZES,
  TABLE_TOOLBAR_STANDARD_COLORS,
  TABLE_TOOLBAR_TYPE_OPTIONS,
  createDefaultTableToolbarState,
  tableToolbarButtonTooltip,
  tableToolbarIconSrc,
  type TableToolbarButton,
  type TableToolbarButtonState,
  type TableToolbarTypeOption
} from './table_toolbar_model.ts';

type ToolbarColumnMode = 'buttons' | 'colors' | 'tools';
type ToolbarButtonRowModel = {
  buttons: readonly TableToolbarButtonState[];
  key: string;
  lockButtons?: boolean;
  rowClass?: string;
  select?: 'font-size' | 'type';
};
type ToolbarColumnModel = {
  columnClass?: string;
  key: string;
  mode: ToolbarColumnMode;
  rows: ToolbarButtonRowModel[];
};

const props = withDefaults(
  defineProps<{
    canRedo?: boolean;
    canUndo?: boolean;
    disabled?: boolean;
    fontSizes?: number[];
    icons?: Record<string, string>;
    toolbarState?: TableToolbarState;
    typeOptions?: TableToolbarTypeOption[];
  }>(),
  {
    canRedo: false,
    canUndo: false,
    disabled: false,
    fontSizes: () => TABLE_TOOLBAR_FONT_SIZES.slice(),
    icons: () => ({}),
    toolbarState: createDefaultTableToolbarState,
    typeOptions: () => TABLE_TOOLBAR_TYPE_OPTIONS.slice()
  }
);

const emit = defineEmits<{
  action: [id: string, value?: unknown];
}>();

const filterOpen = ref(false);
const activeColorMenu = ref('');
const currentFillColor = ref(TABLE_TOOLBAR_DEFAULT_FILL_COLOR);
const currentTextColor = ref(TABLE_TOOLBAR_DEFAULT_TEXT_COLOR);

const historyButtons: TableToolbarButton[] = [
  { id: 'undo', icon: 'undo.svg', label: 'Отменить', shortcut: 'mod+Z' },
  { id: 'redo', icon: 'redo.svg', label: 'Повторить', shortcut: 'mod+Y' }
];

const textStyleButtons: TableToolbarButton[] = [
  { id: 'bold', icon: 'format_bold.svg', label: 'Жирный', shortcut: 'mod+B' },
  { id: 'italic', icon: 'format_italic.svg', label: 'Курсив', shortcut: 'mod+I' },
  { id: 'underline', icon: 'format_underlined.svg', label: 'Подчеркнутый', shortcut: 'mod+U' },
  { id: 'strike', icon: 'format_strikethrough.svg', label: 'Зачеркнутый', shortcut: 'mod+shift+X' }
];

const colorButtons: TableToolbarButton[] = [
  { id: 'fill', icon: 'format_color_fill.svg', label: 'Цвет заливки' },
  { id: 'text-color', icon: 'format_color_text.svg', label: 'Цвет текста' }
];

const colorColumns = TABLE_TOOLBAR_COLOR_COLUMNS;
const standardColors = TABLE_TOOLBAR_STANDARD_COLORS;

const fontStepButtons: TableToolbarButtonState[] = [
  { id: 'font-decrease', icon: 'text_decrease.svg', label: 'Уменьшить размер шрифта' },
  { id: 'font-increase', icon: 'text_increase.svg', label: 'Увеличить размер шрифта' }
];

const verticalAlignButtons: TableToolbarButton[] = [
  { id: 'align-top', icon: 'align_flex_start.svg', label: 'Сверху' },
  { id: 'align-middle', icon: 'align_center.svg', label: 'По центру вертикально' },
  { id: 'align-bottom', icon: 'align_flex_end.svg', label: 'Снизу' }
];

const horizontalAlignButtons: TableToolbarButton[] = [
  { id: 'align-left', icon: 'align_horizontal_left.svg', label: 'По левому краю' },
  { id: 'align-center', icon: 'align_horizontal_center.svg', label: 'По центру' },
  { id: 'align-right', icon: 'align_horizontal_right.svg', label: 'По правому краю' }
];

const numberButtons: TableToolbarButton[] = [
  { id: 'thousands', icon: 'comma.svg', label: 'Разделитель тысяч' },
  { id: 'decimal-decrease', icon: 'decimal_decrease.svg', label: 'Убрать знак после запятой' },
  { id: 'decimal-increase', icon: 'decimal_increase.svg', label: 'Добавить знак после запятой' }
];

const widthButtons: TableToolbarButtonState[] = [
  { id: 'auto-width', icon: 'fit_page_width.svg', label: 'Автоподбор ширины' },
  { id: 'reset-width', icon: 'width_normal.svg', label: 'Сбросить ширины' }
];

const toolButtons: TableToolbarButton[] = [
  { id: 'filter', icon: 'filter_alt.svg', label: 'Фильтры' },
  { id: 'toggle-line-numbers', icon: 'numbers.svg', label: 'Включить нумерацию строк' },
  { id: 'toggle-sticky-header', icon: 'header.svg', label: 'Закрепить заголовки таблицы' },
  { id: 'toggle-word-wrap', icon: 'wrap_text.svg', label: 'Включить перенос по словам' }
];
const toolToggleLabels: Record<string, { active: string; inactive: string }> = {
  'toggle-line-numbers': { active: 'Отключить нумерацию строк', inactive: 'Включить нумерацию строк' },
  'toggle-sticky-header': { active: 'Открепить заголовки таблицы', inactive: 'Закрепить заголовки таблицы' },
  'toggle-word-wrap': { active: 'Выключить перенос по словам', inactive: 'Включить перенос по словам' }
};

const activeButtonIds = computed(() => new Set(props.toolbarState.activeButtons || []));
const toolbarFontSize = computed(() => props.toolbarState.fontSize || TABLE_TOOLBAR_DEFAULT_FONT_SIZE);
const toolbarType = computed(() => props.toolbarState.type || 'general');
const fontSizeOptions = computed(() => {
  const sizes = new Set(props.fontSizes.concat([toolbarFontSize.value]));
  return [...sizes].sort((left, right) => left - right);
});

const historyButtonStates = computed<TableToolbarButtonState[]>(() =>
  historyButtons.map((button) => ({
    ...button,
    disabled: button.id === 'undo' ? !props.canUndo : !props.canRedo
  }))
);

const textStyleButtonStates = computed<TableToolbarButtonState[]>(() =>
  withActiveState(textStyleButtons)
);

const verticalAlignButtonStates = computed<TableToolbarButtonState[]>(() =>
  withActiveState(verticalAlignButtons)
);

const horizontalAlignButtonStates = computed<TableToolbarButtonState[]>(() =>
  withActiveState(horizontalAlignButtons)
);

const numberButtonStates = computed<TableToolbarButtonState[]>(() =>
  withActiveState(numberButtons).map((button) => ({
    ...button,
    disabled: !props.toolbarState.canApplyNumericFormat
  }))
);

const toolButtonStates = computed<TableToolbarButtonState[]>(() =>
  withActiveState(toolButtons).map(withStatefulToolLabel)
);

const toolButtonRows = computed(() => [
  toolButtonStates.value.slice(0, 2),
  toolButtonStates.value.slice(2, 4)
]);

const toolbarColumns = computed<ToolbarColumnModel[]>(() => [
  {
    key: 'history',
    mode: 'buttons',
    columnClass: 'widget-table-toolbar__column--history',
    rows: [{ key: 'history', rowClass: 'widget-table-toolbar__row--center', buttons: historyButtonStates.value }]
  },
  {
    key: 'font',
    mode: 'buttons',
    rows: [
      { key: 'font-size', select: 'font-size', lockButtons: props.toolbarState.typeLocked, buttons: fontStepButtons },
      { key: 'text-style', buttons: textStyleButtonStates.value }
    ]
  },
  { key: 'colors', mode: 'colors', columnClass: 'widget-table-toolbar__column--colors', rows: [] },
  {
    key: 'align',
    mode: 'buttons',
    rows: [
      { key: 'vertical-align', buttons: verticalAlignButtonStates.value },
      { key: 'horizontal-align', buttons: horizontalAlignButtonStates.value }
    ]
  },
  {
    key: 'type',
    mode: 'buttons',
    rows: [
      { key: 'type-select', select: 'type', buttons: [] },
      { key: 'number-format', buttons: numberButtonStates.value }
    ]
  },
  {
    key: 'widths',
    mode: 'buttons',
    columnClass: 'widget-table-toolbar__column--widths',
    rows: widthButtons.map((button) => ({ key: button.id, buttons: [button] }))
  },
  { key: 'tools', mode: 'tools', columnClass: 'widget-table-toolbar__column--tools', rows: [] }
]);

function withActiveState(buttons: readonly TableToolbarButton[]): TableToolbarButtonState[] {
  return buttons.map((button) => ({
    ...button,
    active: activeButtonIds.value.has(button.id)
  }));
}

function withStatefulToolLabel(button: TableToolbarButtonState): TableToolbarButtonState {
  const labels = toolToggleLabels[button.id];
  return labels ? { ...button, label: button.active ? labels.active : labels.inactive } : button;
}

function iconSrc(name: string): string {
  return tableToolbarIconSrc(props.icons, name);
}

function buttonTooltip(button: TableToolbarButtonState | TableToolbarButton): string {
  return tableToolbarButtonTooltip(button);
}

function rowButtonDisabled(row: ToolbarButtonRowModel, button: TableToolbarButtonState): boolean {
  return props.disabled || row.lockButtons === true || Boolean(button.disabled);
}

function emitAction(id: string, value?: unknown): void {
  if (props.disabled) return;
  activeColorMenu.value = '';
  emit('action', id, value);
}

function emitSelectAction(id: string, event: Event): void {
  const target = event.target as HTMLSelectElement | null;
  emitAction(id, target ? target.value : '');
}

function toggleFilter(): void {
  if (props.disabled) return;
  activeColorMenu.value = '';
  filterOpen.value = !filterOpen.value;
}

function onToolButtonPress(id: string): void {
  if (id === 'filter') {
    toggleFilter();
    return;
  }
  emitAction(id);
}

function toggleColorMenu(id: string): void {
  if (props.disabled) return;
  filterOpen.value = false;
  activeColorMenu.value = activeColorMenu.value === id ? '' : id;
}

function currentColorForAction(id: string): string {
  return id === 'fill' ? currentFillColor.value : currentTextColor.value;
}

function defaultColorForAction(id: string): string {
  return id === 'fill' ? TABLE_TOOLBAR_DEFAULT_FILL_COLOR : TABLE_TOOLBAR_DEFAULT_TEXT_COLOR;
}

function componentToHex(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}

function colorToInputValue(color: string, fallback: string): string {
  const normalized = String(color || '').trim();
  const fullHex = normalized.match(/^#([0-9a-f]{6})$/i);
  if (fullHex) return `#${fullHex[1].toLowerCase()}`;

  const shortHex = normalized.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) {
    return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toLowerCase();
  }

  const rgb = normalized.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgb) {
    return `#${componentToHex(Number(rgb[1]))}${componentToHex(Number(rgb[2]))}${componentToHex(Number(rgb[3]))}`;
  }

  return fallback;
}

function colorInputValue(id: string): string {
  return colorToInputValue(currentColorForAction(id), defaultColorForAction(id));
}

function setCurrentColorForAction(id: string, color: string): void {
  if (id === 'fill') {
    currentFillColor.value = color || defaultColorForAction(id);
    return;
  }
  currentTextColor.value = color || defaultColorForAction(id);
}

function applyCurrentColor(id: string): void {
  emitColorAction(id, currentColorForAction(id));
}

function emitColorAction(id: string, color: string): void {
  setCurrentColorForAction(id, color);
  emitAction(id, color);
}

function emitColorResetAction(id: string): void {
  emitColorAction(id, defaultColorForAction(id));
}

function emitCustomColorAction(id: string, event: Event): void {
  const target = event.target as HTMLInputElement | null;
  emitColorAction(id, target?.value || '');
}
</script>
