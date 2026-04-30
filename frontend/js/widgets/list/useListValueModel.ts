import { ref, type ComputedRef, type Ref } from 'vue';
import type { NormalizedListOption } from '../../runtime/widget_contract.ts';
import type { LifecycleCommitResult } from '../../shared/lifecycle_commit.ts';

type ListCommitResult = LifecycleCommitResult;

type ListValue = string | string[];

type ListOptionSelectionResult = {
  closeDropdown: boolean;
  deactivateDraft: boolean;
};

type UseListValueModelOptions = {
  isDraftEditing: Ref<boolean>;
  isEditable: ComputedRef<boolean>;
  isMultiselect: ComputedRef<boolean>;
  listOptions: ComputedRef<NormalizedListOption[]>;
  emitInput(value: unknown): void;
  getFilteredOptions(): NormalizedListOption[];
};

function normalizeSingleValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value[0] == null ? '' : String(value[0]);
  }
  return value == null ? '' : String(value);
}

function normalizeMultiValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? ''))
    : [];
}

function optionIndexById(
  options: readonly NormalizedListOption[],
  optionId: unknown
): number {
  return options.findIndex((option) => option.id === optionId);
}

function findOptionById(
  options: readonly NormalizedListOption[],
  optionId: unknown
): NormalizedListOption | null {
  const index = optionIndexById(options, optionId);
  return index >= 0 ? options[index] : null;
}

function findOptionByValue(
  options: readonly NormalizedListOption[],
  rawValue: unknown
): NormalizedListOption | null {
  const normalized = String(rawValue ?? '');
  return options.find((option) => option.value === normalized) || null;
}

function useListValueModel(options: UseListValueModelOptions) {
  const value = ref<ListValue>('');
  const inputValue = ref('');
  const lastSelectedOptionId = ref('');

  function getOptionByValue(
    rawValue: unknown,
    sourceOptions: readonly NormalizedListOption[] = options.listOptions.value
  ): NormalizedListOption | null {
    return findOptionByValue(sourceOptions, rawValue);
  }

  function getOptionById(
    optionId: unknown,
    sourceOptions: readonly NormalizedListOption[] = options.listOptions.value
  ): NormalizedListOption | null {
    return findOptionById(sourceOptions, optionId);
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
    if (!options.isMultiselect.value || !Array.isArray(value.value)) {
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
    const matchedOption = options.listOptions.value.find((option) =>
      option.label === draft || option.value === draft
    );
    return matchedOption ? matchedOption.value : draft;
  }

  function setSingleValue(nextValue: unknown): void {
    value.value = normalizeSingleValue(nextValue);
    if (!options.isDraftEditing.value) {
      inputValue.value = getOptionLabelByValue(value.value);
    }
  }

  function setMultiValue(nextValue: unknown): void {
    value.value = normalizeMultiValue(nextValue);
  }

  function setValue(nextValue: unknown): void {
    if (options.isMultiselect.value) {
      setMultiValue(nextValue);
      return;
    }
    setSingleValue(nextValue);
  }

  function syncInputDraftFromCommittedValue(): void {
    if (options.isMultiselect.value || options.isDraftEditing.value) {
      return;
    }
    inputValue.value = getOptionLabelByValue(value.value);
  }

  function resolveHighlightedIndex(): number {
    const filteredOptions = options.getFilteredOptions();
    if (options.isMultiselect.value) {
      const anchorOption = getOptionById(lastSelectedOptionId.value, filteredOptions);
      return anchorOption
        ? optionIndexById(filteredOptions, anchorOption.id)
        : -1;
    }

    const selectedOption = getOptionByValue(value.value, filteredOptions);
    return selectedOption
      ? optionIndexById(filteredOptions, selectedOption.id)
      : -1;
  }

  function getCurrentHighlightedOption(highlightedIndex: number): NormalizedListOption | null {
    const sourceOptions = options.getFilteredOptions();
    if (highlightedIndex >= 0 && highlightedIndex < sourceOptions.length) {
      return sourceOptions[highlightedIndex];
    }

    const resolvedIndex = resolveHighlightedIndex();
    return resolvedIndex >= 0 && resolvedIndex < sourceOptions.length
      ? sourceOptions[resolvedIndex]
      : null;
  }

  function buildNextMultiValue(
    option: NormalizedListOption,
    event?: MouseEvent | KeyboardEvent
  ): string[] {
    const currentValues = Array.isArray(value.value) ? [...value.value] : [];
    if (event?.shiftKey && lastSelectedOptionId.value) {
      const anchorIndex = optionIndexById(options.listOptions.value, lastSelectedOptionId.value);
      const currentIndex = optionIndexById(options.listOptions.value, option.id);
      if (anchorIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(anchorIndex, currentIndex);
        const end = Math.max(anchorIndex, currentIndex);
        const nextValues = [...currentValues];
        for (let index = start; index <= end; index += 1) {
          const rangeOption = options.listOptions.value[index];
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
  ): ListOptionSelectionResult {
    if (!option) {
      return { closeDropdown: false, deactivateDraft: false };
    }

    if (options.isMultiselect.value) {
      const nextValue = buildNextMultiValue(option, event);
      value.value = nextValue;
      lastSelectedOptionId.value = option.id;
      options.emitInput(nextValue.slice());
      return { closeDropdown: false, deactivateDraft: false };
    }

    const nextValue = value.value === option.value ? '' : option.value;
    value.value = nextValue;
    inputValue.value = getOptionLabelByValue(nextValue);
    lastSelectedOptionId.value = option.id;
    options.emitInput(nextValue);
    return { closeDropdown: true, deactivateDraft: true };
  }

  function isOptionSelected(option: NormalizedListOption | null | undefined): boolean {
    if (!option) {
      return false;
    }
    if (options.isMultiselect.value) {
      return Array.isArray(value.value) && value.value.includes(option.value);
    }
    return value.value === option.value;
  }

  function removeLastSelected(): void {
    if (!options.isMultiselect.value || !Array.isArray(value.value) || value.value.length === 0) {
      return;
    }
    const nextValue = value.value.slice(0, -1);
    value.value = nextValue;
    options.emitInput(nextValue.slice());
  }

  function clearValue(): void {
    if (options.isMultiselect.value) {
      value.value = [];
      options.emitInput([]);
      lastSelectedOptionId.value = '';
      return;
    }
    value.value = '';
    inputValue.value = '';
    options.emitInput('');
  }

  function commitDraft(): ListCommitResult {
    if (options.isMultiselect.value || !options.isEditable.value) {
      return { status: 'noop' };
    }
    const committedValue = resolveSingleCommittedValue(inputValue.value);
    value.value = committedValue;
    inputValue.value = getOptionLabelByValue(committedValue);
    options.emitInput(committedValue);
    return { status: 'committed' };
  }

  function commitPendingState(): ListCommitResult {
    return commitDraft();
  }

  function getValue(): ListValue {
    return value.value;
  }

  function clearMissingLastSelectedOption(): void {
    if (lastSelectedOptionId.value && !getOptionById(lastSelectedOptionId.value)) {
      lastSelectedOptionId.value = '';
    }
  }

  return {
    inputValue,
    value,
    clearMissingLastSelectedOption,
    clearValue,
    commitDraft,
    commitPendingState,
    getCurrentHighlightedOption,
    getOptionLabelByValue,
    getSelectedLabels,
    getValue,
    isOptionSelected,
    removeLastSelected,
    resolveHighlightedIndex,
    selectOption,
    setValue,
    syncInputDraftFromCommittedValue
  };
}

export {
  useListValueModel
};
