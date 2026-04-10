import type { DateTimeWidgetVm } from '../widget_shared_contracts.ts';
import {
    WEEKDAY_LABELS,
    formatDate as coreFormatDate,
    formatDateISO as coreFormatDateISO,
    formatTime as coreFormatTime,
    getCalendarDays as coreGetCalendarDays,
    getMonthLabel as coreGetMonthLabel,
    getNow as coreGetNow,
    isSameDay as coreIsSameDay,
    monthStart as coreMonthStart,
    normalizeDateInputValue as coreNormalizeDateInputValue,
    normalizeTimeInputValue as coreNormalizeTimeInputValue,
    normalizeTimePart as coreNormalizeTimePart,
    pad,
    parseDate as coreParseDate,
    parseTime as coreParseTime,
    pickerStateFromTime,
    shiftMonth as coreShiftMonth,
    splitDateTimeValue as coreSplitDateTimeValue
} from './datetime_core.js';
import {
    addFloatingListener as runtimeAddFloatingListener,
    addOutsideListener as runtimeAddOutsideListener,
    removeFloatingListener as runtimeRemoveFloatingListener,
    removeOutsideListener as runtimeRemoveOutsideListener,
    resolveRefElement as runtimeResolveRefElement,
    setHiddenPopover as runtimeSetHiddenPopover,
    updateFloatingPopover as runtimeUpdateFloatingPopover
} from './datetime_popover_runtime.js';

function hasValue(this: DateTimeWidgetVm): boolean {
    return Boolean(this.value);
}

function labelFloats(this: DateTimeWidgetVm): boolean {
    return this.hasValue || this.isFocused;
}

function getNow(): Date {
    return coreGetNow();
}

function monthStart(date: Date): Date {
    return coreMonthStart(date);
}

function shiftMonth(date: Date, delta: number): Date {
    return coreShiftMonth(date, delta);
}

function getMonthLabel(date: Date): string {
    return coreGetMonthLabel(date);
}

function isSameDay(left: Date | null | undefined, right: Date | null | undefined): boolean {
    return coreIsSameDay(left, right);
}

function getCalendarDays(this: DateTimeWidgetVm, viewDate: Date, selectedValue: unknown) {
    return coreGetCalendarDays(viewDate, selectedValue, coreGetNow());
}

function parseDate(this: DateTimeWidgetVm, str: unknown) {
    return coreParseDate(str, coreGetNow());
}

function formatDate(date: Date | null | undefined): string {
    return coreFormatDate(date);
}

function formatDateISO(date: Date | null | undefined): string {
    return coreFormatDateISO(date);
}

function normalizeDateInputValue(this: DateTimeWidgetVm, rawValue: unknown) {
    return coreNormalizeDateInputValue(rawValue, coreGetNow());
}

function setCalendarViewFromDate(this: DateTimeWidgetVm, parsedDate: Date | null | undefined) {
    if (parsedDate) {
        this.calendarView = coreMonthStart(parsedDate);
    }
}

function parseTime(str: unknown) {
    return coreParseTime(str);
}

function formatTime(timeValue: unknown, options: Record<string, unknown> = {}): string {
    return coreFormatTime(timeValue, options);
}

function normalizeTimeInputValue(rawValue: unknown) {
    return coreNormalizeTimeInputValue(rawValue);
}

function normalizeTimePart(rawValue: unknown, max: number): string {
    return coreNormalizeTimePart(rawValue, max);
}

function applyTimePickerState(this: DateTimeWidgetVm, parsedTime: unknown) {
    const nextState = pickerStateFromTime(parsedTime, coreGetNow());
    this.pickerHour = nextState.pickerHour;
    this.pickerMinute = nextState.pickerMinute;
    this.pickerSecond = nextState.pickerSecond;
    this.pickerHasSeconds = nextState.pickerHasSeconds;
    return parsedTime || null;
}

function syncTimePickerState(this: DateTimeWidgetVm, rawValue: unknown) {
    const { parsedTime } = coreNormalizeTimeInputValue(rawValue);
    return applyTimePickerState.call(this, parsedTime);
}

function composePickerTimeValue(this: DateTimeWidgetVm): string {
    return coreFormatTime(
        {
            h: Number(this.pickerHour),
            m: Number(this.pickerMinute),
            s: Number(this.pickerSecond),
            hasSeconds: this.pickerHasSeconds
        },
        { includeSeconds: this.pickerHasSeconds }
    );
}

function splitDateTimeValue(str: unknown) {
    return coreSplitDateTimeValue(str);
}

function resolveRefElement(this: DateTimeWidgetVm, refName: string) {
    return runtimeResolveRefElement(this, refName);
}

function setHiddenPopover(this: DateTimeWidgetVm, styleKey: string) {
    runtimeSetHiddenPopover(this, styleKey);
}

function updateFloatingPopover(
    this: DateTimeWidgetVm,
    anchorRefName: string,
    popoverRefName: string,
    styleKey: string,
    options: Record<string, unknown> = {}
) {
    runtimeUpdateFloatingPopover(this, anchorRefName, popoverRefName, styleKey, options);
}

function addFloatingListener(
    this: DateTimeWidgetVm,
    handlerKey: string,
    update: () => void
) {
    runtimeAddFloatingListener(this, handlerKey, update);
}

function removeFloatingListener(this: DateTimeWidgetVm, handlerKey: string) {
    runtimeRemoveFloatingListener(this, handlerKey);
}

function addOutsideListener(
    this: DateTimeWidgetVm,
    handlerKey: string,
    refNames: string[] = []
) {
    runtimeAddOutsideListener(this, handlerKey, refNames);
}

function removeOutsideListener(this: DateTimeWidgetVm, handlerKey: string) {
    runtimeRemoveOutsideListener(this, handlerKey);
}

export {
    WEEKDAY_LABELS,
    addFloatingListener,
    addOutsideListener,
    applyTimePickerState,
    composePickerTimeValue,
    formatDate,
    formatDateISO,
    formatTime,
    getCalendarDays,
    getMonthLabel,
    getNow,
    hasValue,
    isSameDay,
    labelFloats,
    monthStart,
    normalizeDateInputValue,
    normalizeTimeInputValue,
    normalizeTimePart,
    pad,
    parseDate,
    parseTime,
    removeFloatingListener,
    removeOutsideListener,
    resolveRefElement,
    setCalendarViewFromDate,
    setHiddenPopover,
    shiftMonth,
    splitDateTimeValue,
    syncTimePickerState,
    updateFloatingPopover
};
