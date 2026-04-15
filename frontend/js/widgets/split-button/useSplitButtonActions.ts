import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import {
  getActionFallbackLabel,
  inspectSplitButtonActions,
  resolveActionLabel
} from '../../runtime/action_runtime.ts';
import type {
  SplitButtonActionDescriptor,
  SplitButtonDisplayAction,
  SplitButtonWidgetProps
} from './types.ts';
import { buildActionDescriptors } from './utils.ts';

function useSplitButtonActions(props: Readonly<SplitButtonWidgetProps>) {
  const resolvedLabels = shallowRef<Record<string, string>>({});
  const warnedFields = new Set<string>();
  const pendingLabelKeys = new Set<string>();
  let isUnmounted = false;

  const actionInspection = computed(() => inspectSplitButtonActions(props.widgetConfig));
  const actions = computed(() => actionInspection.value.items);
  const actionDescriptors = computed<SplitButtonActionDescriptor[]>(() =>
    buildActionDescriptors(actions.value)
  );
  const displayActionKeys = computed(() => actionDescriptors.value.map((descriptor) => descriptor.key));
  const hasActions = computed(() => actionDescriptors.value.length > 0);
  const malformedWarningsKey = computed(() =>
    JSON.stringify(actionInspection.value.malformedByField || {})
  );
  const displayActions = computed<SplitButtonDisplayAction[]>(() =>
    actionDescriptors.value.map((descriptor) => ({
      ...descriptor,
      displayLabel:
        resolvedLabels.value[descriptor.key] ||
        getActionFallbackLabel(descriptor.item)
    }))
  );

  function emitMalformedWarnings(): void {
    Object.entries(actionInspection.value.malformedByField || {}).forEach(
      ([fieldName, lineNumbers]) => {
        if (warnedFields.has(fieldName) || !Array.isArray(lineNumbers) || !lineNumbers.length) {
          return;
        }

        warnedFields.add(fieldName);
        console.warn(
          `[split_button] malformed DSL lines skipped for widget "${props.widgetName}" ` +
          `field "${fieldName}": ${lineNumbers.join(', ')}`
        );
      }
    );
  }

  function pruneResolvedLabels(validKeys: readonly string[]): void {
    const validKeySet = new Set(validKeys);
    const nextLabels: Record<string, string> = {};
    Object.entries(resolvedLabels.value).forEach(([key, label]) => {
      if (validKeySet.has(key)) {
        nextLabels[key] = label;
      }
    });
    resolvedLabels.value = nextLabels;
  }

  function ensureActionLabelsResolved(): void {
    const descriptorsToResolve = actionDescriptors.value.filter((descriptor) => {
      if (Object.prototype.hasOwnProperty.call(resolvedLabels.value, descriptor.key)) {
        return false;
      }
      return !pendingLabelKeys.has(descriptor.key);
    });

    if (!descriptorsToResolve.length) {
      return;
    }

    descriptorsToResolve.forEach((descriptor) => pendingLabelKeys.add(descriptor.key));

    void Promise.allSettled(
      descriptorsToResolve.map(async (descriptor) => ({
        descriptor,
        resolvedLabel: await resolveActionLabel(descriptor.item)
      }))
    ).then((results) => {
      descriptorsToResolve.forEach((descriptor) => pendingLabelKeys.delete(descriptor.key));
      if (isUnmounted) {
        return;
      }

      const validKeys = new Set(actionDescriptors.value.map((descriptor) => descriptor.key));
      let changed = false;
      const nextLabels = { ...resolvedLabels.value };

      results.forEach((result) => {
        if (result.status !== 'fulfilled') {
          return;
        }

        const { descriptor, resolvedLabel } = result.value;
        if (!validKeys.has(descriptor.key)) {
          return;
        }

        const nextLabel = String(resolvedLabel || '').trim();
        if (!nextLabel || nextLabel === getActionFallbackLabel(descriptor.item)) {
          return;
        }

        nextLabels[descriptor.key] = nextLabel;
        changed = true;
      });

      if (changed) {
        resolvedLabels.value = nextLabels;
      }
    });
  }

  watch(malformedWarningsKey, emitMalformedWarnings, { immediate: true });

  onBeforeUnmount(() => {
    isUnmounted = true;
  });

  return {
    actionDescriptors,
    actionInspection,
    actions,
    displayActionKeys,
    displayActions,
    ensureActionLabelsResolved,
    hasActions,
    pruneResolvedLabels
  };
}

export default useSplitButtonActions;
