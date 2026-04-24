import { computed, ref, watch } from 'vue';
import useCommitFieldBase from './useCommitFieldBase.ts';
import { validateRegexValue } from './field_validation.ts';
import useWidgetField from './useWidgetField.ts';

type SimpleFieldWidgetConfig = Record<string, unknown> & {
  err_text?: string;
  placeholder?: string;
  readonly?: boolean;
  regex?: RegExp | string;
  rows?: number;
  sup_text?: unknown;
  table_cell_mode?: boolean;
  value?: unknown;
};

type SimpleFieldWidgetProps = {
  widgetConfig: SimpleFieldWidgetConfig;
  widgetName: string;
};

type SimpleFieldInputPayload = {
  config: SimpleFieldWidgetConfig;
  name: string;
  value: unknown;
};

type SimpleFieldEmit = {
  (event: 'input', payload: SimpleFieldInputPayload): void;
};

type SimpleFieldCommitContext = {
  kind?: string;
};

type SimpleFieldCommitResult =
  | {
      status: 'noop' | 'committed';
    }
  | {
      error: unknown;
      severity: 'recoverable' | 'fatal';
      status: 'blocked';
    };

type SimpleFieldKind = 'float' | 'int' | 'string' | 'text';

type UseSimpleFieldWidgetOptions = {
  kind: SimpleFieldKind;
};

function eventValue(event: Event | undefined): string | null {
  const target = event?.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target.value;
  }
  return null;
}

function normalizeIntInput(rawValue: unknown): string {
  const raw = String(rawValue ?? '');
  const compact = raw.replace(/\s+/g, '');
  const sign = compact.startsWith('-') ? '-' : '';
  const digits = compact.replace(/\D+/g, '');
  return sign + digits;
}

function normalizeFloatInput(rawValue: unknown): string {
  const compact = String(rawValue ?? '').replace(/,/g, '.').replace(/\s+/g, '');
  const sign = compact.startsWith('-') ? '-' : '';
  const unsigned = compact.replace(/-/g, '');
  let hasDot = false;
  let output = '';

  for (const char of unsigned) {
    if (char >= '0' && char <= '9') {
      output += char;
      continue;
    }
    if (char === '.' && !hasDot) {
      output += char;
      hasDot = true;
    }
  }

  return sign + output;
}

function toStringValue(value: unknown): string {
  return value == null ? '' : String(value);
}

function commitErrorForKind(kind: SimpleFieldKind, value: string): string {
  if (value === '') {
    return '';
  }

  if (kind === 'int') {
    return /^-?\d+$/.test(value) ? '' : 'Введите целое число';
  }

  if (kind === 'float') {
    if (value === '-' || value === '.' || value === '-.') {
      return 'Введите корректное дробное число';
    }
    return Number.isFinite(Number(value)) ? '' : 'Введите корректное дробное число';
  }

  return '';
}

function normalizeLiveValue(kind: SimpleFieldKind, value: string): string {
  if (kind === 'int') {
    return normalizeIntInput(value);
  }
  if (kind === 'float') {
    return normalizeFloatInput(value);
  }
  return value;
}

function useSimpleFieldWidget(
  props: Readonly<SimpleFieldWidgetProps>,
  emit: SimpleFieldEmit,
  options: UseSimpleFieldWidgetOptions
) {
  const field = useWidgetField(props as SimpleFieldWidgetProps, emit);
  const value = ref('');
  const regexError = ref('');
  const typeError = ref('');
  const fieldBase = useCommitFieldBase(props, value, field);
  const fieldError = computed(() =>
    regexError.value || typeError.value || field.tableCellCommitError.value || ''
  );

  function validateRegex(): void {
    regexError.value = props.widgetConfig.readonly
      ? ''
      : validateRegexValue(
        value.value,
        props.widgetConfig.regex,
        props.widgetConfig.err_text
      );
  }

  function validateForCommit(): string {
    validateRegex();
    typeError.value = commitErrorForKind(options.kind, value.value);
    return regexError.value || typeError.value || '';
  }

  function setValue(nextValue: unknown): void {
    value.value = toStringValue(nextValue);
    typeError.value = '';
    validateRegex();
  }

  function getValue(): string {
    return value.value;
  }

  function syncLiveValue(nextValue: string): void {
    value.value = normalizeLiveValue(options.kind, nextValue);
    typeError.value = '';
    validateRegex();
  }

  function onInput(event?: Event): void {
    const nextValue = eventValue(event);
    syncLiveValue(nextValue == null ? value.value : nextValue);

    if (field.tableCellMode.value) {
      field.emitInput(value.value);
      return;
    }

    field.activateDraftController();
  }

  function commitDraft(context?: SimpleFieldCommitContext): SimpleFieldCommitResult {
    return field.commitDraftValue(value.value, validateForCommit(), context);
  }

  function commitPendingState(context?: SimpleFieldCommitContext): SimpleFieldCommitResult {
    return commitDraft(context);
  }

  function onBlur(): void {
    fieldBase.commitOnBlur(commitDraft);
  }

  function onEnterCommit(event: KeyboardEvent): void {
    if (field.tableCellMode.value) {
      return;
    }

    event.preventDefault();
    try {
      commitDraft();
    } finally {
      const target = event.target;
      if (target instanceof HTMLElement) {
        target.blur();
      }
    }
  }

  function onCommitShortcut(): void {
    commitDraft();
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

  return {
    fieldError,
    hasValue: fieldBase.hasValue,
    isDraftEditing: field.isDraftEditing,
    isFocused: fieldBase.isFocused,
    labelFloats: fieldBase.labelFloats,
    regexError,
    showPlaceholder: fieldBase.showPlaceholder,
    tableCellRootAttrs: field.tableCellRootAttrs,
    typeError,
    value,
    commitDraft,
    commitPendingState,
    getValue,
    onBlur,
    onCommitShortcut,
    onEnterCommit,
    onFocus: fieldBase.onFocus,
    onInput,
    setValue,
    validateRegex
  };
}

export default useSimpleFieldWidget;

export type {
  SimpleFieldCommitContext,
  SimpleFieldCommitResult,
  SimpleFieldEmit,
  SimpleFieldKind,
  SimpleFieldWidgetConfig,
  SimpleFieldWidgetProps
};
