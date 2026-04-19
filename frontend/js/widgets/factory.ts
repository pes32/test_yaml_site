import { defineAsyncComponent, type Component } from 'vue';
import FloatWidget from './fields/FloatWidget.vue';
import ImgWidget from './fields/ImgWidget.vue';
import IntWidget from './fields/IntWidget.vue';
import IpMaskWidget from './fields/IpMaskWidget.vue';
import IpWidget from './fields/IpWidget.vue';
import StringWidget from './fields/StringWidget.vue';
import TextWidget from './fields/TextWidget.vue';
import ButtonWidget from './fields/ButtonWidget.vue';

type KnownWidgetType =
  | 'button'
  | 'date'
  | 'datetime'
  | 'float'
  | 'img'
  | 'int'
  | 'ip'
  | 'ip_mask'
  | 'list'
  | 'split_button'
  | 'str'
  | 'table'
  | 'text'
  | 'time'
  | 'voc';

type WidgetComponent = Component;
type WidgetLoaderModule = { default: WidgetComponent };
type WidgetLoader = () => Promise<WidgetComponent | WidgetLoaderModule>;
type WidgetRuntimeFeature =
  | 'confirmModal'
  | 'modalControl'
  | 'notifications'
  | 'errorHandling'
  | 'attrsAccess';

type WidgetCapabilities = {
  stateful: boolean;
  draftCommit: boolean;
  emitsInput: boolean;
  emitsExecute: boolean;
  runtimeFeatures: ReadonlyArray<WidgetRuntimeFeature>;
};

type LifecycleCommitResult =
  | {
      status: 'noop' | 'committed';
    }
  | {
      status: 'blocked';
      severity: 'recoverable' | 'fatal';
      error: unknown;
    };

type WidgetLifecycleCommitContext = {
  kind?: string;
};

type WidgetLifecycleInstance = {
  commitPendingState?: (context?: WidgetLifecycleCommitContext) => unknown;
};

type WidgetLifecycleHandle = {
  bind: (instance: unknown | null | undefined) => void;
  unbind: () => void;
  commitPendingState: (
    context?: WidgetLifecycleCommitContext
  ) => Promise<LifecycleCommitResult>;
  dispose: () => void;
};

type WidgetDefinition = {
  type: string;
  capabilities: WidgetCapabilities;
  createLifecycleHandle: () => WidgetLifecycleHandle;
  prefetch: () => Promise<void>;
  resolveComponent: () => WidgetComponent;
};

type WidgetDefinitionRecord = {
  capabilities?: Partial<WidgetCapabilities>;
  component?: WidgetComponent;
  loader?: WidgetLoader;
  type: string;
};

const EMPTY_RUNTIME_FEATURES = Object.freeze([] as WidgetRuntimeFeature[]);

const DEFAULT_WIDGET_CAPABILITIES: WidgetCapabilities = Object.freeze({
  stateful: false,
  draftCommit: false,
  emitsInput: false,
  emitsExecute: false,
  runtimeFeatures: EMPTY_RUNTIME_FEATURES
});

const NOOP_COMMIT_RESULT: LifecycleCommitResult = Object.freeze({
  status: 'noop'
});

const NOOP_LIFECYCLE_HANDLE: WidgetLifecycleHandle = Object.freeze({
  bind() {
    /* no-op */
  },
  unbind() {
    /* no-op */
  },
  async commitPendingState() {
    return NOOP_COMMIT_RESULT;
  },
  dispose() {
    /* no-op */
  }
});

const FIELD_WIDGET_CAPABILITIES: WidgetCapabilities = Object.freeze({
  stateful: true,
  draftCommit: true,
  emitsInput: true,
  emitsExecute: false,
  runtimeFeatures: ['notifications'] as const
});

const BUTTON_CAPABILITIES: WidgetCapabilities = Object.freeze({
  stateful: false,
  draftCommit: false,
  emitsInput: false,
  emitsExecute: true,
  runtimeFeatures: ['confirmModal', 'modalControl'] as const
});

const TABLE_CAPABILITIES: WidgetCapabilities = Object.freeze({
  stateful: false,
  draftCommit: false,
  emitsInput: true,
  emitsExecute: false,
  runtimeFeatures: ['attrsAccess', 'errorHandling', 'notifications'] as const
});

const DEFAULT_WIDGET_DEFINITIONS: ReadonlyArray<WidgetDefinitionRecord> = Object.freeze([
  {
    type: 'str',
    component: StringWidget,
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'int',
    component: IntWidget,
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'float',
    component: FloatWidget,
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'ip',
    component: IpWidget,
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'ip_mask',
    component: IpMaskWidget,
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'text',
    component: TextWidget,
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'button',
    component: ButtonWidget,
    capabilities: BUTTON_CAPABILITIES
  },
  {
    type: 'img',
    component: ImgWidget,
    capabilities: DEFAULT_WIDGET_CAPABILITIES
  },
  {
    type: 'list',
    loader: () => import('./ListWidget.vue'),
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'voc',
    loader: () => import('./voc/VocWidget.vue'),
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'split_button',
    loader: () => import('./SplitButtonWidget.vue'),
    capabilities: BUTTON_CAPABILITIES
  },
  {
    type: 'datetime',
    loader: () => import('./datetime/DateTimeWidget.vue'),
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'date',
    loader: () => import('./datetime/DateWidget.vue'),
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'time',
    loader: () => import('./datetime/TimeWidget.vue'),
    capabilities: FIELD_WIDGET_CAPABILITIES
  },
  {
    type: 'table',
    loader: () => import('./table/index.ts'),
    capabilities: TABLE_CAPABILITIES
  }
]);

function resolveLoadedComponent(moduleValue: WidgetComponent | WidgetLoaderModule): WidgetComponent {
  if (
    moduleValue &&
    typeof moduleValue === 'object' &&
    Object.prototype.hasOwnProperty.call(moduleValue, 'default')
  ) {
    return (moduleValue as WidgetLoaderModule).default;
  }

  return moduleValue as WidgetComponent;
}

function cloneRuntimeFeatures(
  features: ReadonlyArray<WidgetRuntimeFeature> | undefined
): WidgetRuntimeFeature[] {
  if (!Array.isArray(features) || features.length === 0) {
    return [];
  }

  return Array.from(new Set(features));
}

function normalizeCapabilities(
  capabilities: Partial<WidgetCapabilities> | undefined
): WidgetCapabilities {
  return {
    stateful: capabilities?.stateful === true,
    draftCommit: capabilities?.draftCommit === true,
    emitsInput: capabilities?.emitsInput === true,
    emitsExecute: capabilities?.emitsExecute === true,
    runtimeFeatures: cloneRuntimeFeatures(capabilities?.runtimeFeatures)
  };
}

function normalizeLifecycleCommitResult(result: unknown): LifecycleCommitResult {
  if (result && typeof result === 'object') {
    const candidate = result as Record<string, unknown>;
    if (candidate.status === 'noop' || candidate.status === 'committed') {
      return { status: candidate.status };
    }

    if (
      candidate.status === 'blocked' &&
      (candidate.severity === 'recoverable' || candidate.severity === 'fatal')
    ) {
      return {
        status: 'blocked',
        severity: candidate.severity,
        error: candidate.error
      };
    }
  }

  return {
    status: 'committed'
  };
}

function createFatalBlockedResult(error: unknown): LifecycleCommitResult {
  return {
    status: 'blocked',
    severity: 'fatal',
    error
  };
}

function createWidgetLifecycleHandle(): WidgetLifecycleHandle {
  let boundInstance: WidgetLifecycleInstance | null = null;
  let disposed = false;

  return {
    bind(instance) {
      if (disposed) {
        return;
      }

      if (boundInstance === instance) {
        return;
      }

      boundInstance = (instance as WidgetLifecycleInstance | null) ?? null;
    },

    unbind() {
      boundInstance = null;
    },

    async commitPendingState(context = {}) {
      if (disposed || !boundInstance) {
        return NOOP_COMMIT_RESULT;
      }

      const instance = boundInstance;
      if (typeof instance.commitPendingState === 'function') {
        try {
          return normalizeLifecycleCommitResult(
            await Promise.resolve(instance.commitPendingState(context))
          );
        } catch (error) {
          return createFatalBlockedResult(error);
        }
      }

      return NOOP_COMMIT_RESULT;
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      boundInstance = null;
    }
  };
}

class WidgetDefinitionRegistry {
  private readonly warnedUnknownTypes: Set<string>;
  private readonly asyncComponents: Map<string, WidgetComponent>;
  private readonly definitions: Map<string, WidgetDefinition>;

  constructor() {
    this.warnedUnknownTypes = new Set();
    this.asyncComponents = new Map();
    this.definitions = new Map();
    this.registerDefinitions(DEFAULT_WIDGET_DEFINITIONS);
  }

  registerDefinitions(definitions: ReadonlyArray<WidgetDefinitionRecord>): this {
    definitions.forEach((definition) => {
      this.registerDefinition(definition);
    });
    return this;
  }

  registerDefinition(record: WidgetDefinitionRecord): this {
    const normalizedType = String(record.type || '').trim();
    if (!normalizedType) {
      return this;
    }

    const capabilities = normalizeCapabilities(record.capabilities);
    const definition = this.buildDefinition(normalizedType, capabilities, record.component, record.loader);
    this.definitions.set(normalizedType, definition);
    return this;
  }

  private buildDefinition(
    type: string,
    capabilities: WidgetCapabilities,
    component?: WidgetComponent,
    loader?: WidgetLoader
  ): WidgetDefinition {
    const resolveComponent = () => {
      if (component) {
        return component;
      }

      if (!loader) {
        return StringWidget;
      }

      const cached = this.asyncComponents.get(type);
      if (cached) {
        return cached;
      }

      const asyncComponent = defineAsyncComponent({
        loader: () => Promise.resolve(loader()).then(resolveLoadedComponent),
        delay: 120,
        timeout: 15000,
        suspensible: false,
        onError(error: Error, retry: () => void, fail: (error: Error) => void, attempts: number) {
          if (attempts < 3) {
            retry();
            return;
          }

          fail(error);
        }
      });

      this.asyncComponents.set(type, asyncComponent);
      return asyncComponent;
    };

    const prefetch = async () => {
      if (!loader) {
        return;
      }

      await Promise.resolve(loader()).catch(() => {});
    };

    return {
      type,
      capabilities,
      createLifecycleHandle: capabilities.draftCommit
        ? () => createWidgetLifecycleHandle()
        : () => NOOP_LIFECYCLE_HANDLE,
      prefetch,
      resolveComponent
    };
  }

  private warnUnknownType(type: string): void {
    if (!type || this.warnedUnknownTypes.has(type)) {
      return;
    }

    this.warnedUnknownTypes.add(type);
    console.warn(
      `[widget-registry] Unknown widget type "${type}", falling back to StringWidget render path.`
    );
  }

  private createUnknownDefinition(type: string): WidgetDefinition {
    this.warnUnknownType(type);
    return {
      type,
      capabilities: {
        ...DEFAULT_WIDGET_CAPABILITIES,
        runtimeFeatures: []
      },
      createLifecycleHandle: () => NOOP_LIFECYCLE_HANDLE,
      prefetch: async () => {
        /* no-op */
      },
      resolveComponent: () => StringWidget
    };
  }

  getDefinition(type: string): WidgetDefinition {
    const normalizedType = String(type || '').trim();
    if (!normalizedType) {
      return this.definitions.get('str') || this.createUnknownDefinition('str');
    }

    return this.definitions.get(normalizedType) || this.createUnknownDefinition(normalizedType);
  }

  getWidgetComponent(type: string): WidgetComponent {
    return this.getDefinition(type).resolveComponent();
  }

  isAsyncWidgetType(type: string): boolean {
    const normalizedType = String(type || '').trim();
    const definition = normalizedType ? this.definitions.get(normalizedType) : null;
    if (!definition) {
      return false;
    }

    const component = definition.resolveComponent();
    return this.asyncComponents.get(normalizedType) === component;
  }

  async prefetchWidgetType(type: string): Promise<void> {
    await this.getDefinition(type).prefetch();
  }

  async prefetchWidgetTypes(types: unknown): Promise<void> {
    const queue = Array.from(
      new Set(
        (Array.isArray(types) ? types : [])
          .map((type) => (typeof type === 'string' ? type.trim() : ''))
          .filter(Boolean)
      )
    );

    await Promise.allSettled(queue.map((type) => this.prefetchWidgetType(type)));
  }
}

const widgetRegistry = new WidgetDefinitionRegistry();
const widgetFactory = widgetRegistry;

export type {
  KnownWidgetType,
  LifecycleCommitResult,
  WidgetCapabilities,
  WidgetComponent,
  WidgetDefinition,
  WidgetLifecycleCommitContext,
  WidgetLifecycleHandle,
  WidgetLoader,
  WidgetRuntimeFeature
};

export {
  BUTTON_CAPABILITIES,
  DEFAULT_WIDGET_CAPABILITIES,
  DEFAULT_WIDGET_DEFINITIONS,
  FIELD_WIDGET_CAPABILITIES,
  NOOP_COMMIT_RESULT,
  NOOP_LIFECYCLE_HANDLE,
  TABLE_CAPABILITIES,
  WidgetDefinitionRegistry,
  createWidgetLifecycleHandle,
  normalizeLifecycleCommitResult,
  widgetFactory,
  widgetRegistry
};

export default widgetFactory;
