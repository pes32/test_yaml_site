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
type WidgetRegistryEntry = readonly [KnownWidgetType, WidgetComponent];
type WidgetLoaderModule = { default: WidgetComponent };
type WidgetLoader = () => Promise<WidgetComponent | WidgetLoaderModule>;
type AsyncWidgetRegistryEntry = readonly [KnownWidgetType, WidgetLoader];

const DEFAULT_WIDGET_REGISTRY: ReadonlyArray<WidgetRegistryEntry> = Object.freeze([
  ['str', StringWidget],
  ['int', IntWidget],
  ['float', FloatWidget],
  ['ip', IpWidget],
  ['ip_mask', IpMaskWidget],
  ['text', TextWidget],
  ['button', ButtonWidget],
  ['img', ImgWidget]
]);

const DEFAULT_ASYNC_WIDGET_REGISTRY: ReadonlyArray<AsyncWidgetRegistryEntry> = Object.freeze([
  ['list', () => import('./ListWidget.vue')],
  ['voc', () => import('./voc/VocWidget.vue')],
  ['split_button', () => import('./SplitButtonWidget.vue')],
  ['datetime', () => import('./datetime/DateTimeWidget.vue')],
  ['date', () => import('./datetime/DateWidget.vue')],
  ['time', () => import('./datetime/TimeWidget.vue')],
  ['table', () => import('./table/index.js')]
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

class WidgetFactory {
  private readonly asyncWidgetTypes: Map<string, WidgetComponent>;
  private readonly widgetLoaders: Map<string, WidgetLoader>;
  private readonly widgetTypes: Map<string, WidgetComponent>;

  constructor() {
    this.widgetTypes = new Map();
    this.widgetLoaders = new Map();
    this.asyncWidgetTypes = new Map();
    this.registerDefaultWidgets();
  }

  registerDefaultWidgets(
    registry: ReadonlyArray<WidgetRegistryEntry> = DEFAULT_WIDGET_REGISTRY,
    asyncRegistry: ReadonlyArray<AsyncWidgetRegistryEntry> = DEFAULT_ASYNC_WIDGET_REGISTRY
  ): this {
    registry.forEach(([type, component]) => {
      this.register(type, component);
    });
    asyncRegistry.forEach(([type, loader]) => {
      this.registerAsync(type, loader);
    });
    return this;
  }

  register(type: string, widgetComponent: WidgetComponent): this {
    this.widgetTypes.set(type, widgetComponent);
    return this;
  }

  registerAsync(type: string, loader: WidgetLoader): this {
    this.widgetLoaders.set(type, loader);
    this.asyncWidgetTypes.delete(type);
    return this;
  }

  getAsyncWidgetComponent(type: string): WidgetComponent | null {
    if (this.asyncWidgetTypes.has(type)) {
      return this.asyncWidgetTypes.get(type) ?? null;
    }

    const loader = this.widgetLoaders.get(type);
    if (!loader) {
      return null;
    }

    const asyncComponent = defineAsyncComponent({
      loader: () => Promise.resolve(loader()).then(resolveLoadedComponent),
      delay: 120,
      timeout: 15000,
      suspensible: false,
      onError(
        error: Error,
        retry: () => void,
        fail: (error: Error) => void,
        attempts: number
      ) {
        if (attempts < 3) {
          retry();
          return;
        }
        fail(error);
      }
    });

    this.asyncWidgetTypes.set(type, asyncComponent);
    return asyncComponent;
  }

  isAsyncWidgetType(type: string): boolean {
    return this.widgetLoaders.has(type);
  }

  async prefetchWidgetType(type: string): Promise<void> {
    const loader = this.widgetLoaders.get(type);
    if (!loader) {
      return;
    }

    await Promise.resolve(loader()).catch(() => {});
  }

  async prefetchWidgetTypes(types: unknown): Promise<void> {
    const queue = Array.from(new Set(
      (Array.isArray(types) ? types : [])
        .map((type) => typeof type === 'string' ? type.trim() : '')
        .filter(Boolean)
    ));

    await Promise.allSettled(queue.map((type) => this.prefetchWidgetType(type)));
  }

  getWidgetComponent(type: string): WidgetComponent {
    const widgetComponent = this.widgetTypes.get(type);

    if (widgetComponent) {
      return widgetComponent;
    }

    const asyncWidgetComponent = this.getAsyncWidgetComponent(type);
    if (asyncWidgetComponent) {
      return asyncWidgetComponent;
    }

    console.warn(`Неизвестный тип виджета: ${type}, используем StringWidget`);
    return StringWidget;
  }
}

const widgetFactory = new WidgetFactory();

export type {
  AsyncWidgetRegistryEntry,
  KnownWidgetType,
  WidgetComponent,
  WidgetLoader,
  WidgetRegistryEntry
};

export {
  DEFAULT_ASYNC_WIDGET_REGISTRY,
  DEFAULT_WIDGET_REGISTRY,
  WidgetFactory,
  widgetFactory
};
export default widgetFactory;
