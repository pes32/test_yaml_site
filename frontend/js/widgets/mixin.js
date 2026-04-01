// Общий миксин для полевых виджетов: валидация и единый формат emit

const widgetMixin = {
    inject: {
        showAppNotification: {
            from: 'showAppNotification',
            default: null
        },
        setActiveDraftWidgetController: {
            from: 'setActiveDraftWidgetController',
            default: null
        },
        clearActiveDraftWidgetController: {
            from: 'clearActiveDraftWidgetController',
            default: null
        }
    },
    data() {
        return {
            intError: '',
            floatError: '',
            tableCellCommitError: '',
            isDraftEditing: false
        };
    },
    computed: {
        tableCellMode() {
            return !!(
                this.widgetConfig && this.widgetConfig.table_cell_mode === true
            );
        },
        tableCellRootAttrs() {
            if (!this.tableCellMode) return {};
            const attrs = {
                'data-table-embedded-widget': 'true'
            };
            const consume =
                this.widgetConfig && this.widgetConfig.table_consume_keys;
            if (consume) {
                attrs['data-table-consume-keys'] = String(consume);
            }
            return attrs;
        },
        /** Собирает все ошибки поля (regex, int, float) для отображения. */
        fieldError() {
            return (
                this.regexError ||
                this.intError ||
                this.floatError ||
                this.tableCellCommitError ||
                ''
            );
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
        },
        usesDraftCommitModel() {
            return !this.tableCellMode;
        },
        syncCommittedValue(value, applyValue) {
            if (typeof applyValue !== 'function') {
                return;
            }

            const editingLocked = this.usesDraftCommitModel()
                ? this.isDraftEditing
                : !!this.isFocused;

            if (editingLocked) {
                return;
            }

            applyValue(value);
        },
        activateDraftController() {
            if (!this.usesDraftCommitModel() || this.widgetConfig.readonly) {
                return;
            }

            this.isDraftEditing = true;
            if (typeof this.setActiveDraftWidgetController === 'function') {
                this.setActiveDraftWidgetController(this);
            }
        },
        deactivateDraftController() {
            if (!this.usesDraftCommitModel()) {
                return;
            }

            this.isDraftEditing = false;
            if (typeof this.clearActiveDraftWidgetController === 'function') {
                this.clearActiveDraftWidgetController(this);
            }
        },
        showWidgetNotification(message, type = 'danger') {
            if (typeof this.showAppNotification === 'function') {
                this.showAppNotification(message, type);
                return;
            }

            const root = this.$root;
            if (root && typeof root.showNotification === 'function') {
                root.showNotification(message, type);
            }
        },
        syncTableCellValidationState(message) {
            const handler =
                this.widgetConfig &&
                this.widgetConfig.table_cell_validation_handler;
            if (typeof handler !== 'function') return;
            try {
                handler(String(message || '').trim());
            } catch (e) {
                /* best effort */
            }
        },
        handleTableCellCommitValidation(message) {
            const errorMessage = String(message || '').trim();
            if (!this.tableCellMode) {
                this.tableCellCommitError = '';
                return errorMessage === '';
            }
            this.tableCellCommitError = errorMessage;
            this.syncTableCellValidationState(errorMessage);
            if (errorMessage) {
                this.showWidgetNotification(errorMessage, 'danger');
            }
            return errorMessage === '';
        }
    },
    beforeUnmount() {
        this.deactivateDraftController();
    }
};

export { widgetMixin };
export default widgetMixin;
