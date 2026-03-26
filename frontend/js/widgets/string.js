// Виджет для строковых полей (str)

import Md3Field from './md3_field.js';
import widgetMixin from './mixin.js';

const StringWidget = {
    components: { Md3Field },
    mixins: [widgetMixin],
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
                   data-table-editor-target="true"
                   v-bind="tableCellRootAttrs"
                   :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   :title="value"
                   @input="onInput"
                   @focus="isFocused = true"
                   @blur="onBlur">
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
        showPlaceholder() { return !this.hasValue && this.isFocused && this.widgetConfig.placeholder; }
    },
    methods: {
        onInput() {
            this.validateRegex();
            this.emitInput(this.value);
        },
        onBlur() {
            this.isFocused = false;
            this.validateRegex();
            this.handleTableCellCommitValidation(this.fieldError);
        },
        setValue(value) {
            this.value = value == null ? '' : String(value);
            this.validateRegex();
        },
        getValue() { return this.value; }
    },
    watch: {
        'widgetConfig.value': {
            immediate: true,
            handler(value) {
                if (value === undefined) return;
                this.setValue(value);
            }
        }
    },
    mounted() {
        if (this.widgetConfig.value !== undefined) {
            this.setValue(this.widgetConfig.value);
        } else if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        }
        this.validateRegex();
    }
};

export { StringWidget };
export default StringWidget;
