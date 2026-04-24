import { inject, onMounted, ref } from 'vue';
import useActionButtonVisual from './useActionButtonVisual.ts';
import useActionExecution from './useActionExecution.ts';
import type {
  ActionButtonVisualOptions,
  ActionWidgetEmit,
  ActionWidgetProps
} from './types.ts';

function useActionWidgetBase(
  props: Readonly<ActionWidgetProps>,
  emit: ActionWidgetEmit,
  visualOptions: ActionButtonVisualOptions
) {
  const getConfirmModal = inject<() => unknown | null>('getConfirmModal', () => null);
  const openUiModal = inject<((modalName: string) => Promise<unknown> | unknown) | null>(
    'openUiModal',
    null
  );
  const closeUiModal = inject<(() => Promise<unknown> | unknown) | null>(
    'closeUiModal',
    null
  );
  const value = ref<unknown>('');
  const visual = useActionButtonVisual(props, visualOptions);
  const execution = useActionExecution(props, emit, {
    closeUiModal,
    getConfirmModal,
    openUiModal
  });

  function setValue(nextValue: unknown): void {
    value.value = nextValue;
  }

  function getValue(): unknown {
    return value.value;
  }

  onMounted(() => {
    if (props.widgetConfig.default !== undefined) {
      value.value = props.widgetConfig.default;
    }
  });

  return {
    ...execution,
    ...visual,
    getValue,
    setValue,
    value
  };
}

export default useActionWidgetBase;
