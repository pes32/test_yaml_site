<template>
  <div
    ref="root"
    class="widget-dt-popover widget-dt-popover--calendar"
    :style="popoverStyle"
    @keydown.escape.prevent="$emit('close')"
  >
    <div class="widget-dt-panel-head">
      <div class="widget-dt-panel-label">Дата</div>
      <div class="widget-dt-panel-value">{{ preview }}</div>
    </div>
    <div class="widget-dt-popover-header">
      <button type="button" class="widget-dt-nav" aria-label="Предыдущий месяц" @click="$emit('prev')">‹</button>
      <div class="widget-dt-popover-title">{{ monthLabel }}</div>
      <button type="button" class="widget-dt-nav" aria-label="Следующий месяц" @click="$emit('next')">›</button>
    </div>
    <div class="widget-dt-weekdays">
      <span v-for="day in weekdayLabels" :key="day">{{ day }}</span>
    </div>
    <div class="widget-dt-calendar-grid">
      <button
        v-for="day in days"
        :key="day.key"
        type="button"
        class="widget-dt-day"
        :class="{ 'is-outside': !day.inMonth, 'is-today': day.isToday, 'is-selected': day.isSelected }"
        @click="$emit('select', day.date)"
      >
        <span>{{ day.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CalendarDay, DateTimePopoverStyle } from './types.ts';

defineProps<{
  days: CalendarDay[];
  monthLabel: string;
  popoverStyle: DateTimePopoverStyle;
  preview: string;
  weekdayLabels: readonly string[];
}>();

defineEmits<{
  close: [];
  next: [];
  prev: [];
  select: [date: Date];
}>();

const root = ref<HTMLElement | null>(null);

defineExpose({
  getRoot: () => root.value
});
</script>
