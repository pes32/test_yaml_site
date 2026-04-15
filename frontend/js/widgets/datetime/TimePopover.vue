<template>
  <div
    ref="root"
    class="widget-dt-popover widget-dt-popover--time"
    :style="popoverStyle"
    @keydown.escape.prevent="$emit('close')"
  >
    <div class="widget-dt-panel-head">
      <div class="widget-dt-panel-label">Время</div>
    </div>
    <div class="widget-dt-time-preview">{{ preview }}</div>
    <div class="widget-dt-time-editors">
      <div class="widget-dt-time-editor">
        <span class="widget-dt-time-caption">Часы</span>
        <input
          type="text"
          inputmode="numeric"
          class="widget-dt-time-editor-input"
          :value="pickerHour"
          @input="$emit('part-input', 'pickerHour', $event)"
          @blur="$emit('part-commit', 'pickerHour', 23, false)"
          @keydown.enter.prevent="$emit('part-commit', 'pickerHour', 23, false)"
        >
      </div>
      <div class="widget-dt-time-separator">:</div>
      <div class="widget-dt-time-editor">
        <span class="widget-dt-time-caption">Минуты</span>
        <input
          type="text"
          inputmode="numeric"
          class="widget-dt-time-editor-input"
          :value="pickerMinute"
          @input="$emit('part-input', 'pickerMinute', $event)"
          @blur="$emit('part-commit', 'pickerMinute', 59, false)"
          @keydown.enter.prevent="$emit('part-commit', 'pickerMinute', 59, false)"
        >
      </div>
      <div class="widget-dt-time-separator">:</div>
      <div class="widget-dt-time-editor">
        <span class="widget-dt-time-caption">Секунды</span>
        <input
          type="text"
          inputmode="numeric"
          class="widget-dt-time-editor-input"
          :value="pickerSecond"
          @input="$emit('part-input', 'pickerSecond', $event)"
          @blur="$emit('part-commit', 'pickerSecond', 59, true)"
          @keydown.enter.prevent="$emit('part-commit', 'pickerSecond', 59, true)"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { DateTimePopoverStyle } from './types.ts';
import type { TimePartKey } from './useTimePart.ts';

defineProps<{
  pickerHour: string;
  pickerMinute: string;
  pickerSecond: string;
  popoverStyle: DateTimePopoverStyle;
  preview: string;
}>();

defineEmits<{
  close: [];
  'part-commit': [part: TimePartKey, max: number, shouldClose: boolean];
  'part-input': [part: TimePartKey, event: Event];
}>();

const root = ref<HTMLElement | null>(null);

defineExpose({
  getRoot: () => root.value
});
</script>
