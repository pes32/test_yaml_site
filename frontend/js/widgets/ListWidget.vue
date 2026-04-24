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
    <choice-combobox
      ref="combobox"
      arrow-label="Развернуть список"
      :active-descendant="highlightedId"
      :disabled="widgetConfig.readonly"
      :input-value="inputDisplayValue"
      :is-open="isDropdownOpen"
      :is-scrollable="filteredOptions.length > 10"
      :item-class="listOptionClass"
      :item-id="listItemId"
      :item-key="listOptionKey"
      :item-label="listOptionLabel"
      :item-title="listOptionLabel"
      :menu-id="listMenuId"
      :menu-items="filteredOptions"
      :menu-position="menuPosition"
      :placeholder="showPlaceholder ? String(widgetConfig.placeholder || '') : ''"
      :readonly="!isEditable || widgetConfig.multiselect"
      :root-attrs="tableCellRootAttrs"
      :tabindex="widgetConfig.readonly ? -1 : null"
      @arrow-click="onArrowClick"
      @blur="onInputBlur"
      @focus="onInputFocus"
      @input="onInputChange"
      @input-keydown="onInputKeydown"
      @item-mousedown="setHighlightedFromPointer"
      @item-select="selectOption"
      @menu-keydown="onMenuKeydown"
    ></choice-combobox>
    <template #supporting>
      <span v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch, type CSSProperties } from 'vue';
import ChoiceCombobox from './common/ChoiceCombobox.vue';
import Md3Field from './common/Md3Field.vue';
import {
  resolveChoiceComboboxRefs,
  type ChoiceComboboxSurface
} from './common/choice_combobox_refs.ts';
import type { ChoiceWidgetConfigBase } from './common/choice_widget_types.ts';
import useWidgetField from './composables/useWidgetField.ts';
import { useWidgetConfigValueSync } from './composables/useWidgetConfigValueSync.ts';
import {
  normalizeListOptions,
  type NormalizedListOption
} from '../runtime/widget_contract.ts';
import { useListValueModel } from './list/useListValueModel.ts';
import {
  closeDropdown as closeDropdownRuntime,
  focusInput,
  getInputElement as getInputElementRuntime,
  handleDropdownTableCellTab,
  listItemId as resolveListItemId,
  moveDropdownHighlightedIndex,
  openDropdown as openDropdownRuntime,
  removeClickOutsideListener,
  removeScrollListener,
  scheduleOutsideInteractionCommit,
  setDropdownHighlightedIndex,
  type DropdownRuntimeContext
} from './dropdown/dropdown_runtime.ts';
type ListWidgetConfig = ChoiceWidgetConfigBase & {
  editable?: boolean;
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
type MenuPosition = CSSProperties & {
  minWidth?: string;
};
defineOptions({
  name: 'ListWidget'
});
const props = defineProps<ListWidgetProps>();
const emit = defineEmits<ListWidgetEmit>();
const field = useWidgetField(props, emit);
const combobox = ref<ChoiceComboboxSurface | null>(null);
const isDropdownOpen = ref(false);
const isFocused = ref(false);
const menuPosition = shallowRef<MenuPosition>({});
const listId = `list-${Math.random().toString(36).slice(2, 9)}`;
const highlightedIndex = ref(-1);
const tableCellMode = field.tableCellMode;
const tableCellRootAttrs = field.tableCellRootAttrs;
const isDraftEditing = field.isDraftEditing;
const isEditable = computed(() => props.widgetConfig.editable !== false);
const isMultiselect = computed(() => props.widgetConfig.multiselect === true);
const isSearchable = computed(() => isEditable.value && !isMultiselect.value);
const listOptions = computed(() => normalizeListOptions(props.widgetConfig.source));
const valueModel = useListValueModel({
  isDraftEditing,
  isEditable,
  isMultiselect,
  listOptions,
  emitInput: field.emitInput,
  getFilteredOptions: () => filteredOptions.value
});
const {
  inputValue,
  value,
  clearMissingLastSelectedOption,
  clearValue,
  commitDraft,
  commitPendingState,
  getCurrentHighlightedOption: getHighlightedOptionFromValueModel,
  getOptionLabelByValue,
  getSelectedLabels,
  getValue,
  isOptionSelected,
  removeLastSelected,
  resolveHighlightedIndex,
  selectOption: selectOptionInValueModel,
  setValue,
  syncInputDraftFromCommittedValue
} = valueModel;
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
function getDropdownRefs() {
  return resolveChoiceComboboxRefs(combobox.value);
}
const dropdownRuntimeContext: DropdownRuntimeContext = {
  $nextTick: nextTick,
  get $refs() {
    return getDropdownRefs();
  },
  get highlightedIndex() {
    return highlightedIndex.value;
  },
  set highlightedIndex(value) {
    highlightedIndex.value = Number(value) || 0;
  },
  get inlineRows() {
    return filteredOptions.value;
  },
  get isDropdownOpen() {
    return isDropdownOpen.value;
  },
  set isDropdownOpen(value) {
    isDropdownOpen.value = Boolean(value);
  },
  get listId() {
    return listId;
  },
  get menuPosition() {
    return menuPosition.value as Record<string, string>;
  },
  set menuPosition(value) {
    menuPosition.value = value;
  },
  onOutsideInteractionCommit,
  resolveHighlightedIndex,
  get shouldShowInlineDropdown() {
    return isDropdownOpen.value;
  },
  get widgetConfig() {
    return props.widgetConfig;
  }
};
function listItemId(index: number): string {
  return resolveListItemId(dropdownRuntimeContext, Number(index));
}
function asListOption(item: unknown): NormalizedListOption | null {
  return item && typeof item === 'object'
    ? (item as NormalizedListOption)
    : null;
}
function listOptionKey(item: unknown): string {
  return asListOption(item)?.id || '';
}
function listOptionLabel(item: unknown): string {
  return asListOption(item)?.label || '';
}
function listOptionClass(item: unknown, index: number): Record<string, boolean> {
  const option = asListOption(item);
  const selected = isOptionSelected(option);
  return {
    active: highlightedIndex.value >= 0 ? highlightedIndex.value === index : selected,
    'dropdown-item--selected': Boolean(props.widgetConfig.multiselect && selected)
  };
}
function setHighlightedFromPointer(index: number): void {
  highlightedIndex.value = Number(index) || 0;
}
function getInputElement(): HTMLInputElement | null {
  return getInputElementRuntime(dropdownRuntimeContext);
}
function setHighlightedIndex(index: number, options: { scroll?: boolean } = {}): void {
  setDropdownHighlightedIndex(
    dropdownRuntimeContext,
    index,
    filteredOptions.value.length,
    options
  );
}
function moveHighlightedIndex(delta: number): void {
  moveDropdownHighlightedIndex(
    dropdownRuntimeContext,
    filteredOptions.value.length,
    delta
  );
}
function resetHighlightToFirstFilteredOption(): void {
  void nextTick(() => {
    setHighlightedIndex(
      filteredOptions.value.length > 0 ? 0 : -1
    );
  });
}
function getCurrentHighlightedOption() {
  return getHighlightedOptionFromValueModel(highlightedIndex.value);
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
  scheduleOutsideInteractionCommit(dropdownRuntimeContext, { delay: 150 });
}
function maybeHandleTableTab(event: KeyboardEvent): boolean {
  return handleDropdownTableCellTab(event, {
    closeDropdown,
    tableCellMode: tableCellMode.value,
    tabHandler: props.widgetConfig.table_cell_tab_handler
  });
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
  focusInput(dropdownRuntimeContext);
  if (isDropdownOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}
function selectOption(
  option: unknown,
  event?: MouseEvent | KeyboardEvent
): void {
  const result = selectOptionInValueModel(asListOption(option), event);
  if (result.closeDropdown) {
    closeDropdown();
  }
  if (result.deactivateDraft) {
    field.deactivateDraftController();
  }
}
function openDropdown(options: { highlightFirstFiltered?: boolean } = {}): void {
  openDropdownRuntime(dropdownRuntimeContext, {
    highlightFirst: options.highlightFirstFiltered === true
  });
}
function closeDropdown(): void {
  closeDropdownRuntime(dropdownRuntimeContext);
}
function onOutsideInteractionCommit(): void {
  if (!isMultiselect.value && isEditable.value) {
    commitDraft();
  }
  closeDropdown();
  field.deactivateDraftController();
}
function onWidgetFocusOut(): void {
  scheduleOutsideInteractionCommit(dropdownRuntimeContext);
}
useWidgetConfigValueSync(props, field.syncCommittedValue, setValue);
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
  clearMissingLastSelectedOption();
  syncInputDraftFromCommittedValue();
});
onBeforeUnmount(() => {
  closeDropdown();
  removeClickOutsideListener(dropdownRuntimeContext);
  removeScrollListener(dropdownRuntimeContext);
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
