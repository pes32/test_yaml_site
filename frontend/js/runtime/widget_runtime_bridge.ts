import { inject, provide, type ComputedRef } from 'vue';
import type {
  WidgetDefinition,
  WidgetLifecycleHandle,
  WidgetRuntimeFeature
} from '../widgets/factory.ts';
import type { AttrConfigMap, AttrConfigRecord } from '../shared/attr_config.ts';

type NotificationType = 'success' | 'info' | 'warning' | 'danger' | string;

type PageHostRuntimeServices = {
  clearActiveWidgetLifecycle?: (handle?: WidgetLifecycleHandle | null) => void;
  closeUiModal?: () => Promise<unknown> | unknown;
  getAllAttrsMap?: () => AttrConfigMap;
  getConfirmModal?: () => unknown;
  getCurrentPageNameFromRuntime?: () => string;
  getModalRuntimeController?: () => unknown;
  getModalRuntimeState?: () => unknown;
  getWidgetAttrsByName?: (widgetName: string) => AttrConfigRecord;
  getWidgetRuntimeValueByName?: (widgetName: string) => unknown;
  handleRecoverableAppError?: (error: unknown, options?: Record<string, unknown>) => unknown;
  openUiModal?: (modalName: string) => Promise<unknown> | unknown;
  reportAppError?: (error: unknown, options?: Record<string, unknown>) => unknown;
  runBoundaryAction?: (kind: string, action: () => Promise<unknown> | unknown) => Promise<unknown>;
  setActiveWidgetLifecycle?: (handle?: WidgetLifecycleHandle | null) => void;
  showAppNotification?: (message: string, type?: NotificationType) => void;
};

type WidgetScopedLifecycleBridge = {
  clearActiveWidgetLifecycle: () => void;
  setActiveWidgetLifecycle: () => void;
};

const PAGE_HOST_RUNTIME_SERVICES_KEY = 'pageHostRuntimeServices';

const FEATURE_SERVICE_KEYS: Record<WidgetRuntimeFeature, string[]> = {
  attrsAccess: [
    'getWidgetAttrsByName',
    'getWidgetRuntimeValueByName',
    'getAllAttrsMap',
    'getCurrentPageNameFromRuntime'
  ],
  confirmModal: ['getConfirmModal'],
  errorHandling: ['reportAppError', 'handleRecoverableAppError'],
  modalControl: ['openUiModal', 'closeUiModal', 'getModalRuntimeState', 'getModalRuntimeController'],
  notifications: ['showAppNotification']
};

function injectPageHostRuntimeServices(): PageHostRuntimeServices | null {
  return inject<PageHostRuntimeServices | null>(PAGE_HOST_RUNTIME_SERVICES_KEY, null);
}

function assertRuntimeFeatureServices(
  definition: WidgetDefinition,
  hostServices: PageHostRuntimeServices | null
): void {
  definition.capabilities.runtimeFeatures.forEach((feature) => {
    const requiredKeys = FEATURE_SERVICE_KEYS[feature] || [];
    requiredKeys.forEach((key) => {
      if (typeof hostServices?.[key as keyof PageHostRuntimeServices] === 'function') {
        return;
      }

      console.warn(
        `[widget-runtime-bridge] Widget "${definition.type}" requires "${key}" for feature "${feature}", but the host service is unavailable.`
      );
    });
  });
}

function shouldExposeFeature(
  definitionRef: ComputedRef<WidgetDefinition>,
  feature: WidgetRuntimeFeature
): boolean {
  return definitionRef.value.capabilities.runtimeFeatures.includes(feature);
}

function provideWidgetRuntimeBridge(
  definitionRef: ComputedRef<WidgetDefinition>,
  hostServices: PageHostRuntimeServices | null,
  lifecycleBridge: WidgetScopedLifecycleBridge | null
): void {
  provide('getConfirmModal', () =>
    shouldExposeFeature(definitionRef, 'confirmModal')
      ? hostServices?.getConfirmModal?.()
      : null
  );

  provide('openUiModal', (modalName: string) => {
    if (!shouldExposeFeature(definitionRef, 'modalControl')) {
      return Promise.resolve(null);
    }

    return hostServices?.openUiModal?.(modalName) ?? Promise.resolve(null);
  });

  provide('closeUiModal', () => {
    if (!shouldExposeFeature(definitionRef, 'modalControl')) {
      return;
    }

    return hostServices?.closeUiModal?.();
  });

  provide('showAppNotification', (message: string, type?: NotificationType) => {
    if (!shouldExposeFeature(definitionRef, 'notifications')) {
      return;
    }

    hostServices?.showAppNotification?.(message, type);
  });

  provide('reportAppError', (error: unknown, options?: Record<string, unknown>) => {
    if (!shouldExposeFeature(definitionRef, 'errorHandling')) {
      return null;
    }

    return hostServices?.reportAppError?.(error, options) ?? null;
  });

  provide('handleRecoverableAppError', (error: unknown, options?: Record<string, unknown>) => {
    if (!shouldExposeFeature(definitionRef, 'errorHandling')) {
      return null;
    }

    return hostServices?.handleRecoverableAppError?.(error, options) ?? null;
  });

  provide('getWidgetAttrsByName', (widgetName: string) => {
    if (!shouldExposeFeature(definitionRef, 'attrsAccess')) {
      return null;
    }

    return hostServices?.getWidgetAttrsByName?.(widgetName) ?? null;
  });

  provide('getWidgetRuntimeValueByName', (widgetName: string) => {
    if (!shouldExposeFeature(definitionRef, 'attrsAccess')) {
      return undefined;
    }

    return hostServices?.getWidgetRuntimeValueByName?.(widgetName);
  });

  provide('getAllAttrsMap', () => {
    if (!shouldExposeFeature(definitionRef, 'attrsAccess')) {
      return {};
    }

    return hostServices?.getAllAttrsMap?.() ?? {};
  });

  provide('getCurrentPageNameFromRuntime', () => {
    if (!shouldExposeFeature(definitionRef, 'attrsAccess')) {
      return '';
    }

    return hostServices?.getCurrentPageNameFromRuntime?.() ?? '';
  });

  provide('getModalRuntimeState', () => {
    if (!shouldExposeFeature(definitionRef, 'modalControl')) {
      return null;
    }

    return hostServices?.getModalRuntimeState?.() ?? null;
  });

  provide('getModalRuntimeController', () => {
    if (!shouldExposeFeature(definitionRef, 'modalControl')) {
      return null;
    }

    return hostServices?.getModalRuntimeController?.() ?? null;
  });

  provide('setActiveWidgetLifecycle', () => {
    if (!definitionRef.value.capabilities.draftCommit) {
      return;
    }

    lifecycleBridge?.setActiveWidgetLifecycle();
  });

  provide('clearActiveWidgetLifecycle', () => {
    if (!definitionRef.value.capabilities.draftCommit) {
      return;
    }

    lifecycleBridge?.clearActiveWidgetLifecycle();
  });
}

export type {
  NotificationType,
  PageHostRuntimeServices,
  WidgetScopedLifecycleBridge
};

export {
  FEATURE_SERVICE_KEYS,
  PAGE_HOST_RUNTIME_SERVICES_KEY,
  assertRuntimeFeatureServices,
  injectPageHostRuntimeServices,
  provideWidgetRuntimeBridge
};
