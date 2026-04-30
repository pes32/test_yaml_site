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

<script setup lang="ts">
import { injectPageHostRuntimeServices } from '../../runtime/widget_runtime_bridge.ts';
import { createModalWidgetAccess } from './modal_widget_access.ts';
import WidgetRenderer from './WidgetRenderer.vue';

defineOptions({
  name: 'ModalButtons'
});

const CLOSE_BUTTON_CONFIG = Object.freeze({
  widget: 'button',
  label: 'Закрыть',
  command: 'CLOSE_MODAL'
});

defineProps<{
  buttons: string[];
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'execute', payload: unknown): void;
}>();

const hostServices = injectPageHostRuntimeServices();
const { getWidgetAttrs, getWidgetValue } = createModalWidgetAccess(hostServices);

function getCloseButtonConfig() {
  return CLOSE_BUTTON_CONFIG;
}
</script>
