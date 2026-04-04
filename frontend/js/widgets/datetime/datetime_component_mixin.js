import {
    WEEKDAY_LABELS,
    formatDate,
    formatDateISO,
    formatTime,
    getCalendarDays,
    getMonthLabel,
    getNow,
    isSameDay,
    monthStart,
    normalizeDateInputValue,
    normalizeTimeInputValue,
    normalizeTimePart,
    pad,
    parseDate,
    parseTime,
    pickerStateFromTime,
    shiftMonth,
    splitDateTimeValue
} from './datetime_core.js';
import {
    addFloatingListener,
    addOutsideListener,
    removeFloatingListener,
    removeOutsideListener,
    resolveRefElement,
    setHiddenPopover,
    updateFloatingPopover
} from './datetime_popover_runtime.js';

const dateTimeMixin = {
    data() {
        return {
            value: '',
            isFocused: false
        };
    },
    computed: {
        hasValue() {
            return Boolean(this.value);
        },
        labelFloats() {
            return this.hasValue || this.isFocused;
        }
    },
    methods: {
        emit(v) {
            this.emitInput(v);
        },
        getNow() {
            return getNow();
        },
        monthStart(date) {
            return monthStart(date);
        },
        shiftMonth(date, delta) {
            return shiftMonth(date, delta);
        },
        getMonthLabel(date) {
            return getMonthLabel(date);
        },
        isSameDay(left, right) {
            return isSameDay(left, right);
        },
        getCalendarDays(viewDate, selectedValue) {
            return getCalendarDays(viewDate, selectedValue, this.getNow());
        },
        parseDate(str) {
            return parseDate(str, this.getNow());
        },
        formatDate(date) {
            return formatDate(date);
        },
        formatDateISO(date) {
            return formatDateISO(date);
        },
        normalizeDateInputValue(rawValue) {
            return normalizeDateInputValue(rawValue, this.getNow());
        },
        setCalendarViewFromDate(parsedDate) {
            if (parsedDate) {
                this.calendarView = this.monthStart(parsedDate);
            }
        },
        parseTime(str) {
            return parseTime(str);
        },
        formatTime(timeValue, options = {}) {
            return formatTime(timeValue, options);
        },
        normalizeTimeInputValue(rawValue) {
            return normalizeTimeInputValue(rawValue);
        },
        normalizeTimePart(rawValue, max) {
            return normalizeTimePart(rawValue, max);
        },
        applyTimePickerState(parsedTime) {
            const nextState = pickerStateFromTime(parsedTime, this.getNow());
            this.pickerHour = nextState.pickerHour;
            this.pickerMinute = nextState.pickerMinute;
            this.pickerSecond = nextState.pickerSecond;
            this.pickerHasSeconds = nextState.pickerHasSeconds;
            return parsedTime || null;
        },
        syncTimePickerState(rawValue) {
            const { parsedTime } = this.normalizeTimeInputValue(rawValue);
            return this.applyTimePickerState(parsedTime);
        },
        composePickerTimeValue() {
            return this.formatTime({
                h: Number(this.pickerHour),
                m: Number(this.pickerMinute),
                s: Number(this.pickerSecond),
                hasSeconds: this.pickerHasSeconds
            }, { includeSeconds: this.pickerHasSeconds });
        },
        splitDateTimeValue(str) {
            return splitDateTimeValue(str);
        },
        resolveRefElement(refName) {
            return resolveRefElement(this, refName);
        },
        setHiddenPopover(styleKey) {
            setHiddenPopover(this, styleKey);
        },
        updateFloatingPopover(anchorRefName, popoverRefName, styleKey, options = {}) {
            updateFloatingPopover(this, anchorRefName, popoverRefName, styleKey, options);
        },
        addFloatingListener(handlerKey, update) {
            addFloatingListener(this, handlerKey, update);
        },
        removeFloatingListener(handlerKey) {
            removeFloatingListener(this, handlerKey);
        },
        addOutsideListener(handlerKey, refNames = []) {
            addOutsideListener(this, handlerKey, refNames);
        },
        removeOutsideListener(handlerKey) {
            removeOutsideListener(this, handlerKey);
        }
    }
};

export { WEEKDAY_LABELS, dateTimeMixin };
