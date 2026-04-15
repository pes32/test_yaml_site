<template>
  <div v-if="error" class="feedback-panel error-panel">
    <div class="feedback-panel__summary">
      <span class="feedback-panel__title">Ошибка</span>
      <span class="feedback-panel__meta" v-text="error.scope + ' | ' + error.kind"></span>
      <button
        type="button"
        class="ui-close-button feedback-panel__dismiss"
        aria-label="Скрыть ошибку"
        @click="emit('dismiss')"
      ></button>
    </div>
    <div class="feedback-panel__body">
      <div class="feedback-panel__message" v-text="error.message"></div>
      <div class="feedback-panel__location" v-text="'recoverable: ' + (error.recoverable ? 'yes' : 'no')"></div>
      <pre v-if="detailsText" class="feedback-panel__details" v-text="detailsText"></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FrontendRuntimeError } from '../../runtime/error_model.ts';

defineOptions({
  name: 'ErrorPanel'
});

const props = defineProps<{
  error?: FrontendRuntimeError | null;
}>();

const emit = defineEmits<{
  (event: 'dismiss'): void;
}>();

const detailsText = computed(() => {
  if (!props.error || !props.error.details) {
    return '';
  }

  if (typeof props.error.details === 'string') {
    return props.error.details;
  }

  try {
    return JSON.stringify(props.error.details, null, 2);
  } catch {
    return '';
  }
});
</script>
