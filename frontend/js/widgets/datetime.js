// Виджет для даты и времени (datetime)

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
            <div v-if="widgetConfig.description" class="widget-label">
                <span v-text="widgetConfig.description"></span>
            </div>
            
            <div class="widget-datetime">
                <input type="date" 
                       class="form-control widget-input"
                       :class="{ 'widget-readonly': widgetConfig.readonly }"
                       :disabled="widgetConfig.readonly"
                       :tabindex="widgetConfig.readonly ? -1 : null"
                       v-model="dateValue"
                       @input="onDateTimeInput">
                <input type="time" 
                       class="form-control widget-input"
                       :class="{ 'widget-readonly': widgetConfig.readonly }"
                       :disabled="widgetConfig.readonly"
                       :tabindex="widgetConfig.readonly ? -1 : null"
                       v-model="timeValue"
                       @input="onDateTimeInput">
            </div>
            
            <div v-if="widgetConfig.info" class="widget-info">
                <span v-text="widgetConfig.info"></span>
            </div>
        </div>
    `,
    data() {
        return {
            value: '',
            dateValue: '',
            timeValue: ''
        };
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
                    this.timeValue = date.toTimeString().split(' ')[0];
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
            this.timeValue = now.toTimeString().split(' ')[0];
        }
    }
};

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.DateTimeWidget = DateTimeWidget;
}
