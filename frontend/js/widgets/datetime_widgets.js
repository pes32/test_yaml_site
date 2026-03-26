// datetime, date, time

import Md3Field from './md3_field.js';
import widgetMixin from './mixin.js';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const dateTimeMixin = {
    data() {
        return {
            value: '',
            isFocused: false
        };
    },
    computed: {
        hasValue() { return Boolean(this.value); },
        labelFloats() { return this.hasValue || this.isFocused; }
    },
    methods: {
        emit(v) { this.emitInput(v); },
        pad(n) { return String(n).padStart(2, '0'); },
        clamp(value, min, max) { return Math.min(Math.max(value, min), max); },
        getNow() { return new Date(); },
        monthStart(date) { return new Date(date.getFullYear(), date.getMonth(), 1); },
        shiftMonth(date, delta) { return new Date(date.getFullYear(), date.getMonth() + delta, 1); },
        getMonthLabel(date) {
            return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
        },
        isSameDay(a, b) {
            return a.getFullYear() === b.getFullYear()
                && a.getMonth() === b.getMonth()
                && a.getDate() === b.getDate();
        },
        getCalendarDays(viewDate, selectedValue) {
            const selectedDate = this.parseDate(selectedValue);
            const now = this.getNow();
            const monthStart = this.monthStart(viewDate);
            const weekDayIndex = (monthStart.getDay() + 6) % 7;
            const gridStart = new Date(monthStart);
            gridStart.setDate(monthStart.getDate() - weekDayIndex);

            return Array.from({ length: 42 }, (_, index) => {
                const date = new Date(gridStart);
                date.setDate(gridStart.getDate() + index);
                return {
                    key: this.formatDateISO(date),
                    label: date.getDate(),
                    date,
                    inMonth: date.getMonth() === viewDate.getMonth(),
                    isToday: this.isSameDay(date, now),
                    isSelected: selectedDate ? this.isSameDay(date, selectedDate) : false
                };
            });
        },

        normalizeYear(year) {
            const numericYear = Number(year);
            if (!Number.isInteger(numericYear)) return NaN;
            return String(year).length <= 2 ? 2000 + numericYear : numericYear;
        },
        buildDate(day, month, year) {
            const d = Number(day);
            const m = Number(month);
            const y = this.normalizeYear(year);
            if (![d, m, y].every(Number.isInteger)) return null;

            const date = new Date(y, m - 1, d);
            if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
            return date;
        },
        parseCompactDate(raw, now) {
            const digits = raw.replace(/\s+/g, '');
            if (!/^\d+$/.test(digits)) return null;

            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            if (digits.length <= 2) {
                return this.buildDate(digits, currentMonth, currentYear);
            }
            if (digits.length === 4) {
                return this.buildDate(digits.slice(0, 2), digits.slice(2, 4), currentYear);
            }
            if (digits.length === 6) {
                return this.buildDate(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6));
            }
            if (digits.length === 8) {
                if (/^(19|20)\d{6}$/.test(digits)) {
                    const isoDate = this.buildDate(digits.slice(6, 8), digits.slice(4, 6), digits.slice(0, 4));
                    if (isoDate) return isoDate;
                }
                return this.buildDate(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8));
            }

            return null;
        },
        parseDate(str) {
            if (!str) return null;

            const raw = String(str).trim();
            if (!raw) return null;

            const now = this.getNow();
            const compactDate = this.parseCompactDate(raw, now);
            if (compactDate) return compactDate;

            const parts = raw.replace(/[.,]/g, '/').split(/[/-]/).map(s => s.trim()).filter(Boolean);
            if (!parts.length) return null;

            let day;
            let month;
            let year;

            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    [year, month, day] = parts;
                } else {
                    [day, month, year] = parts;
                }
            } else if (parts.length === 2) {
                [day, month] = parts;
                year = now.getFullYear();
            } else if (parts.length === 1) {
                [day] = parts;
                month = now.getMonth() + 1;
                year = now.getFullYear();
            } else {
                return null;
            }

            return this.buildDate(day, month, year);
        },
        formatDate(date) {
            return `${this.pad(date.getDate())}.${this.pad(date.getMonth() + 1)}.${date.getFullYear()}`;
        },
        formatDateISO(date) {
            return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
        },
        normalizeDateInputValue(rawValue) {
            const raw = String(rawValue ?? '').trim();
            if (!raw) return { value: '', parsedDate: null };

            const parsedDate = this.parseDate(raw);
            return {
                value: parsedDate ? this.formatDate(parsedDate) : raw,
                parsedDate
            };
        },
        setCalendarViewFromDate(parsedDate) {
            if (parsedDate) {
                this.calendarView = this.monthStart(parsedDate);
            }
        },

        buildTime(hour, minute = 0, second = 0, hasSeconds = false) {
            const h = Number(hour);
            const m = Number(minute);
            const s = Number(second);
            if (![h, m, s].every(Number.isInteger)) return null;
            if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
            return { h, m, s, hasSeconds };
        },
        parseCompactTime(raw) {
            const digits = raw.replace(/\s+/g, '');
            if (!/^\d+$/.test(digits)) return null;

            if (digits.length <= 2) {
                return this.buildTime(digits, 0, 0, false);
            }
            if (digits.length === 3 || digits.length === 4) {
                return this.buildTime(digits.slice(0, -2), digits.slice(-2), 0, false);
            }
            if (digits.length === 5 || digits.length === 6) {
                return this.buildTime(digits.slice(0, -4), digits.slice(-4, -2), digits.slice(-2), true);
            }

            return null;
        },
        parseTime(str) {
            if (!str) return null;

            const raw = String(str).trim();
            if (!raw) return null;

            const compactTime = this.parseCompactTime(raw);
            if (compactTime) return compactTime;

            const parts = raw.replace(/[.,]/g, ':').split(':').map(part => part.trim()).filter(Boolean);
            if (!parts.length) return null;
            if (parts.length > 3) return null;

            return this.buildTime(parts[0], parts[1] ?? 0, parts[2] ?? 0, parts.length === 3);
        },
        formatTime(t, options = {}) {
            const includeSeconds = options.includeSeconds ?? Boolean(t.hasSeconds);
            const base = `${this.pad(t.h)}:${this.pad(t.m)}`;
            return includeSeconds ? `${base}:${this.pad(t.s ?? 0)}` : base;
        },
        normalizeTimeInputValue(rawValue) {
            const raw = String(rawValue ?? '').trim();
            if (!raw) return { value: '', parsedTime: null };

            const parsedTime = this.parseTime(raw);
            return {
                value: parsedTime ? this.formatTime(parsedTime, { includeSeconds: parsedTime.hasSeconds }) : raw,
                parsedTime
            };
        },
        normalizeTimePart(rawValue, max) {
            const digits = String(rawValue ?? '').replace(/\D+/g, '').slice(0, 2);
            if (!digits) return '';
            return this.pad(Math.min(Number(digits), max));
        },
        applyTimePickerState(parsedTime) {
            if (parsedTime) {
                this.pickerHour = this.pad(parsedTime.h);
                this.pickerMinute = this.pad(parsedTime.m);
                this.pickerSecond = this.pad(parsedTime.s ?? 0);
                this.pickerHasSeconds = Boolean(parsedTime.hasSeconds);
                return parsedTime;
            }

            const now = this.getNow();
            this.pickerHour = this.pad(now.getHours());
            this.pickerMinute = this.pad(now.getMinutes());
            this.pickerSecond = '00';
            this.pickerHasSeconds = false;
            return null;
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
            const raw = String(str || '').trim();
            if (!raw) return { datePart: '', timePart: '' };

            if (raw.includes('T')) {
                const [datePart, timePart = ''] = raw.split('T');
                return { datePart: datePart.trim(), timePart: timePart.trim() };
            }

            const parts = raw.split(/\s+/);
            if (parts.length === 1) return { datePart: parts[0], timePart: '' };

            const [datePart, ...rest] = parts;
            return { datePart: datePart.trim(), timePart: rest.join(' ').trim() };
        },

        resolveRefElement(refName) {
            const ref = this.$refs && this.$refs[refName];
            if (Array.isArray(ref)) return ref[0] || null;
            if (ref && ref.$el) return ref.$el;
            return ref || null;
        },
        setHiddenPopover(styleKey) {
            this[styleKey] = { visibility: 'hidden' };
        },
        updateFloatingPopover(anchorRefName, popoverRefName, styleKey, options = {}) {
            const anchor = this.resolveRefElement(anchorRefName);
            const popover = this.resolveRefElement(popoverRefName);
            if (!anchor || !popover) return false;

            const margin = options.viewportMargin ?? 12;
            const offset = options.offset ?? 8;
            const align = options.align ?? 'start';
            const rect = anchor.getBoundingClientRect();
            const popoverRect = popover.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - rect.bottom - margin;
            const spaceAbove = rect.top - margin;
            const openUp = popoverRect.height > spaceBelow && spaceAbove > spaceBelow;
            const availableSpace = Math.max(180, (openUp ? spaceAbove : spaceBelow) - offset);

            let top = openUp ? rect.top - popoverRect.height - offset : rect.bottom + offset;
            top = this.clamp(top, margin, Math.max(margin, viewportHeight - margin - popoverRect.height));

            let left = align === 'end' ? rect.right - popoverRect.width : rect.left;
            left = this.clamp(left, margin, Math.max(margin, viewportWidth - margin - popoverRect.width));

            this[styleKey] = {
                position: 'fixed',
                top: `${Math.round(top)}px`,
                left: `${Math.round(left)}px`,
                maxHeight: `${Math.round(availableSpace)}px`,
                visibility: 'visible'
            };

            return openUp;
        },
        addFloatingListener(handler, update) {
            this.removeFloatingListener(handler);
            this[handler] = () => update();
            window.addEventListener('resize', this[handler]);
            window.addEventListener('scroll', this[handler], true);
        },
        removeFloatingListener(handler) {
            if (this[handler]) {
                window.removeEventListener('resize', this[handler]);
                window.removeEventListener('scroll', this[handler], true);
                this[handler] = null;
            }
        },
        addOutsideListener(handler, refNames = []) {
            this.removeOutsideListener(handler);
            this[handler] = (event) => {
                const target = event.target;
                const isInside = refNames.some((refName) => {
                    const element = this.resolveRefElement(refName);
                    return element && element.contains(target);
                });
                if (!isInside) {
                    this.closePopovers?.();
                }
            };
            setTimeout(() => document.addEventListener('click', this[handler]), 0);
        },
        removeOutsideListener(handler) {
            if (this[handler]) {
                document.removeEventListener('click', this[handler]);
                this[handler] = null;
            }
        }
    }
};

const DateWidget = {
    mixins: [widgetMixin, dateTimeMixin],
    components: { Md3Field },
    props: { widgetConfig: { type: Object, required: true }, widgetName: { type: String, required: true } },
    emits: ['input'],
    data() {
        return {
            isCalendarOpen: false,
            calendarView: new Date(),
            calendarPopoverStyle: { visibility: 'hidden' },
            _outsideClick: null,
            _floatingUpdate: null
        };
    },
    computed: {
        calendarDays() {
            return this.getCalendarDays(this.calendarView, this.value);
        },
        monthLabel() {
            return this.getMonthLabel(this.calendarView);
        },
        weekdayLabels() {
            return WEEKDAY_LABELS;
        },
        calendarPreview() {
            const date = this.parseDate(this.value) || this.getNow();
            return this.formatDate(date);
        }
    },
    template: `
        <md3-field :widget-config="widgetConfig" :has-value="hasValue" :label-floats="labelFloats"
                   :is-focused="isFocused" :wrap-extra="{ 'widget-dt': true, error: !!tableCellCommitError }" :wrap-data="{ 'data-type': 'date' }"
                   :has-supporting="!!widgetConfig.sup_text">
            <div class="widget-dt-host"
                 v-bind="tableCellRootAttrs"
                 ref="pickerHost">
                <div class="widget-dt-inner">
                    <div class="widget-dt-segment widget-dt-segment--single" ref="dateAnchor">
                        <input type="text" class="form-control widget-dt-input widget-dt-input--date" data-table-editor-target="true" v-model="value"
                               :disabled="widgetConfig.readonly" :tabindex="widgetConfig.readonly ? -1 : null"
                               @input="onInput" @focus="isFocused = true" @blur="onBlur">
                        <span class="widget-dt-icon-wrap">
                            <span class="widget-dt-icon" data-table-action-trigger="date" role="button" tabindex="-1" aria-label="Выбрать дату"
                                  @click="openPicker" @mousedown.prevent>
                                <img src="/templates/icons/calendar.svg" alt="">
                            </span>
                        </span>
                    </div>
                </div>
            </div>
            <Teleport to="body">
                <div v-if="isCalendarOpen" ref="calendarPopover"
                     class="widget-dt-popover widget-dt-popover--calendar"
                     :style="calendarPopoverStyle">
                    <div class="widget-dt-panel-head">
                        <div class="widget-dt-panel-label">Дата</div>
                        <div class="widget-dt-panel-value" v-text="calendarPreview"></div>
                    </div>
                    <div class="widget-dt-popover-header">
                        <button type="button" class="widget-dt-nav" @click="prevMonth" aria-label="Предыдущий месяц">‹</button>
                        <div class="widget-dt-popover-title" v-text="monthLabel"></div>
                        <button type="button" class="widget-dt-nav" @click="nextMonth" aria-label="Следующий месяц">›</button>
                    </div>
                    <div class="widget-dt-weekdays">
                        <span v-for="day in weekdayLabels" :key="day" v-text="day"></span>
                    </div>
                    <div class="widget-dt-calendar-grid">
                        <button v-for="day in calendarDays"
                                :key="day.key"
                                type="button"
                                class="widget-dt-day"
                                :class="{ 'is-outside': !day.inMonth, 'is-today': day.isToday, 'is-selected': day.isSelected }"
                                @click="selectDate(day.date)">
                            <span v-text="day.label"></span>
                        </button>
                    </div>
                </div>
            </Teleport>
            <template #supporting><span v-text="widgetConfig.sup_text"></span></template>
        </md3-field>
    `,
    methods: {
        closePopovers() {
            this.isCalendarOpen = false;
            this.removeOutsideListener('_outsideClick');
            this.removeFloatingListener('_floatingUpdate');
        },
        syncCalendarPopoverPosition() {
            if (!this.isCalendarOpen) return;
            this.updateFloatingPopover('dateAnchor', 'calendarPopover', 'calendarPopoverStyle', { align: 'start' });
        },
        onInput() {
            this.emit(this.value);
        },
        onBlur() {
            this.isFocused = false;
            this.commitInput();
        },
        commitInput() {
            if (!this.value) {
                this.handleTableCellCommitValidation('');
                this.emit(this.value);
                return;
            }

            const { value, parsedDate } = this.normalizeDateInputValue(this.value);
            this.value = value;
            this.setCalendarViewFromDate(parsedDate);
            this.handleTableCellCommitValidation(
                parsedDate ? '' : 'Неверный формат даты'
            );
            this.emit(this.value);
        },
        openPicker() {
            if (this.widgetConfig.readonly) return;
            const parsedDate = this.parseDate(this.value) || this.getNow();
            this.calendarView = this.monthStart(parsedDate);
            this.isCalendarOpen = true;
            this.setHiddenPopover('calendarPopoverStyle');
            this.addOutsideListener('_outsideClick', ['pickerHost', 'calendarPopover']);
            this.$nextTick(() => {
                this.syncCalendarPopoverPosition();
                this.addFloatingListener('_floatingUpdate', () => this.syncCalendarPopoverPosition());
            });
        },
        prevMonth() {
            this.calendarView = this.shiftMonth(this.calendarView, -1);
            this.$nextTick(() => this.syncCalendarPopoverPosition());
        },
        nextMonth() {
            this.calendarView = this.shiftMonth(this.calendarView, 1);
            this.$nextTick(() => this.syncCalendarPopoverPosition());
        },
        selectDate(date) {
            this.value = this.formatDate(date);
            this.calendarView = this.monthStart(date);
            this.emit(this.value);
            this.closePopovers();
        },
        setValue(v) {
            if (!v) {
                this.value = '';
                return;
            }

            const { value, parsedDate } = this.normalizeDateInputValue(v);
            this.value = value;
            this.setCalendarViewFromDate(parsedDate);
        },
        getValue() { return this.value; }
    },
    watch: {
        'widgetConfig.value': {
            immediate: true,
            handler(value) {
                if (value === undefined) return;
                if (this.tableCellMode && this.isFocused) return;
                this.setValue(value);
            }
        }
    },
    mounted() {
        if (this.widgetConfig.value !== undefined) {
            this.setValue(this.widgetConfig.value);
        } else if (this.widgetConfig.default === 'now') {
            const date = this.getNow();
            this.value = this.formatDate(date);
            this.calendarView = this.monthStart(date);
            this.emit(this.value);
        } else if (this.widgetConfig.default !== undefined && this.widgetConfig.default !== '') {
            this.setValue(String(this.widgetConfig.default));
        }
    },
    beforeUnmount() {
        this.removeOutsideListener('_outsideClick');
        this.removeFloatingListener('_floatingUpdate');
    }
};

const TimeWidget = {
    mixins: [widgetMixin, dateTimeMixin],
    components: { Md3Field },
    props: { widgetConfig: { type: Object, required: true }, widgetName: { type: String, required: true } },
    emits: ['input'],
    data() {
        return {
            isTimeOpen: false,
            pickerHour: '00',
            pickerMinute: '00',
            pickerSecond: '00',
            pickerHasSeconds: false,
            timePopoverStyle: { visibility: 'hidden' },
            _outsideClick: null,
            _floatingUpdate: null
        };
    },
    computed: {
        timePreview() { return `${this.pickerHour}:${this.pickerMinute}:${this.pickerSecond}`; }
    },
    template: `
        <md3-field :widget-config="widgetConfig" :has-value="hasValue" :label-floats="labelFloats"
                   :is-focused="isFocused" :wrap-extra="{ 'widget-dt': true, error: !!tableCellCommitError }" :wrap-data="{ 'data-type': 'time' }"
                   :has-supporting="!!widgetConfig.sup_text">
            <div class="widget-dt-host"
                 v-bind="tableCellRootAttrs"
                 ref="pickerHost">
                <div class="widget-dt-inner">
                    <div class="widget-dt-segment widget-dt-segment--single" ref="timeAnchor">
                        <input type="text" class="form-control widget-dt-input widget-dt-input--time" data-table-editor-target="true" v-model="value"
                               :disabled="widgetConfig.readonly" :tabindex="widgetConfig.readonly ? -1 : null"
                               @input="onInput" @focus="isFocused = true" @blur="onBlur">
                        <span class="widget-dt-icon-wrap">
                            <span class="widget-dt-icon" data-table-action-trigger="time" role="button" tabindex="-1" aria-label="Выбрать время"
                                  @click="openPicker" @mousedown.prevent>
                                <img src="/templates/icons/clock.svg" alt="">
                            </span>
                        </span>
                    </div>
                </div>
            </div>
            <Teleport to="body">
                <div v-if="isTimeOpen" ref="timePopover"
                     class="widget-dt-popover widget-dt-popover--time"
                     :style="timePopoverStyle">
                    <div class="widget-dt-panel-head">
                        <div class="widget-dt-panel-label">Время</div>
                    </div>
                    <div class="widget-dt-time-preview" v-text="timePreview"></div>
                    <div class="widget-dt-time-editors">
                        <div class="widget-dt-time-editor">
                            <span class="widget-dt-time-caption">Часы</span>
                            <input type="text" inputmode="numeric" class="widget-dt-time-editor-input"
                                   :value="pickerHour"
                                   @input="onPickerPartInput('pickerHour', 23, $event)"
                                   @blur="commitPickerPart('pickerHour', 23)"
                                   @keydown.enter.prevent="commitPickerPart('pickerHour', 23)">
                        </div>
                        <div class="widget-dt-time-separator">:</div>
                        <div class="widget-dt-time-editor">
                            <span class="widget-dt-time-caption">Минуты</span>
                            <input type="text" inputmode="numeric" class="widget-dt-time-editor-input"
                                   :value="pickerMinute"
                                   @input="onPickerPartInput('pickerMinute', 59, $event)"
                                   @blur="commitPickerPart('pickerMinute', 59)"
                                   @keydown.enter.prevent="commitPickerPart('pickerMinute', 59)">
                        </div>
                        <div class="widget-dt-time-separator">:</div>
                        <div class="widget-dt-time-editor">
                            <span class="widget-dt-time-caption">Секунды</span>
                            <input type="text" inputmode="numeric" class="widget-dt-time-editor-input"
                                   :value="pickerSecond"
                                   @input="onPickerPartInput('pickerSecond', 59, $event)"
                                   @blur="commitPickerPart('pickerSecond', 59, true)"
                                   @keydown.enter.prevent="commitPickerPart('pickerSecond', 59, true)">
                        </div>
                    </div>
                </div>
            </Teleport>
            <template #supporting><span v-text="widgetConfig.sup_text"></span></template>
        </md3-field>
    `,
    methods: {
        closePopovers() {
            this.isTimeOpen = false;
            this.removeOutsideListener('_outsideClick');
            this.removeFloatingListener('_floatingUpdate');
        },
        syncTimePopoverPosition() {
            if (!this.isTimeOpen) return;
            this.updateFloatingPopover('timeAnchor', 'timePopover', 'timePopoverStyle', { align: 'end' });
        },
        applyPickedTime(shouldClose = false) {
            this.value = this.composePickerTimeValue();
            this.emit(this.value);
            if (shouldClose) this.closePopovers();
        },
        onPickerPartInput(part, max, event) {
            const digits = String(event.target.value || '').replace(/\D+/g, '').slice(0, 2);
            this[part] = digits;
            if (part === 'pickerSecond' && digits.length) this.pickerHasSeconds = true;
        },
        commitPickerPart(part, max, shouldClose = false) {
            const normalized = this.normalizeTimePart(this[part], max) || '00';
            this[part] = normalized;
            if (part === 'pickerSecond') this.pickerHasSeconds = true;
            this.applyPickedTime(shouldClose);
        },
        onInput() {
            this.emit(this.value);
        },
        onBlur() {
            this.isFocused = false;
            this.commitInput();
        },
        commitInput() {
            if (!this.value) {
                this.handleTableCellCommitValidation('');
                this.emit(this.value);
                return;
            }

            const { value, parsedTime } = this.normalizeTimeInputValue(this.value);
            this.value = value;
            this.applyTimePickerState(parsedTime);
            this.handleTableCellCommitValidation(
                parsedTime ? '' : 'Неверный формат времени'
            );
            this.emit(this.value);
        },
        openPicker() {
            if (this.widgetConfig.readonly) return;
            this.syncTimePickerState(this.value);
            this.isTimeOpen = true;
            this.setHiddenPopover('timePopoverStyle');
            this.addOutsideListener('_outsideClick', ['pickerHost', 'timePopover']);
            this.$nextTick(() => {
                this.syncTimePopoverPosition();
                this.addFloatingListener('_floatingUpdate', () => this.syncTimePopoverPosition());
            });
        },
        setValue(v) {
            if (!v) {
                this.value = '';
                return;
            }

            const { value, parsedTime } = this.normalizeTimeInputValue(v);
            this.value = value;
            this.applyTimePickerState(parsedTime);
        },
        getValue() { return this.value; }
    },
    watch: {
        'widgetConfig.value': {
            immediate: true,
            handler(value) {
                if (value === undefined) return;
                if (this.tableCellMode && this.isFocused) return;
                this.setValue(value);
            }
        }
    },
    mounted() {
        if (this.widgetConfig.value !== undefined) {
            this.setValue(this.widgetConfig.value);
        } else if (this.widgetConfig.default === 'now') {
            const now = this.getNow();
            this.value = this.formatTime({ h: now.getHours(), m: now.getMinutes(), s: now.getSeconds(), hasSeconds: false }, { includeSeconds: false });
            this.syncTimePickerState(this.value);
            this.emit(this.value);
        } else if (this.widgetConfig.default !== undefined && this.widgetConfig.default !== '') {
            this.setValue(String(this.widgetConfig.default));
        }
    },
    beforeUnmount() {
        this.removeOutsideListener('_outsideClick');
        this.removeFloatingListener('_floatingUpdate');
    }
};

const DateTimeWidget = {
    mixins: [widgetMixin, dateTimeMixin],
    components: { Md3Field },
    props: { widgetConfig: { type: Object, required: true }, widgetName: { type: String, required: true } },
    emits: ['input'],
    data() {
        return {
            dateValue: '',
            timeValue: '',
            isDatePopoverOpen: false,
            isTimePopoverOpen: false,
            datePopoverStyle: { visibility: 'hidden' },
            timePopoverStyle: { visibility: 'hidden' },
            calendarView: new Date(),
            pickerHour: '00',
            pickerMinute: '00',
            pickerSecond: '00',
            pickerHasSeconds: false,
            _outsideClick: null,
            _floatingUpdate: null
        };
    },
    computed: {
        calendarDays() {
            return this.getCalendarDays(this.calendarView, this.dateValue);
        },
        monthLabel() {
            return this.getMonthLabel(this.calendarView);
        },
        weekdayLabels() {
            return WEEKDAY_LABELS;
        },
        datePreview() {
            const date = this.parseDate(this.dateValue) || this.getNow();
            return this.formatDate(date);
        },
        timePreview() {
            return `${this.pickerHour}:${this.pickerMinute}:${this.pickerSecond}`;
        }
    },
    template: `
        <md3-field :widget-config="widgetConfig" :has-value="hasValue" :label-floats="labelFloats"
                   :is-focused="isFocused" :wrap-extra="{ 'widget-dt': true, 'widget-dt--datetime': true, error: !!tableCellCommitError }"
                   :wrap-data="{ 'data-type': 'datetime' }" :has-supporting="!!widgetConfig.sup_text"
                   container-modifier="datetime">
            <div class="widget-dt-host widget-dt-host--datetime"
                 v-bind="tableCellRootAttrs"
                 ref="pickerHost">
                <div class="widget-dt-inner widget-dt-inner--datetime">
                    <div class="widget-dt-segment widget-dt-segment--date" ref="dateAnchor">
                        <input type="text" class="form-control widget-dt-input widget-dt-input--date" data-table-editor-target="true" v-model="dateValue"
                               :disabled="widgetConfig.readonly" :tabindex="widgetConfig.readonly ? -1 : null"
                               @input="onDateInput" @focus="isFocused = true" @blur="onDateBlur">
                        <span class="widget-dt-icon-wrap">
                            <span class="widget-dt-icon" data-table-action-trigger="date" role="button" tabindex="-1" aria-label="Выбрать дату"
                                  @click="openDatePicker" @mousedown.prevent>
                                <img src="/templates/icons/calendar.svg" alt="">
                            </span>
                        </span>
                    </div>
                    <div class="widget-dt-segment widget-dt-segment--time" ref="timeAnchor">
                        <input type="text" class="form-control widget-dt-input widget-dt-input--time" data-table-editor-target="true" v-model="timeValue"
                               :disabled="widgetConfig.readonly" :tabindex="widgetConfig.readonly ? -1 : null"
                               @input="onTimeInput" @focus="isFocused = true" @blur="onTimeBlur">
                        <span class="widget-dt-icon-wrap">
                            <span class="widget-dt-icon" data-table-action-trigger="time" role="button" tabindex="-1" aria-label="Выбрать время"
                                  @click="openTimePicker" @mousedown.prevent>
                                <img src="/templates/icons/clock.svg" alt="">
                            </span>
                        </span>
                    </div>
                </div>
            </div>
            <Teleport to="body">
                <div v-if="isDatePopoverOpen" ref="datePopover"
                     class="widget-dt-popover widget-dt-popover--calendar"
                     :style="datePopoverStyle">
                    <div class="widget-dt-panel-head">
                        <div class="widget-dt-panel-label">Дата</div>
                        <div class="widget-dt-panel-value" v-text="datePreview"></div>
                    </div>
                    <div class="widget-dt-popover-header">
                        <button type="button" class="widget-dt-nav" @click="prevMonth" aria-label="Предыдущий месяц">‹</button>
                        <div class="widget-dt-popover-title" v-text="monthLabel"></div>
                        <button type="button" class="widget-dt-nav" @click="nextMonth" aria-label="Следующий месяц">›</button>
                    </div>
                    <div class="widget-dt-weekdays">
                        <span v-for="day in weekdayLabels" :key="day" v-text="day"></span>
                    </div>
                    <div class="widget-dt-calendar-grid">
                        <button v-for="day in calendarDays"
                                :key="day.key"
                                type="button"
                                class="widget-dt-day"
                                :class="{ 'is-outside': !day.inMonth, 'is-today': day.isToday, 'is-selected': day.isSelected }"
                                @click="selectDate(day.date)">
                            <span v-text="day.label"></span>
                        </button>
                    </div>
                </div>
            </Teleport>
            <Teleport to="body">
                <div v-if="isTimePopoverOpen" ref="timePopover"
                     class="widget-dt-popover widget-dt-popover--time"
                     :style="timePopoverStyle">
                    <div class="widget-dt-panel-head">
                        <div class="widget-dt-panel-label">Время</div>
                    </div>
                    <div class="widget-dt-time-preview" v-text="timePreview"></div>
                    <div class="widget-dt-time-editors">
                        <div class="widget-dt-time-editor">
                            <span class="widget-dt-time-caption">Часы</span>
                            <input type="text" inputmode="numeric" class="widget-dt-time-editor-input"
                                   :value="pickerHour"
                                   @input="onTimePickerPartInput('pickerHour', 23, $event)"
                                   @blur="commitTimePickerPart('pickerHour', 23)"
                                   @keydown.enter.prevent="commitTimePickerPart('pickerHour', 23)">
                        </div>
                        <div class="widget-dt-time-separator">:</div>
                        <div class="widget-dt-time-editor">
                            <span class="widget-dt-time-caption">Минуты</span>
                            <input type="text" inputmode="numeric" class="widget-dt-time-editor-input"
                                   :value="pickerMinute"
                                   @input="onTimePickerPartInput('pickerMinute', 59, $event)"
                                   @blur="commitTimePickerPart('pickerMinute', 59)"
                                   @keydown.enter.prevent="commitTimePickerPart('pickerMinute', 59)">
                        </div>
                        <div class="widget-dt-time-separator">:</div>
                        <div class="widget-dt-time-editor">
                            <span class="widget-dt-time-caption">Секунды</span>
                            <input type="text" inputmode="numeric" class="widget-dt-time-editor-input"
                                   :value="pickerSecond"
                                   @input="onTimePickerPartInput('pickerSecond', 59, $event)"
                                   @blur="commitTimePickerPart('pickerSecond', 59, true)"
                                   @keydown.enter.prevent="commitTimePickerPart('pickerSecond', 59, true)">
                        </div>
                    </div>
                </div>
            </Teleport>
            <template #supporting><span v-text="widgetConfig.sup_text"></span></template>
        </md3-field>
    `,
    methods: {
        closePopovers() {
            this.isDatePopoverOpen = false;
            this.isTimePopoverOpen = false;
            this.removeOutsideListener('_outsideClick');
            this.removeFloatingListener('_floatingUpdate');
        },
        bindPopoverTracking() {
            this.addOutsideListener('_outsideClick', ['pickerHost', 'datePopover', 'timePopover']);
            this.addFloatingListener('_floatingUpdate', () => this.refreshOpenPopovers());
        },
        refreshOpenPopovers() {
            if (this.isDatePopoverOpen) {
                this.updateFloatingPopover('dateAnchor', 'datePopover', 'datePopoverStyle', { align: 'start' });
            }
            if (this.isTimePopoverOpen) {
                this.updateFloatingPopover('timeAnchor', 'timePopover', 'timePopoverStyle', { align: 'end' });
            }
        },
        composeValue() {
            return [this.dateValue, this.timeValue].filter(Boolean).join(' ');
        },
        syncValue(shouldEmit = true) {
            this.value = this.composeValue();
            if (shouldEmit) this.emit(this.value);
        },
        onTimePickerPartInput(part, max, event) {
            const digits = String(event.target.value || '').replace(/\D+/g, '').slice(0, 2);
            this[part] = digits;
            if (part === 'pickerSecond' && digits.length) this.pickerHasSeconds = true;
        },
        commitTimePickerPart(part, max, shouldClose = false) {
            const normalized = this.normalizeTimePart(this[part], max) || '00';
            this[part] = normalized;
            if (part === 'pickerSecond') this.pickerHasSeconds = true;
            this.timeValue = this.composePickerTimeValue();
            this.syncValue();
            if (shouldClose) this.closePopovers();
        },
        onDateInput() {
            this.syncValue();
        },
        onTimeInput() {
            this.syncValue();
        },
        onDateBlur() {
            this.isFocused = false;
            this.commitDateInput();
        },
        onTimeBlur() {
            this.isFocused = false;
            this.commitTimeInput();
        },
        commitDateInput() {
            if (!this.dateValue) {
                this.handleTableCellCommitValidation('');
                this.syncValue();
                return;
            }

            const { value, parsedDate } = this.normalizeDateInputValue(this.dateValue);
            this.dateValue = value;
            this.setCalendarViewFromDate(parsedDate);
            this.handleTableCellCommitValidation(
                parsedDate ? '' : 'Неверный формат даты'
            );
            this.syncValue();
        },
        commitTimeInput() {
            if (!this.timeValue) {
                this.handleTableCellCommitValidation('');
                this.syncValue();
                return;
            }

            const { value, parsedTime } = this.normalizeTimeInputValue(this.timeValue);
            this.timeValue = value;
            this.applyTimePickerState(parsedTime);
            this.handleTableCellCommitValidation(
                parsedTime ? '' : 'Неверный формат времени'
            );
            this.syncValue();
        },
        openDatePicker() {
            if (this.widgetConfig.readonly) return;
            const parsedDate = this.parseDate(this.dateValue) || this.getNow();
            this.calendarView = this.monthStart(parsedDate);
            this.isDatePopoverOpen = true;
            this.isTimePopoverOpen = false;
            this.setHiddenPopover('datePopoverStyle');
            this.$nextTick(() => {
                this.refreshOpenPopovers();
                this.bindPopoverTracking();
            });
        },
        openTimePicker() {
            if (this.widgetConfig.readonly) return;
            this.syncTimePickerState(this.timeValue);
            this.isTimePopoverOpen = true;
            this.isDatePopoverOpen = false;
            this.setHiddenPopover('timePopoverStyle');
            this.$nextTick(() => {
                this.refreshOpenPopovers();
                this.bindPopoverTracking();
            });
        },
        prevMonth() {
            this.calendarView = this.shiftMonth(this.calendarView, -1);
            this.$nextTick(() => this.refreshOpenPopovers());
        },
        nextMonth() {
            this.calendarView = this.shiftMonth(this.calendarView, 1);
            this.$nextTick(() => this.refreshOpenPopovers());
        },
        selectDate(date) {
            this.dateValue = this.formatDate(date);
            this.calendarView = this.monthStart(date);
            this.syncValue();
            this.closePopovers();
        },
        setValue(v) {
            if (!v) {
                this.value = '';
                this.dateValue = '';
                this.timeValue = '';
                return;
            }

            const { datePart, timePart } = this.splitDateTimeValue(v);
            const dateState = this.normalizeDateInputValue(datePart);
            const timeState = this.normalizeTimeInputValue(timePart);

            this.dateValue = dateState.value;
            this.timeValue = timeState.value;
            this.setCalendarViewFromDate(dateState.parsedDate);
            this.applyTimePickerState(timeState.parsedTime);
            this.syncValue(false);
        },
        getValue() { return this.value; }
    },
    watch: {
        'widgetConfig.value': {
            immediate: true,
            handler(value) {
                if (value === undefined) return;
                if (this.tableCellMode && this.isFocused) return;
                this.setValue(value);
            }
        }
    },
    mounted() {
        if (this.widgetConfig.value !== undefined) {
            this.setValue(this.widgetConfig.value);
        } else if (this.widgetConfig.default === 'now') {
            const now = this.getNow();
            const time = { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds(), hasSeconds: false };
            this.dateValue = this.formatDate(now);
            this.timeValue = this.formatTime(time, { includeSeconds: false });
            this.setCalendarViewFromDate(now);
            this.applyTimePickerState(time);
            this.syncValue();
        } else if (this.widgetConfig.default !== undefined && this.widgetConfig.default !== '') {
            this.setValue(String(this.widgetConfig.default));
        }
    },
    beforeUnmount() {
        this.removeOutsideListener('_outsideClick');
        this.removeFloatingListener('_floatingUpdate');
    }
};

export { DateWidget, TimeWidget, DateTimeWidget };
