// Виджет для кнопок (button)

const ButtonWidget = {
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
    emits: ['execute'],
    template: `
        <div class="widget-container">
            <button class="btn widget-button"
                    :disabled="widgetConfig.readonly"
                    @click="onButtonClick">
                <i v-if="widgetConfig.icon" :class="'fas fa-' + widgetConfig.icon"></i>
                <span v-text="widgetConfig.description || 'Кнопка'"></span>
            </button>
            
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
        onButtonClick() {
            // Проверяем, есть ли URL для перехода
            if (this.widgetConfig.url) {
                window.location.href = this.widgetConfig.url;
                return;
            }
            
            // Проверяем, нужен ли диалог подтверждения
            if (this.widgetConfig.dialog) {
                this.showConfirmDialog();
            } else if (this.widgetConfig.command) {
                this.executeCommand();
            }
            // Если нет ни url, ни dialog, ни command - кнопка просто ничего не делает
        },
        
        showConfirmDialog() {
            const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
            const title = document.getElementById('confirmModalTitle');
            const body = document.getElementById('confirmModalBody');
            const acceptBtn = document.getElementById('confirmModalAccept');
            
            title.textContent = this.widgetConfig.dialog.title || 'Подтверждение';
            body.textContent = this.widgetConfig.dialog.text || 'Вы уверены?';
            
            // Обработчик для кнопки подтверждения
            const handleAccept = () => {
                this.executeCommand();
                modal.hide();
                acceptBtn.removeEventListener('click', handleAccept);
            };
            
            acceptBtn.addEventListener('click', handleAccept);
            modal.show();
        },
        
        executeCommand() {
            // Если нет команды, просто выходим
            if (!this.widgetConfig.command) {
                return;
            }
            
            const params = {};
            
            // Собираем параметры из output_attrs
            if (this.widgetConfig.output_attrs) {
                const attrs = Array.isArray(this.widgetConfig.output_attrs) 
                    ? this.widgetConfig.output_attrs 
                    : [this.widgetConfig.output_attrs];
                
                attrs.forEach(attr => {
                    // Здесь нужно получить значение атрибута из родительского компонента
                    params[attr] = `value_${attr}`;
                });
            }
            
            this.$emit('execute', {
                command: this.widgetConfig.command,
                params: params,
                widget: this.widgetName
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
    window.ButtonWidget = ButtonWidget;
}
