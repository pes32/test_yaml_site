<template>
  <div class="widget-container u-wide">
    <button
      class="widget-button inline-flex-center"
      :class="buttonClasses"
      :style="standaloneButtonStyle"
      :title="buttonTitle"
      @click="onButtonClick"
    >
      <action-button-content
        :icon-name="iconName"
        :icon-style="iconStyle"
        :label="buttonLabel"
      ></action-button-content>
    </button>

    <div v-if="supportingText" class="widget-info">
      <span>{{ supportingText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import ActionButtonContent from '../action-button/ActionButtonContent.vue';
import { parseButtonAction } from '../../runtime/action_runtime.ts';
import useActionButtonVisual from '../action-button/useActionButtonVisual.ts';
import useActionExecution from '../action-button/useActionExecution.ts';
import type { ActionWidgetEmit, ActionWidgetProps } from '../action-button/types.ts';

defineOptions({
  name: 'ButtonWidget'
});

const props = defineProps<ActionWidgetProps>();
const emit = defineEmits<ActionWidgetEmit>();

const getConfirmModal = inject<() => unknown | null>('getConfirmModal', () => null);
const openUiModal = inject<((modalName: string) => Promise<unknown> | unknown) | null>(
  'openUiModal',
  null
);
const closeUiModal = inject<(() => Promise<unknown> | unknown) | null>(
  'closeUiModal',
  null
);

const value = ref<unknown>('');
const buttonAction = computed(() => parseButtonAction(props.widgetConfig));

const {
  buttonClasses,
  buttonLabel,
  buttonTitle,
  iconName,
  iconStyle,
  standaloneButtonStyle,
  supportingText
} = useActionButtonVisual(props, { fallbackTitle: 'Кнопка' });

const { executeAction } = useActionExecution(props, emit, {
  closeUiModal,
  getConfirmModal,
  openUiModal
});

function onButtonClick(): void {
  if (!buttonAction.value) {
    return;
  }
  void executeAction(buttonAction.value);
}

function setValue(nextValue: unknown): void {
  value.value = nextValue;
}

function getValue(): unknown {
  return value.value;
}

onMounted(() => {
  if (props.widgetConfig.default !== undefined) {
    value.value = props.widgetConfig.default;
  }
});

defineExpose({
  getValue,
  setValue,
  value
});
</script>
