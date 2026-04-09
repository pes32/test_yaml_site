<template>
  <div v-if="show" class="modal-overlay confirm-modal-overlay flex-center" @click.self="cancel">
    <div class="modal-content confirm-modal-content">
      <div class="modal-header">
        <h5 class="modal-title" v-text="config?.title || 'Подтверждение'"></h5>
        <button type="button" class="ui-close-button" aria-label="Закрыть" @click="cancel"></button>
      </div>
      <div class="modal-body" v-text="config?.text || 'Вы уверены?'"></div>
      <div class="modal-footer">
        <button
          type="button"
          class="widget-button confirm-modal-action confirm-modal-action--secondary"
          @click="cancel"
          v-text="config?.cancel || 'Отмена'"
        ></button>
        <button
          type="button"
          class="widget-button confirm-modal-action"
          @click="accept"
          v-text="config?.accept || 'Подтвердить'"
        ></button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConfirmModal',
  data() {
    return {
      show: false,
      config: null,
      _acceptHandler: null
    };
  },
  methods: {
    open(nextConfig) {
      this.config = nextConfig || {};
      this.show = true;
    },
    hide() {
      this.show = false;
      this._acceptHandler = null;
    },
    accept() {
      if (this._acceptHandler) {
        this._acceptHandler();
      }

      this.hide();
    },
    cancel() {
      this.hide();
    }
  }
};
</script>
