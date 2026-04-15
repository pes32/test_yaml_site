import { computed, ref, type Ref } from 'vue';
import {
  formatTime,
  getNow,
  normalizeTimeInputValue,
  normalizeTimePart,
  pickerStateFromTime
} from './core.ts';
import type { ParsedTime, TimePickerState } from './core.ts';

type TimePartKey = 'pickerHour' | 'pickerMinute' | 'pickerSecond';

function useTimePart(value: Ref<string>) {
  const initialState = pickerStateFromTime(null, getNow());
  const pickerHour = ref(initialState.pickerHour);
  const pickerMinute = ref(initialState.pickerMinute);
  const pickerSecond = ref(initialState.pickerSecond);
  const pickerHasSeconds = ref(initialState.pickerHasSeconds);

  const preview = computed(() =>
    `${pickerHour.value}:${pickerMinute.value}:${pickerSecond.value}`
  );

  function applyState(state: TimePickerState): void {
    pickerHour.value = state.pickerHour;
    pickerMinute.value = state.pickerMinute;
    pickerSecond.value = state.pickerSecond;
    pickerHasSeconds.value = state.pickerHasSeconds;
  }

  function applyTimePickerState(parsedTime: ParsedTime | null | undefined): ParsedTime | null {
    applyState(pickerStateFromTime(parsedTime, getNow()));
    return parsedTime || null;
  }

  function normalize(rawValue: unknown) {
    const state = normalizeTimeInputValue(rawValue);
    applyTimePickerState(state.parsedTime);
    return state;
  }

  function syncPickerState(rawValue = value.value): ParsedTime | null {
    const { parsedTime } = normalizeTimeInputValue(rawValue);
    return applyTimePickerState(parsedTime);
  }

  function composePickerTimeValue(): string {
    return formatTime(
      {
        h: Number(pickerHour.value),
        m: Number(pickerMinute.value),
        s: Number(pickerSecond.value),
        hasSeconds: pickerHasSeconds.value
      },
      { includeSeconds: pickerHasSeconds.value }
    );
  }

  function setPart(part: TimePartKey, rawValue: unknown): void {
    const digits = String(rawValue ?? '').replace(/\D+/g, '').slice(0, 2);
    if (part === 'pickerHour') {
      pickerHour.value = digits;
    } else if (part === 'pickerMinute') {
      pickerMinute.value = digits;
    } else {
      pickerSecond.value = digits;
      if (digits.length) {
        pickerHasSeconds.value = true;
      }
    }
  }

  function commitPart(part: TimePartKey, max: number): string {
    const currentValue =
      part === 'pickerHour'
        ? pickerHour.value
        : part === 'pickerMinute'
          ? pickerMinute.value
          : pickerSecond.value;
    const normalized = normalizeTimePart(currentValue, max) || '00';

    if (part === 'pickerHour') {
      pickerHour.value = normalized;
    } else if (part === 'pickerMinute') {
      pickerMinute.value = normalized;
    } else {
      pickerSecond.value = normalized;
      pickerHasSeconds.value = true;
    }

    value.value = composePickerTimeValue();
    return value.value;
  }

  return {
    applyTimePickerState,
    commitPart,
    composePickerTimeValue,
    normalize,
    pickerHasSeconds,
    pickerHour,
    pickerMinute,
    pickerSecond,
    preview,
    setPart,
    syncPickerState
  };
}

export type { TimePartKey };
export default useTimePart;
