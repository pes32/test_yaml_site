// Виджет для кнопок (button)

const ButtonWidget = {
    inject: { getConfirmModal: { from: 'getConfirmModal', default: () => null } },
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
                <img v-if="widgetConfig.icon && !$isFontIcon(widgetConfig.icon)" 
                     :src="$getIconSrc(widgetConfig.icon)"
                     :style="iconStyle"
                     alt=""
                     @error="$onIconError"
                     class="button-icon">
                <!-- FontAwesome иконка -->
                <i v-else-if="widgetConfig.icon && $isFontIcon(widgetConfig.icon)" 
                   :class="widgetConfig.icon"></i>
                <!-- Текст: при icon+text или text-only -->
                <span v-if="widgetConfig.label" 
                      v-text="widgetConfig.label"></span>
            </button>
            
            <div v-if="widgetConfig.sup_text" class="widget-info">
                <span v-text="widgetConfig.sup_text"></span>
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
            return Boolean(this.widgetConfig.icon && !this.widgetConfig.label);
        },
        buttonTitle() {
            if (this.isIconOnly && this.widgetConfig.hint) return this.widgetConfig.hint;
            if (this.widgetConfig.label) return this.widgetConfig.label;
            return 'Кнопка';
        },
        iconStyle() {
            if (!this.widgetConfig.icon || (window.GuiParser && window.GuiParser.isFontIcon(this.widgetConfig.icon))) {
                return {};
            }
            const size = this.widgetConfig.iconSize || this.widgetConfig.size || 24;
            return {
                width: `${size}px`,
                height: `${size}px`
            };
        },
        buttonStyle() {
            const w = this.widgetConfig.width || this.widgetConfig.size;
            if (this.isIconOnly) {
                const widthVal = w || 40;
                const pad = Math.max(0, Math.floor((40 - 24) / 2));
                return {
                    width: `${widthVal}px`,
                    minWidth: `${widthVal}px`,
                    padding: `${pad}px`
                };
            }
            // Кнопка с текстом и иконкой: width задаёт ширину
            if (w != null && w !== '') {
                const widthVal = typeof w === 'number' ? `${w}px` : String(w);
                return {
                    width: widthVal,
                    justifyContent: 'flex-start',
                    textAlign: 'left'
                };
            }
            return {};
        }
    },
    methods: {
        onButtonClick() {
            // Если есть диалог — показываем его; действие (url/command) выполнится при нажатии accept
            if (this.widgetConfig.dialog) {
                this.showConfirmDialog();
                return;
            }
            // source — открыть файл (PDF и т.д.) в новой вкладке
            if (this.widgetConfig.source) {
                const src = String(this.widgetConfig.source).trim();
                const href = /^https?:\/\//i.test(src) || src.startsWith('/') ? src : '/' + src;
                window.open(href, '_blank', 'noopener,noreferrer');
                return;
            }
            // url — перейти по ссылке в текущей вкладке
            if (this.widgetConfig.url) {
                window.location.href = this.widgetConfig.url;
                return;
            }
            if (this.widgetConfig.command) {
                this.executeCommand();
            }
        },
        
        showConfirmDialog() {
            const getModal = this.getConfirmModal;
            if (!getModal) return;
            const modal = getModal();
            if (!modal) return;

            const d = this.widgetConfig.dialog || {};
            modal._acceptHandler = () => {
                if (this.widgetConfig.url) {
                    window.location.href = this.widgetConfig.url;
                } else if (this.widgetConfig.command) {
                    this.executeCommand();
                }
            };
            modal.open({
                title: d.title || 'Подтверждение',
                text: d.text || 'Вы уверены?',
                accept: d.accept || 'Подтвердить',
                cancel: d.cancel || 'Отмена'
            });
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
window.ButtonWidget = ButtonWidget;
