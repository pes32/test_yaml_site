<template>
  <div class="d-flex gap-2 justify-content-end w-100">
    <template v-for="buttonName in buttons" :key="buttonName">
      <WidgetRenderer
        v-if="buttonName === 'CLOSE'"
        :widget-attrs="getCloseButtonConfig()"
        :widget-name="'CLOSE'"
        @execute="emit('execute', $event)"
      />

      <WidgetRenderer
        v-else
        :widget-attrs="getWidgetAttrs(buttonName)"
        :widget-value="getWidgetValue(buttonName)"
        :widget-name="buttonName"
        @execute="emit('execute', $event)"
      />
    </template>
  </div>
</template>

<script setup>
import { injectPageHostRuntimeServices } from '../../runtime/widget_runtime_bridge.ts';
import WidgetRenderer from './WidgetRenderer.vue';

defineOptions({
  name: 'ModalButtons'
});

const CLOSE_BUTTON_CONFIG = Object.freeze({
  widget: 'button',
  label: 'Закрыть',
  command: 'CLOSE_MODAL'
});

defineProps({
  buttons: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['close', 'execute']);

const hostServices = injectPageHostRuntimeServices();

function getCloseButtonConfig() {
  return CLOSE_BUTTON_CONFIG;
}

function getWidgetAttrs(widgetName) {
  if (typeof hostServices?.getWidgetAttrsByName === 'function') {
    return hostServices.getWidgetAttrsByName(widgetName);
  }

  return {
    widget: 'str',
    label: widgetName
  };
}

function getWidgetValue(widgetName) {
  return typeof hostServices?.getWidgetRuntimeValueByName === 'function'
    ? hostServices.getWidgetRuntimeValueByName(widgetName)
    : undefined;
}
</script>
