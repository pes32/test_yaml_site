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
                    :class="{ 'icon-only': isIconOnly }"
                    :style="buttonStyle"
                    :disabled="widgetConfig.readonly"
                    @click="onButtonClick"
                    :title="buttonTitle">
                <!-- SVG иконка -->
                <img v-if="widgetConfig.icon && !widgetConfig.icon.startsWith('fas')" 
                     :src="'/templates/icons/' + widgetConfig.icon"
                     :style="iconStyle"
                     alt=""
                     @error="onIconError"
                     class="button-icon">
                <!-- FontAwesome иконка -->
                <i v-else-if="widgetConfig.icon && widgetConfig.icon.startsWith('fas')" 
                   :class="widgetConfig.icon"></i>
                <!-- Текст: при icon+text или text-only -->
                <span v-if="widgetConfig.description" 
                      v-text="widgetConfig.description"></span>
            </button>
            
            <div v-if="widgetConfig.sup_tex" class="widget-info">
                <span v-text="widgetConfig.sup_tex"></span>
            </div>
        </div>
    `,
    data() {
        return {
            value: ''
        };
    },
    computed: {
        isIconOnly() {
            return Boolean(this.widgetConfig.icon && !this.widgetConfig.description);
        },
        buttonTitle() {
            if (this.isIconOnly && this.widgetConfig.hint) return this.widgetConfig.hint;
            if (this.widgetConfig.description) return this.widgetConfig.description;
            return 'Кнопка';
        },
        iconStyle() {
            if (!this.widgetConfig.icon || this.widgetConfig.icon.startsWith('fas')) {
                return {};
            }
            const size = this.widgetConfig.iconSize || this.widgetConfig.size || 24;
            return {
                width: `${size}px`,
                height: `${size}px`
            };
        },
        buttonStyle() {
            // Кнопка только с иконкой: высота 40px, ширина из width или 40 (квадрат)
            if (this.isIconOnly) {
                const w = this.widgetConfig.width || this.widgetConfig.size || 40;
                const pad = Math.max(0, Math.floor((40 - 24) / 2));
                return {
                    width: `${w}px`,
                    minWidth: `${w}px`,
                    padding: `${pad}px`
                };
            }
            return {};
        }
    },
    methods: {
        onIconError(event) {
            const img = event && event.target;
            if (!img) {
                return;
            }

            img.style.display = 'none';
        },

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
            
            // Проверяем специальную команду для закрытия модального окна
            if (this.widgetConfig.command === 'CLOSE_MODAL') {
                // Закрываем модальное окно через глобальный менеджер
                if (this.$root.$refs.modalManager) {
                    this.$root.$refs.modalManager.closeModal();
                }
                return;
            }
            
            // Проверяем, является ли команда UI-командой (содержит -ui)
            if (this.widgetConfig.command.includes(' -ui')) {
                const modalName = this.widgetConfig.command.replace(' -ui', '').trim();
                // Открываем модальное окно через глобальный менеджер
                const mgr = (this.$root && this.$root.$refs && this.$root.$refs.modalManager) || window.modalManager;
                if (mgr && typeof mgr.openModal === 'function') {
                    mgr.openModal(modalName);
                }
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
