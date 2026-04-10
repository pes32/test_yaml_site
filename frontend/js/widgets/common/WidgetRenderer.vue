<template>
  <component
    :is="widgetComponent"
    :key="componentKey"
    ref="widgetInstance"
    :widget-config="resolvedWidgetConfig"
    :widget-name="widgetName"
    v-on="widgetListeners"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import widgetFactory, {
  type WidgetDefinition,
  type WidgetLifecycleHandle
} from '../factory.ts';
import {
  assertRuntimeFeatureServices,
  injectPageHostRuntimeServices,
  provideWidgetRuntimeBridge
} from '../../runtime/widget_runtime_bridge.ts';

defineOptions({
  name: 'WidgetRenderer'
});

const props = defineProps({
  widgetAttrs: {
    type: Object,
    required: true
  },
  widgetValue: {
    required: false,
    default: undefined
  },
  widgetName: {
    type: String,
    required: true
  }
});

const emit = defineEmits<{
  input: [payload: unknown];
  execute: [payload: unknown];
}>();

const hostServices = injectPageHostRuntimeServices();
const widgetInstance = ref<unknown | null>(null);

let lastResolvedAttrs: Record<string, unknown> | null = null;
let lastResolvedValue: unknown = undefined;
let lastResolvedConfig: Record<string, unknown> | null = null;

const resolvedWidgetConfig = computed<Record<string, unknown>>(() => {
  if (props.widgetValue === undefined) {
    return props.widgetAttrs;
  }

  if (
    lastResolvedConfig &&
    lastResolvedAttrs === props.widgetAttrs &&
    lastResolvedValue === props.widgetValue
  ) {
    return lastResolvedConfig;
  }

  lastResolvedAttrs = props.widgetAttrs;
  lastResolvedValue = props.widgetValue;
  lastResolvedConfig = {
    ...props.widgetAttrs,
    value: props.widgetValue
  };

  return lastResolvedConfig;
});

const resolvedWidgetType = computed(() => {
  const widgetType = resolvedWidgetConfig.value?.widget;
  return typeof widgetType === 'string' && widgetType.trim()
    ? widgetType.trim()
    : 'str';
});

const widgetDefinition = computed<WidgetDefinition>(() =>
  widgetFactory.getDefinition(resolvedWidgetType.value)
);

const lifecycleHandle = ref<WidgetLifecycleHandle>(widgetDefinition.value.createLifecycleHandle());

provideWidgetRuntimeBridge(widgetDefinition, hostServices, {
  clearActiveWidgetLifecycle() {
    hostServices?.clearActiveWidgetLifecycle?.(lifecycleHandle.value);
  },
  setActiveWidgetLifecycle() {
    hostServices?.setActiveWidgetLifecycle?.(lifecycleHandle.value);
  }
});

const widgetComponent = computed(() => widgetDefinition.value.resolveComponent());

const widgetListeners = computed<Record<string, (payload: unknown) => void>>(() => {
  const listeners: Record<string, (payload: unknown) => void> = {};

  if (widgetDefinition.value.capabilities.emitsInput) {
    listeners.input = (payload) => emit('input', payload);
  }

  if (widgetDefinition.value.capabilities.emitsExecute) {
    listeners.execute = (payload) => emit('execute', payload);
  }

  return listeners;
});

const componentKey = computed(() => `${resolvedWidgetType.value}:${props.widgetName}`);

function disposeLifecycleHandle(handle: WidgetLifecycleHandle): void {
  hostServices?.clearActiveWidgetLifecycle?.(handle);
  handle.unbind();
  handle.dispose();
}

function syncLifecycleBinding(): void {
  const handle = lifecycleHandle.value;
  handle.unbind();

  if (!widgetDefinition.value.capabilities.draftCommit || !widgetInstance.value) {
    return;
  }

  handle.bind(widgetInstance.value);
}

watch(
  widgetDefinition,
  (definition, previousDefinition) => {
    if (definition === previousDefinition) {
      return;
    }

    assertRuntimeFeatureServices(definition, hostServices);

    const previousHandle = lifecycleHandle.value;
    lifecycleHandle.value = definition.createLifecycleHandle();
    disposeLifecycleHandle(previousHandle);
    syncLifecycleBinding();
  },
  { immediate: true }
);

watch(widgetInstance, () => {
  syncLifecycleBinding();
});

onBeforeUnmount(() => {
  disposeLifecycleHandle(lifecycleHandle.value);
});
</script>
