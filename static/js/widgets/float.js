// Виджет для дробных чисел (float)

const FloatWidget = {
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
                   :class="{ 'widget-readonly': widgetConfig.readonly, 'is-invalid': floatError }"
                   :disabled="widgetConfig.readonly"
                   :tabindex="widgetConfig.readonly ? -1 : null"
                   v-model="value"
                   @input="onFloatInput"
                   placeholder="Введите дробное число">
            <div v-if="floatError" class="invalid-feedback">
                <span v-text="floatError"></span>
            </div>
            
            <div v-if="widgetConfig.info" class="widget-info">
                <span v-text="widgetConfig.info"></span>
            </div>
        </div>
    `,
    data() {
        return {
            value: '',
            floatError: ''
        };
    },
    methods: {
        onFloatInput() {
            // Разрешаем ввод цифр, точки, запятой и минуса
            let input = this.value;
            
            // Заменяем запятую на точку для стандартного формата
            input = input.replace(/,/g, '.');
            
            // Убираем все, кроме цифр, точки и минуса
            input = input.replace(/[^0-9.-]/g, '');
            
            // Проверяем корректность формата
            if (input === '' || input === '-' || input === '.' || input === '-.') {
                this.value = input;
                this.floatError = '';
            } else {
                // Проверяем, что точка только одна
                const dotCount = (input.match(/\./g) || []).length;
                if (dotCount > 1) {
                    // Оставляем только первую точку
                    const parts = input.split('.');
                    input = parts[0] + '.' + parts.slice(1).join('');
                }
                
                // Проверяем, что минус только в начале
                if (input.startsWith('-')) {
                    input = '-' + input.substring(1).replace(/-/g, '');
                } else {
                    input = input.replace(/-/g, '');
                }
                
                this.value = input;
                
                // Валидация числа
                if (input.endsWith('.') || input.endsWith('-')) {
                    this.floatError = '';
                } else {
                    const num = parseFloat(input);
                    if (isNaN(num)) {
                        this.floatError = 'Введите корректное дробное число';
                    } else {
                        this.floatError = '';
                    }
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
    window.FloatWidget = FloatWidget;
}
