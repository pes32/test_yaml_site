<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="wrapExtra"
    :wrap-data="{ 'data-type': mode }"
    :has-supporting="!!widgetConfig.sup_text"
    :container-modifier="isDateTimeMode ? 'datetime' : undefined"
  >
    <div
      ref="pickerHost"
      :class="hostClass"
      v-bind="tableCellRootAttrs"
    >
      <div :class="innerClass">
        <date-time-segment
          v-if="hasDateSegment"
          ref="dateAnchor"
          v-model="dateValue"
          kind="date"
          :segment-class="dateSegmentClass"
          input-class="widget-dt-input--date"
          :readonly="widgetConfig.readonly"
          :icon-src="calendarIconSrc"
          accessible-label="Выбрать дату"
          @input="onDateInput"
          @focus="onSegmentFocus"
          @blur="onDateBlur"
          @enter="onDateEnterCommit"
          @open="openDatePicker"
        ></date-time-segment>
        <date-time-segment
          v-if="hasTimeSegment"
          ref="timeAnchor"
          v-model="timeValue"
          kind="time"
          :segment-class="timeSegmentClass"
          input-class="widget-dt-input--time"
          :readonly="widgetConfig.readonly"
          :icon-src="clockIconSrc"
          accessible-label="Выбрать время"
          @input="onTimeInput"
          @focus="onSegmentFocus"
          @blur="onTimeBlur"
          @enter="onTimeEnterCommit"
          @open="openTimePicker"
        ></date-time-segment>
      </div>
    </div>
    <Teleport to="body">
      <calendar-popover
        v-if="isDatePopoverOpen"
        ref="datePopoverRef"
        :popover-style="popover.style.value"
        :preview="datePart.preview.value"
        :month-label="datePart.monthLabel.value"
        :weekday-labels="datePart.weekdayLabels.value"
        :days="datePart.calendarDays.value"
        @prev="prevMonth"
        @next="nextMonth"
        @select="selectDate"
        @close="closePopovers"
      ></calendar-popover>
    </Teleport>
    <Teleport to="body">
      <time-popover
        v-if="isTimePopoverOpen"
        ref="timePopoverRef"
        :popover-style="popover.style.value"
        :preview="timePart.preview.value"
        :picker-hour="timePart.pickerHour.value"
        :picker-minute="timePart.pickerMinute.value"
        :picker-second="timePart.pickerSecond.value"
        @part-input="onTimePickerPartInput"
        @part-commit="commitTimePickerPart"
        @close="closePopovers"
      ></time-popover>
    </Teleport>
    <template #supporting>
      <span>{{ widgetConfig.sup_text }}</span>
    </template>
  </md3-field>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import Md3Field from '../common/Md3Field.vue';
import CalendarPopover from './CalendarPopover.vue';
import DateTimeSegment from './DateTimeSegment.vue';
import TimePopover from './TimePopover.vue';
import { splitDateTimeValue } from './core.ts';
import useDatePart from './useDatePart.ts';
import useDateTimeField, { type DateTimeCommitContext } from './useDateTimeField.ts';
import useFloatingPopover from './useFloatingPopover.ts';
import useTimePart, { type TimePartKey } from './useTimePart.ts';
import type {
  DateTimeMode,
  DateTimeSegmentExpose,
  DateTimeWidgetEmit,
  DateTimeWidgetProps,
  PopoverExpose
} from './types.ts';

defineOptions({
  name: 'DateTimeInputWidget'
});

const CALENDAR_ICON_SRC = '/templates/icons/calendar.svg';
const CLOCK_ICON_SRC = '/templates/icons/clock.svg';

const props = defineProps<DateTimeWidgetProps>();
const emit = defineEmits<DateTimeWidgetEmit>();

const value = ref('');
const dateValue = ref('');
const timeValue = ref('');
const isDatePopoverOpen = ref(false);
const isTimePopoverOpen = ref(false);
const pickerHost = ref<HTMLElement | null>(null);
const dateAnchor = ref<DateTimeSegmentExpose | null>(null);
const timeAnchor = ref<DateTimeSegmentExpose | null>(null);
const datePopoverRef = ref<PopoverExpose | null>(null);
const timePopoverRef = ref<PopoverExpose | null>(null);
const calendarIconSrc = CALENDAR_ICON_SRC;
const clockIconSrc = CLOCK_ICON_SRC;

const mode = computed<DateTimeMode>(() => {
  const widgetType = String(props.widgetConfig.widget || '').trim();
  return widgetType === 'time' || widgetType === 'datetime' ? widgetType : 'date';
});
const isDateTimeMode = computed(() => mode.value === 'datetime');
const hasDateSegment = computed(() => mode.value !== 'time');
const hasTimeSegment = computed(() => mode.value !== 'date');
const hostClass = computed(() => ({
  'widget-dt-host': true,
  'widget-dt-host--datetime': isDateTimeMode.value
}));
const innerClass = computed(() => ({
  'widget-dt-inner': true,
  'widget-dt-inner--datetime': isDateTimeMode.value
}));
const dateSegmentClass = computed(() =>
  isDateTimeMode.value ? 'widget-dt-segment--date' : 'widget-dt-segment--single'
);
const timeSegmentClass = computed(() =>
  isDateTimeMode.value ? 'widget-dt-segment--time' : 'widget-dt-segment--single'
);

const field = useDateTimeField(props, emit, value);
const datePart = useDatePart(dateValue);
const timePart = useTimePart(timeValue);
const popover = useFloatingPopover(
  () => [
    pickerHost.value,
    popover.elementFromExpose(datePopoverRef),
    popover.elementFromExpose(timePopoverRef)
  ],
  closePopovers
);

const {
  hasValue,
  isFocused,
  labelFloats,
  tableCellCommitError,
  tableCellMode,
  tableCellRootAttrs
} = field;

const wrapExtra = computed(() => ({
  'widget-dt': true,
  'widget-dt--datetime': isDateTimeMode.value,
  error: !!tableCellCommitError.value
}));

function closePopovers(): void {
  isDatePopoverOpen.value = false;
  isTimePopoverOpen.value = false;
  popover.unbind();
}

function refreshOpenPopovers(): void {
  if (isDatePopoverOpen.value) {
    popover.update(
      popover.elementFromExpose(dateAnchor),
      popover.elementFromExpose(datePopoverRef),
      'start'
    );
  }
  if (isTimePopoverOpen.value) {
    popover.update(
      popover.elementFromExpose(timeAnchor),
      popover.elementFromExpose(timePopoverRef),
      'end'
    );
  }
}

function composeValue(): string {
  if (mode.value === 'date') {
    return dateValue.value;
  }
  if (mode.value === 'time') {
    return timeValue.value;
  }
  return [dateValue.value, timeValue.value].filter(Boolean).join(' ');
}

function syncValue(shouldEmit = true): void {
  value.value = composeValue();
  if (shouldEmit) {
    field.emitInput(value.value);
  }
}

function onSegmentFocus(): void {
  field.onFocus();
}

function finalizeSegmentBlur(commitHandler: () => void): void {
  isFocused.value = false;
  const shouldScheduleDeactivation = isDateTimeMode.value && !tableCellMode.value;

  try {
    commitHandler();
  } finally {
    if (!shouldScheduleDeactivation) {
      field.deactivateDraftController();
      return;
    }

    window.setTimeout(() => {
      const active = document.activeElement;
      const root = pickerHost.value;
      if (root && active && root.contains(active)) {
        return;
      }
      field.deactivateDraftController();
    }, 0);
  }
}

function commitDateInput(context?: DateTimeCommitContext) {
  if (!dateValue.value) {
    syncValue(false);
    return field.commitValue(value.value, '', context);
  }

  const state = datePart.normalize(dateValue.value);
  dateValue.value = state.value;
  syncValue(false);
  return field.commitValue(
    value.value,
    state.parsedDate ? '' : 'Неверный формат даты',
    context
  );
}

function commitTimeInput(context?: DateTimeCommitContext) {
  if (!timeValue.value) {
    syncValue(false);
    return field.commitValue(value.value, '', context);
  }

  const state = timePart.normalize(timeValue.value);
  timeValue.value = state.value;
  syncValue(false);
  return field.commitValue(
    value.value,
    state.parsedTime ? '' : 'Неверный формат времени',
    context
  );
}

function commitDraft(context?: DateTimeCommitContext) {
  if (mode.value === 'date') {
    return commitDateInput(context);
  }
  if (mode.value === 'time') {
    return commitTimeInput(context);
  }

  const dateResult = commitDateInput(context);
  const timeResult = commitTimeInput(context);
  return timeResult || dateResult;
}

function commitPendingState(context?: DateTimeCommitContext) {
  return commitDraft(context);
}

function onDateInput(): void {
  syncValue(tableCellMode.value);
  if (!tableCellMode.value) {
    field.activateDraftController();
  }
}

function onTimeInput(): void {
  syncValue(tableCellMode.value);
  if (!tableCellMode.value) {
    field.activateDraftController();
  }
}

function onDateBlur(): void {
  finalizeSegmentBlur(() => {
    commitDateInput();
  });
}

function onTimeBlur(): void {
  finalizeSegmentBlur(() => {
    commitTimeInput();
  });
}

function onDateEnterCommit(event: KeyboardEvent): void {
  if (tableCellMode.value) {
    return;
  }

  event.preventDefault();
  try {
    commitDateInput();
  } finally {
    const target = event.target;
    if (target instanceof HTMLElement) {
      target.blur();
    }
  }
}

function onTimeEnterCommit(event: KeyboardEvent): void {
  if (tableCellMode.value) {
    return;
  }

  event.preventDefault();
  try {
    commitTimeInput();
  } finally {
    const target = event.target;
    if (target instanceof HTMLElement) {
      target.blur();
    }
  }
}

function openDatePicker(): void {
  if (props.widgetConfig.readonly || !hasDateSegment.value) {
    return;
  }

  datePart.openFromValue();
  isDatePopoverOpen.value = true;
  isTimePopoverOpen.value = false;
  popover.setHidden();
  void nextTick(() => {
    refreshOpenPopovers();
    popover.bind(refreshOpenPopovers);
  });
}

function openTimePicker(): void {
  if (props.widgetConfig.readonly || !hasTimeSegment.value) {
    return;
  }

  timePart.syncPickerState(timeValue.value);
  isTimePopoverOpen.value = true;
  isDatePopoverOpen.value = false;
  popover.setHidden();
  void nextTick(() => {
    refreshOpenPopovers();
    popover.bind(refreshOpenPopovers);
  });
}

function openPicker(): void {
  if (hasDateSegment.value) {
    openDatePicker();
    return;
  }
  openTimePicker();
}

function prevMonth(): void {
  datePart.prevMonth();
  void nextTick(refreshOpenPopovers);
}

function nextMonth(): void {
  datePart.nextMonth();
  void nextTick(refreshOpenPopovers);
}

function selectDate(date: Date): void {
  datePart.selectDate(date);
  syncValue();
  closePopovers();
}

function onTimePickerPartInput(part: TimePartKey, event: Event): void {
  const target = event.target;
  timePart.setPart(part, target instanceof HTMLInputElement ? target.value : '');
}

function commitTimePickerPart(part: TimePartKey, max: number, shouldClose = false): void {
  timePart.commitPart(part, max);
  syncValue();
  if (shouldClose) {
    closePopovers();
  }
}

function setValue(nextValue: unknown): void {
  if (!nextValue) {
    value.value = '';
    dateValue.value = '';
    timeValue.value = '';
    return;
  }

  if (mode.value === 'date') {
    const state = datePart.normalize(nextValue);
    dateValue.value = state.value;
    timeValue.value = '';
  } else if (mode.value === 'time') {
    const state = timePart.normalize(nextValue);
    dateValue.value = '';
    timeValue.value = state.value;
  } else {
    const { datePart: nextDate, timePart: nextTime } = splitDateTimeValue(nextValue);
    const dateState = datePart.normalize(nextDate);
    const timeState = timePart.normalize(nextTime);
    dateValue.value = dateState.value;
    timeValue.value = timeState.value;
  }
  syncValue(false);
}

function getValue(): string {
  return value.value;
}

watch(
  () => props.widgetConfig.value,
  (nextValue) => {
    if (nextValue === undefined) {
      return;
    }
    field.syncCommittedValue(nextValue, setValue);
  },
  { immediate: true }
);

defineExpose({
  commitDraft,
  commitPendingState,
  getValue,
  openDatePicker,
  openPicker,
  openTimePicker,
  setValue,
  tableCellCommitError,
  value
});
</script>
