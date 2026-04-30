import { computed, type ComputedRef, type Ref } from 'vue';
import {
  parseVocDraft,
  serializeVocValues,
  type VocRow
} from '../../runtime/voc_contract.ts';
import {
  commitMultiselectVocDraft,
  commitSingleVocDraft,
  replaceVocDraftActiveToken,
  resolveHighlightedInlineIndex,
  resolveInlineQuery,
  resolveInputDisplayValue,
  resolveModalRows
} from './voc_value_core.ts';
import { handleDropdownTableCellTab } from '../dropdown/dropdown_runtime.ts';
import type { VocWidgetState } from './voc_shared.ts';
import {
  createLifecycleBlockedResult,
  type LifecycleCommitContext,
  type LifecycleCommitResult
} from '../../shared/lifecycle_commit.ts';

type VocCommitContext = LifecycleCommitContext;
type VocCommitResult = LifecycleCommitResult;

type VocInlineWidgetConfig = {
  readonly?: boolean;
  table_cell_tab_handler?: unknown;
};

type SetSingleValueOptions = {
  forceSyncInput?: boolean;
};

type OpenDropdownOptions = {
  highlightFirst?: boolean;
};

type ScheduleOutsideCommitOptions = {
  delay?: number;
};

type UseVocInlineDropdownOptions = {
  combinedFieldError: ComputedRef<string>;
  isDraftEditing: Ref<boolean>;
  isMultiselect: ComputedRef<boolean>;
  rows: ComputedRef<VocRow[]>;
  state: VocWidgetState;
  tableCellMode: ComputedRef<boolean>;
  widgetConfig: VocInlineWidgetConfig;
  activateDraftController(): void;
  clearVocError(): void;
  closeDropdown(): void;
  deactivateDraftController(): void;
  emitInput(value: unknown): void;
  focusInput(): void;
  moveHighlightedIndex(delta: number): void;
  openDropdown(options?: OpenDropdownOptions): void;
  openModal(): void;
  scheduleOutsideCommit(options?: ScheduleOutsideCommitOptions): void;
  setHighlightedIndex(index: number, options?: { scroll?: boolean }): void;
  setSingleValue(value: unknown, options?: SetSingleValueOptions): void;
  setVocError(message: string): void;
};

function useVocInlineDropdown(options: UseVocInlineDropdownOptions) {
  const inlineQuery = computed(() =>
    resolveInlineQuery(options.state.inputValue, options.isMultiselect.value)
  );
  const inlineRows = computed(() =>
    resolveModalRows(options.rows.value, inlineQuery.value, -1, '')
  );
  const inputDisplayValue = computed(() =>
    resolveInputDisplayValue({
      isMultiselect: options.isMultiselect.value,
      isFocused: options.state.isFocused,
      isDraftEditing: options.isDraftEditing.value,
      inputValue: options.state.inputValue,
      value: options.state.value
    })
  );
  const shouldShowInlineDropdown = computed(() =>
    options.state.isDropdownOpen && inlineRows.value.length > 0
  );

  function resolveHighlightedIndex(): number {
    return resolveHighlightedInlineIndex({
      isMultiselect: options.isMultiselect.value,
      inlineRows: inlineRows.value,
      value: options.state.value
    });
  }

  function getHighlightedInlineRow(): VocRow | null {
    return options.state.highlightedIndex >= 0
      && options.state.highlightedIndex < inlineRows.value.length
      ? inlineRows.value[options.state.highlightedIndex]
      : null;
  }

  function syncInputFromCommitted(): void {
    if (options.state.isFocused || options.isDraftEditing.value) {
      return;
    }
    options.state.inputValue = options.isMultiselect.value
      ? serializeVocValues(options.state.value)
      : String(options.state.value || '');
    if (!options.isMultiselect.value) {
      options.state.singleDraftDirty = false;
    }
  }

  function normalizeMultiselectDraftAndSync(commitOptions: {
    fromBlur?: boolean;
    includeActiveToken?: boolean;
  } = {}) {
    const resolution = commitMultiselectVocDraft({
      rows: options.rows.value,
      value: options.state.value,
      inputValue: options.state.inputValue,
      includeActiveToken: commitOptions.includeActiveToken === true,
      fromBlur: commitOptions.fromBlur === true
    });
    options.state.value = resolution.nextValue;
    if (resolution.shouldEmit) {
      options.emitInput(resolution.nextValue.slice());
    }
    if (resolution.invalidMessage) {
      options.setVocError(resolution.invalidMessage);
    } else {
      options.clearVocError();
    }
    if (commitOptions.fromBlur === true) {
      options.state.inputValue = resolution.nextInputValue;
    }
    return resolution;
  }

  function commitDraftMethod(commitOptions: {
    fromBlur?: boolean;
    includeActiveToken?: boolean;
  } = {}): void {
    if (options.isMultiselect.value) {
      normalizeMultiselectDraftAndSync({
        includeActiveToken: commitOptions.includeActiveToken === true,
        fromBlur: commitOptions.fromBlur === true
      });
      return;
    }
    const resolution = commitSingleVocDraft({
      rows: options.rows.value,
      inputValue: options.state.inputValue,
      value: options.state.value,
      draftDirty: options.state.singleDraftDirty
    });
    options.state.value = resolution.nextValue;
    options.state.inputValue = resolution.nextInputValue;
    options.state.singleDraftDirty = false;
    options.clearVocError();
    if (resolution.emit) {
      options.emitInput(resolution.emittedValue);
    }
  }

  function onOutsideInteractionCommit(): void {
    if (options.state.isModalOpen) {
      return;
    }
    if (options.isMultiselect.value && options.state.skipNextOutsideCommit) {
      options.state.skipNextOutsideCommit = false;
      syncInputFromCommitted();
      options.closeDropdown();
      options.deactivateDraftController();
      return;
    }
    commitDraftMethod({ includeActiveToken: true, fromBlur: true });
    options.closeDropdown();
    options.deactivateDraftController();
  }

  function selectInlineRow(row: VocRow | null | undefined): void {
    const nextRow = row || null;
    if (!nextRow) {
      return;
    }
    if (options.isMultiselect.value) {
      options.state.inputValue = replaceVocDraftActiveToken(options.state.inputValue, nextRow.value);
      normalizeMultiselectDraftAndSync({
        includeActiveToken: false,
        fromBlur: false
      });
      options.closeDropdown();
      options.focusInput();
      return;
    }
    options.setSingleValue(nextRow.value, { forceSyncInput: true });
    options.clearVocError();
    options.emitInput(nextRow.value);
    options.closeDropdown();
    options.deactivateDraftController();
  }

  function onInputChange(event: Event): void {
    if (options.widgetConfig.readonly) {
      return;
    }
    options.activateDraftController();
    options.state.skipNextOutsideCommit = false;
    options.clearVocError();
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    if (options.isMultiselect.value) {
      const rawValue = target?.value == null ? '' : String(target.value);
      options.state.inputValue = parseVocDraft(rawValue).normalizedText;
      normalizeMultiselectDraftAndSync({
        includeActiveToken: false,
        fromBlur: false
      });
      const query = resolveInlineQuery(options.state.inputValue, true);
      if (query.trim()) {
        options.openDropdown({ highlightFirst: true });
      } else {
        options.closeDropdown();
      }
      return;
    }
    options.state.inputValue = target?.value == null ? '' : String(target.value);
    options.state.singleDraftDirty = true;
    if (!options.state.isDropdownOpen) {
      options.openDropdown({ highlightFirst: true });
      return;
    }
    options.setHighlightedIndex(inlineRows.value.length > 0 ? 0 : -1);
  }

  function onInputFocus(): void {
    options.state.isFocused = true;
    options.activateDraftController();
    options.clearVocError();
    if (options.isMultiselect.value) {
      options.state.inputValue = options.state.inputValue !== ''
        ? options.state.inputValue
        : serializeVocValues(options.state.value);
      return;
    }
    options.state.inputValue = String(options.state.value || '');
  }

  function onInputBlur(): void {
    options.state.isFocused = false;
    options.scheduleOutsideCommit({ delay: 150 });
  }

  function onWidgetFocusOut(): void {
    options.scheduleOutsideCommit();
  }

  function maybeHandleTableTab(event: KeyboardEvent): boolean {
    return handleDropdownTableCellTab(event, {
      closeDropdown: options.closeDropdown,
      tableCellMode: options.tableCellMode.value,
      tabHandler: options.widgetConfig.table_cell_tab_handler
    });
  }

  function onInputKeydown(event: KeyboardEvent): void {
    if (options.widgetConfig.readonly) {
      return;
    }
    if (maybeHandleTableTab(event)) {
      return;
    }
    const shouldOpenModal =
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.key === 'ArrowDown';
    if (shouldOpenModal) {
      event.preventDefault();
      options.openModal();
      return;
    }
    if (event.key === 'Enter' && !options.state.isDropdownOpen) {
      event.preventDefault();
      options.openDropdown({ highlightFirst: true });
      return;
    }
    if (options.state.isDropdownOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        options.moveHighlightedIndex(1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        options.moveHighlightedIndex(-1);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        selectInlineRow(getHighlightedInlineRow());
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        options.closeDropdown();
        options.focusInput();
      }
    }
  }

  function onMenuKeydown(event: KeyboardEvent): void {
    if (!shouldShowInlineDropdown.value) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options.moveHighlightedIndex(1);
      options.focusInput();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      options.moveHighlightedIndex(-1);
      options.focusInput();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      selectInlineRow(getHighlightedInlineRow());
      options.focusInput();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      options.closeDropdown();
      options.focusInput();
    }
  }

  function commitDraft(commitOptions?: { fromBlur?: boolean; includeActiveToken?: boolean }): VocCommitResult {
    commitDraftMethod(commitOptions);
    return { status: 'committed' };
  }

  function commitPendingState(context: VocCommitContext = {}): VocCommitResult {
    if (!options.isDraftEditing.value) {
      return { status: 'noop' };
    }
    if (options.isMultiselect.value) {
      commitDraftMethod({ includeActiveToken: true, fromBlur: true });
    } else {
      commitDraftMethod();
    }
    const message = String(options.combinedFieldError.value || '').trim();
    if (message && context.kind) {
      return createLifecycleBlockedResult(new Error(message), 'recoverable');
    }
    return { status: 'committed' };
  }

  return {
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
  };
}

export {
  useVocInlineDropdown
};
