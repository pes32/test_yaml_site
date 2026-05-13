<template>
  <widget-render-fallback
    v-if="widgetLoadError || widgetRuntimeError"
    :widget-name="widgetName"
    :widget-type="resolvedWidgetType"
    :message="fallbackMessage"
    :detail="widgetRuntimeDetail || undefined"
  />
  <component
    v-else-if="widgetBodyReady && resolvedWidgetComponent"
    :is="resolvedWidgetComponent"
    :key="componentKey"
    ref="widgetInstance"
    :widget-config="resolvedWidgetConfig"
    :widget-name="widgetName"
    v-on="widgetListeners"
  />
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import {
  computed,
  onBeforeUnmount,
  onErrorCaptured,
  ref,
  shallowRef,
  watch
} from 'vue';
import widgetFactory, {
  type WidgetDefinition,
  type WidgetLifecycleHandle
} from '../factory.ts';
import {
  assertRuntimeFeatureServices,
  injectPageHostRuntimeServices,
  provideWidgetRuntimeBridge
} from '../../runtime/widget_runtime_bridge.ts';
import { FRONTEND_ERROR_SCOPES } from '../../runtime/error_model.ts';
import WidgetRenderFallback from './WidgetRenderFallback.vue';

defineOptions({
  name: 'WidgetRenderer'
});

const props = withDefaults(defineProps<{
  /** Лёгкая раскладка страницы первым кадром: таблицы монтируются с микро-задержкой по слоту. */
  mountDeferSlot?: number;
  widgetAttrs: Record<string, unknown>;
  widgetName: string;
  widgetValue?: unknown;
}>(), {
  mountDeferSlot: 0,
  widgetValue: undefined
});

const emit = defineEmits<{
  input: [payload: unknown];
  execute: [payload: unknown];
}>();

type WidgetInstanceDebugEntry = {
  instance: unknown;
  type: string;
  widgetName: string;
};

type WidgetInstanceDebugRegistry = {
  register(entry: WidgetInstanceDebugEntry): void;
  unregister(entry: WidgetInstanceDebugEntry): void;
};

const hostServices = injectPageHostRuntimeServices();
const widgetInstance = ref<unknown | null>(null);
const widgetBodyReady = ref(true);

let tableDeferTimer: ReturnType<typeof setTimeout> | null = null;
let tableDeferRaf = 0;

const widgetLoadError = ref<string | null>(null);
const widgetRuntimeError = ref<string | null>(null);
const widgetRuntimeDetail = ref<string | null>(null);
const resolvedWidgetComponent = shallowRef<Component | null>(null);
const renderRecoveryKey = ref(0);

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

function clearTableBodyDeferSchedule(): void {
  if (tableDeferTimer != null) {
    clearTimeout(tableDeferTimer);
    tableDeferTimer = null;
  }
  if (tableDeferRaf) {
    cancelAnimationFrame(tableDeferRaf);
    tableDeferRaf = 0;
  }
}

function scheduleWidgetBodyMount(): void {
  clearTableBodyDeferSchedule();
  if (resolvedWidgetType.value !== 'table') {
    widgetBodyReady.value = true;
    return;
  }
  widgetBodyReady.value = false;
  const slot = Math.max(0, Number(props.mountDeferSlot) || 0);
  const ms = Math.min(slot * 4, 48);
  const reveal = (): void => {
    widgetBodyReady.value = true;
  };
  if (ms <= 0) {
    tableDeferRaf = requestAnimationFrame(reveal);
    return;
  }
  tableDeferTimer = setTimeout(reveal, ms);
}

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

const fallbackMessage = computed(
  () =>
    widgetRuntimeError.value ||
    widgetLoadError.value ||
    'Не удалось отобразить виджет'
);

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

const componentKey = computed(
  () => `${resolvedWidgetType.value}:${props.widgetName}:${renderRecoveryKey.value}`
);

function disposeLifecycleHandle(handle: WidgetLifecycleHandle): void {
  hostServices?.clearActiveWidgetLifecycle?.(handle);
  handle.unbind();
  handle.dispose();
}

function noopLifecycleHandle(): WidgetLifecycleHandle {
  return widgetFactory.getDefinition('img').createLifecycleHandle();
}

function syncLifecycleBinding(): void {
  const handle = lifecycleHandle.value;
  handle.unbind();

  if (!widgetDefinition.value.capabilities.draftCommit || !widgetInstance.value) {
    return;
  }

  handle.bind(widgetInstance.value);
}

function reportWidgetFailure(source: string, err: unknown, vueInfo?: string): void {
  const message = err instanceof Error ? err.message : String(err || 'Неизвестная ошибка');
  const wrapped = err instanceof Error ? err : new Error(message);
  console.error(
    `[WidgetRenderer] Ошибка виджета "${props.widgetName}" (${resolvedWidgetType.value}) [${source}]`,
    vueInfo || '',
    err
  );
  hostServices?.reportAppError?.(wrapped, {
    context: 'widget_render_fallback',
    scope: FRONTEND_ERROR_SCOPES.widget,
    source,
    vueInfo: vueInfo || '',
    widgetName: props.widgetName,
    widgetType: resolvedWidgetType.value
  });
}

function getWidgetInstanceDebugRegistry(): WidgetInstanceDebugRegistry | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const debugWindow = window as Window & {
    __YAMLS_WIDGET_INSTANCE_DEBUG__?: WidgetInstanceDebugRegistry;
  };
  if (!debugWindow.__YAMLS_WIDGET_INSTANCE_DEBUG__) {
    const entries: Record<string, { instance: unknown; type: string }> = {};
    debugWindow.__YAMLS_WIDGET_INSTANCE_DEBUG__ = {
      register(entry) {
        entries[entry.widgetName] = { instance: entry.instance, type: entry.type };
        (this as WidgetInstanceDebugRegistry & {
          entries?: Record<string, { instance: unknown; type: string }>;
        }).entries = entries;
      },
      unregister(entry) {
        if (entries[entry.widgetName]?.instance === entry.instance) {
          delete entries[entry.widgetName];
        }
        (this as WidgetInstanceDebugRegistry & {
          entries?: Record<string, { instance: unknown; type: string }>;
        }).entries = entries;
      }
    } as WidgetInstanceDebugRegistry;
    (debugWindow.__YAMLS_WIDGET_INSTANCE_DEBUG__ as WidgetInstanceDebugRegistry & {
      entries?: Record<string, { instance: unknown; type: string }>;
    }).entries = entries;
  }
  return debugWindow.__YAMLS_WIDGET_INSTANCE_DEBUG__;
}

function createWidgetInstanceDebugEntry(instance: unknown): WidgetInstanceDebugEntry {
  return {
    instance,
    type: resolvedWidgetType.value,
    widgetName: props.widgetName
  };
}

function registerWidgetDebugInstance(instance: unknown | null = widgetInstance.value): void {
  if (!instance) {
    return;
  }

  getWidgetInstanceDebugRegistry()?.register(createWidgetInstanceDebugEntry(instance));
}

function unregisterWidgetDebugInstance(instance: unknown | null = widgetInstance.value): void {
  if (!instance) {
    return;
  }

  getWidgetInstanceDebugRegistry()?.unregister(createWidgetInstanceDebugEntry(instance));
}

watch(
  [resolvedWidgetType, () => props.mountDeferSlot],
  () => {
    scheduleWidgetBodyMount();
  },
  { immediate: true }
);

watch(
  [
    widgetDefinition,
    () => props.widgetAttrs,
    () => props.widgetValue,
    () => props.widgetName
  ],
  ([definition], prevTuple) => {
    const prevDefinition = prevTuple?.[0] as WidgetDefinition | undefined;
    const hadLoadError = Boolean(widgetLoadError.value);
    const hadRuntimeError = Boolean(widgetRuntimeError.value);

    widgetRuntimeError.value = null;
    widgetRuntimeDetail.value = null;

    try {
      if (!definition.isKnown) {
        throw new Error(`Неизвестный тип виджета: ${resolvedWidgetType.value}`);
      }
      resolvedWidgetComponent.value = definition.resolveComponent();
      widgetLoadError.value = null;
      if (hadLoadError || hadRuntimeError) {
        renderRecoveryKey.value += 1;
      }
    } catch (err) {
      resolvedWidgetComponent.value = null;
      widgetLoadError.value = err instanceof Error ? err.message : String(err);
      reportWidgetFailure('resolveComponent', err);
      disposeLifecycleHandle(lifecycleHandle.value);
      lifecycleHandle.value = noopLifecycleHandle();
      return;
    }

    assertRuntimeFeatureServices(definition, hostServices);

    if (definition !== prevDefinition) {
      const previousHandle = lifecycleHandle.value;
      lifecycleHandle.value = definition.createLifecycleHandle();
      disposeLifecycleHandle(previousHandle);
    }

    syncLifecycleBinding();
    registerWidgetDebugInstance();
  },
  { deep: true, immediate: true }
);

watch(widgetInstance, (instance, previousInstance) => {
  syncLifecycleBinding();
  unregisterWidgetDebugInstance(previousInstance);
  registerWidgetDebugInstance(instance);
});

onErrorCaptured((err, _instance, info) => {
  const msg = err instanceof Error ? err.message : String(err || 'Ошибка рендера');
  widgetRuntimeError.value = msg;
  widgetRuntimeDetail.value = typeof info === 'string' ? info : String(info || '');
  reportWidgetFailure('render', err, typeof info === 'string' ? info : String(info || ''));
  return false;
});

onBeforeUnmount(() => {
  clearTableBodyDeferSchedule();
  unregisterWidgetDebugInstance();
  disposeLifecycleHandle(lifecycleHandle.value);
});
</script>
