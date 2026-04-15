import { computed, ref, type Ref } from 'vue';
import {
  WEEKDAY_LABELS,
  formatDate,
  getCalendarDays,
  getMonthLabel,
  getNow,
  monthStart,
  normalizeDateInputValue,
  parseDate,
  shiftMonth
} from './core.ts';

function useDatePart(value: Ref<string>) {
  const calendarView = ref(monthStart(getNow()));

  const calendarDays = computed(() =>
    getCalendarDays(calendarView.value, value.value)
  );
  const monthLabel = computed(() => getMonthLabel(calendarView.value));
  const weekdayLabels = computed(() => WEEKDAY_LABELS);
  const preview = computed(() => {
    const date = parseDate(value.value) || getNow();
    return formatDate(date);
  });

  function setCalendarViewFromDate(parsedDate: Date | null | undefined): void {
    if (parsedDate) {
      calendarView.value = monthStart(parsedDate);
    }
  }

  function normalize(rawValue: unknown) {
    const state = normalizeDateInputValue(rawValue);
    setCalendarViewFromDate(state.parsedDate);
    return state;
  }

  function openFromValue(): void {
    const parsedDate = parseDate(value.value) || getNow();
    calendarView.value = monthStart(parsedDate);
  }

  function prevMonth(): void {
    calendarView.value = shiftMonth(calendarView.value, -1);
  }

  function nextMonth(): void {
    calendarView.value = shiftMonth(calendarView.value, 1);
  }

  function selectDate(date: Date): string {
    value.value = formatDate(date);
    calendarView.value = monthStart(date);
    return value.value;
  }

  return {
    calendarDays,
    calendarView,
    monthLabel,
    nextMonth,
    normalize,
    openFromValue,
    prevMonth,
    preview,
    selectDate,
    setCalendarViewFromDate,
    weekdayLabels
  };
}

export default useDatePart;
