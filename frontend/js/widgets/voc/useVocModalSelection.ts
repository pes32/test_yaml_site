import { computed, nextTick, onBeforeUnmount, watch, type ComputedRef } from 'vue';
import type { VocRow } from '../../runtime/voc_contract.ts';
import {
  applyModalSelection as resolveAppliedModalSelection,
  modalSortControlClass as resolveModalSortControlClass,
  moveModalActiveState,
  resolveModalActiveState,
  resolveModalOpenState,
  resolveModalRows,
  toggleModalRowSelection,
  toggleModalSortState
} from './voc_value_core.ts';
import {
  closeModal as closeModalRuntime,
  focusModalSearchInput,
  scrollModalActiveRowIntoView,
  setTableUiLocked as runtimeSetTableUiLocked,
  type VocModalRuntimeContext,
  type VocModalRuntimeRefs
} from './voc_modal_runtime.ts';
import type { VocWidgetState } from './voc_shared.ts';

type VocModalTableSurface = {
  modalRoot: HTMLElement | null;
  modalSearchInput: HTMLInputElement | null;
};

type VocModalWidgetConfig = {
  readonly?: boolean;
  table_cell_ui_lock_handler?: unknown;
};

type SetSingleValueOptions = {
  forceSyncInput?: boolean;
};

type UseVocModalSelectionOptions = {
  isMultiselect: ComputedRef<boolean>;
  rows: ComputedRef<VocRow[]>;
  state: VocWidgetState;
  widgetConfig: VocModalWidgetConfig;
  clearVocError(): void;
  closeDropdown(): void;
  emitInput(value: unknown): void;
  getInputElement(): HTMLElement | HTMLInputElement | null;
  getModalTable(): VocModalTableSurface | null;
  setMultiValue(value: unknown): void;
  setSingleValue(value: unknown, options?: SetSingleValueOptions): void;
};

function useVocModalSelection(options: UseVocModalSelectionOptions) {
  const modalRows = computed(() =>
    resolveModalRows(
      options.rows.value,
      options.state.modalSearch,
      options.state.modalSortColumn,
      options.state.modalSortDirection
    )
  );
  const modalSelectedRowIdSet = computed(() => new Set(options.state.modalSelectedRowIds));

  function getModalRefs(): VocModalRuntimeRefs {
    const modalTable = options.getModalTable();
    return {
      modalRoot: modalTable?.modalRoot || null,
      modalSearchInput: modalTable?.modalSearchInput || null
    };
  }

  const modalRuntimeContext: VocModalRuntimeContext = {
    $nextTick: nextTick,
    get $refs() {
      return getModalRefs();
    },
    getInputElement: options.getInputElement,
    get isModalOpen() {
      return options.state.isModalOpen;
    },
    set isModalOpen(value) {
      options.state.isModalOpen = Boolean(value);
    },
    get modalActiveRowId() {
      return options.state.modalActiveRowId;
    },
    get widgetConfig() {
      return options.widgetConfig;
    }
  };

  function setTableUiLocked(locked: boolean): void {
    runtimeSetTableUiLocked(modalRuntimeContext, Boolean(locked));
  }

  function syncModalActiveRow(): void {
    const nextState = resolveModalActiveState({
      visibleRows: modalRows.value,
      isMultiselect: options.isMultiselect.value,
      modalActiveRowId: options.state.modalActiveRowId,
      modalSelectedRowId: options.state.modalSelectedRowId,
      modalSelectedRowIds: options.state.modalSelectedRowIds
    });
    options.state.modalActiveRowId = nextState.modalActiveRowId;
    options.state.modalSelectedRowId = nextState.modalSelectedRowId;
    void nextTick(() => scrollModalActiveRowIntoView(modalRuntimeContext));
  }

  function openModal(): void {
    if (options.widgetConfig.readonly) {
      return;
    }
    options.state.skipNextOutsideCommit = false;
    options.closeDropdown();
    options.clearVocError();
    options.state.isModalOpen = true;
    setTableUiLocked(true);
    options.state.modalSortColumn = -1;
    options.state.modalSortDirection = '';
    const nextState = resolveModalOpenState({
      isMultiselect: options.isMultiselect.value,
      rows: options.rows.value,
      value: options.state.value,
      inputValue: options.state.inputValue
    });
    options.state.modalSearch = nextState.modalSearch;
    options.state.modalSelectedRowIds = nextState.modalSelectedRowIds;
    options.state.modalSelectedRowId = nextState.modalSelectedRowId;
    void nextTick(() => {
      syncModalActiveRow();
      focusModalSearchInput(modalRuntimeContext);
    });
  }

  function closeModal(closeOptions: { restoreFocus?: boolean } = {}): void {
    closeModalRuntime(modalRuntimeContext, closeOptions);
  }

  function closeModalFromCancel(): void {
    closeModal({ restoreFocus: true });
  }

  function applyModalSelection(): void {
    const selection = resolveAppliedModalSelection({
      isMultiselect: options.isMultiselect.value,
      rows: options.rows.value,
      modalSelectedRowIds: options.state.modalSelectedRowIds,
      modalSelectedRowId: options.state.modalSelectedRowId,
      modalActiveRowId: options.state.modalActiveRowId
    });
    if (options.isMultiselect.value) {
      options.setMultiValue(selection.nextValue);
      options.state.skipNextOutsideCommit = true;
      options.clearVocError();
      closeModal({ restoreFocus: true });
      options.emitInput(selection.emittedValue);
      return;
    }
    if (selection.shouldEmit) {
      options.setSingleValue(selection.nextValue, { forceSyncInput: true });
      options.clearVocError();
      closeModal({ restoreFocus: true });
      options.emitInput(selection.emittedValue);
      return;
    }
    closeModal({ restoreFocus: true });
  }

  function isModalRowSelected(row: VocRow | null | undefined): boolean {
    const nextRow = row || null;
    if (!nextRow) {
      return false;
    }
    if (options.isMultiselect.value) {
      return modalSelectedRowIdSet.value.has(nextRow.id);
    }
    return options.state.modalSelectedRowId === nextRow.id;
  }

  function isModalRowActive(row: VocRow | null | undefined): boolean {
    const nextRow = row || null;
    return !!(nextRow && options.state.modalActiveRowId === nextRow.id);
  }

  function modalCellClass(row: VocRow | null | undefined): Record<string, boolean> {
    const isActive = isModalRowActive(row);
    const isSelected = isModalRowSelected(row);
    return {
      'voc-modal-cell--active': isActive,
      'voc-modal-cell--selected': !isActive && isSelected
    };
  }

  function modalSortControlClass(columnIndex: number): Record<string, boolean> {
    return resolveModalSortControlClass(
      options.state.modalSortColumn,
      options.state.modalSortDirection,
      Number(columnIndex)
    );
  }

  function toggleModalSort(columnIndex: number): void {
    const nextState = toggleModalSortState(
      options.state.modalSortColumn,
      options.state.modalSortDirection,
      Number(columnIndex)
    );
    options.state.modalSortColumn = nextState.modalSortColumn;
    options.state.modalSortDirection = nextState.modalSortDirection;
    void nextTick(() => syncModalActiveRow());
  }

  function toggleModalRow(row: VocRow): void {
    const nextState = toggleModalRowSelection({
      isMultiselect: options.isMultiselect.value,
      modalSelectedRowIds: options.state.modalSelectedRowIds,
      modalSelectedRowId: options.state.modalSelectedRowId,
      row
    });
    options.state.modalSelectedRowIds = nextState.modalSelectedRowIds;
    options.state.modalSelectedRowId = nextState.modalSelectedRowId;
    options.state.modalActiveRowId = nextState.modalActiveRowId;
  }

  function onModalRowClick(row: VocRow | null | undefined): void {
    const nextRow = row || null;
    if (!nextRow) {
      return;
    }
    if (options.isMultiselect.value) {
      toggleModalRow(nextRow);
      return;
    }
    options.state.modalSelectedRowId = nextRow.id;
    options.state.modalActiveRowId = nextRow.id;
  }

  function onModalRowDoubleClick(row: VocRow | null | undefined): void {
    onModalRowClick(row || null);
    if (!options.isMultiselect.value) {
      applyModalSelection();
    }
  }

  function onModalSearchInput(value: string): void {
    options.state.modalSearch = value;
  }

  function moveModalActiveRow(delta: number): void {
    const nextState = moveModalActiveState({
      visibleRows: modalRows.value,
      isMultiselect: options.isMultiselect.value,
      modalActiveRowId: options.state.modalActiveRowId,
      modalSelectedRowId: options.state.modalSelectedRowId,
      delta: Number(delta) || 0
    });
    options.state.modalActiveRowId = nextState.modalActiveRowId;
    options.state.modalSelectedRowId = nextState.modalSelectedRowId;
    void nextTick(() => scrollModalActiveRowIntoView(modalRuntimeContext));
  }

  function onModalKeydown(event: KeyboardEvent): void {
    if (!options.state.isModalOpen) {
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
        modalRows.value.find((row) => row.id === options.state.modalActiveRowId) || null;
      if (!activeRow) {
        return;
      }
      event.preventDefault();
      if (options.isMultiselect.value) {
        toggleModalRow(activeRow);
        return;
      }
      options.state.modalSelectedRowId = activeRow.id;
      options.state.modalActiveRowId = activeRow.id;
      applyModalSelection();
    }
  }

  watch(modalRows, () => {
    if (!options.state.isModalOpen) {
      return;
    }
    syncModalActiveRow();
  });

  onBeforeUnmount(() => {
    if (options.state.isModalOpen) {
      setTableUiLocked(false);
    }
  });

  return {
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
  };
}

export type {
  VocModalTableSurface
};

export {
  useVocModalSelection
};
