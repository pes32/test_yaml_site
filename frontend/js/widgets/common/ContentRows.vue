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
              :widget-attrs="safeGetWidgetAttrs(item)"
              :widget-value="getWidgetValue(item)"
              :widget-name="item"
              :mount-defer-slot="tableMountDeferSlot(rowIndex, itemIndex, item)"
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
import { FRONTEND_ERROR_SCOPES } from '../../runtime/error_model.ts';
import { remoteLogClientDiagnostic } from '../../runtime/client_diagnostic_remote_log.ts';

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

function safeGetWidgetAttrs(widgetName: string): Record<string, unknown> {
  try {
    const attrs = props.getWidgetAttrs(widgetName);
    return attrs && typeof attrs === 'object' ? attrs : {};
  } catch (err) {
    console.error(`[ContentRows] Ошибка атрибутов виджета "${widgetName}"`, err);
    remoteLogClientDiagnostic(err instanceof Error ? err : new Error(String(err)), {
      scope: FRONTEND_ERROR_SCOPES.widget,
      context: 'widget_attrs_resolution',
      widgetName,
      widgetType: 'unknown',
      source: 'ContentRows.safeGetWidgetAttrs'
    });
    return {
      widget: 'str',
      value: '',
      label: widgetName,
      readonly: true,
      err_text: 'Ошибка конфигурации виджета'
    };
  }
}

function tableMountDeferSlot(rowIndex: number, itemIndex: number, widgetName: string): number {
  if (getWidgetType(widgetName) !== 'table') {
    return 0;
  }
  return rowIndex * 3 + itemIndex;
}

function getWidgetType(widgetName: string): string {
  const attrs = safeGetWidgetAttrs(widgetName) || {};
  const widgetType = typeof attrs.widget === 'string' ? attrs.widget.trim() : '';
  return widgetType || 'str';
}
</script>
