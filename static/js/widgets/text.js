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
            <div v-if="widgetConfig.description" class="widget-label">
                <span v-text="widgetConfig.description"></span>
            </div>
            
            <textarea class="form-control widget-text"
                      :class="{ 'widget-readonly': widgetConfig.readonly }"
                      :disabled="widgetConfig.readonly"
                      :tabindex="widgetConfig.readonly ? -1 : null"
                      :rows="widgetConfig.rows || 3"
                      v-model="value"
                      @input="onInput"
                      :placeholder="widgetConfig.placeholder || 'Введите текст'">
            </textarea>
            
            <div v-if="widgetConfig.info" class="widget-info">
                <span v-text="widgetConfig.info"></span>
            </div>
        </div>
    `,
    data() {
        return {
            value: ''
        };
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
        }
    }
};

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.TextWidget = TextWidget;
}
