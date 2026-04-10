import { computed, getCurrentInstance, inject, onBeforeUnmount, ref } from 'vue';

type WidgetConfig = Record<string, unknown> & {
  err_text?: string;
  readonly?: boolean;
  regex?: RegExp | string;
  table_cell_mode?: boolean;
  table_cell_validation_handler?: ((message: string) => void) | unknown;
  table_consume_keys?: unknown;
};

type WidgetFieldProps = {
  widgetConfig: WidgetConfig;
  widgetName: string;
};

type WidgetInputPayload = {
  name: string;
  value: unknown;
  config: WidgetConfig;
};

type WidgetFieldEmit = (event: 'input', payload: WidgetInputPayload) => void;

type NotificationHandler = ((message: string, type?: string) => void) | null;
type DraftLifecycleHandler = (() => void) | null;

type DraftCommitContext = {
  kind?: string;
};

type DraftCommitResult =
  | {
      status: 'noop' | 'committed';
    }
  | {
      status: 'blocked';
      severity: 'recoverable' | 'fatal';
      error: unknown;
    };

type WidgetRoot = {
  showNotification?: (message: string, type?: string) => void;
};

type WidgetProxy = Record<string, unknown> & {
  $root?: WidgetRoot;
  floatError?: string;
  intError?: string;
  isFocused?: boolean;
  regexError?: string;
  value?: unknown;
};

function resolveWidgetProxy(
  instance: ReturnType<typeof getCurrentInstance>
): WidgetProxy | null {
  return (instance?.proxy as WidgetProxy | null) ?? null;
}

export default function useWidgetField(
  props: WidgetFieldProps,
  emit: WidgetFieldEmit
) {
  const instance = getCurrentInstance();
  const showAppNotification = inject<NotificationHandler>('showAppNotification', null);
  const setActiveWidgetLifecycle = inject<DraftLifecycleHandler>(
    'setActiveWidgetLifecycle',
    null
  );
  const clearActiveWidgetLifecycle = inject<DraftLifecycleHandler>(
    'clearActiveWidgetLifecycle',
    null
  );

  const tableCellCommitError = ref('');
  const isDraftEditing = ref(false);

  const tableCellMode = computed<boolean>(() => !!(
    props.widgetConfig && props.widgetConfig.table_cell_mode === true
  ));

  const tableCellRootAttrs = computed<Record<string, string>>(() => {
    if (!tableCellMode.value) {
      return {};
    }

    const attrs: Record<string, string> = {
      'data-table-embedded-widget': 'true'
    };
    const consume = props.widgetConfig && props.widgetConfig.table_consume_keys;
    if (consume) {
      attrs['data-table-consume-keys'] = String(consume);
    }
    return attrs;
  });

  const fieldError = computed<string>(() => {
    const vm = resolveWidgetProxy(instance);
    return (
      (vm?.regexError as string | undefined) ||
      (vm?.intError as string | undefined) ||
      (vm?.floatError as string | undefined) ||
      tableCellCommitError.value ||
      ''
    );
  });

  function validateRegex(): void {
    const vm = resolveWidgetProxy(instance);
    if (!vm) {
      return;
    }

    const regex = props.widgetConfig.regex;
    if (!regex || props.widgetConfig.readonly) {
      vm.regexError = '';
      return;
    }

    try {
      const re = typeof regex === 'string' ? new RegExp(regex) : regex;
      const value = vm.value == null ? '' : String(vm.value);
      vm.regexError = (value !== '' && !re.test(value))
        ? (props.widgetConfig.err_text || 'Неверный формат')
        : '';
    } catch {
      vm.regexError = '';
    }
  }

  function emitInput(value: unknown): void {
    emit('input', {
      name: props.widgetName,
      value,
      config: props.widgetConfig
    });
  }

  function usesDraftCommitModel(): boolean {
    return !tableCellMode.value;
  }

  function syncCommittedValue(value: unknown, applyValue: (value: unknown) => void): void {
    const vm = resolveWidgetProxy(instance);
    const editingLocked = usesDraftCommitModel()
      ? isDraftEditing.value
      : !!vm?.isFocused;

    if (editingLocked) {
      return;
    }

    applyValue(value);
  }

  function activateDraftController(): void {
    if (!usesDraftCommitModel() || props.widgetConfig.readonly) {
      return;
    }

    isDraftEditing.value = true;
    if (typeof setActiveWidgetLifecycle === 'function') {
      setActiveWidgetLifecycle();
    }
  }

  function deactivateDraftController(): void {
    if (!usesDraftCommitModel()) {
      return;
    }

    isDraftEditing.value = false;
    if (typeof clearActiveWidgetLifecycle === 'function') {
      clearActiveWidgetLifecycle();
    }
  }

  function showWidgetNotification(message: string, type = 'danger'): void {
    if (typeof showAppNotification === 'function') {
      showAppNotification(message, type);
      return;
    }

    const vm = resolveWidgetProxy(instance);
    const root = vm?.$root;
    if (root && typeof root.showNotification === 'function') {
      root.showNotification(message, type);
    }
  }

  function syncTableCellValidationState(message: string): void {
    const handler = props.widgetConfig && props.widgetConfig.table_cell_validation_handler;
    if (typeof handler !== 'function') {
      return;
    }

    try {
      handler(String(message || '').trim());
    } catch {
      /* best effort */
    }
  }

  function handleTableCellCommitValidation(message: string): boolean {
    const errorMessage = String(message || '').trim();
    if (!tableCellMode.value) {
      tableCellCommitError.value = '';
      return errorMessage === '';
    }

    tableCellCommitError.value = errorMessage;
    syncTableCellValidationState(errorMessage);
    if (errorMessage) {
      showWidgetNotification(errorMessage, 'danger');
    }
    return errorMessage === '';
  }

  function isBoundaryCommitContext(context: unknown): boolean {
    if (!context || typeof context !== 'object') {
      return false;
    }

    const kind = (context as DraftCommitContext).kind;
    return typeof kind === 'string' && kind.trim() !== '';
  }

  function createDraftCommitResult(status: 'noop' | 'committed'): DraftCommitResult {
    return { status };
  }

  function createRecoverableBlockedResult(error: unknown): DraftCommitResult {
    return {
      status: 'blocked',
      severity: 'recoverable',
      error
    };
  }

  function commitDraftValue(
    value: unknown,
    validationMessage: string,
    context?: DraftCommitContext
  ): DraftCommitResult {
    const errorMessage = String(validationMessage || '').trim();
    const isValid = handleTableCellCommitValidation(errorMessage);
    if (!isValid && isBoundaryCommitContext(context)) {
      return createRecoverableBlockedResult(
        new Error(errorMessage || 'Черновик виджета не прошёл проверку')
      );
    }

    emitInput(value);
    return createDraftCommitResult('committed');
  }

  onBeforeUnmount(() => {
    deactivateDraftController();
  });

  return {
    fieldError,
    isDraftEditing,
    tableCellCommitError,
    tableCellMode,
    tableCellRootAttrs,
    activateDraftController,
    commitDraftValue,
    createDraftCommitResult,
    createRecoverableBlockedResult,
    deactivateDraftController,
    emitInput,
    handleTableCellCommitValidation,
    isBoundaryCommitContext,
    showWidgetNotification,
    syncCommittedValue,
    syncTableCellValidationState,
    usesDraftCommitModel,
    validateRegex
  };
}
