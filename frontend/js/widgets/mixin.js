// Общий миксин для полевых виджетов: containerStyle и единый формат emit

const widgetMixin = {
    data() {
        return {
            intError: '',
            floatError: ''
        };
    },
    computed: {
        containerStyle() {
            const w = this.widgetConfig.width;
            if (w == null) return {};
            const widthVal = typeof w === 'number' ? w + 'px' : String(w);
            const isText = this.widgetConfig.widget === 'text';
            return isText ? { minWidth: widthVal } : { width: widthVal };
        },
        /** Собирает все ошибки поля (regex, int, float) для отображения. */
        fieldError() {
            return this.regexError || this.intError || this.floatError || '';
        }
    },
    methods: {
        /** Проверка значения по regex из widgetConfig, записывает в this.regexError */
        validateRegex() {
            const regex = this.widgetConfig.regex;
            if (!regex || this.widgetConfig.readonly) {
                this.regexError = '';
                return;
            }
            try {
                const re = typeof regex === 'string' ? new RegExp(regex) : regex;
                this.regexError = (this.value !== '' && !re.test(this.value))
                    ? (this.widgetConfig.err_text || 'Неверный формат')
                    : '';
            } catch {
                this.regexError = '';
            }
        },
        /** Единый формат события input: { name, value, config } */
        emitInput(value) {
            this.$emit('input', {
                name: this.widgetName,
                value,
                config: this.widgetConfig
            });
        }
    }
};

window.widgetMixin = widgetMixin;
