<template>
  <div class="widget-container u-wide">
    <button
      class="widget-button inline-flex-center"
      :class="[buttonClasses, { 'widget-button--readonly': isReadonly }]"
      :style="standaloneButtonStyle"
      :title="buttonTitle"
      :disabled="isReadonly"
      @click="onButtonClick"
    >
      <action-button-content
        :icon-name="iconName"
        :icon-style="iconStyle"
        :label="buttonLabel"
        :tint-icon-with-text-color="isReadonly"
      ></action-button-content>
    </button>

    <div v-if="supportingText" class="widget-info">
      <span>{{ supportingText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ActionButtonContent from '../action-button/ActionButtonContent.vue';
import { parseButtonAction } from '../../runtime/action_runtime.ts';
import useActionWidgetBase from '../action-button/useActionWidgetBase.ts';
import type { ActionWidgetEmit, ActionWidgetProps } from '../action-button/types.ts';

defineOptions({
  name: 'ButtonWidget'
});

const props = defineProps<ActionWidgetProps>();
const emit = defineEmits<ActionWidgetEmit>();
const buttonAction = computed(() => parseButtonAction(props.widgetConfig));
const isReadonly = computed(() => !!props.widgetConfig.readonly);

const {
  buttonClasses,
  buttonLabel,
  buttonTitle,
  iconName,
  iconStyle,
  getValue,
  executeAction,
  setValue,
  standaloneButtonStyle,
  supportingText,
  value
} = useActionWidgetBase(props, emit, { fallbackTitle: 'Кнопка' });

function onButtonClick(): void {
  if (isReadonly.value || !buttonAction.value) {
    return;
  }
  void executeAction(buttonAction.value);
}

defineExpose({
  getValue,
  setValue,
  value
});
</script>
