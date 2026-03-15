// Виджеты для даты и времени (datetime, date, time)

const DateTimeWidget = {
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
                <div class="md3-field-wrap md3-datetime-wrap"
                     :class="{ floating: labelFloats, focused: isFocused, filled: hasValue, 'widget-readonly': widgetConfig.readonly }">
                    <div class="widget-datetime">
                        <input type="date"
                               class="form-control"
                               :disabled="widgetConfig.readonly"
                               :tabindex="widgetConfig.readonly ? -1 : null"
                               v-model="dateValue"
                               @input="onDateTimeInput"
                               @focus="isFocused = true"
                               @blur="isFocused = false">
                        <input type="time"
                               class="form-control"
                               :disabled="widgetConfig.readonly"
                               :tabindex="widgetConfig.readonly ? -1 : null"
                               v-model="timeValue"
                               @input="onDateTimeInput"
                               @focus="isFocused = true"
                               @blur="isFocused = false">
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
            dateValue: '',
            timeValue: '',
            isFocused: false
        };
    },
    computed: {
        hasValue() { return Boolean(this.dateValue || this.timeValue); },
        labelFloats() {
            return this.hasValue || this.isFocused;
        }
    },
    methods: {
        onDateTimeInput() {
            if (this.dateValue && this.timeValue) {
                this.value = `${this.dateValue} ${this.timeValue}`;
            } else {
                this.value = '';
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
            // Парсим значение на дату и время
            if (value) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    this.dateValue = date.toISOString().split('T')[0];
                    this.timeValue = date.toTimeString().split(' ')[0].substring(0, 5); // Убираем секунды
                }
            }
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
        
        // Инициализация datetime
        if (this.widgetConfig.widget === 'datetime') {
            const now = new Date();
            this.dateValue = now.toISOString().split('T')[0];
            this.timeValue = now.toTimeString().split(' ')[0].substring(0, 5); // Убираем секунды
        }
    }
};

const DateWidget = {
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
                    <input type="date"
                           class="form-control"
                           :disabled="widgetConfig.readonly"
                           :tabindex="widgetConfig.readonly ? -1 : null"
                           v-model="value"
                           @input="onInput"
                           @focus="isFocused = true"
                           @blur="isFocused = false">
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
        }
    },
    
    mounted() {
        // Инициализация значений по умолчанию
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        } else if (this.widgetConfig.widget === 'date') {
            // Устанавливаем текущую дату по умолчанию
            const now = new Date();
            this.value = now.toISOString().split('T')[0];
        }
    }
};

const TimeWidget = {
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
                    <input type="time"
                           class="form-control"
                           :disabled="widgetConfig.readonly"
                           :tabindex="widgetConfig.readonly ? -1 : null"
                           v-model="value"
                           @input="onInput"
                           @focus="isFocused = true"
                           @blur="isFocused = false">
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
        }
    },
    
    mounted() {
        // Инициализация значений по умолчанию
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        } else if (this.widgetConfig.widget === 'time') {
            // Устанавливаем текущее время по умолчанию (без секунд)
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0].substring(0, 5); // Берем только HH:MM
            this.value = timeString;
        }
    }
};

// Регистрируем виджеты глобально
if (typeof window !== 'undefined') {
    window.DateTimeWidget = DateTimeWidget;
    window.DateWidget = DateWidget;
    window.TimeWidget = TimeWidget;
}
