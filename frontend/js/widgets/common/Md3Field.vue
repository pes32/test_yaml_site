<template>
  <slot v-if="isTableCellMode"></slot>
  <div
    v-else
    class="widget-container u-wide"
    :class="containerClass"
    :style="containerStyle"
      v-bind="containerAttrs"
      @focusout="emit('containerFocusout', $event)"
  >
    <div class="md3-field" :class="{ filled: hasValue, 'md3-field--readonly': widgetConfig.readonly }">
      <div
        class="md3-field-wrap"
        :class="[wrapClass, wrapStateClass]"
        v-bind="wrapData"
        @focusin="emit('focusin', $event)"
        @focusout="emit('focusout', $event)"
      >
        <slot></slot>
        <label v-if="widgetConfig.label && !isTableCellMode">{{ widgetConfig.label }}</label>
      </div>
      <div v-if="supportingVisible" class="md3-supporting">
        <slot name="supporting"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Md3WidgetConfig = Record<string, unknown> & {
  label?: unknown;
  readonly?: boolean;
  table_cell_mode?: boolean;
  table_consume_keys?: unknown;
  widget?: unknown;
  width?: unknown;
};

type Md3FieldProps = {
  containerModifier?: string;
  hasSupporting?: boolean;
  hasValue?: boolean;
  isFocused?: boolean;
  labelFloats?: boolean;
  widgetConfig: Md3WidgetConfig;
  wrapData?: Record<string, unknown>;
  wrapExtra?: Record<string, unknown>;
  wrapVariant?: string;
};

defineOptions({
  name: 'Md3Field',
  inheritAttrs: false
});

const props = withDefaults(defineProps<Md3FieldProps>(), {
  containerModifier: '',
  hasSupporting: false,
  hasValue: false,
  isFocused: false,
  labelFloats: false,
  wrapData: () => ({}),
  wrapExtra: () => ({}),
  wrapVariant: ''
});

const emit = defineEmits<{
  (event: 'containerFocusout', payload: FocusEvent): void;
  (event: 'focusin', payload: FocusEvent): void;
  (event: 'focusout', payload: FocusEvent): void;
}>();

function resolveMd3ContainerStyle(widgetConfig: Md3WidgetConfig): Record<string, string> {
  if (widgetConfig && widgetConfig.table_cell_mode === true) {
    return {};
  }

  const width = widgetConfig && widgetConfig.width;
  if (width == null || width === '') {
    return {};
  }

  const widthValue = typeof width === 'number' ? `${width}px` : String(width);
  const isTextarea = widgetConfig && widgetConfig.widget === 'text';
  if (isTextarea) {
    return {
      width: 'fit-content',
      minWidth: widthValue,
      maxWidth: 'none',
      '--widget-textarea-base-width': widthValue
    };
  }

  return {
    width: widthValue,
    maxWidth: 'none'
  };
}

function resolveMd3ContainerClass(
  hasExplicitWidth: boolean,
  containerModifier: string
): Record<string, boolean | string> {
  return {
    'widget-explicit-width': hasExplicitWidth,
    [`widget-container--${containerModifier}`]: containerModifier
  };
}

function resolveMd3WrapStateClass(ctx: {
  hasValue: boolean;
  isFocused: boolean;
  labelFloats: boolean;
  widgetConfig: Md3WidgetConfig;
  wrapExtra: Record<string, unknown>;
}): Record<string, boolean> {
  return {
    'is-filled': ctx.hasValue,
    'is-focused': ctx.isFocused,
    'is-error': Boolean(ctx.wrapExtra.error),
    'is-floating': ctx.labelFloats,
    'is-readonly': ctx.widgetConfig.readonly === true
  };
}

function resolveMd3WrapClass(
  wrapExtra: Record<string, unknown>,
  wrapVariant: string
): Record<string, unknown> {
  const { error, ...rest } = wrapExtra;
  return {
    ...rest,
    [`md3-field-wrap--${wrapVariant}`]: wrapVariant
  };
}

const isTableCellMode = computed(() => props.widgetConfig.table_cell_mode === true);
const hasExplicitWidth = computed(() => {
  const width = props.widgetConfig.width;
  return width != null && width !== '';
});
const containerStyle = computed(() => resolveMd3ContainerStyle(props.widgetConfig));
const wrapStateClass = computed(() =>
  resolveMd3WrapStateClass({
    hasValue: props.hasValue,
    isFocused: props.isFocused,
    labelFloats: props.labelFloats,
    widgetConfig: props.widgetConfig,
    wrapExtra: props.wrapExtra
  })
);
const wrapClass = computed(() => resolveMd3WrapClass(props.wrapExtra, props.wrapVariant));
const containerClass = computed(() =>
  Object.assign(
    {},
    resolveMd3ContainerClass(hasExplicitWidth.value, props.containerModifier),
    {
      'widget-container--table-cell': isTableCellMode.value
    }
  )
);
const containerAttrs = computed(() => {
  const attrs: Record<string, string> = {};
  if (isTableCellMode.value) {
    attrs['data-table-embedded-widget'] = 'true';
    if (props.widgetConfig.table_consume_keys) {
      attrs['data-table-consume-keys'] = String(
        props.widgetConfig.table_consume_keys
      );
    }
  }
  return attrs;
});
const supportingVisible = computed(() => props.hasSupporting && !isTableCellMode.value);
</script>
