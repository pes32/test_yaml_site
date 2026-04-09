<template>
  <component
    :is="widgetComponent"
    :key="componentKey"
    :widget-config="resolvedWidgetConfig"
    :widget-name="widgetName"
    @input="emit('input', $event)"
    @execute="emit('execute', $event)"
  />
</template>

<script setup>
import { computed } from 'vue';
import widgetFactory from '../factory.ts';

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

const emit = defineEmits(['input', 'execute']);

let lastResolvedAttrs = null;
let lastResolvedValue = undefined;
let lastResolvedConfig = null;

const resolvedWidgetConfig = computed(() => {
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

const widgetComponent = computed(() => {
  if (widgetFactory && resolvedWidgetConfig.value.widget) {
    return widgetFactory.getWidgetComponent(resolvedWidgetConfig.value.widget);
  }

  return widgetFactory.getWidgetComponent('str');
});

const componentKey = computed(() => {
  const widgetType = resolvedWidgetConfig.value && resolvedWidgetConfig.value.widget
    ? resolvedWidgetConfig.value.widget
    : 'str';

  return `${widgetType}:${props.widgetName}`;
});
</script>
