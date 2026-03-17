// Виджет для модальных окон (modal)

const ModalWidget = {
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
            <div v-if="widgetConfig.label" class="widget-label">
                <span v-text="widgetConfig.label"></span>
            </div>

            <button
                type="button"
                class="btn btn-primary d-inline-flex align-items-center gap-2"
                @click="openModal">
                <span v-if="widgetConfig.icon" class="page-item-icon">
                    <img v-if="!isFontIcon(widgetConfig.icon)"
                         :src="getIconSrc(widgetConfig.icon)"
                         alt=""
                         @error="onIconError">
                    <i v-else :class="widgetConfig.icon"></i>
                </span>
                <span v-text="widgetConfig.label || 'Открыть'"></span>
            </button>
        </div>
    `,
    methods: {
        resolveModalName() {
            const command = this.widgetConfig.command || '';
            if (command.includes(' -ui')) {
                return command.replace(' -ui', '').trim();
            }

            return this.widgetName;
        },

        openModal() {
            const modalName = this.resolveModalName();
            const modalManager = (this.$root && this.$root.$refs && this.$root.$refs.modalManager)
                || window.modalManager;

            if (modalManager && typeof modalManager.openModal === 'function') {
                modalManager.openModal(modalName);
                return;
            }

            console.warn('Modal manager is not available for:', modalName);
        },

        isFontIcon(icon) {
            return window.GuiParser ? window.GuiParser.isFontIcon(icon) : false;
        },

        getIconSrc(icon) {
            return window.GuiParser ? window.GuiParser.getIconSrc(icon) : null;
        },

        onIconError(event) {
            const img = event && event.target;
            if (!img) {
                return;
            }

            img.style.display = 'none';
            if (img.parentElement) {
                img.parentElement.style.display = 'none';
            }
        }
    }
};

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.ModalWidget = ModalWidget;
}
