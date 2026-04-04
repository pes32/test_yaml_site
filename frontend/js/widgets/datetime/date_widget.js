import Md3Field from '../md3_field.js';
import widgetMixin from '../mixin.js';
import { WEEKDAY_LABELS, dateTimeMixin } from './datetime_component_mixin.js';

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
                               @input="onInput" @focus="onFocus" @blur="onBlur" @keydown.enter="onEnterCommit">
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
            if (!this.isCalendarOpen) {
                return;
            }
            this.updateFloatingPopover('dateAnchor', 'calendarPopover', 'calendarPopoverStyle', { align: 'start' });
        },
        onFocus() {
            this.isFocused = true;
            this.activateDraftController();
        },
        onInput() {
            if (this.tableCellMode) {
                this.emit(this.value);
                return;
            }

            this.activateDraftController();
        },
        onBlur() {
            this.isFocused = false;
            this.commitDraft();
            this.deactivateDraftController();
        },
        onEnterCommit(event) {
            if (this.tableCellMode) {
                return;
            }

            event.preventDefault();
            this.commitDraft();
            event.target?.blur?.();
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
            this.handleTableCellCommitValidation(parsedDate ? '' : 'Неверный формат даты');
            this.emit(this.value);
        },
        commitDraft() {
            this.commitInput();
        },
        openPicker() {
            if (this.widgetConfig.readonly) {
                return;
            }
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

export { DateWidget };
export default DateWidget;
