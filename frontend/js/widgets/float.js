// Виджет для дробных чисел (float)

const FloatWidget = {
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
            :wrap-extra="{ error: !!fieldError }"
            :has-supporting="!!(widgetConfig.sup_text || fieldError)">
            <input type="text"
                   class="form-control"
                   :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   @input="onFloatInput"
                   @focus="isFocused = true"
                   @blur="isFocused = false">
            <template #supporting>
                <span v-if="fieldError" class="md3-error" v-text="fieldError"></span>
                <span v-else v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return { value: '', regexError: '', floatError: '', isFocused: false };
    },
    computed: {
        hasValue() { return Boolean(this.value); },
        labelFloats() { return this.hasValue || this.isFocused; },
        showPlaceholder() { return !this.hasValue && this.isFocused && this.widgetConfig.placeholder; }
    },
    methods: {
        onFloatInput() {
            let input = this.value.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
            if (input.startsWith('-')) {
                input = '-' + input.substring(1).replace(/-/g, '');
            } else {
                input = input.replace(/-/g, '');
            }
            const dotCount = (input.match(/\./g) || []).length;
            if (dotCount > 1) {
                const parts = input.split('.');
                input = parts[0] + '.' + parts.slice(1).join('');
            }
            this.value = input;
            if (input === '' || input === '-' || input === '.' || input === '-.') {
                this.floatError = '';
            } else if (input.endsWith('.') || input.endsWith('-')) {
                this.floatError = '';
            } else {
                const num = parseFloat(input);
                this.floatError = isNaN(num) ? 'Введите корректное дробное число' : '';
            }
            this.validateRegex();
            this.emitInput(this.value);
        },
        onInput() { this.emitInput(this.value); },
        setValue(value) { this.value = value; },
        getValue() { return this.value; }
    },
    mounted() {
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        }
        this.validateRegex();
    }
};

window.FloatWidget = FloatWidget;
