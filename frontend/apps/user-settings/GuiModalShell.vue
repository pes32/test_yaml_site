<template>
  <modal-frame :show="show" :title="title" :content-class="contentClass" :body-class="bodyClass" @close="emitClose">
    <slot></slot>
    <template v-if="$slots.footer" #footer>
      <slot name="footer"></slot>
    </template>
  </modal-frame>
</template>

<script setup lang="ts">
import ModalFrame from '@frontend/widgets/common/ModalFrame.vue';

defineOptions({
  name: 'GuiModalShell',
});

withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    contentClass?: string;
    bodyClass?: string;
  }>(),
  {
    contentClass: '',
    bodyClass: '',
  }
);

const emit = defineEmits<{
  close: [];
}>();

function emitClose(): void {
  emit('close');
}
</script>
