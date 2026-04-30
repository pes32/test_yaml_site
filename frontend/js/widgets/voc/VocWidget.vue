<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ 'md3-dropdown-wrap': true, error: !!combinedFieldError }"
    :has-supporting="!!(widgetConfig.sup_text || combinedFieldError)"
    @focusout="onWidgetFocusOut"
    @container-focusout="onWidgetFocusOut"
  >
    <choice-combobox
      ref="combobox"
      arrow-label="Открыть справочник"
      :active-descendant="highlightedId"
      :disabled="widgetConfig.readonly"
      :input-value="inputDisplayValue"
      :is-open="shouldShowInlineDropdown"
      :is-scrollable="inlineRows.length > 10"
      :item-class="inlineRowClass"
      :item-id="listItemId"
      :item-key="inlineRowKey"
      :item-label="inlineRowLabel"
      :item-title="inlineRowLabel"
      :menu-id="listMenuId"
      :menu-items="inlineRows"
      :menu-position="menuPosition"
      :placeholder="showPlaceholder ? String(widgetConfig.placeholder || '') : ''"
      :render-menu="shouldShowInlineDropdown"
      :root-attrs="tableCellRootAttrs"
      :tabindex="widgetConfig.readonly ? -1 : null"
      @arrow-click="onArrowClick"
      @blur="onInputBlur"
      @focus="onInputFocus"
      @input="onInputChange"
      @input-keydown="onInputKeydown"
      @item-mousedown="setHighlightedFromPointer"
      @item-select="selectInlineItem"
      @menu-keydown="onMenuKeydown"
    ></choice-combobox>
    <voc-modal-table
      ref="modalTable"
      :cell-class="modalCellClass"
      :columns="columns"
      :is-multiselect="isMultiselect"
      :is-open="isModalOpen"
      :is-row-active="isModalRowActive"
      :is-row-selected="isModalRowSelected"
      :modal-search="modalSearch"
      :rows="modalRows"
      :sort-control-class="modalSortControlClass"
      :title="modalTitle"
      @apply="applyModalSelection"
      @cancel="closeModalFromCancel"
      @keydown="onModalKeydown"
      @row-click="onModalRowClick"
      @row-double-click="onModalRowDoubleClick"
      @row-toggle="toggleModalRow"
      @search-input="onModalSearchInput"
      @sort="toggleModalSort"
    ></voc-modal-table>
    <template #supporting>
      <span v-if="combinedFieldError" class="md3-error" v-text="combinedFieldError"></span>
      <span v-else v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>
<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  toRefs,
  watch
} from 'vue';
import Md3Field from '../common/Md3Field.vue';
import ChoiceCombobox from '../common/ChoiceCombobox.vue';
import {
  resolveChoiceComboboxRefs,
  type ChoiceComboboxSurface
} from '../common/choice_combobox_refs.ts';
import type { ChoiceWidgetConfigBase } from '../common/choice_widget_types.ts';
import useWidgetField from '../composables/useWidgetField.ts';
import { useWidgetConfigValueSync } from '../composables/useWidgetConfigValueSync.ts';
import VocModalTable from './VocModalTable.vue';
import {
  normalizeVocColumns,
  normalizeVocRows,
  serializeVocValues,
  type VocRow
} from '../../runtime/voc_contract.ts';
import {
  formatVocRowLabel,
  hasVocValue,
  normalizeMultiVocValue,
  normalizeSingleVocValue
} from './voc_value_core.ts';
import {
  scheduleOutsideInteractionCommit
} from '../dropdown/dropdown_runtime.ts';
import { createChoiceDropdownRuntime } from '../dropdown/choice_dropdown_runtime.ts';
import {
  useVocModalSelection,
  type VocModalTableSurface
} from './useVocModalSelection.ts';
import { useVocInlineDropdown } from './useVocInlineDropdown.ts';
import {
  createVocWidgetState,
  type VocWidgetState
} from './voc_shared.ts';
type VocWidgetConfig = ChoiceWidgetConfigBase & {
  columns?: unknown;
  label?: unknown;
  table_cell_ui_lock_handler?: unknown;
};
type VocWidgetProps = {
  widgetConfig: VocWidgetConfig;
  widgetName: string;
};
type VocInputPayload = {
  config: VocWidgetConfig;
  name: string;
  value: unknown;
};
type VocWidgetEmit = {
  (event: 'input', payload: VocInputPayload): void;
};
defineOptions({
  name: 'VocWidget'
});
const props = defineProps<VocWidgetProps>();
const emit = defineEmits<VocWidgetEmit>();
const combobox = ref<ChoiceComboboxSurface | null>(null);
const modalTable = ref<VocModalTableSurface | null>(null);
const state = reactive(createVocWidgetState()) as VocWidgetState;
const field = useWidgetField(props, emit);
const tableCellRootAttrs = field.tableCellRootAttrs;
const fieldError = field.fieldError;
const isDraftEditing = field.isDraftEditing;
const tableCellMode = field.tableCellMode;
const isMultiselect = computed(() => props.widgetConfig.multiselect === true);
const hasValue = computed(() => hasVocValue(state.value, isMultiselect.value));
const labelFloats = computed(() => hasValue.value || state.isFocused);
const showPlaceholder = computed(() =>
  !hasValue.value && state.isFocused && Boolean(props.widgetConfig.placeholder)
);
const columns = computed(() => normalizeVocColumns(props.widgetConfig.columns));
const rows = computed(() => normalizeVocRows(columns.value, props.widgetConfig.source));
const combinedFieldError = computed(() => state.vocError || fieldError.value || '');
let openModalFromInlineDropdown = (): void => {};
function listItemId(index: number): string {
  return choiceDropdown.listItemId(index);
}
function setHighlightedIndex(index: number, options: { scroll?: boolean } = {}): void {
  choiceDropdown.setHighlightedIndex(index, options);
}
function moveHighlightedIndex(delta: number): void {
  choiceDropdown.moveHighlightedIndex(delta);
}
function getInputElement(): HTMLInputElement | null {
  return choiceDropdown.getInputElement();
}
const inlineDropdown = useVocInlineDropdown({
  state,
  widgetConfig: props.widgetConfig,
  isMultiselect,
  isDraftEditing,
  tableCellMode,
  rows,
  combinedFieldError,
  activateDraftController: field.activateDraftController,
  clearVocError,
  closeDropdown,
  deactivateDraftController: field.deactivateDraftController,
  emitInput: field.emitInput,
  focusInput: () => choiceDropdown.focusInput(),
  moveHighlightedIndex,
  openDropdown,
  openModal: () => openModalFromInlineDropdown(),
  scheduleOutsideCommit: (options) => scheduleOutsideInteractionCommit(dropdownRuntimeContext, options),
  setHighlightedIndex,
  setSingleValue,
  setVocError
});
const {
  inlineRows,
  inputDisplayValue,
  shouldShowInlineDropdown,
  commitDraft,
  commitPendingState,
  onInputBlur,
  onInputChange,
  onInputFocus,
  onInputKeydown,
  onMenuKeydown,
  onOutsideInteractionCommit,
  onWidgetFocusOut,
  resolveHighlightedIndex,
  selectInlineRow
} = inlineDropdown;
const listMenuId = computed(() => `voc-menu-${state.listId}`);
const highlightedId = computed(() =>
  state.highlightedIndex >= 0 && state.highlightedIndex < inlineRows.value.length
    ? listItemId(state.highlightedIndex)
    : null
);
const modalTitle = computed(() => {
  const label = String(props.widgetConfig.label || '').trim();
  return label || props.widgetName;
});
const choiceDropdown = createChoiceDropdownRuntime({
  $nextTick: nextTick,
  getRefs: () => resolveChoiceComboboxRefs(combobox.value, modalTable.value?.modalRoot || null),
  getHighlightedIndex: () => state.highlightedIndex,
  setHighlightedIndex: (value) => {
    state.highlightedIndex = Number(value) || 0;
  },
  getInlineRows: () => inlineRows.value,
  getIsDropdownOpen: () => state.isDropdownOpen,
  setIsDropdownOpen: (value) => {
    state.isDropdownOpen = Boolean(value);
  },
  getListId: () => state.listId,
  getMenuPosition: () => state.menuPosition,
  setMenuPosition: (value) => {
    state.menuPosition = value;
  },
  onOutsideInteractionCommit,
  resolveHighlightedIndex,
  getShouldShowInlineDropdown: () => shouldShowInlineDropdown.value,
  getWidgetConfig: () => props.widgetConfig
});
const dropdownRuntimeContext = choiceDropdown.context;
const {
  highlightedIndex,
  inputValue,
  isDropdownOpen,
  isFocused,
  isModalOpen,
  menuPosition,
  modalSearch,
  value,
  vocError
} = toRefs(state);
function formatRowLabel(row: VocRow | null | undefined): string {
  return formatVocRowLabel(row || null);
}
function asVocRow(item: unknown): VocRow | null {
  return item && typeof item === 'object'
    ? (item as VocRow)
    : null;
}
function inlineRowKey(item: unknown): string {
  return asVocRow(item)?.id || '';
}
function inlineRowLabel(item: unknown): string {
  return formatRowLabel(asVocRow(item));
}
function inlineRowClass(_item: unknown, index: number): Record<string, boolean> {
  return {
    active: state.highlightedIndex === index
  };
}
function setHighlightedFromPointer(index: number): void {
  state.highlightedIndex = Number(index) || 0;
}
function selectInlineItem(item: unknown): void {
  selectInlineRow(asVocRow(item));
}
function setSingleValue(value: unknown, options: { forceSyncInput?: boolean } = {}): void {
  state.value = normalizeSingleVocValue(value);
  state.singleDraftDirty = false;
  if (options.forceSyncInput === true || (!state.isFocused && !isDraftEditing.value)) {
    state.inputValue = String(state.value || '');
  }
}
function setMultiValue(value: unknown): void {
  state.value = normalizeMultiVocValue(value);
  if (!state.isFocused && !isDraftEditing.value) {
    state.inputValue = serializeVocValues(state.value);
  }
}
function setValue(value: unknown): void {
  if (isMultiselect.value) {
    setMultiValue(value);
    return;
  }
  const nextValue = Array.isArray(value)
    ? String(value[0] ?? '')
    : String(value ?? '');
  setSingleValue(nextValue, { forceSyncInput: true });
}
function getValue(): string | string[] {
  return state.value;
}
function clearVocError(): void {
  state.vocError = '';
  field.handleTableCellCommitValidation('');
}
function setVocError(message: string): void {
  const errorMessage = String(message || '').trim();
  state.vocError = errorMessage;
  field.handleTableCellCommitValidation(errorMessage);
}
const modalSelection = useVocModalSelection({
  state,
  widgetConfig: props.widgetConfig,
  isMultiselect,
  rows,
  clearVocError,
  closeDropdown,
  emitInput: field.emitInput,
  getInputElement,
  getModalTable: () => modalTable.value,
  setMultiValue,
  setSingleValue
});
const {
  modalRows,
  applyModalSelection,
  closeModal,
  closeModalFromCancel,
  isModalRowActive,
  isModalRowSelected,
  modalCellClass,
  modalSortControlClass,
  moveModalActiveRow,
  onModalKeydown,
  onModalRowClick,
  onModalRowDoubleClick,
  onModalSearchInput,
  openModal,
  setTableUiLocked,
  syncModalActiveRow,
  toggleModalRow,
  toggleModalSort
} = modalSelection;
openModalFromInlineDropdown = openModal;
function openDropdown(options: { highlightFirst?: boolean } = {}): void {
  choiceDropdown.openDropdown(options);
}
function closeDropdown(): void {
  choiceDropdown.closeDropdown();
}
function onArrowClick(): void {
  if (props.widgetConfig.readonly) {
    return;
  }
  choiceDropdown.focusInput();
  openModal();
}
useWidgetConfigValueSync(props, field.syncCommittedValue, setValue);
watch(inlineRows, () => {
  if (inlineRows.value.length === 0) {
    state.highlightedIndex = -1;
    return;
  }
  if (state.highlightedIndex >= inlineRows.value.length) {
    setHighlightedIndex(0, { scroll: false });
  }
});
onBeforeUnmount(() => {
  closeDropdown();
});
defineExpose({
  clearVocError,
  closeDropdown,
  closeModal,
  combinedFieldError,
  commitDraft,
  commitPendingState,
  fieldError,
  getInputElement,
  getValue,
  isDraftEditing,
  isModalOpen,
  moveModalActiveRow,
  onArrowClick,
  openDropdown,
  openModal,
  setTableUiLocked,
  setValue,
  syncModalActiveRow,
  value,
  vocError
});
</script>
