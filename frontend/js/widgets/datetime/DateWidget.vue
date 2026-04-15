<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ 'widget-dt': true, error: !!tableCellCommitError }"
    :wrap-data="{ 'data-type': 'date' }"
    :has-supporting="!!widgetConfig.sup_text"
  >
    <div
      ref="pickerHost"
      class="widget-dt-host"
      v-bind="tableCellRootAttrs"
    >
      <div class="widget-dt-inner">
        <date-time-segment
          ref="dateAnchor"
          v-model="value"
          kind="date"
          segment-class="widget-dt-segment--single"
          input-class="widget-dt-input--date"
          :readonly="widgetConfig.readonly"
          :icon-src="calendarIconSrc"
          accessible-label="Выбрать дату"
          @input="onInput"
          @focus="onFocus"
          @blur="onBlur"
          @enter="onEnterCommit"
          @open="openPicker"
        ></date-time-segment>
      </div>
    </div>
    <Teleport to="body">
      <calendar-popover
        v-if="isCalendarOpen"
        ref="calendarPopoverRef"
        :popover-style="calendarPopover.style.value"
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
    <template #supporting>
      <span>{{ widgetConfig.sup_text }}</span>
    </template>
  </md3-field>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import Md3Field from '../common/Md3Field.vue';
import CalendarPopover from './CalendarPopover.vue';
import DateTimeSegment from './DateTimeSegment.vue';
import useDatePart from './useDatePart.ts';
import useDateTimeField, { type DateTimeCommitContext } from './useDateTimeField.ts';
import useFloatingPopover from './useFloatingPopover.ts';
import type {
  DateTimeSegmentExpose,
  DateTimeWidgetEmit,
  DateTimeWidgetProps,
  PopoverExpose
} from './types.ts';

defineOptions({
  name: 'DateWidget'
});

const CALENDAR_ICON_SRC = '/templates/icons/calendar.svg';

const props = defineProps<DateTimeWidgetProps>();
const emit = defineEmits<DateTimeWidgetEmit>();

const value = ref('');
const isCalendarOpen = ref(false);
const pickerHost = ref<HTMLElement | null>(null);
const dateAnchor = ref<DateTimeSegmentExpose | null>(null);
const calendarPopoverRef = ref<PopoverExpose | null>(null);
const calendarIconSrc = CALENDAR_ICON_SRC;

const field = useDateTimeField(props, emit, value);
const datePart = useDatePart(value);
const calendarPopover = useFloatingPopover(
  () => [pickerHost.value, calendarPopover.elementFromExpose(calendarPopoverRef)],
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

function closePopovers(): void {
  isCalendarOpen.value = false;
  calendarPopover.unbind();
}

function syncCalendarPopoverPosition(): void {
  if (!isCalendarOpen.value) {
    return;
  }
  calendarPopover.update(
    calendarPopover.elementFromExpose(dateAnchor),
    calendarPopover.elementFromExpose(calendarPopoverRef),
    'start'
  );
}

function onInput(): void {
  field.onLiveInput(value.value);
}

function onFocus(): void {
  field.onFocus();
}

function onBlur(): void {
  isFocused.value = false;
  try {
    commitDraft();
  } finally {
    field.deactivateDraftController();
  }
}

function onEnterCommit(event: KeyboardEvent): void {
  if (tableCellMode.value) {
    return;
  }

  event.preventDefault();
  try {
    commitDraft();
  } finally {
    const target = event.target;
    if (target instanceof HTMLElement) {
      target.blur();
    }
  }
}

function commitInput(context?: DateTimeCommitContext) {
  if (!value.value) {
    return field.commitValue(value.value, '', context);
  }

  const state = datePart.normalize(value.value);
  value.value = state.value;
  return field.commitValue(
    value.value,
    state.parsedDate ? '' : 'Неверный формат даты',
    context
  );
}

function commitDraft(context?: DateTimeCommitContext) {
  return commitInput(context);
}

function commitPendingState(context?: DateTimeCommitContext) {
  return commitDraft(context);
}

function openPicker(): void {
  if (props.widgetConfig.readonly) {
    return;
  }

  datePart.openFromValue();
  isCalendarOpen.value = true;
  calendarPopover.setHidden();
  void nextTick(() => {
    syncCalendarPopoverPosition();
    calendarPopover.bind(syncCalendarPopoverPosition);
  });
}

function openDatePicker(): void {
  openPicker();
}

function prevMonth(): void {
  datePart.prevMonth();
  void nextTick(syncCalendarPopoverPosition);
}

function nextMonth(): void {
  datePart.nextMonth();
  void nextTick(syncCalendarPopoverPosition);
}

function selectDate(date: Date): void {
  datePart.selectDate(date);
  field.emitInput(value.value);
  closePopovers();
}

function setValue(nextValue: unknown): void {
  if (!nextValue) {
    value.value = '';
    return;
  }

  const state = datePart.normalize(nextValue);
  value.value = state.value;
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
  setValue,
  tableCellCommitError,
  value
});
</script>
