<template>
  <div ref="root" class="widget-dt-segment" :class="segmentClass">
    <input
      :value="modelValue"
      type="text"
      class="form-control widget-dt-input"
      :class="inputClass"
      data-table-editor-target="true"
      :disabled="readonly"
      :tabindex="readonly ? -1 : null"
      @input="onInput"
      @focus="$emit('focus', $event)"
      @blur="$emit('blur', $event)"
      @keydown.enter="$emit('enter', $event)"
    >
    <span class="widget-dt-icon-wrap">
      <span
        class="widget-dt-icon"
        :data-table-action-trigger="kind"
        role="button"
        tabindex="-1"
        :aria-label="accessibleLabel"
        @click="$emit('open')"
        @mousedown.prevent
      >
        <img :src="iconSrc" alt="">
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { SegmentKind } from './types.ts';

type Props = {
  accessibleLabel: string;
  iconSrc: string;
  inputClass: string;
  kind: SegmentKind;
  modelValue: string;
  readonly?: boolean;
  segmentClass: string;
};

const props = defineProps<Props>();
const emit = defineEmits<{
  blur: [event: FocusEvent];
  enter: [event: KeyboardEvent];
  focus: [event: FocusEvent];
  input: [event: Event];
  open: [];
  'update:modelValue': [value: string];
}>();

const root = ref<HTMLElement | null>(null);

function onInput(event: Event): void {
  const target = event.target;
  const value = target instanceof HTMLInputElement ? target.value : props.modelValue;
  emit('update:modelValue', value);
  emit('input', event);
}

defineExpose({
  getRoot: () => root.value
});
</script>
