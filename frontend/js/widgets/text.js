// Виджет для многострочного текста (text)

const TextWidget = {
    props: {
        widgetConfig: {
            type: Object,
            required: true
        },
        widgetName: {
            type: String,
            required: true
        }
    },
    emits: ['input'],
    template: `
        <div class="widget-container">
            <div class="md3-field" :class="{ filled: hasValue }">
                <div class="md3-field-wrap"
                     :class="{ floating: labelFloats, focused: isFocused, filled: hasValue, 'widget-readonly': widgetConfig.readonly }">
                    <div class="md3-textarea-wrap" ref="textareaWrap">
                        <textarea ref="textareaEl" class="form-control"
                                  :disabled="widgetConfig.readonly"
                                  :tabindex="widgetConfig.readonly ? -1 : null"
                                  :rows="widgetConfig.rows || 3"
                                  v-model="value"
                                  @input="onInput"
                                  @focus="isFocused = true"
                                  @blur="isFocused = false">
                        </textarea>
                    </div>
                    <label v-if="widgetConfig.description">{{ widgetConfig.description }}</label>
                </div>
                <div v-if="widgetConfig.sup_tex" class="md3-supporting">
                    <span v-text="widgetConfig.sup_tex"></span>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            value: '',
            isFocused: false
        };
    },
    computed: {
        hasValue() { return Boolean(this.value); },
        labelFloats() {
            return this.hasValue || this.isFocused;
        }
    },
    methods: {
        onInput() {
            this.$emit('input', {
                name: this.widgetName,
                value: this.value,
                config: this.widgetConfig
            });
        },
        setValue(value) {
            this.value = value;
        },
        getValue() {
            return this.value;
        },
        _syncWrapToTextarea() {
            const wrap = this.$refs.textareaWrap;
            const ta = this.$refs.textareaEl;
            if (wrap && ta) {
                wrap.style.width = ta.offsetWidth + 'px';
            }
        }
    },
    mounted() {
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        }
        this.$nextTick(() => {
            this._syncWrapToTextarea();
            const ta = this.$refs.textareaEl;
            if (ta && typeof ResizeObserver !== 'undefined') {
                this._resizeObserver = new ResizeObserver(() => this._syncWrapToTextarea());
                this._resizeObserver.observe(ta);
            }
        });
    },
    beforeUnmount() {
        if (this._resizeObserver && this.$refs.textareaEl) {
            this._resizeObserver.unobserve(this.$refs.textareaEl);
        }
    }
};

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.TextWidget = TextWidget;
}
