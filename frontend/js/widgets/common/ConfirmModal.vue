<template>
  <modal-frame
    :show="show"
    :title="config?.title || 'Подтверждение'"
    content-class="confirm-modal-content"
    body-class="confirm-modal-body--multiline"
    @close="cancel"
  >
    <div>{{ config?.text || 'Вы уверены?' }}</div>
    <div v-if="errorText" class="confirm-modal-error" role="alert">{{ errorText }}</div>
    <template #footer>
      <button
        type="button"
        class="widget-button confirm-modal-action confirm-modal-action--secondary"
        @click="cancel"
        v-text="config?.cancel || 'Отмена'"
      ></button>
      <button
        type="button"
        class="widget-button confirm-modal-action"
        :disabled="busy"
        @click="accept"
        v-text="config?.accept || 'Подтвердить'"
      ></button>
    </template>
  </modal-frame>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ModalFrame from './ModalFrame.vue';
import type { ConfirmModalConfig } from './confirm_modal_contract.ts';

defineOptions({
  name: 'ConfirmModal',
});

const show = ref(false);
const config = ref<ConfirmModalConfig | null>(null);
const acceptHandler = ref<(() => void | Promise<void>) | null>(null);
const cancelHandler = ref<(() => void) | null>(null);
const busy = ref(false);
const errorText = ref('');

function open(nextConfig?: ConfirmModalConfig | null): void {
  const cfg = nextConfig || {};
  config.value = cfg;
  acceptHandler.value = typeof cfg.onAccept === 'function' ? cfg.onAccept : null;
  cancelHandler.value = typeof cfg.onCancel === 'function' ? cfg.onCancel : null;
  busy.value = false;
  errorText.value = '';
  show.value = true;
}

function close(): void {
  show.value = false;
  acceptHandler.value = null;
  cancelHandler.value = null;
  config.value = null;
  busy.value = false;
  errorText.value = '';
}

async function accept(): Promise<void> {
  const handler = acceptHandler.value;
  if (!handler) {
    close();
    return;
  }
  busy.value = true;
  errorText.value = '';
  try {
    await handler();
    close();
  } catch (err) {
    errorText.value = err instanceof Error ? err.message : String(err);
    busy.value = false;
  }
}

function cancel(): void {
  const handler = cancelHandler.value;
  close();
  if (handler) handler();
}

defineExpose({
  accept,
  cancel,
  close,
  open,
});
</script>

<style scoped>
:deep(.confirm-modal-body--multiline) {
  white-space: pre-wrap;
  word-break: break-word;
}
.confirm-modal-error {
  margin-top: var(--space-md, 12px);
  color: var(--color-danger, #c00);
  font-size: var(--text-sm, 13px);
}
</style>
