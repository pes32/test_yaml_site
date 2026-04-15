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
          <div
            v-for="(item, itemIndex) in row.widgets"
            :key="itemIndex"
            class="col-auto"
            :data-widget-name="item"
            :data-widget-type="getWidgetType(item)"
          >
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

<script setup lang="ts">
import WidgetRenderer from './WidgetRenderer.vue';

defineOptions({
  name: 'ContentRows'
});

type WidgetRow = string | { widgets?: string[] };

const props = withDefaults(defineProps<{
  getWidgetAttrs: (widgetName: string) => Record<string, unknown>;
  getWidgetValue: (widgetName: string) => unknown;
  rows: WidgetRow[];
  textClass?: string;
}>(), {
  textClass: 'page-section-text'
});

const emit = defineEmits<{
  (event: 'execute', payload: unknown): void;
  (event: 'input', payload: unknown): void;
}>();

function isWidgetRow(row: WidgetRow | undefined): row is { widgets: string[] } {
  return Boolean(row && typeof row === 'object' && row.widgets && Array.isArray(row.widgets));
}

function nextRowHasWidgets(rowIndex: number): boolean {
  return isWidgetRow(props.rows[rowIndex + 1]);
}

function getWidgetType(widgetName: string): string {
  const attrs = props.getWidgetAttrs(widgetName) || {};
  const widgetType = typeof attrs.widget === 'string' ? attrs.widget.trim() : '';
  return widgetType || 'str';
}
</script>
