// Виджет для многострочного текста (text)

const TextWidget = {
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
            <div class="md3-textarea-wrap">
                <textarea class="form-control"
                         :style="textareaStyle"
                         :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                         :disabled="widgetConfig.readonly"
                         :tabindex="widgetConfig.readonly ? -1 : null"
                         :rows="widgetConfig.rows || 3"
                         v-model="value"
                         @input="onInput"
                         @focus="isFocused = true"
                         @blur="isFocused = false">
                </textarea>
            </div>
            <template #supporting>
                <span v-if="fieldError" class="md3-error" v-text="fieldError"></span>
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
        showPlaceholder() { return !this.hasValue && this.isFocused && this.widgetConfig.placeholder; },
        textareaStyle() {
            const w = this.widgetConfig && this.widgetConfig.width;
            if (w == null || w === '') return {};
            const widthVal = typeof w === 'number' ? `${w}px` : String(w);
            return {
                width: widthVal
            };
        }
    },
    methods: {
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

window.TextWidget = TextWidget;
