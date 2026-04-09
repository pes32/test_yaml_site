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

function hasValue() {
    return Boolean(this.value);
}

function labelFloats() {
    return this.hasValue || this.isFocused;
}

function getNow() {
    return coreGetNow();
}

function monthStart(date) {
    return coreMonthStart(date);
}

function shiftMonth(date, delta) {
    return coreShiftMonth(date, delta);
}

function getMonthLabel(date) {
    return coreGetMonthLabel(date);
}

function isSameDay(left, right) {
    return coreIsSameDay(left, right);
}

function getCalendarDays(viewDate, selectedValue) {
    return coreGetCalendarDays(viewDate, selectedValue, this.getNow());
}

function parseDate(str) {
    return coreParseDate(str, this.getNow());
}

function formatDate(date) {
    return coreFormatDate(date);
}

function formatDateISO(date) {
    return coreFormatDateISO(date);
}

function normalizeDateInputValue(rawValue) {
    return coreNormalizeDateInputValue(rawValue, this.getNow());
}

function setCalendarViewFromDate(parsedDate) {
    if (parsedDate) {
        this.calendarView = this.monthStart(parsedDate);
    }
}

function parseTime(str) {
    return coreParseTime(str);
}

function formatTime(timeValue, options = {}) {
    return coreFormatTime(timeValue, options);
}

function normalizeTimeInputValue(rawValue) {
    return coreNormalizeTimeInputValue(rawValue);
}

function normalizeTimePart(rawValue, max) {
    return coreNormalizeTimePart(rawValue, max);
}

function applyTimePickerState(parsedTime) {
    const nextState = pickerStateFromTime(parsedTime, this.getNow());
    this.pickerHour = nextState.pickerHour;
    this.pickerMinute = nextState.pickerMinute;
    this.pickerSecond = nextState.pickerSecond;
    this.pickerHasSeconds = nextState.pickerHasSeconds;
    return parsedTime || null;
}

function syncTimePickerState(rawValue) {
    const { parsedTime } = this.normalizeTimeInputValue(rawValue);
    return this.applyTimePickerState(parsedTime);
}

function composePickerTimeValue() {
    return this.formatTime({
        h: Number(this.pickerHour),
        m: Number(this.pickerMinute),
        s: Number(this.pickerSecond),
        hasSeconds: this.pickerHasSeconds
    }, { includeSeconds: this.pickerHasSeconds });
}

function splitDateTimeValue(str) {
    return coreSplitDateTimeValue(str);
}

function resolveRefElement(refName) {
    return runtimeResolveRefElement(this, refName);
}

function setHiddenPopover(styleKey) {
    runtimeSetHiddenPopover(this, styleKey);
}

function updateFloatingPopover(anchorRefName, popoverRefName, styleKey, options = {}) {
    runtimeUpdateFloatingPopover(this, anchorRefName, popoverRefName, styleKey, options);
}

function addFloatingListener(handlerKey, update) {
    runtimeAddFloatingListener(this, handlerKey, update);
}

function removeFloatingListener(handlerKey) {
    runtimeRemoveFloatingListener(this, handlerKey);
}

function addOutsideListener(handlerKey, refNames = []) {
    runtimeAddOutsideListener(this, handlerKey, refNames);
}

function removeOutsideListener(handlerKey) {
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
