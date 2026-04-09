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
import { inject } from 'vue';
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

const getWidgetAttrsByName = inject('getWidgetAttrsByName', null);
const getWidgetRuntimeValueByName = inject('getWidgetRuntimeValueByName', null);

function getCloseButtonConfig() {
  return CLOSE_BUTTON_CONFIG;
}

function getWidgetAttrs(widgetName) {
  if (typeof getWidgetAttrsByName === 'function') {
    return getWidgetAttrsByName(widgetName);
  }

  return {
    widget: 'str',
    label: widgetName
  };
}

function getWidgetValue(widgetName) {
  return typeof getWidgetRuntimeValueByName === 'function'
    ? getWidgetRuntimeValueByName(widgetName)
    : undefined;
}
</script>
