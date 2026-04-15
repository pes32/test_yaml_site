import { computed, ref, type Ref } from 'vue';
import useWidgetField from '../composables/useWidgetField.ts';
import type { DateTimeWidgetEmit, DateTimeWidgetProps } from './types.ts';

type DateTimeCommitContext = {
  kind?: string;
};

function useDateTimeField(
  props: Readonly<DateTimeWidgetProps>,
  emit: DateTimeWidgetEmit,
  value: Ref<string>
) {
  const field = useWidgetField(props, emit);
  const isFocused = ref(false);
  const hasValue = computed(() => Boolean(value.value));
  const labelFloats = computed(() => hasValue.value || isFocused.value);

  function onFocus(): void {
    isFocused.value = true;
    field.activateDraftController();
  }

  function onLiveInput(nextValue = value.value): void {
    if (field.tableCellMode.value) {
      field.emitInput(nextValue);
      return;
    }

    field.activateDraftController();
  }

  function commitValue(
    nextValue = value.value,
    validationMessage = '',
    context?: DateTimeCommitContext
  ) {
    return field.commitDraftValue(nextValue, validationMessage, context);
  }

  function syncCommittedValue(nextValue: unknown, applyValue: (value: unknown) => void): void {
    field.syncCommittedValue(nextValue, applyValue);
  }

  return {
    ...field,
    commitValue,
    hasValue,
    isFocused,
    labelFloats,
    onFocus,
    onLiveInput,
    syncCommittedValue
  };
}

export type { DateTimeCommitContext };
export default useDateTimeField;
