<template>
  <template v-for="(row, rowIndex) in rows" :key="rowIndex">
    <div
      class="row row--section"
      :class="{ 'row--text': typeof row === 'string', 'row--before-widgets': nextRowHasWidgets(rowIndex) }"
    >
      <div v-if="typeof row === 'string'" class="col-12">
        <span :class="textClass" v-text="row"></span>
      </div>
      <div v-else-if="isWidgetRow(row)" class="col-12">
        <div class="row">
          <div v-for="(item, itemIndex) in row.widgets" :key="itemIndex" class="col-auto">
            <WidgetRenderer
              :widget-attrs="getWidgetAttrs(item)"
              :widget-value="getWidgetValue(item)"
              :widget-name="item"
              @input="emit('input', $event)"
              @execute="emit('execute', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import WidgetRenderer from './WidgetRenderer.vue';

defineOptions({
  name: 'ContentRows'
});

const props = defineProps({
  rows: {
    type: Array,
    required: true
  },
  getWidgetAttrs: {
    type: Function,
    required: true
  },
  getWidgetValue: {
    type: Function,
    required: true
  },
  textClass: {
    type: String,
    default: 'page-section-text'
  }
});

const emit = defineEmits(['execute', 'input']);

function isWidgetRow(row) {
  return row && typeof row === 'object' && row.widgets && Array.isArray(row.widgets);
}

function nextRowHasWidgets(rowIndex) {
  return isWidgetRow(props.rows[rowIndex + 1]);
}
</script>
