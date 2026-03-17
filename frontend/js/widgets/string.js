// Виджет для строковых полей (str)

const StringWidget = {
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
            :wrap-extra="{ error: !!regexError }"
            :has-supporting="!!(widgetConfig.sup_text || regexError)">
            <input type="text"
                   class="form-control"
                   :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   :title="value"
                   @input="onInput"
                   @focus="isFocused = true"
                   @blur="isFocused = false">
            <template #supporting>
                <span v-if="regexError" class="md3-error" v-text="regexError"></span>
                <span v-else v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return { value: '', regexError: '', isFocused: false };
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
        onInput() {
            this.validateRegex();
            this.emitInput(this.value);
        },
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
    window.StringWidget = StringWidget;
}
