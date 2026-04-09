<template>
  <details v-if="items.length" class="feedback-panel diagnostics-panel" :open="hasCritical">
    <summary class="feedback-panel__summary">
      <span class="feedback-panel__title">Диагностика</span>
      <span class="feedback-panel__meta" v-text="summaryText"></span>
      <span v-if="snapshotVersion" class="feedback-panel__meta" v-text="'snapshot ' + snapshotVersion"></span>
    </summary>
    <div class="feedback-panel__body">
      <div
        v-for="(item, index) in items"
        :key="item.code + ':' + index"
        class="feedback-panel__item"
        :class="'feedback-panel__item--' + item.level"
      >
        <div class="feedback-panel__item-head">
          <strong v-text="item.code"></strong>
          <span class="feedback-panel__level" v-text="item.level"></span>
        </div>
        <div class="feedback-panel__message" v-text="item.message"></div>
        <div v-if="locationText(item)" class="feedback-panel__location" v-text="locationText(item)"></div>
      </div>
    </div>
  </details>
</template>

<script setup>
import { computed } from 'vue';
import {
  countDiagnosticsByLevel,
  formatDiagnosticLocation,
  normalizeDiagnostics
} from '../../runtime/diagnostics.js';

defineOptions({
  name: 'DiagnosticsPanel'
});

const props = defineProps({
  diagnostics: {
    type: Array,
    default: () => []
  },
  snapshotVersion: {
    type: String,
    default: ''
  }
});

const items = computed(() => normalizeDiagnostics(props.diagnostics));
const counts = computed(() => countDiagnosticsByLevel(items.value));
const hasCritical = computed(() => counts.value.error > 0 || counts.value.warning > 0);
const summaryText = computed(() => {
  const parts = [];

  if (counts.value.error) {
    parts.push(`errors: ${counts.value.error}`);
  }

  if (counts.value.warning) {
    parts.push(`warnings: ${counts.value.warning}`);
  }

  if (counts.value.info) {
    parts.push(`info: ${counts.value.info}`);
  }

  return parts.join(' | ') || 'diagnostics';
});

function locationText(item) {
  return formatDiagnosticLocation(item);
}
</script>
