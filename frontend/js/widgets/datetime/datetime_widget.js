import Md3Field from '../md3_field.js';
import widgetMixin from '../mixin.js';
import { WEEKDAY_LABELS, dateTimeMixin } from './datetime_component_mixin.js';

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
                               @input="onDateInput" @focus="onSegmentFocus" @blur="onDateBlur" @keydown.enter="onDateEnterCommit">
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
                               @input="onTimeInput" @focus="onSegmentFocus" @blur="onTimeBlur" @keydown.enter="onTimeEnterCommit">
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
            if (shouldEmit) {
                this.emit(this.value);
            }
        },
        onSegmentFocus() {
            this.isFocused = true;
            this.activateDraftController();
        },
        finalizeSegmentBlur(commitHandler) {
            this.isFocused = false;
            if (typeof commitHandler === 'function') {
                commitHandler();
            }

            if (this.tableCellMode) {
                return;
            }

            window.setTimeout(() => {
                const root = this.resolveRefElement('pickerHost');
                const active = document.activeElement;
                if (root && active && root.contains(active)) {
                    return;
                }
                this.deactivateDraftController();
            }, 0);
        },
        onTimePickerPartInput(part, max, event) {
            const digits = String(event.target.value || '').replace(/\D+/g, '').slice(0, 2);
            this[part] = digits;
            if (part === 'pickerSecond' && digits.length) {
                this.pickerHasSeconds = true;
            }
        },
        commitTimePickerPart(part, max, shouldClose = false) {
            const normalized = this.normalizeTimePart(this[part], max) || '00';
            this[part] = normalized;
            if (part === 'pickerSecond') {
                this.pickerHasSeconds = true;
            }
            this.timeValue = this.composePickerTimeValue();
            this.syncValue();
            if (shouldClose) {
                this.closePopovers();
            }
        },
        onDateInput() {
            this.syncValue(this.tableCellMode);
            if (!this.tableCellMode) {
                this.activateDraftController();
            }
        },
        onTimeInput() {
            this.syncValue(this.tableCellMode);
            if (!this.tableCellMode) {
                this.activateDraftController();
            }
        },
        onDateBlur() {
            this.finalizeSegmentBlur(() => this.commitDateInput());
        },
        onTimeBlur() {
            this.finalizeSegmentBlur(() => this.commitTimeInput());
        },
        onDateEnterCommit(event) {
            if (this.tableCellMode) {
                return;
            }

            event.preventDefault();
            this.commitDateInput();
            event.target?.blur?.();
        },
        onTimeEnterCommit(event) {
            if (this.tableCellMode) {
                return;
            }

            event.preventDefault();
            this.commitTimeInput();
            event.target?.blur?.();
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
            this.handleTableCellCommitValidation(parsedDate ? '' : 'Неверный формат даты');
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
            this.handleTableCellCommitValidation(parsedTime ? '' : 'Неверный формат времени');
            this.syncValue();
        },
        commitDraft() {
            this.commitDateInput();
            this.commitTimeInput();
        },
        openDatePicker() {
            if (this.widgetConfig.readonly) {
                return;
            }
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
            if (this.widgetConfig.readonly) {
                return;
            }
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
        getValue() {
            return this.value;
        }
    },
    watch: {
        'widgetConfig.value': {
            immediate: true,
            handler(value) {
                if (value === undefined) {
                    return;
                }
                this.syncCommittedValue(value, (nextValue) => this.setValue(nextValue));
            }
        }
    },
    beforeUnmount() {
        this.removeOutsideListener('_outsideClick');
        this.removeFloatingListener('_floatingUpdate');
    }
};

export { DateTimeWidget };
export default DateTimeWidget;
