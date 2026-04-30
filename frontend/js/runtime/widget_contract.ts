import { STATEFUL_WIDGET_TYPES, type StatefulWidgetType } from '../shared/widget_types.ts';
import { formatNowValueForWidgetType } from '../shared/date_time_format.ts';
import {
  normalizeChoiceValue,
  normalizeScalarStringValue
} from '../shared/choice_value.ts';

type WidgetConfigLike =
  | string
  | WidgetConfigRecord
  | null
  | undefined;

type NormalizeStatefulWidgetValueOptions = {
  now?: Date;
  useDefaultOnUndefined?: boolean;
};

type NormalizedStatefulWidgetValue = string | string[];

type ListOptionRecord = {
  id?: unknown;
  label?: unknown;
  value?: unknown;
};

type WidgetConfigRecord = {
  default?: unknown;
  multiselect?: boolean;
  widget?: unknown;
};

type NormalizedListOption = {
  id: string;
  label: string;
  value: string;
};

function asWidgetConfig(configOrType: WidgetConfigLike): WidgetConfigRecord | null {
  if (
    configOrType &&
    typeof configOrType === 'object' &&
    !Array.isArray(configOrType)
  ) {
    return configOrType;
  }

  return null;
}

function normalizeWidgetType(configOrType: WidgetConfigLike): string {
  if (typeof configOrType === 'string') {
    return configOrType.trim();
  }

  const config = asWidgetConfig(configOrType);
  if (config && typeof config.widget === 'string') {
    return config.widget.trim();
  }

  return '';
}

function isStatefulWidgetType(type: WidgetConfigLike): boolean {
  return STATEFUL_WIDGET_TYPES.has(normalizeWidgetType(type) as StatefulWidgetType);
}

function isStatefulWidgetConfig(widgetConfig: WidgetConfigLike): boolean {
  return isStatefulWidgetType(widgetConfig);
}

function isListMultiselect(widgetConfig: WidgetConfigLike): boolean {
  const config = asWidgetConfig(widgetConfig);
  return normalizeWidgetType(widgetConfig) === 'list' && config?.multiselect === true;
}

function isVocMultiselect(widgetConfig: WidgetConfigLike): boolean {
  const config = asWidgetConfig(widgetConfig);
  return normalizeWidgetType(widgetConfig) === 'voc' && config?.multiselect === true;
}

function isChoiceWidgetMultiselect(widgetConfig: WidgetConfigLike): boolean {
  return isListMultiselect(widgetConfig) || isVocMultiselect(widgetConfig);
}

function normalizeStatefulWidgetValue(
  widgetConfig: WidgetConfigLike,
  value: unknown,
  options: NormalizeStatefulWidgetValueOptions = {}
): NormalizedStatefulWidgetValue {
  const widgetType = normalizeWidgetType(widgetConfig);
  const now = options.now instanceof Date ? options.now : new Date();
  const config = asWidgetConfig(widgetConfig);
  let rawValue = value;

  if (
    rawValue === undefined &&
    options.useDefaultOnUndefined === true &&
    config &&
    Object.prototype.hasOwnProperty.call(config, 'default')
  ) {
    rawValue = config.default;
  }

  if (rawValue === undefined) {
    return isChoiceWidgetMultiselect(widgetConfig) ? [] : '';
  }

  if (
    (widgetType === 'date' ||
      widgetType === 'time' ||
      widgetType === 'datetime') &&
    rawValue === 'now'
  ) {
    return formatNowValueForWidgetType(widgetType, now);
  }

  if (isChoiceWidgetMultiselect(widgetConfig)) {
    return normalizeChoiceValue(rawValue, true, { coerceToString: true }) as string[];
  }

  return normalizeScalarStringValue(rawValue);
}

function resolveInitialWidgetValue(
  widgetConfig: WidgetConfigLike,
  options: NormalizeStatefulWidgetValueOptions = {}
): NormalizedStatefulWidgetValue | undefined {
  if (!isStatefulWidgetConfig(widgetConfig)) {
    return undefined;
  }

  return normalizeStatefulWidgetValue(widgetConfig, undefined, {
    ...options,
    useDefaultOnUndefined: true
  });
}

function normalizedStatefulValueEquals(
  left: NormalizedStatefulWidgetValue | undefined,
  right: NormalizedStatefulWidgetValue | undefined
): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }

    return true;
  }

  return left === right;
}

function normalizeListOption(
  item: unknown,
  index: number,
  duplicateValueCounts: Map<string, number> | null = null
): NormalizedListOption {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const option = item as ListOptionRecord;
    const hasValue = Object.prototype.hasOwnProperty.call(option, 'value');
    const hasLabel = Object.prototype.hasOwnProperty.call(option, 'label');
    const hasId = Object.prototype.hasOwnProperty.call(option, 'id');
    const value = hasValue
      ? normalizeScalarStringValue(option.value)
      : hasLabel
        ? normalizeScalarStringValue(option.label)
        : hasId
          ? normalizeScalarStringValue(option.id)
          : '';
    const label = hasLabel ? normalizeScalarStringValue(option.label) : value;
    const explicitId = hasId ? normalizeScalarStringValue(option.id) : '';
    const shouldUseFallbackId =
      !explicitId &&
      duplicateValueCounts != null &&
      (duplicateValueCounts.get(value) || 0) > 1;

    return {
      id: explicitId || (shouldUseFallbackId ? `legacy:${index}:${value}` : `value:${value}`),
      label,
      value
    };
  }

  const value = normalizeScalarStringValue(item);
  const shouldUseFallbackId =
    duplicateValueCounts != null &&
    (duplicateValueCounts.get(value) || 0) > 1;
  return {
    id: shouldUseFallbackId ? `legacy:${index}:${value}` : `value:${value}`,
    label: value,
    value
  };
}

function normalizeListOptions(source: unknown): NormalizedListOption[] {
  if (!Array.isArray(source)) {
    return [];
  }

  const duplicateValueCounts = new Map<string, number>();

  source.forEach((item) => {
    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      Object.prototype.hasOwnProperty.call(item, 'id')
    ) {
      return;
    }

    const normalized = normalizeListOption(item, -1, null);
    duplicateValueCounts.set(
      normalized.value,
      (duplicateValueCounts.get(normalized.value) || 0) + 1
    );
  });

  return source.map((item, index) => normalizeListOption(item, index, duplicateValueCounts));
}

export type {
  ListOptionRecord,
  NormalizeStatefulWidgetValueOptions,
  NormalizedListOption,
  NormalizedStatefulWidgetValue,
  StatefulWidgetType,
  WidgetConfigLike
};

export {
  STATEFUL_WIDGET_TYPES,
  isChoiceWidgetMultiselect,
  isListMultiselect,
  isStatefulWidgetConfig,
  isStatefulWidgetType,
  isVocMultiselect,
  normalizeListOption,
  normalizeListOptions,
  normalizeStatefulWidgetValue,
  normalizeWidgetType,
  normalizedStatefulValueEquals,
  resolveInitialWidgetValue
};
