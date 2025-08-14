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
            <div v-if="widgetConfig.description" class="widget-label">
                <span v-text="widgetConfig.description"></span>
            </div>
            
            <input type="text" 
                   class="form-control widget-input"
                   :class="{ 'widget-readonly': widgetConfig.readonly, 'is-invalid': intError }"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   @input="onIntInput"
                   placeholder="Введите целое число">
            <div v-if="intError" class="invalid-feedback">
                <span v-text="intError"></span>
            </div>
            
            <div v-if="widgetConfig.info" class="widget-info">
                <span v-text="widgetConfig.info"></span>
            </div>
        </div>
    `,
    data() {
        return {
            value: '',
            intError: ''
        };
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
