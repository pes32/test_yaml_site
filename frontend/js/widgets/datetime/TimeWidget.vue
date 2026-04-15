<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ 'widget-dt': true, error: !!tableCellCommitError }"
    :wrap-data="{ 'data-type': 'time' }"
    :has-supporting="!!widgetConfig.sup_text"
  >
    <div
      ref="pickerHost"
      class="widget-dt-host"
      v-bind="tableCellRootAttrs"
    >
      <div class="widget-dt-inner">
        <date-time-segment
          ref="timeAnchor"
          v-model="value"
          kind="time"
          segment-class="widget-dt-segment--single"
          input-class="widget-dt-input--time"
          :readonly="widgetConfig.readonly"
          :icon-src="clockIconSrc"
          accessible-label="Выбрать время"
          @input="onInput"
          @focus="onFocus"
          @blur="onBlur"
          @enter="onEnterCommit"
          @open="openPicker"
        ></date-time-segment>
      </div>
    </div>
    <Teleport to="body">
      <time-popover
        v-if="isTimeOpen"
        ref="timePopoverRef"
        :popover-style="timePopover.style.value"
        :preview="timePart.preview.value"
        :picker-hour="timePart.pickerHour.value"
        :picker-minute="timePart.pickerMinute.value"
        :picker-second="timePart.pickerSecond.value"
        @part-input="onPickerPartInput"
        @part-commit="commitPickerPart"
        @close="closePopovers"
      ></time-popover>
    </Teleport>
    <template #supporting>
      <span>{{ widgetConfig.sup_text }}</span>
    </template>
  </md3-field>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import Md3Field from '../common/Md3Field.vue';
import DateTimeSegment from './DateTimeSegment.vue';
import TimePopover from './TimePopover.vue';
import useDateTimeField, { type DateTimeCommitContext } from './useDateTimeField.ts';
import useFloatingPopover from './useFloatingPopover.ts';
import useTimePart, { type TimePartKey } from './useTimePart.ts';
import type {
  DateTimeSegmentExpose,
  DateTimeWidgetEmit,
  DateTimeWidgetProps,
  PopoverExpose
} from './types.ts';

defineOptions({
  name: 'TimeWidget'
});

const CLOCK_ICON_SRC = '/templates/icons/clock.svg';

const props = defineProps<DateTimeWidgetProps>();
const emit = defineEmits<DateTimeWidgetEmit>();

const value = ref('');
const isTimeOpen = ref(false);
const pickerHost = ref<HTMLElement | null>(null);
const timeAnchor = ref<DateTimeSegmentExpose | null>(null);
const timePopoverRef = ref<PopoverExpose | null>(null);
const clockIconSrc = CLOCK_ICON_SRC;

const field = useDateTimeField(props, emit, value);
const timePart = useTimePart(value);
const timePopover = useFloatingPopover(
  () => [pickerHost.value, timePopover.elementFromExpose(timePopoverRef)],
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
  isTimeOpen.value = false;
  timePopover.unbind();
}

function syncTimePopoverPosition(): void {
  if (!isTimeOpen.value) {
    return;
  }
  timePopover.update(
    timePopover.elementFromExpose(timeAnchor),
    timePopover.elementFromExpose(timePopoverRef),
    'end'
  );
}

function applyPickedTime(shouldClose = false): void {
  value.value = timePart.composePickerTimeValue();
  field.emitInput(value.value);
  if (shouldClose) {
    closePopovers();
  }
}

function onPickerPartInput(part: TimePartKey, event: Event): void {
  const target = event.target;
  timePart.setPart(part, target instanceof HTMLInputElement ? target.value : '');
}

function commitPickerPart(part: TimePartKey, max: number, shouldClose = false): void {
  timePart.commitPart(part, max);
  applyPickedTime(shouldClose);
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

  const state = timePart.normalize(value.value);
  value.value = state.value;
  return field.commitValue(
    value.value,
    state.parsedTime ? '' : 'Неверный формат времени',
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

  timePart.syncPickerState(value.value);
  isTimeOpen.value = true;
  timePopover.setHidden();
  void nextTick(() => {
    syncTimePopoverPosition();
    timePopover.bind(syncTimePopoverPosition);
  });
}

function openTimePicker(): void {
  openPicker();
}

function setValue(nextValue: unknown): void {
  if (!nextValue) {
    value.value = '';
    return;
  }

  const state = timePart.normalize(nextValue);
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
  openPicker,
  openTimePicker,
  setValue,
  tableCellCommitError,
  value
});
</script>
