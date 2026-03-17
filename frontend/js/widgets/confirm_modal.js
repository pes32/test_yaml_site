// Vue-компонент диалога подтверждения (замена Bootstrap Modal)

const ConfirmModal = {
    data() {
        return {
            show: false,
            config: null,
            _acceptHandler: null
        };
    },
    template: `
        <div v-if="show" class="modal-overlay confirm-modal-overlay" @click.self="cancel">
            <div class="modal-content confirm-modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" v-text="config?.title || 'Подтверждение'"></h5>
                    <button type="button" class="btn-close" @click="cancel" aria-label="Закрыть"></button>
                </div>
                <div class="modal-body" v-text="config?.text || 'Вы уверены?'"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="cancel" v-text="config?.cancel || 'Отмена'"></button>
                    <button type="button" class="btn btn-primary" @click="accept" v-text="config?.accept || 'Подтвердить'"></button>
                </div>
            </div>
        </div>
    `,
    methods: {
        open(config) {
            this.config = config || {};
            this.show = true;
        },
        hide() {
            this.show = false;
            this._acceptHandler = null;
        },
        accept() {
            if (this._acceptHandler) this._acceptHandler();
            this.hide();
        },
        cancel() {
            this.hide();
        }
    }
};

if (typeof window !== 'undefined') {
    window.ConfirmModal = ConfirmModal;
}
