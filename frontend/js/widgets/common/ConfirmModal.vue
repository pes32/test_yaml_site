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

<script setup lang="ts">
import { ref } from 'vue';

type ConfirmModalConfig = {
  accept?: string;
  cancel?: string;
  text?: string;
  title?: string;
};

defineOptions({
  name: 'ConfirmModal'
});

const show = ref(false);
const config = ref<ConfirmModalConfig | null>(null);
const _acceptHandler = ref<(() => void) | null>(null);

function open(nextConfig?: ConfirmModalConfig | null): void {
  config.value = nextConfig || {};
  show.value = true;
}

function hide(): void {
  show.value = false;
  _acceptHandler.value = null;
}

function accept(): void {
  _acceptHandler.value?.();
  hide();
}

function cancel(): void {
  hide();
}

defineExpose({
  _acceptHandler,
  accept,
  cancel,
  hide,
  open
});
</script>
