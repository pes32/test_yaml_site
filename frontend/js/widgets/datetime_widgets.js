// Виджеты для даты и времени (datetime, date, time)

const DateTimeWidget = {
    components: { Md3Field: window.Md3Field },
    mixins: [window.widgetMixin],
    props: {
        widgetConfig: { type: Object, required: true },
        widgetName: { type: String, required: true }
    },
    emits: ['input'],
    template: `
        <md3-field
            :widget-config="widgetConfig"
            :has-value="hasValue"
            :label-floats="labelFloats"
            :is-focused="isFocused"
            :wrap-extra="{ 'md3-datetime-wrap': true }"
            :has-supporting="!!widgetConfig.sup_text"
            wrap-variant="datetime">
            <div class="widget-datetime w-100">
                <input type="date"
                       class="form-control"
                       :disabled="widgetConfig.readonly"
                       :tabindex="widgetConfig.readonly ? -1 : null"
                       v-model="dateValue"
                       @input="onDateTimeInput"
                       @focus="isFocused = true"
                       @blur="isFocused = false">
                <input type="time"
                       class="form-control"
                       :disabled="widgetConfig.readonly"
                       :tabindex="widgetConfig.readonly ? -1 : null"
                       v-model="timeValue"
                       @input="onDateTimeInput"
                       @focus="isFocused = true"
                       @blur="isFocused = false">
            </div>
            <template #supporting>
                <span v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return {
            value: '',
            dateValue: '',
            timeValue: '',
            isFocused: false
        };
    },
    computed: {
        hasValue() { return Boolean(this.dateValue || this.timeValue); },
        labelFloats() { return this.hasValue || this.isFocused; }
    },
    methods: {
        onDateTimeInput() {
            this.value = (this.dateValue && this.timeValue)
                ? `${this.dateValue} ${this.timeValue}`
                : '';
            this.emitInput(this.value);
        },
        setValue(value) {
            this.value = value;
            if (value) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    this.dateValue = date.toISOString().split('T')[0];
                    this.timeValue = date.toTimeString().split(' ')[0].substring(0, 5);
                }
            }
        },
        getValue() { return this.value; }
    },
    mounted() {
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
            this.setValue(this.value);
        } else if (this.widgetConfig.widget === 'datetime') {
            const now = new Date();
            this.dateValue = now.toISOString().split('T')[0];
            this.timeValue = now.toTimeString().split(' ')[0].substring(0, 5);
        }
    }
};

const DateWidget = {
    components: { Md3Field: window.Md3Field },
    mixins: [window.widgetMixin],
    props: {
        widgetConfig: { type: Object, required: true },
        widgetName: { type: String, required: true }
    },
    emits: ['input'],
    template: `
        <md3-field
            :widget-config="widgetConfig"
            :has-value="hasValue"
            :label-floats="labelFloats"
            :is-focused="isFocused"
            :wrap-extra="{}"
            :has-supporting="!!widgetConfig.sup_text"
            wrap-variant="date">
            <input type="date"
                   class="form-control"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   @input="onInput"
                   @focus="isFocused = true"
                   @blur="isFocused = false">
            <template #supporting>
                <span v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return { value: '', isFocused: false };
    },
    computed: {
        hasValue() { return Boolean(this.value); },
        labelFloats() { return this.hasValue || this.isFocused; }
    },
    methods: {
        onInput() { this.emitInput(this.value); },
        setValue(value) { this.value = value; },
        getValue() { return this.value; }
    },
    mounted() {
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        } else if (this.widgetConfig.widget === 'date') {
            this.value = new Date().toISOString().split('T')[0];
        }
    }
};

const TimeWidget = {
    components: { Md3Field: window.Md3Field },
    mixins: [window.widgetMixin],
    props: {
        widgetConfig: { type: Object, required: true },
        widgetName: { type: String, required: true }
    },
    emits: ['input'],
    template: `
        <md3-field
            :widget-config="widgetConfig"
            :has-value="hasValue"
            :label-floats="labelFloats"
            :is-focused="isFocused"
            :wrap-extra="{}"
            :has-supporting="!!widgetConfig.sup_text"
            wrap-variant="time">
            <input type="time"
                   class="form-control"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   @input="onInput"
                   @focus="isFocused = true"
                   @blur="isFocused = false">
            <template #supporting>
                <span v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return { value: '', isFocused: false };
    },
    computed: {
        hasValue() { return Boolean(this.value); },
        labelFloats() { return this.hasValue || this.isFocused; }
    },
    methods: {
        onInput() { this.emitInput(this.value); },
        setValue(value) { this.value = value; },
        getValue() { return this.value; }
    },
    mounted() {
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        } else if (this.widgetConfig.widget === 'time') {
            this.value = new Date().toTimeString().split(' ')[0].substring(0, 5);
        }
    }
};

window.DateTimeWidget = DateTimeWidget;
window.DateWidget = DateWidget;
window.TimeWidget = TimeWidget;
