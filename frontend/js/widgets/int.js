// Виджет для целых чисел (int)

const IntWidget = {
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
                     :class="{ floating: labelFloats, focused: isFocused, filled: hasValue, error: !!intError, 'widget-readonly': widgetConfig.readonly }">
                    <input type="text"
                           class="form-control"
                           :disabled="widgetConfig.readonly"
                           :tabindex="widgetConfig.readonly ? -1 : null"
                           v-model="value"
                           @input="onIntInput"
                           @focus="isFocused = true"
                           @blur="isFocused = false">
                    <label v-if="widgetConfig.description">{{ widgetConfig.description }}</label>
                </div>
                <div v-if="widgetConfig.sup_tex || intError" class="md3-supporting">
                    <span v-if="intError" class="md3-error" v-text="intError"></span>
                    <span v-else v-text="widgetConfig.sup_tex"></span>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            value: '',
            intError: '',
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
        onIntInput() {
            // Валидация целого числа
            const intValue = this.value.replace(/[^0-9-]/g, '');
            if (intValue === '-' || intValue === '') {
                this.value = intValue;
                this.intError = '';
            } else {
                const num = parseInt(intValue);
                if (isNaN(num)) {
                    this.intError = 'Введите целое число';
                } else {
                    this.value = num.toString();
                    this.intError = '';
                }
            }
            this.onInput();
        },
        
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
        }
    },
    
    mounted() {
        // Инициализация значений по умолчанию
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        }
    }
};

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.IntWidget = IntWidget;
}
