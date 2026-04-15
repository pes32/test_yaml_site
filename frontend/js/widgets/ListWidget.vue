<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ 'md3-dropdown-wrap': true }"
    :has-supporting="!!widgetConfig.sup_text"
    @focusout="onWidgetFocusOut"
    @container-focusout="onWidgetFocusOut"
  >
    <div
      ref="dropdownRoot"
      class="dropdown widget-dropdown list-combobox w-100 min-w-0 max-w-none"
      :class="{ show: isDropdownOpen }"
      :data-dropdown-open="isDropdownOpen ? 'true' : undefined"
      v-bind="tableCellRootAttrs"
    >
      <div ref="dropdownToggle" class="list-combobox-inner">
        <input
          type="text"
          class="list-combobox-input"
          data-table-editor-target="true"
          role="combobox"
          :aria-controls="listMenuId"
          :aria-expanded="isDropdownOpen ? 'true' : 'false'"
          :aria-activedescendant="highlightedId || undefined"
          :value="inputDisplayValue"
          :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
          :readonly="!isEditable || widgetConfig.multiselect"
          :disabled="widgetConfig.readonly"
          :tabindex="widgetConfig.readonly ? -1 : null"
          :title="inputDisplayValue"
          @input="onInputChange"
          @focus="onInputFocus"
          @blur="onInputBlur"
          @keydown="onInputKeydown"
        >
        <span class="list-combobox-arrow-wrap">
          <span
            class="list-combobox-arrow"
            data-table-action-trigger="list"
            role="button"
            tabindex="-1"
            aria-label="Развернуть список"
            @click.prevent="onArrowClick"
            @mousedown.prevent
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"></path>
            </svg>
          </span>
        </span>
      </div>
      <Teleport to="body">
        <ul
          ref="dropdownMenu"
          class="dropdown-menu widget-dd-menu widget-dd-menu--teleport"
          :id="listMenuId"
          :class="{ show: isDropdownOpen, scrollable: filteredOptions.length > 10 }"
          :style="menuPosition"
          role="listbox"
          tabindex="-1"
          @keydown="onMenuKeydown"
        >
          <li
            v-for="(option, idx) in filteredOptions"
            :id="listItemId(idx)"
            :key="option.id"
            role="option"
          >
            <a
              class="dropdown-item"
              href="#"
              :tabindex="-1"
              :class="{
                active: (highlightedIndex >= 0 ? highlightedIndex === idx : isOptionSelected(option)),
                'dropdown-item--selected': widgetConfig.multiselect && isOptionSelected(option)
              }"
              :title="option.label"
              @click.prevent="selectOption(option, $event)"
              @mousedown.prevent="highlightedIndex = idx"
            >
              <span v-text="option.label"></span>
            </a>
          </li>
        </ul>
      </Teleport>
    </div>
    <template #supporting>
      <span v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch, type CSSProperties } from 'vue';
import Md3Field from './common/Md3Field.vue';
import useWidgetField from './composables/useWidgetField.ts';
import {
  normalizeListOptions,
  type NormalizedListOption
} from '../runtime/widget_contract.ts';

type ListWidgetConfig = Record<string, unknown> & {
  editable?: boolean;
  multiselect?: boolean;
  placeholder?: string;
  readonly?: boolean;
  source?: unknown;
  sup_text?: unknown;
  table_cell_mode?: boolean;
  table_cell_tab_handler?: unknown;
  table_cell_validation_handler?: unknown;
  table_consume_keys?: unknown;
  value?: unknown;
};

type ListWidgetProps = {
  widgetConfig: ListWidgetConfig;
  widgetName: string;
};

type ListInputPayload = {
  config: ListWidgetConfig;
  name: string;
  value: unknown;
};

type ListWidgetEmit = {
  (event: 'input', payload: ListInputPayload): void;
};

type ListCommitResult =
  | { status: 'noop' | 'committed' }
  | { error: unknown; severity: 'recoverable' | 'fatal'; status: 'blocked' };

type ListValue = string | string[];
type MenuPosition = CSSProperties & {
  minWidth?: string;
};

defineOptions({
  name: 'ListWidget'
});

const props = defineProps<ListWidgetProps>();
const emit = defineEmits<ListWidgetEmit>();
const field = useWidgetField(props, emit);

const dropdownRoot = ref<HTMLElement | null>(null);
const dropdownToggle = ref<HTMLElement | null>(null);
const dropdownMenu = ref<HTMLElement | null>(null);

const value = ref<ListValue>('');
const inputValue = ref('');
const lastSelectedOptionId = ref('');
const isDropdownOpen = ref(false);
const isFocused = ref(false);
const menuPosition = shallowRef<MenuPosition>({});
const listId = `list-${Math.random().toString(36).slice(2, 9)}`;
const highlightedIndex = ref(-1);

let clickOutsideTimerId = 0;
let clickOutsideHandler: ((event: MouseEvent) => void) | null = null;
let scrollUpdate: EventListener | null = null;

const tableCellMode = field.tableCellMode;
const tableCellRootAttrs = field.tableCellRootAttrs;
const isDraftEditing = field.isDraftEditing;

const isEditable = computed(() => props.widgetConfig.editable !== false);
const isMultiselect = computed(() => props.widgetConfig.multiselect === true);
const isSearchable = computed(() => isEditable.value && !isMultiselect.value);
const hasValue = computed(() => {
  if (isMultiselect.value) {
    return Array.isArray(value.value) && value.value.length > 0;
  }
  return String(value.value || '').trim() !== '';
});
const labelFloats = computed(() => hasValue.value || isFocused.value);
const showPlaceholder = computed(() =>
  Boolean(!hasValue.value && isFocused.value && props.widgetConfig.placeholder)
);
const listOptions = computed(() => normalizeListOptions(props.widgetConfig.source));
const filteredOptions = computed(() => {
  if (isSearchable.value && isDropdownOpen.value && inputValue.value.trim()) {
    const query = inputValue.value.trim().toLowerCase();
    return listOptions.value.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }

  return listOptions.value;
});
const listMenuId = computed(() => `list-menu-${listId}`);
const highlightedId = computed(() =>
  highlightedIndex.value >= 0 && highlightedIndex.value < filteredOptions.value.length
    ? listItemId(highlightedIndex.value)
    : null
);
const inputDisplayValue = computed(() => {
  if (isMultiselect.value) {
    return getSelectedLabels().join(', ');
  }

  if (!isEditable.value) {
    return getOptionLabelByValue(value.value);
  }

  if (isDraftEditing.value) {
    return inputValue.value;
  }

  return inputValue.value !== ''
    ? inputValue.value
    : getOptionLabelByValue(value.value);
});

function listItemId(index: number): string {
  return `list-item-${listId}-${index}`;
}

function getOptionByValue(
  rawValue: unknown,
  options: readonly NormalizedListOption[] = listOptions.value
): NormalizedListOption | null {
  return options.find((option) => option.value === String(rawValue ?? '')) || null;
}

function getOptionById(
  optionId: unknown,
  options: readonly NormalizedListOption[] = listOptions.value
): NormalizedListOption | null {
  return options.find((option) => option.id === optionId) || null;
}

function getOptionLabelByValue(rawValue: unknown): string {
  const normalized = rawValue == null ? '' : String(rawValue);
  if (!normalized) {
    return '';
  }

  const option = getOptionByValue(normalized);
  return option ? option.label : normalized;
}

function getSelectedLabels(): string[] {
  if (!isMultiselect.value || !Array.isArray(value.value)) {
    return [];
  }

  return value.value
    .map((itemValue) => getOptionLabelByValue(itemValue))
    .filter(Boolean);
}

function resolveSingleCommittedValue(rawDraft: unknown): string {
  const draft = String(rawDraft ?? '');
  if (!draft) {
    return '';
  }

  const matchedOption = listOptions.value.find((option) =>
    option.label === draft || option.value === draft
  );

  return matchedOption ? matchedOption.value : draft;
}

function setSingleValue(nextValue: unknown): void {
  value.value = nextValue == null ? '' : String(nextValue);
  if (!isDraftEditing.value) {
    inputValue.value = getOptionLabelByValue(value.value);
  }
}

function setMultiValue(nextValue: unknown): void {
  value.value = Array.isArray(nextValue)
    ? nextValue.map((item) => String(item ?? ''))
    : [];
}

function setValue(nextValue: unknown): void {
  if (isMultiselect.value) {
    setMultiValue(nextValue);
    return;
  }

  const singleValue = Array.isArray(nextValue)
    ? (nextValue[0] == null ? '' : String(nextValue[0]))
    : String(nextValue ?? '');
  setSingleValue(singleValue);
}

function syncInputDraftFromCommittedValue(): void {
  if (isMultiselect.value || isDraftEditing.value) {
    return;
  }

  inputValue.value = getOptionLabelByValue(value.value);
}

function resolveHighlightedIndex(): number {
  if (isMultiselect.value) {
    const anchorOption = getOptionById(lastSelectedOptionId.value, filteredOptions.value);
    if (anchorOption) {
      return filteredOptions.value.findIndex((option) => option.id === anchorOption.id);
    }
    return -1;
  }

  const selectedOption = getOptionByValue(value.value, filteredOptions.value);
  if (selectedOption) {
    return filteredOptions.value.findIndex((option) => option.id === selectedOption.id);
  }
  return -1;
}

function getInputElement(): HTMLInputElement | null {
  const element = dropdownToggle.value?.querySelector('.list-combobox-input') || null;
  return element instanceof HTMLInputElement ? element : null;
}

function scrollHighlightedItemIntoView(): void {
  const items = dropdownMenu.value?.querySelectorAll('[role="option"]');
  if (!items || highlightedIndex.value < 0 || highlightedIndex.value >= items.length) {
    return;
  }

  const item = items[highlightedIndex.value];
  const element =
    item?.querySelector('.dropdown-item') ||
    item;
  if (element instanceof HTMLElement) {
    element.scrollIntoView({ block: 'nearest' });
  }
}

function setHighlightedIndex(index: number, options: { scroll?: boolean } = {}): void {
  const scroll = options.scroll !== false;
  const maxIndex = filteredOptions.value.length - 1;
  const nextIndex =
    maxIndex < 0
      ? -1
      : Math.min(Math.max(index, 0), maxIndex);
  highlightedIndex.value = nextIndex;
  if (scroll && nextIndex >= 0) {
    void nextTick(scrollHighlightedItemIntoView);
  }
}

function moveHighlightedIndex(delta: number): void {
  const length = filteredOptions.value.length;
  if (length === 0) {
    highlightedIndex.value = -1;
    return;
  }

  const nextIndex =
    highlightedIndex.value < 0
      ? delta > 0
        ? 0
        : length - 1
      : (highlightedIndex.value + delta + length) % length;
  setHighlightedIndex(nextIndex);
}

function resetHighlightToFirstFilteredOption(): void {
  void nextTick(() => {
    setHighlightedIndex(
      filteredOptions.value.length > 0 ? 0 : -1
    );
  });
}

function getCurrentHighlightedOption(): NormalizedListOption | null {
  const options = filteredOptions.value;
  if (highlightedIndex.value >= 0 && highlightedIndex.value < options.length) {
    return options[highlightedIndex.value];
  }

  const resolvedIndex = resolveHighlightedIndex();
  return resolvedIndex >= 0 && resolvedIndex < options.length
    ? options[resolvedIndex]
    : null;
}

function onInputChange(event: Event): void {
  if (!isSearchable.value) {
    return;
  }

  const target = event.target instanceof HTMLInputElement ? event.target : null;
  inputValue.value = String(target?.value || '');
  field.activateDraftController();
  if (!isDropdownOpen.value) {
    openDropdown({ highlightFirstFiltered: true });
    return;
  }

  resetHighlightToFirstFilteredOption();
}

function onInputFocus(): void {
  isFocused.value = true;
  if (!isMultiselect.value && isEditable.value && !isDraftEditing.value) {
    inputValue.value = getOptionLabelByValue(value.value);
    field.activateDraftController();
  }
}

function onInputBlur(): void {
  isFocused.value = false;
  const input = getInputElement();
  if (input) {
    input.scrollLeft = 0;
    input.setSelectionRange(0, 0);
  }

  window.setTimeout(() => {
    if (isFocusInsideWidget()) {
      return;
    }

    if (!isMultiselect.value && isEditable.value) {
      commitDraft();
    }
    closeDropdown();
    field.deactivateDraftController();
  }, 150);
}

function maybeHandleTableTab(event: KeyboardEvent): boolean {
  if (event.key !== 'Tab') {
    return false;
  }

  const tabHandler = props.widgetConfig.table_cell_tab_handler;
  if (tableCellMode.value && typeof tabHandler === 'function') {
    event.preventDefault();
    closeDropdown();
    tabHandler(!!event.shiftKey);
    return true;
  }

  return false;
}

function onInputKeydown(event: KeyboardEvent): void {
  if (props.widgetConfig.readonly) {
    return;
  }

  if (isMultiselect.value && (event.key === 'Backspace' || event.key === 'Delete')) {
    event.preventDefault();
    removeLastSelected();
    return;
  }

  if (!isEditable.value && (event.key === 'Backspace' || event.key === 'Delete')) {
    event.preventDefault();
    clearValue();
    return;
  }

  if (maybeHandleTableTab(event)) {
    return;
  }

  const expandKeys =
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.key === 'ArrowDown';
  if (expandKeys) {
    event.preventDefault();
    openDropdown();
    return;
  }

  if (event.key === 'Enter' && !isDropdownOpen.value) {
    event.preventDefault();
    openDropdown();
    return;
  }

  if (isDropdownOpen.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlightedIndex(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlightedIndex(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = getCurrentHighlightedOption();
      if (option) {
        selectOption(option, event);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
      getInputElement()?.focus();
    }
  }
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (!isDropdownOpen.value) {
    return;
  }

  const length = filteredOptions.value.length;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveHighlightedIndex(1);
    getInputElement()?.focus();
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveHighlightedIndex(-1);
    getInputElement()?.focus();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    if (length > 0) {
      const option = getCurrentHighlightedOption();
      if (option) {
        selectOption(option, event);
      }
    }
    getInputElement()?.focus();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeDropdown();
    getInputElement()?.focus();
    return;
  }

  if (event.key === 'Tab') {
    if (maybeHandleTableTab(event)) {
      return;
    }

    closeDropdown();
  }

  if (isMultiselect.value && (event.key === 'Backspace' || event.key === 'Delete')) {
    event.preventDefault();
    removeLastSelected();
    closeDropdown();
    getInputElement()?.focus();
  }
}

function onArrowClick(): void {
  if (props.widgetConfig.readonly) {
    return;
  }

  getInputElement()?.focus();
  if (isDropdownOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function buildNextMultiValue(
  option: NormalizedListOption,
  event?: MouseEvent | KeyboardEvent
): string[] {
  const currentValues = Array.isArray(value.value) ? [...value.value] : [];
  if (event?.shiftKey && lastSelectedOptionId.value) {
    const anchorIndex = listOptions.value.findIndex((item) => item.id === lastSelectedOptionId.value);
    const currentIndex = listOptions.value.findIndex((item) => item.id === option.id);

    if (anchorIndex !== -1 && currentIndex !== -1) {
      const start = Math.min(anchorIndex, currentIndex);
      const end = Math.max(anchorIndex, currentIndex);
      const nextValues = [...currentValues];

      for (let index = start; index <= end; index += 1) {
        const rangeOption = listOptions.value[index];
        if (!rangeOption || nextValues.includes(rangeOption.value)) {
          continue;
        }
        nextValues.push(rangeOption.value);
      }

      return nextValues;
    }
  }

  const optionIndex = currentValues.indexOf(option.value);
  if (optionIndex >= 0) {
    currentValues.splice(optionIndex, 1);
    return currentValues;
  }

  currentValues.push(option.value);
  return currentValues;
}

function selectOption(
  option: NormalizedListOption | null | undefined,
  event?: MouseEvent | KeyboardEvent
): void {
  if (!option) {
    return;
  }

  if (isMultiselect.value) {
    const nextValue = buildNextMultiValue(option, event);
    value.value = nextValue;
    lastSelectedOptionId.value = option.id;
    field.emitInput(nextValue.slice());
    return;
  }

  const nextValue = value.value === option.value ? '' : option.value;
  value.value = nextValue;
  inputValue.value = getOptionLabelByValue(nextValue);
  lastSelectedOptionId.value = option.id;
  field.emitInput(nextValue);
  closeDropdown();
  field.deactivateDraftController();
}

function isOptionSelected(option: NormalizedListOption | null | undefined): boolean {
  if (!option) {
    return false;
  }

  if (isMultiselect.value) {
    return Array.isArray(value.value) && value.value.includes(option.value);
  }

  return value.value === option.value;
}

function openDropdown(options: { highlightFirstFiltered?: boolean } = {}): void {
  if (props.widgetConfig.readonly) {
    return;
  }

  const highlightFirstFiltered = options.highlightFirstFiltered === true;
  isDropdownOpen.value = true;
  highlightedIndex.value = highlightFirstFiltered
    ? filteredOptions.value.length > 0
      ? 0
      : -1
    : resolveHighlightedIndex();
  void nextTick(() => {
    updateMenuPosition();
    addClickOutsideListener();
    addScrollListener();
    scrollHighlightedItemIntoView();
  });
}

function updateMenuPosition(): void {
  const toggle = dropdownToggle.value;
  if (!toggle) {
    return;
  }

  const rect = toggle.getBoundingClientRect();
  menuPosition.value = {
    position: 'fixed',
    top: `${rect.bottom}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    minWidth: `${rect.width}px`
  };
}

function addScrollListener(): void {
  removeScrollListener();
  scrollUpdate = () => {
    if (isDropdownOpen.value) {
      updateMenuPosition();
    }
  };
  window.addEventListener('scroll', scrollUpdate, true);
}

function removeScrollListener(): void {
  if (scrollUpdate) {
    window.removeEventListener('scroll', scrollUpdate, true);
    scrollUpdate = null;
  }
}

function closeDropdown(): void {
  if (!isDropdownOpen.value) {
    return;
  }

  isDropdownOpen.value = false;
  highlightedIndex.value = -1;
  removeClickOutsideListener();
  removeScrollListener();
}

function addClickOutsideListener(): void {
  removeClickOutsideListener();
  clickOutsideHandler = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const root = dropdownRoot.value;
    const menu = dropdownMenu.value;
    const inRoot = Boolean(root && root.contains(target));
    const inMenu = Boolean(menu && menu.contains(target));
    if (!inRoot && !inMenu) {
      if (!isMultiselect.value && isEditable.value) {
        commitDraft();
      }
      closeDropdown();
      field.deactivateDraftController();
    }
  };
  clickOutsideTimerId = window.setTimeout(() => {
    clickOutsideTimerId = 0;
    if (clickOutsideHandler) {
      document.addEventListener('click', clickOutsideHandler);
    }
  }, 0);
}

function removeClickOutsideListener(): void {
  if (clickOutsideTimerId) {
    window.clearTimeout(clickOutsideTimerId);
    clickOutsideTimerId = 0;
  }
  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler);
    clickOutsideHandler = null;
  }
}

function isFocusInsideWidget(): boolean {
  const root = dropdownRoot.value;
  const menu = dropdownMenu.value;
  const active = document.activeElement;
  if (root && active && root.contains(active)) {
    return true;
  }
  return Boolean(menu && active && menu.contains(active));
}

function onWidgetFocusOut(): void {
  window.setTimeout(() => {
    if (isFocusInsideWidget()) {
      return;
    }

    if (!isMultiselect.value && isEditable.value) {
      commitDraft();
    }
    closeDropdown();
    field.deactivateDraftController();
  }, 0);
}

function removeLastSelected(): void {
  if (!isMultiselect.value || !Array.isArray(value.value) || value.value.length === 0) {
    return;
  }

  const nextValue = value.value.slice(0, -1);
  value.value = nextValue;
  field.emitInput(nextValue.slice());
}

function clearValue(): void {
  if (isMultiselect.value) {
    value.value = [];
    field.emitInput([]);
    lastSelectedOptionId.value = '';
    return;
  }

  value.value = '';
  inputValue.value = '';
  field.emitInput('');
}

function commitDraft(): ListCommitResult {
  if (isMultiselect.value || !isEditable.value) {
    return { status: 'noop' };
  }

  const committedValue = resolveSingleCommittedValue(inputValue.value);
  value.value = committedValue;
  inputValue.value = getOptionLabelByValue(committedValue);
  field.emitInput(committedValue);
  return { status: 'committed' };
}

function commitPendingState(): ListCommitResult {
  return commitDraft();
}

function getValue(): ListValue {
  return value.value;
}

watch(
  () => props.widgetConfig.value,
  (nextValue) => {
    if (nextValue === undefined) {
      return;
    }

    field.syncCommittedValue(nextValue, setValue);
  },
  { immediate: true }
);

watch(filteredOptions, () => {
  if (filteredOptions.value.length === 0) {
    highlightedIndex.value = -1;
    return;
  }

  if (highlightedIndex.value >= filteredOptions.value.length) {
    setHighlightedIndex(
      Math.max(0, filteredOptions.value.length - 1),
      { scroll: false }
    );
  }
});

watch(listOptions, () => {
  if (lastSelectedOptionId.value && !getOptionById(lastSelectedOptionId.value)) {
    lastSelectedOptionId.value = '';
  }

  syncInputDraftFromCommittedValue();
});

onBeforeUnmount(() => {
  closeDropdown();
  removeClickOutsideListener();
  removeScrollListener();
});

defineExpose({
  closeDropdown,
  commitDraft,
  commitPendingState,
  getValue,
  onArrowClick,
  openDropdown,
  setValue,
  toggleDropdown: onArrowClick,
  value
});
</script>
