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
            :wrap-extra="{ error: !!intError }"
            :has-supporting="!!(widgetConfig.sup_tex || intError)">
            <input type="text"
                   class="form-control"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   @input="onIntInput"
                   @focus="isFocused = true"
                   @blur="isFocused = false">
            <template #supporting>
                <span v-if="intError" class="md3-error" v-text="intError"></span>
                <span v-else v-text="widgetConfig.sup_tex"></span>
            </template>
        </md3-field>
    `,
    data() {
        return { value: '', intError: '', isFocused: false };
    },
    computed: {
        hasValue() { return Boolean(this.value); },
        labelFloats() { return this.hasValue || this.isFocused; }
    },
    methods: {
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
    }
};

if (typeof window !== 'undefined') {
    window.IntWidget = IntWidget;
}
