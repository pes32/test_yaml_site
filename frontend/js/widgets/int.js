// Виджет для целых чисел (int)

const IntWidget = {
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
            :wrap-extra="{ error: !!(regexError || intError) }"
            :has-supporting="!!(widgetConfig.sup_text || regexError || intError)">
            <input type="text"
                   class="form-control"
                   :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   @input="onIntInput"
                   @focus="isFocused = true"
                   @blur="isFocused = false">
            <template #supporting>
                <span v-if="regexError || intError" class="md3-error" v-text="regexError || intError"></span>
                <span v-else v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return { value: '', regexError: '', intError: '', isFocused: false };
    },
    computed: {
        hasValue() { return Boolean(this.value); },
        labelFloats() { return this.hasValue || this.isFocused; },
        showPlaceholder() { return !this.hasValue && this.isFocused && this.widgetConfig.placeholder; }
    },
    methods: {
        validateRegex() {
            const regex = this.widgetConfig.regex;
            if (!regex || this.widgetConfig.readonly) {
                this.regexError = '';
                return;
            }
            try {
                const re = typeof regex === 'string' ? new RegExp(regex) : regex;
                this.regexError = (this.value !== '' && !re.test(this.value))
                    ? (this.widgetConfig.err_text || 'Неверный формат')
                    : '';
            } catch {
                this.regexError = '';
            }
        },
        onIntInput() {
            const intValue = this.value.replace(/[^0-9-]/g, '');
            if (intValue === '-' || intValue === '') {
                this.value = intValue;
                this.intError = '';
            } else {
                const num = parseInt(intValue, 10);
                if (isNaN(num)) {
                    this.intError = 'Введите целое число';
                } else {
                    this.value = num.toString();
                    this.intError = '';
                }
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

if (typeof window !== 'undefined') {
    window.IntWidget = IntWidget;
}
