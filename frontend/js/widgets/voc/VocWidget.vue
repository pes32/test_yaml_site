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
    <div
      ref="dropdownRoot"
      class="dropdown widget-dropdown list-combobox w-100 min-w-0 max-w-none"
      :class="{ show: shouldShowInlineDropdown }"
      :data-dropdown-open="shouldShowInlineDropdown ? 'true' : undefined"
      v-bind="tableCellRootAttrs"
    >
      <div ref="dropdownToggle" class="list-combobox-inner">
        <input
          type="text"
          class="list-combobox-input"
          data-table-editor-target="true"
          role="combobox"
          :aria-controls="listMenuId"
          :aria-expanded="shouldShowInlineDropdown ? 'true' : 'false'"
          :aria-activedescendant="highlightedId || undefined"
          :value="inputDisplayValue"
          :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
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
            aria-label="Открыть справочник"
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
          v-if="shouldShowInlineDropdown"
          ref="dropdownMenu"
          class="dropdown-menu widget-dd-menu widget-dd-menu--teleport"
          :id="listMenuId"
          :class="{ show: shouldShowInlineDropdown, scrollable: inlineRows.length > 10 }"
          :style="menuPosition"
          role="listbox"
          tabindex="-1"
          @keydown="onMenuKeydown"
        >
          <li
            v-for="(row, idx) in inlineRows"
            :id="listItemId(idx)"
            :key="row.id"
            role="option"
          >
            <a
              class="dropdown-item"
              href="#"
              :tabindex="-1"
              :class="{ active: highlightedIndex === idx }"
              :title="formatRowLabel(row)"
              @click.prevent="selectInlineRow(row)"
              @mousedown.prevent="highlightedIndex = idx"
            >
              <span v-text="formatRowLabel(row)"></span>
            </a>
          </li>
        </ul>
      </Teleport>
    </div>
    <Teleport to="body">
      <div
        v-if="isModalOpen"
        class="modal-overlay flex-center"
        @click.self="closeModalFromCancel"
      >
        <div
          ref="modalRoot"
          class="modal-content gui-modal"
          :style="modalInlineStyle"
          @click.stop
          @keydown.stop="onModalKeydown"
        >
          <div class="modal-header">
            <h5 class="modal-title page-section-title" v-text="modalTitle"></h5>
            <button type="button" class="ui-close-button" aria-label="Закрыть" @click="closeModalFromCancel"></button>
          </div>
          <div class="modal-body">
            <div class="gui-modal-body-inner" :style="modalBodyInnerStyle">
              <div>
                <input
                  ref="modalSearchInput"
                  type="text"
                  class="form-control voc-modal-search-input"
                  :value="modalSearch"
                  :style="modalSearchInputStyle"
                  placeholder="Поиск"
                  @input="onModalSearchInput"
                  @keydown.stop="onModalKeydown"
                >
              </div>
              <div class="gui-modal-tab-single" :style="modalTableWrapStyle">
                <table class="table widget-table widget-table--sticky-header widget-table--sortable">
                  <thead>
                    <tr>
                      <th v-if="isMultiselect" :style="checkboxCellStyle"></th>
                      <th
                        v-for="(columnLabel, columnIndex) in columns"
                        :key="'voc-th-' + columnIndex"
                      >
                        <div
                          class="widget-table__th-inner"
                          role="button"
                          tabindex="0"
                          :aria-label="'Сортировать по колонке ' + columnLabel"
                          @click="toggleModalSort(columnIndex)"
                          @keydown.enter.prevent="toggleModalSort(columnIndex)"
                          @keydown.space.prevent="toggleModalSort(columnIndex)"
                        >
                          <span class="widget-table__th-text" v-text="columnLabel"></span>
                          <div class="widget-table__sort-icons" :class="modalSortControlClass(columnIndex)" aria-hidden="true">
                            <svg class="widget-table__sort-svg widget-table__sort-svg--up" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.5845 17.7447L22.3941 8.93511C23.202 8.12722 23.202 6.80556 22.3941 5.99859L21.6588 5.26239C20.8528 4.45543 19.5302 4.45543 18.7232 5.26239L12 11.9856L5.27679 5.2624C4.46983 4.45543 3.14724 4.45543 2.34119 5.2624L1.60591 5.9986C0.798027 6.80556 0.798027 8.12723 1.60592 8.93511L10.4173 17.7447C10.8502 18.1785 11.4311 18.3715 12.0009 18.3393C12.568 18.3715 13.1498 18.1785 13.5845 17.7447Z"></path></svg>
                            <svg class="widget-table__sort-svg widget-table__sort-svg--down" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.5845 17.7447L22.3941 8.93511C23.202 8.12722 23.202 6.80556 22.3941 5.99859L21.6588 5.26239C20.8528 4.45543 19.5302 4.45543 18.7232 5.26239L12 11.9856L5.27679 5.2624C4.46983 4.45543 3.14724 4.45543 2.34119 5.2624L1.60591 5.9986C0.798027 6.80556 0.798027 8.12723 1.60592 8.93511L10.4173 17.7447C10.8502 18.1785 11.4311 18.3715 12.0009 18.3393C12.568 18.3715 13.1498 18.1785 13.5845 17.7447Z"></path></svg>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody v-if="modalRows.length">
                    <tr
                      v-for="row in modalRows"
                      :key="row.id"
                      :data-modal-active="isModalRowActive(row) ? 'true' : null"
                      :style="modalRowStyle(row)"
                      @click="onModalRowClick(row)"
                      @dblclick="onModalRowDoubleClick(row)"
                    >
                      <td v-if="isMultiselect" :style="modalCellStyle(row, checkboxCellStyle)">
                        <input
                          type="checkbox"
                          tabindex="-1"
                          :checked="isModalRowSelected(row)"
                          @click.stop="toggleModalRow(row)"
                        >
                      </td>
                      <td
                        v-for="(cellValue, cellIndex) in row.cells"
                        :key="row.id + '-c-' + cellIndex"
                        :style="modalCellStyle(row)"
                      >
                        <span class="widget-table__cell-value" v-text="cellValue"></span>
                      </td>
                    </tr>
                  </tbody>
                  <tbody v-else>
                    <tr>
                      <td :colspan="columns.length + (isMultiselect ? 1 : 0)">
                        <span class="widget-table__cell-value">Нет данных</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="widget-button confirm-modal-action confirm-modal-action--secondary"
              @click="closeModalFromCancel"
            >
              Отмена
            </button>
            <button
              type="button"
              class="widget-button confirm-modal-action"
              @click="applyModalSelection"
            >
              Выбрать
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
import useWidgetField from '../composables/useWidgetField.ts';
import {
  normalizeVocColumns,
  normalizeVocRows,
  parseVocDraft,
  serializeVocValues,
  type VocRow
} from '../../runtime/voc_contract.ts';
import {
  applyModalSelection as resolveAppliedModalSelection,
  commitMultiselectVocDraft,
  commitSingleVocDraft,
  formatVocRowLabel,
  hasVocValue,
  modalSortControlClass as resolveModalSortControlClass,
  moveModalActiveState,
  normalizeMultiVocValue,
  normalizeSingleVocValue,
  replaceVocDraftActiveToken,
  resolveHighlightedInlineIndex,
  resolveInlineQuery,
  resolveInputDisplayValue,
  resolveModalActiveState,
  resolveModalOpenState,
  resolveModalRows,
  toggleModalRowSelection,
  toggleModalSortState
} from './voc_value_core.ts';
import {
  closeDropdown as closeDropdownRuntime,
  focusInput,
  getInputElement as getInputElementRuntime,
  isFocusInsideWidget,
  listItemId as resolveListItemId,
  openDropdown as openDropdownRuntime,
  type VocDropdownRuntimeContext,
  type VocDropdownRuntimeRefs
} from './voc_dropdown_runtime.ts';
import {
  closeModal as closeModalRuntime,
  focusModalSearchInput,
  scrollModalActiveRowIntoView,
  setTableUiLocked as runtimeSetTableUiLocked,
  type VocModalRuntimeContext,
  type VocModalRuntimeRefs
} from './voc_modal_runtime.ts';
import {
  createVocWidgetState,
  type VocWidgetState
} from './voc_shared.ts';

type VocWidgetConfig = Record<string, unknown> & {
  columns?: unknown;
  label?: unknown;
  multiselect?: boolean;
  placeholder?: string;
  readonly?: boolean;
  source?: unknown;
  sup_text?: unknown;
  table_cell_mode?: boolean;
  table_cell_tab_handler?: unknown;
  table_cell_ui_lock_handler?: unknown;
  table_cell_validation_handler?: unknown;
  table_consume_keys?: unknown;
  value?: unknown;
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

type VocCommitContext = {
  kind?: string;
};

type VocCommitResult =
  | { status: 'noop' | 'committed' }
  | { error: unknown; severity: 'recoverable' | 'fatal'; status: 'blocked' };

defineOptions({
  name: 'VocWidget'
});

const props = defineProps<VocWidgetProps>();
const emit = defineEmits<VocWidgetEmit>();

const dropdownRoot = ref<HTMLElement | null>(null);
const dropdownToggle = ref<HTMLElement | null>(null);
const dropdownMenu = ref<HTMLElement | null>(null);
const modalRoot = ref<HTMLElement | null>(null);
const modalSearchInput = ref<HTMLInputElement | null>(null);

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
const inlineQuery = computed(() => resolveInlineQuery(state.inputValue, isMultiselect.value));
const inlineRows = computed(() => resolveModalRows(rows.value, inlineQuery.value, -1, ''));
const inputDisplayValue = computed(() =>
  resolveInputDisplayValue({
    isMultiselect: isMultiselect.value,
    isFocused: state.isFocused,
    isDraftEditing: isDraftEditing.value,
    inputValue: state.inputValue,
    value: state.value
  })
);
const listMenuId = computed(() => `voc-menu-${state.listId}`);
const highlightedId = computed(() =>
  state.highlightedIndex >= 0 && state.highlightedIndex < inlineRows.value.length
    ? listItemId(state.highlightedIndex)
    : null
);
const shouldShowInlineDropdown = computed(() =>
  state.isDropdownOpen && inlineRows.value.length > 0
);
const combinedFieldError = computed(() => state.vocError || fieldError.value || '');
const modalTitle = computed(() => {
  const label = String(props.widgetConfig.label || '').trim();
  return label || props.widgetName;
});
const modalRows = computed(() =>
  resolveModalRows(
    rows.value,
    state.modalSearch,
    state.modalSortColumn,
    state.modalSortDirection
  )
);
const modalSelectedRowIdSet = computed(() => new Set(state.modalSelectedRowIds));
const modalInlineStyle = computed(() => ({
  width: 'min(100%, 1100px)',
  maxWidth: 'min(1100px, 100%)',
  height: 'min(720px, calc(100vh - 2 * var(--space-md)))',
  maxHeight: 'min(720px, calc(100vh - 2 * var(--space-md)))'
}));
const modalBodyInnerStyle = computed(() => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
  minHeight: '0',
  padding: '0 20px 20px'
}));
const modalSearchInputStyle = computed(() => ({
  display: 'block',
  width: '100%',
  boxSizing: 'border-box'
}));
const modalTableWrapStyle = computed(() => ({
  minHeight: '0',
  width: '100%'
}));
const checkboxCellStyle = computed(() => ({
  width: '52px',
  minWidth: '52px'
}));

function getDropdownRefs(): VocDropdownRuntimeRefs {
  return {
    dropdownMenu: dropdownMenu.value,
    dropdownRoot: dropdownRoot.value,
    dropdownToggle: dropdownToggle.value,
    modalRoot: modalRoot.value
  };
}

function getModalRefs(): VocModalRuntimeRefs {
  return {
    modalRoot: modalRoot.value,
    modalSearchInput: modalSearchInput.value
  };
}

const dropdownRuntimeContext: VocDropdownRuntimeContext = {
  $nextTick: nextTick,
  get $refs() {
    return getDropdownRefs();
  },
  get _clickOutside() {
    return state._clickOutside;
  },
  set _clickOutside(value) {
    state._clickOutside = value;
  },
  get _clickOutsideTimerId() {
    return state._clickOutsideTimerId;
  },
  set _clickOutsideTimerId(value) {
    state._clickOutsideTimerId = value;
  },
  get _scrollUpdate() {
    return state._scrollUpdate;
  },
  set _scrollUpdate(value) {
    state._scrollUpdate = value;
  },
  get highlightedIndex() {
    return state.highlightedIndex;
  },
  set highlightedIndex(value) {
    state.highlightedIndex = Number(value) || 0;
  },
  get inlineRows() {
    return inlineRows.value;
  },
  get isDropdownOpen() {
    return state.isDropdownOpen;
  },
  set isDropdownOpen(value) {
    state.isDropdownOpen = Boolean(value);
  },
  get listId() {
    return state.listId;
  },
  get menuPosition() {
    return state.menuPosition;
  },
  set menuPosition(value) {
    state.menuPosition = value;
  },
  onOutsideInteractionCommit,
  resolveHighlightedIndex,
  get shouldShowInlineDropdown() {
    return shouldShowInlineDropdown.value;
  },
  get widgetConfig() {
    return props.widgetConfig;
  }
};

const modalRuntimeContext: VocModalRuntimeContext = {
  $nextTick: nextTick,
  get $refs() {
    return getModalRefs();
  },
  getInputElement,
  get isModalOpen() {
    return state.isModalOpen;
  },
  set isModalOpen(value) {
    state.isModalOpen = Boolean(value);
  },
  get modalActiveRowId() {
    return state.modalActiveRowId;
  },
  get widgetConfig() {
    return props.widgetConfig;
  }
};

const {
  highlightedIndex,
  inputValue,
  isDropdownOpen,
  isFocused,
  isModalOpen,
  menuPosition,
  modalActiveRowId,
  modalSearch,
  modalSelectedRowId,
  modalSelectedRowIds,
  modalSortColumn,
  modalSortDirection,
  singleDraftDirty,
  skipNextOutsideCommit,
  value,
  vocError
} = toRefs(state);

function listItemId(index: number): string {
  return resolveListItemId(dropdownRuntimeContext, Number(index));
}

function formatRowLabel(row: VocRow | null | undefined): string {
  return formatVocRowLabel(row || null);
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

function syncInputFromCommitted(): void {
  if (state.isFocused || isDraftEditing.value) {
    return;
  }
  state.inputValue = isMultiselect.value
    ? serializeVocValues(state.value)
    : String(state.value || '');
  if (!isMultiselect.value) {
    state.singleDraftDirty = false;
  }
}

function resolveHighlightedIndex(): number {
  return resolveHighlightedInlineIndex({
    isMultiselect: isMultiselect.value,
    inlineRows: inlineRows.value,
    value: state.value
  });
}

function setHighlightedIndex(index: number, options: { scroll?: boolean } = {}): void {
  const scroll = options.scroll !== false;
  const maxIndex = inlineRows.value.length - 1;
  const nextIndex =
    maxIndex < 0
      ? -1
      : Math.min(Math.max(Number(index) || 0, 0), maxIndex);
  state.highlightedIndex = nextIndex;
  if (scroll && nextIndex >= 0) {
    void nextTick(() => {
      const items = dropdownMenu.value?.querySelectorAll('[role="option"]');
      const option = items?.[nextIndex] || null;
      const element = option?.querySelector('.dropdown-item') || option;
      element?.scrollIntoView({ block: 'nearest' });
    });
  }
}

function moveHighlightedIndex(delta: number): void {
  const length = inlineRows.value.length;
  if (!length) {
    state.highlightedIndex = -1;
    return;
  }
  const step = Number(delta) || 0;
  const nextIndex =
    state.highlightedIndex < 0
      ? step > 0
        ? 0
        : length - 1
      : (state.highlightedIndex + step + length) % length;
  setHighlightedIndex(nextIndex);
}

function getInputElement(): HTMLInputElement | null {
  return getInputElementRuntime(dropdownRuntimeContext);
}

function onOutsideInteractionCommit(): void {
  if (state.isModalOpen) {
    return;
  }
  if (isMultiselect.value && state.skipNextOutsideCommit) {
    state.skipNextOutsideCommit = false;
    syncInputFromCommitted();
    closeDropdown();
    field.deactivateDraftController();
    return;
  }
  commitDraftMethod({ includeActiveToken: true, fromBlur: true });
  closeDropdown();
  field.deactivateDraftController();
}

function openDropdown(options: { highlightFirst?: boolean } = {}): void {
  openDropdownRuntime(dropdownRuntimeContext, options);
}

function closeDropdown(): void {
  closeDropdownRuntime(dropdownRuntimeContext);
}

function normalizeMultiselectDraftAndSync(options: {
  fromBlur?: boolean;
  includeActiveToken?: boolean;
} = {}) {
  const resolution = commitMultiselectVocDraft({
    rows: rows.value,
    value: state.value,
    inputValue: state.inputValue,
    includeActiveToken: options.includeActiveToken === true,
    fromBlur: options.fromBlur === true
  });

  state.value = resolution.nextValue;
  if (resolution.shouldEmit) {
    field.emitInput(resolution.nextValue.slice());
  }

  if (resolution.invalidMessage) {
    setVocError(resolution.invalidMessage);
  } else {
    clearVocError();
  }

  if (options.fromBlur === true) {
    state.inputValue = resolution.nextInputValue;
  }

  return resolution;
}

function commitDraftMethod(options: {
  fromBlur?: boolean;
  includeActiveToken?: boolean;
} = {}): void {
  if (isMultiselect.value) {
    normalizeMultiselectDraftAndSync({
      includeActiveToken: options.includeActiveToken === true,
      fromBlur: options.fromBlur === true
    });
    return;
  }

  const resolution = commitSingleVocDraft({
    rows: rows.value,
    inputValue: state.inputValue,
    value: state.value,
    draftDirty: state.singleDraftDirty
  });

  state.value = resolution.nextValue;
  state.inputValue = resolution.nextInputValue;
  state.singleDraftDirty = false;
  clearVocError();
  if (resolution.emit) {
    field.emitInput(resolution.emittedValue);
  }
}

function selectInlineRow(row: VocRow | null | undefined): void {
  const nextRow = row || null;
  if (!nextRow) {
    return;
  }
  if (isMultiselect.value) {
    state.inputValue = replaceVocDraftActiveToken(state.inputValue, nextRow.value);
    normalizeMultiselectDraftAndSync({
      includeActiveToken: false,
      fromBlur: false
    });
    closeDropdown();
    focusInput(dropdownRuntimeContext);
    return;
  }

  setSingleValue(nextRow.value, { forceSyncInput: true });
  clearVocError();
  field.emitInput(nextRow.value);
  closeDropdown();
  field.deactivateDraftController();
}

function onInputChange(event: Event): void {
  if (props.widgetConfig.readonly) {
    return;
  }
  field.activateDraftController();
  state.skipNextOutsideCommit = false;
  clearVocError();

  const target = event.target instanceof HTMLInputElement ? event.target : null;

  if (isMultiselect.value) {
    const rawValue = target?.value == null ? '' : String(target.value);
    state.inputValue = parseVocDraft(rawValue).normalizedText;
    normalizeMultiselectDraftAndSync({
      includeActiveToken: false,
      fromBlur: false
    });
    const query = resolveInlineQuery(state.inputValue, true);
    if (query.trim()) {
      openDropdown({ highlightFirst: true });
    } else {
      closeDropdown();
    }
    return;
  }

  state.inputValue = target?.value == null ? '' : String(target.value);
  state.singleDraftDirty = true;
  if (!state.isDropdownOpen) {
    openDropdown({ highlightFirst: true });
    return;
  }
  setHighlightedIndex(inlineRows.value.length > 0 ? 0 : -1);
}

function onInputFocus(): void {
  state.isFocused = true;
  field.activateDraftController();
  clearVocError();
  if (isMultiselect.value) {
    state.inputValue = state.inputValue !== ''
      ? state.inputValue
      : serializeVocValues(state.value);
    return;
  }
  state.inputValue = String(state.value || '');
}

function onInputBlur(): void {
  state.isFocused = false;
  window.setTimeout(() => {
    if (isFocusInsideWidget(dropdownRuntimeContext)) {
      return;
    }
    onOutsideInteractionCommit();
  }, 150);
}

function onWidgetFocusOut(): void {
  window.setTimeout(() => {
    if (isFocusInsideWidget(dropdownRuntimeContext)) {
      return;
    }
    onOutsideInteractionCommit();
  }, 0);
}

function onInputKeydown(event: KeyboardEvent): void {
  if (props.widgetConfig.readonly) {
    return;
  }

  if (event.key === 'Tab') {
    const tabHandler = props.widgetConfig.table_cell_tab_handler;
    if (tableCellMode.value && typeof tabHandler === 'function') {
      event.preventDefault();
      closeDropdown();
      tabHandler(!!event.shiftKey);
      return;
    }
  }

  const shouldOpenModal =
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.key === 'ArrowDown';
  if (shouldOpenModal) {
    event.preventDefault();
    openModal();
    return;
  }

  if (event.key === 'Enter' && !state.isDropdownOpen) {
    event.preventDefault();
    openDropdown({ highlightFirst: true });
    return;
  }

  if (state.isDropdownOpen) {
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
      const row =
        state.highlightedIndex >= 0 && state.highlightedIndex < inlineRows.value.length
          ? inlineRows.value[state.highlightedIndex]
          : null;
      if (row) {
        selectInlineRow(row);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
      focusInput(dropdownRuntimeContext);
    }
  }
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (!shouldShowInlineDropdown.value) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveHighlightedIndex(1);
    focusInput(dropdownRuntimeContext);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveHighlightedIndex(-1);
    focusInput(dropdownRuntimeContext);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const row =
      state.highlightedIndex >= 0 && state.highlightedIndex < inlineRows.value.length
        ? inlineRows.value[state.highlightedIndex]
        : null;
    if (row) {
      selectInlineRow(row);
    }
    focusInput(dropdownRuntimeContext);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDropdown();
    focusInput(dropdownRuntimeContext);
  }
}

function onArrowClick(): void {
  if (props.widgetConfig.readonly) {
    return;
  }
  focusInput(dropdownRuntimeContext);
  openModal();
}

function setTableUiLocked(locked: boolean): void {
  runtimeSetTableUiLocked(modalRuntimeContext, Boolean(locked));
}

function openModal(): void {
  if (props.widgetConfig.readonly) {
    return;
  }
  state.skipNextOutsideCommit = false;
  closeDropdown();
  clearVocError();
  state.isModalOpen = true;
  setTableUiLocked(true);
  state.modalSortColumn = -1;
  state.modalSortDirection = '';

  const nextState = resolveModalOpenState({
    isMultiselect: isMultiselect.value,
    rows: rows.value,
    value: state.value,
    inputValue: state.inputValue
  });
  state.modalSearch = nextState.modalSearch;
  state.modalSelectedRowIds = nextState.modalSelectedRowIds;
  state.modalSelectedRowId = nextState.modalSelectedRowId;

  void nextTick(() => {
    syncModalActiveRow();
    focusModalSearchInput(modalRuntimeContext);
  });
}

function closeModal(options: { restoreFocus?: boolean } = {}): void {
  closeModalRuntime(modalRuntimeContext, options);
}

function closeModalFromCancel(): void {
  closeModal({ restoreFocus: true });
}

function applyModalSelection(): void {
  const selection = resolveAppliedModalSelection({
    isMultiselect: isMultiselect.value,
    rows: rows.value,
    modalSelectedRowIds: state.modalSelectedRowIds,
    modalSelectedRowId: state.modalSelectedRowId,
    modalActiveRowId: state.modalActiveRowId
  });

  if (isMultiselect.value) {
    setMultiValue(selection.nextValue);
    state.skipNextOutsideCommit = true;
    clearVocError();
    closeModal({ restoreFocus: true });
    field.emitInput(selection.emittedValue);
    return;
  }

  if (selection.shouldEmit) {
    setSingleValue(selection.nextValue, { forceSyncInput: true });
    clearVocError();
    closeModal({ restoreFocus: true });
    field.emitInput(selection.emittedValue);
    return;
  }

  closeModal({ restoreFocus: true });
}

function modalRowStyle(_row?: VocRow | null): Record<string, string> {
  return {
    cursor: 'pointer'
  };
}

function modalCellStyle(
  row: VocRow | null | undefined,
  baseStyle: Record<string, string> | null = null
): Record<string, string> {
  const style = { ...(baseStyle || {}) };
  const isActive = isModalRowActive(row);
  const isSelected = isModalRowSelected(row);

  if (!isActive && !isSelected) {
    return style;
  }

  style.backgroundColor = isActive
    ? 'var(--color-dropdown-active)'
    : 'var(--color-table-hover)';

  if (isActive) {
    style.boxShadow = 'inset 0 2px 0 0 var(--color-text-main), inset 0 -2px 0 0 var(--color-text-main)';
  }

  return style;
}

function modalSortControlClass(columnIndex: number): Record<string, boolean> {
  return resolveModalSortControlClass(
    state.modalSortColumn,
    state.modalSortDirection,
    Number(columnIndex)
  );
}

function toggleModalSort(columnIndex: number): void {
  const nextState = toggleModalSortState(
    state.modalSortColumn,
    state.modalSortDirection,
    Number(columnIndex)
  );
  state.modalSortColumn = nextState.modalSortColumn;
  state.modalSortDirection = nextState.modalSortDirection;
  void nextTick(() => syncModalActiveRow());
}

function isModalRowSelected(row: VocRow | null | undefined): boolean {
  const nextRow = row || null;
  if (!nextRow) {
    return false;
  }
  if (isMultiselect.value) {
    return modalSelectedRowIdSet.value.has(nextRow.id);
  }
  return state.modalSelectedRowId === nextRow.id;
}

function isModalRowActive(row: VocRow | null | undefined): boolean {
  const nextRow = row || null;
  return !!(nextRow && state.modalActiveRowId === nextRow.id);
}

function toggleModalRow(row: VocRow): void {
  const nextState = toggleModalRowSelection({
    isMultiselect: isMultiselect.value,
    modalSelectedRowIds: state.modalSelectedRowIds,
    modalSelectedRowId: state.modalSelectedRowId,
    row
  });
  state.modalSelectedRowIds = nextState.modalSelectedRowIds;
  state.modalSelectedRowId = nextState.modalSelectedRowId;
  state.modalActiveRowId = nextState.modalActiveRowId;
}

function onModalRowClick(row: VocRow | null | undefined): void {
  const nextRow = row || null;
  if (!nextRow) {
    return;
  }
  if (isMultiselect.value) {
    toggleModalRow(nextRow);
    return;
  }
  state.modalSelectedRowId = nextRow.id;
  state.modalActiveRowId = nextRow.id;
}

function onModalRowDoubleClick(row: VocRow | null | undefined): void {
  onModalRowClick(row || null);
  if (!isMultiselect.value) {
    applyModalSelection();
  }
}

function onModalSearchInput(event: Event): void {
  const target = event.target instanceof HTMLInputElement ? event.target : null;
  state.modalSearch = target?.value == null ? '' : String(target.value);
}

function syncModalActiveRow(): void {
  const nextState = resolveModalActiveState({
    visibleRows: modalRows.value,
    isMultiselect: isMultiselect.value,
    modalActiveRowId: state.modalActiveRowId,
    modalSelectedRowId: state.modalSelectedRowId,
    modalSelectedRowIds: state.modalSelectedRowIds
  });
  state.modalActiveRowId = nextState.modalActiveRowId;
  state.modalSelectedRowId = nextState.modalSelectedRowId;
  void nextTick(() => scrollModalActiveRowIntoView(modalRuntimeContext));
}

function moveModalActiveRow(delta: number): void {
  const nextState = moveModalActiveState({
    visibleRows: modalRows.value,
    isMultiselect: isMultiselect.value,
    modalActiveRowId: state.modalActiveRowId,
    modalSelectedRowId: state.modalSelectedRowId,
    delta: Number(delta) || 0
  });
  state.modalActiveRowId = nextState.modalActiveRowId;
  state.modalSelectedRowId = nextState.modalSelectedRowId;
  void nextTick(() => scrollModalActiveRowIntoView(modalRuntimeContext));
}

function onModalKeydown(event: KeyboardEvent): void {
  if (!state.isModalOpen) {
    return;
  }

  const targetTag = String((event.target as HTMLElement | null)?.tagName || '').toUpperCase();
  if (targetTag === 'BUTTON' && event.key === 'Enter') {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeModalFromCancel();
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveModalActiveRow(1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveModalActiveRow(-1);
    return;
  }
  if (event.key === 'Enter') {
    const activeRow =
      modalRows.value.find((row) => row.id === state.modalActiveRowId) || null;
    if (!activeRow) {
      return;
    }
    event.preventDefault();
    if (isMultiselect.value) {
      toggleModalRow(activeRow);
      return;
    }
    state.modalSelectedRowId = activeRow.id;
    state.modalActiveRowId = activeRow.id;
    applyModalSelection();
  }
}

function commitDraft(options?: { fromBlur?: boolean; includeActiveToken?: boolean }): VocCommitResult {
  commitDraftMethod(options);
  return { status: 'committed' };
}

function commitPendingState(context: VocCommitContext = {}): VocCommitResult {
  if (!isDraftEditing.value) {
    return { status: 'noop' };
  }

  if (isMultiselect.value) {
    commitDraftMethod({ includeActiveToken: true, fromBlur: true });
  } else {
    commitDraftMethod();
  }

  const message = String(combinedFieldError.value || '').trim();
  if (message && context.kind) {
    return {
      status: 'blocked',
      severity: 'recoverable',
      error: new Error(message)
    };
  }

  return { status: 'committed' };
}

watch(
  () => props.widgetConfig.value,
  (nextValue) => {
    if (nextValue === undefined) {
      return;
    }
    field.syncCommittedValue(nextValue, (value) => setValue(value));
  },
  { immediate: true }
);

watch(inlineRows, () => {
  if (inlineRows.value.length === 0) {
    state.highlightedIndex = -1;
    return;
  }
  if (state.highlightedIndex >= inlineRows.value.length) {
    setHighlightedIndex(0, { scroll: false });
  }
});

watch(modalRows, () => {
  if (!state.isModalOpen) {
    return;
  }
  syncModalActiveRow();
});

onBeforeUnmount(() => {
  closeDropdown();
  if (state.isModalOpen) {
    setTableUiLocked(false);
  }
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
