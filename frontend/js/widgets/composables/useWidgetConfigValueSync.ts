import { watch } from 'vue';

type WidgetValueProps = {
  widgetConfig: {
    value?: unknown;
  };
};

function useWidgetConfigValueSync(
  props: WidgetValueProps,
  syncCommittedValue: (value: unknown, applyValue: (value: unknown) => void) => void,
  applyValue: (value: unknown) => void
): void {
  watch(
    () => props.widgetConfig.value,
    (nextValue) => {
      if (nextValue === undefined) {
        return;
      }
      syncCommittedValue(nextValue, applyValue);
    },
    { immediate: true }
  );
}

export {
  useWidgetConfigValueSync
};
