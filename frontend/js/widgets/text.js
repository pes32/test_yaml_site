// Виджет для многострочного текста (text)

import Md3Field from './md3_field.js';
import widgetMixin from './mixin.js';

const TextWidget = {
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
            :has-supporting="!!(widgetConfig.sup_text || fieldError)"
            wrap-variant="textarea"
            container-modifier="textarea">
            <div class="md3-textarea-wrap w-100 min-w-0">
                <textarea class="form-control"
                         :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                         :disabled="widgetConfig.readonly"
                         :tabindex="widgetConfig.readonly ? -1 : null"
                         :rows="widgetConfig.rows || 3"
                         v-model="value"
                         @input="onInput"
                         @focus="onFocus"
                         @blur="onBlur"
                         @keydown.ctrl.enter.prevent="onCommitShortcut"
                         @keydown.meta.enter.prevent="onCommitShortcut">
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
        showPlaceholder() { return !this.hasValue && this.isFocused && this.widgetConfig.placeholder; }
    },
    methods: {
        onFocus() {
            this.isFocused = true;
            this.activateDraftController();
        },
        onInput() {
            this.validateRegex();
            if (this.tableCellMode) {
                this.emitInput(this.value);
                return;
            }

            this.activateDraftController();
        },
        onBlur() {
            this.isFocused = false;
            this.commitDraft();
            this.deactivateDraftController();
        },
        onCommitShortcut() {
            this.commitDraft();
        },
        commitDraft() {
            this.validateRegex();
            this.handleTableCellCommitValidation(this.fieldError);
            this.emitInput(this.value);
        },
        setValue(value) { this.value = value == null ? '' : String(value); },
        getValue() { return this.value; }
    },
    watch: {
        'widgetConfig.value': {
            immediate: true,
            handler(value) {
                if (value === undefined) return;
                this.syncCommittedValue(value, (nextValue) => this.setValue(nextValue));
            }
        }
    },
    mounted() {
        this.validateRegex();
    }
};

export { TextWidget };
export default TextWidget;
