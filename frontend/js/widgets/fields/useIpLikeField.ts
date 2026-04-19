import { computed, nextTick, ref, watch, type Ref } from 'vue';
import useWidgetField from '../composables/useWidgetField.ts';

type IpLikeWidgetConfig = Record<string, unknown> & {
  err_text?: string;
  placeholder?: string;
  readonly?: boolean;
  regex?: RegExp | string;
  sup_text?: unknown;
  table_cell_mode?: boolean;
  table_cell_validation_handler?: unknown;
  table_consume_keys?: unknown;
  value?: unknown;
};

type IpLikeWidgetProps = {
  widgetConfig: IpLikeWidgetConfig;
  widgetName: string;
};

type IpLikeInputPayload = {
  config: IpLikeWidgetConfig;
  name: string;
  value: unknown;
};

type IpLikeWidgetEmit = {
  (event: 'input', payload: IpLikeInputPayload): void;
};

type IpLikeCommitContext = {
  kind?: string;
};

type IpLikeCommitResult =
  | {
      status: 'noop' | 'committed';
    }
  | {
      error: unknown;
      severity: 'recoverable' | 'fatal';
      status: 'blocked';
    };

type IpLikeNormalizedValue = {
  activeOctet: string;
  completedOctets: string[];
  hasMaskSeparator: boolean;
  justCommittedByAutoAdvance: boolean;
  justCommittedOctet: boolean;
  maskDigits: string;
  value: string;
};

type UseIpLikeFieldOptions = {
  allowMask: boolean;
  maskTemplate: string;
  validate: (value: string) => boolean;
};

const IP_OCTET_SEPARATOR_KEYS = new Set(['.', ',', ' ', '|', '\\']);
const IP_CONTROL_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Enter',
  'Escape',
  'Home',
  'End',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown'
]);

const IP_MASK_TEMPLATE = 'xxx.xxx.xxx.xxx';
const IP_CIDR_TEMPLATE = 'xxx.xxx.xxx.xxx/xx';

function isDigitChar(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isCommittedOctetValid(octet: string): boolean {
  if (!octet) return false;
  if (!/^\d{1,3}$/.test(octet)) return false;
  const number = Number(octet);
  if (number < 0 || number > 255) return false;
  return String(number) === octet;
}

function normalizeIpLikeValue(rawValue: unknown, allowMask: boolean): IpLikeNormalizedValue {
  const raw = String(rawValue || '');
  const octets = [''];
  let maskDigits = '';
  let inMask = false;
  let justCommittedOctet = false;
  let justCommittedByAutoAdvance = false;

  for (const ch of raw) {
    if (isDigitChar(ch)) {
      justCommittedOctet = false;
      justCommittedByAutoAdvance = false;
      if (inMask) {
        if (maskDigits.length < 2) {
          maskDigits += ch;
        }
        continue;
      }

      const current = octets[octets.length - 1];
      if (current.length < 3) {
        const nextOctet = current + ch;
        octets[octets.length - 1] = nextOctet;
        if (
          nextOctet.length === 3 &&
          octets.length < 4 &&
          isCommittedOctetValid(nextOctet)
        ) {
          octets.push('');
          justCommittedOctet = true;
          justCommittedByAutoAdvance = true;
        }
        continue;
      }

      if (octets.length < 4) {
        octets.push(ch);
      }
      justCommittedOctet = false;
      justCommittedByAutoAdvance = false;
      continue;
    }

    const isOctetSeparator =
      IP_OCTET_SEPARATOR_KEYS.has(ch) || (!allowMask && ch === '/');
    if (isOctetSeparator) {
      justCommittedByAutoAdvance = false;
      if (!inMask && octets.length < 4 && octets[octets.length - 1].length > 0) {
        octets.push('');
        justCommittedOctet = true;
      }
      continue;
    }

    if (allowMask && ch === '/') {
      justCommittedOctet = false;
      justCommittedByAutoAdvance = false;
      if (!inMask && octets.some(Boolean)) {
        inMask = true;
      }
    }
  }

  let ipPart = octets[0] || '';
  for (let index = 1; index < octets.length; index += 1) {
    ipPart += `.${octets[index]}`;
  }

  return {
    value: allowMask && inMask ? `${ipPart}/${maskDigits}` : ipPart,
    completedOctets: octets.slice(0, -1),
    activeOctet: octets[octets.length - 1] || '',
    maskDigits,
    hasMaskSeparator: inMask,
    justCommittedOctet,
    justCommittedByAutoAdvance
  };
}

function hasLiveIpLikeError(normalized: IpLikeNormalizedValue, allowMask: boolean): boolean {
  if (normalized.completedOctets.some((octet) => !isCommittedOctetValid(octet))) {
    return true;
  }

  if (!allowMask || !normalized.hasMaskSeparator || normalized.maskDigits.length < 2) {
    return false;
  }

  const maskValue = Number(normalized.maskDigits);
  return !Number.isFinite(maskValue) || maskValue < 0 || maskValue > 32;
}

function isAllowedIpKey(key: string, allowMask: boolean): boolean {
  if (IP_CONTROL_KEYS.has(key)) return true;
  if (key.length !== 1) return true;
  if (isDigitChar(key)) return true;
  if (IP_OCTET_SEPARATOR_KEYS.has(key)) return true;
  if (allowMask && key === '/') return true;
  return false;
}

function validateRegexValue(rawValue: unknown, regex: unknown, errText?: string): string {
  if (!regex) return '';
  try {
    const re = regex instanceof RegExp || typeof regex === 'string'
      ? (typeof regex === 'string' ? new RegExp(regex) : regex)
      : null;
    if (!re) {
      return '';
    }
    return rawValue !== '' && !re.test(String(rawValue))
      ? errText || 'Неверный формат'
      : '';
  } catch {
    return '';
  }
}

function validateIPv4(ip: string): boolean {
  if (!ip) return true;
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => isCommittedOctetValid(part));
}

function validateIPv4Cidr(value: string): boolean {
  if (!value) return true;
  const [ip, mask] = value.split('/');
  if (!validateIPv4(ip)) return false;
  if (mask === undefined) return false;
  if (!/^\d{1,2}$/.test(mask)) return false;
  const number = Number(mask);
  return number >= 0 && number <= 32;
}

function resolveIpLikeOptions(widgetType: unknown): UseIpLikeFieldOptions {
  const allowMask = String(widgetType || '').trim() === 'ip_mask';
  return {
    allowMask,
    maskTemplate: allowMask ? IP_CIDR_TEMPLATE : IP_MASK_TEMPLATE,
    validate: allowMask ? validateIPv4Cidr : validateIPv4
  };
}

function useIpLikeField(
  props: Readonly<IpLikeWidgetProps>,
  emit: IpLikeWidgetEmit,
  options: UseIpLikeFieldOptions = resolveIpLikeOptions(props.widgetConfig.widget)
) {
  const field = useWidgetField(props as IpLikeWidgetProps, emit);
  const inputRef: Ref<HTMLInputElement | null> = ref(null);
  const inputValue = ref('');
  const error = ref('');
  const isFocused = ref(false);

  const hasValue = computed(() => Boolean(inputValue.value));
  const labelFloats = computed(() => hasValue.value || isFocused.value);
  const displayError = computed(() =>
    field.tableCellCommitError.value || error.value || ''
  );
  const showPlaceholder = computed(() =>
    Boolean(!hasValue.value && isFocused.value && props.widgetConfig.placeholder)
  );
  const maxLength = computed(() => options.maskTemplate.length);

  function emitValue(): void {
    field.emitInput(inputValue.value);
  }

  function onFocus(): void {
    isFocused.value = true;
    field.activateDraftController();
  }

  function validateCommittedValue(): string {
    if (inputValue.value === '') {
      error.value = '';
      return '';
    }

    const regexError = validateRegexValue(
      inputValue.value,
      props.widgetConfig.regex,
      props.widgetConfig.err_text
    );
    if (regexError) {
      error.value = regexError;
      return error.value;
    }

    error.value = options.validate(inputValue.value)
      ? ''
      : props.widgetConfig.err_text || 'Неверный формат';
    return error.value;
  }

  function applyNormalizedValue(rawValue: unknown, caretPosition: number | null): void {
    const previousValue = inputValue.value;
    const normalized = normalizeIpLikeValue(rawValue, options.allowMask);
    inputValue.value = normalized.value;
    error.value = hasLiveIpLikeError(normalized, options.allowMask) ? 'Неверный формат' : '';

    if (field.tableCellMode.value) {
      emitValue();
    } else {
      field.activateDraftController();
    }

    let nextCursor: number | null = null;
    if (
      normalized.justCommittedByAutoAdvance &&
      typeof caretPosition === 'number' &&
      caretPosition === String(rawValue || '').length
    ) {
      nextCursor = normalized.value.length;
    } else if (typeof caretPosition === 'number') {
      nextCursor = Math.max(0, Math.min(caretPosition, normalized.value.length));
    }

    if (nextCursor == null) {
      return;
    }

    void nextTick(() => {
      const element = inputRef.value;
      if (!(element instanceof HTMLInputElement)) return;
      if (element.value !== inputValue.value || inputValue.value === previousValue) return;
      if (typeof element.setSelectionRange === 'function') {
        element.setSelectionRange(nextCursor, nextCursor);
      }
    });
  }

  function handleBackspaceAcrossSeparator(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLInputElement)) return false;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (start == null || end == null || start !== end || start < 1) {
      return false;
    }

    const value = String(inputValue.value || '');
    if (value.charAt(start - 1) !== '.' || !isDigitChar(value.charAt(start - 2))) {
      return false;
    }

    const nextRaw = start === value.length
      ? value.slice(0, Math.max(0, start - 2))
      : value.slice(0, Math.max(0, start - 2)) + value.slice(start - 1);

    applyNormalizedValue(nextRaw, Math.max(0, start - 2));
    return true;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) return;
    if (event.altKey && event.key.length > 1) return;
    if (event.key === 'Backspace' && handleBackspaceAcrossSeparator(event.target)) {
      event.preventDefault();
      return;
    }
    if (isAllowedIpKey(event.key, options.allowMask)) return;
    event.preventDefault();
  }

  function onInputHandler(event: Event): void {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    const rawInputValue = String(target?.value || '');
    const previousCursor = typeof target?.selectionStart === 'number'
      ? target.selectionStart
      : null;
    applyNormalizedValue(rawInputValue, previousCursor);
  }

  function commitDraft(context?: IpLikeCommitContext): IpLikeCommitResult {
    const validationMessage = validateCommittedValue();
    return field.commitDraftValue(inputValue.value, validationMessage, context);
  }

  function commitPendingState(context?: IpLikeCommitContext): IpLikeCommitResult {
    return commitDraft(context);
  }

  function handleBlur(): void {
    isFocused.value = false;
    try {
      commitDraft();
    } finally {
      field.deactivateDraftController();
    }
  }

  function setValue(value: unknown): void {
    const raw = value == null ? '' : String(value);
    inputValue.value = normalizeIpLikeValue(raw, options.allowMask).value;
    validateCommittedValue();
  }

  function getValue(): string {
    return inputValue.value;
  }

  watch(
    () => props.widgetConfig.value,
    (value) => {
      if (value === undefined) return;
      field.syncCommittedValue(value, setValue);
    },
    { immediate: true }
  );

  return {
    displayError,
    error,
    hasValue,
    inputRef,
    inputValue,
    isFocused,
    labelFloats,
    maxLength,
    showPlaceholder,
    tableCellRootAttrs: field.tableCellRootAttrs,
    commitDraft,
    commitPendingState,
    getValue,
    handleBlur,
    onFocus,
    onInputHandler,
    onKeyDown,
    setValue
  };
}

export {
  IP_CIDR_TEMPLATE,
  IP_MASK_TEMPLATE,
  normalizeIpLikeValue,
  resolveIpLikeOptions,
  useIpLikeField,
  validateIPv4,
  validateIPv4Cidr
};

export type {
  IpLikeCommitContext,
  IpLikeCommitResult,
  IpLikeWidgetConfig,
  IpLikeWidgetEmit,
  IpLikeWidgetProps
};
