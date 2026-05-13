<template>
  <div v-if="show" class="modal-overlay confirm-modal-overlay flex-center" @click.self="emitClose">
    <div ref="modalContent" class="modal-content" :class="contentClass" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h5 class="modal-title">
          <slot name="title">{{ title }}</slot>
        </h5>
        <button type="button" class="ui-close-button" aria-label="Закрыть" @click="emitClose"></button>
      </div>
      <div class="modal-body" :class="bodyClass">
        <slot></slot>
      </div>
      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

defineOptions({
  name: 'ModalFrame',
});

const props = withDefaults(
  defineProps<{
    bodyClass?: string;
    contentClass?: string;
    show: boolean;
    title?: string;
  }>(),
  {
    bodyClass: '',
    contentClass: '',
    title: '',
  }
);

const emit = defineEmits<{
  close: [];
}>();

const modalContent = ref<HTMLElement | null>(null);

function emitClose(): void {
  emit('close');
}

function isFocusableVisible(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('tabindex') === '-1') return false;
  return Boolean(element.offsetParent || element.getClientRects().length);
}

function focusInitialControl(): void {
  const root = modalContent.value;
  if (!root) return;

  const bodyControl = root.querySelector<HTMLElement>(
    [
      '.modal-body input',
      '.modal-body textarea',
      '.modal-body select',
      '.modal-body button',
      '.modal-body [href]',
      '.modal-body [tabindex]:not([tabindex="-1"])',
    ].join(',')
  );
  if (bodyControl && isFocusableVisible(bodyControl)) {
    bodyControl.focus({ preventScroll: true });
    return;
  }

  const controls = Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        'button',
        '[href]',
        'input',
        'textarea',
        'select',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',')
    )
  );
  const target = controls.find(isFocusableVisible);
  target?.focus({ preventScroll: true });
}

watch(
  () => props.show,
  async (show) => {
    if (!show) return;
    await nextTick();
    focusInitialControl();
  },
  { flush: 'post' }
);
</script>
