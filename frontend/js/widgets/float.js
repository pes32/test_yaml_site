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
            <div class="md3-field" :class="{ filled: hasValue }">
                <div class="md3-field-wrap"
                     :class="{ floating: labelFloats, focused: isFocused, filled: hasValue, error: !!floatError, 'widget-readonly': widgetConfig.readonly }">
                    <input type="text"
                           class="form-control"
                           :disabled="widgetConfig.readonly"
                           :tabindex="widgetConfig.readonly ? -1 : null"
                           v-model="value"
                           @input="onFloatInput"
                           @focus="isFocused = true"
                           @blur="isFocused = false">
                    <label v-if="widgetConfig.description">{{ widgetConfig.description }}</label>
                </div>
                <div v-if="widgetConfig.sup_tex || floatError" class="md3-supporting">
                    <span v-if="floatError" class="md3-error" v-text="floatError"></span>
                    <span v-else v-text="widgetConfig.sup_tex"></span>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            value: '',
            floatError: '',
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
