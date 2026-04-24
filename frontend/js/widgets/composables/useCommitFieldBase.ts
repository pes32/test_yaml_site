import { computed, ref, type Ref } from 'vue';

type CommitFieldBaseConfig = {
  placeholder?: unknown;
};

type CommitFieldBaseProps = {
  widgetConfig: CommitFieldBaseConfig;
};

type CommitFieldLifecycle = {
  activateDraftController(): void;
  deactivateDraftController(): void;
};

function useCommitFieldBase<TValue>(
  props: Readonly<CommitFieldBaseProps>,
  valueRef: Ref<TValue>,
  lifecycle: CommitFieldLifecycle
) {
  const isFocused = ref(false);
  const hasValue = computed(() => Boolean(valueRef.value));
  const labelFloats = computed(() => hasValue.value || isFocused.value);
  const showPlaceholder = computed(() =>
    Boolean(!hasValue.value && isFocused.value && props.widgetConfig.placeholder)
  );

  function onFocus(): void {
    isFocused.value = true;
    lifecycle.activateDraftController();
  }

  function commitOnBlur(commit: () => unknown): void {
    isFocused.value = false;
    try {
      commit();
    } finally {
      lifecycle.deactivateDraftController();
    }
  }

  return {
    hasValue,
    isFocused,
    labelFloats,
    showPlaceholder,
    commitOnBlur,
    onFocus
  };
}

export default useCommitFieldBase;
