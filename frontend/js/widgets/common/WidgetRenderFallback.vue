<template>
  <div
    class="widget-container widget-render-fallback u-wide"
    role="alert"
    :data-widget-fallback="widgetName"
    :data-widget-type="widgetType"
  >
    <div class="widget-render-fallback__title">
      Ошибка виджета
    </div>
    <dl class="widget-render-fallback__meta">
      <dt class="widget-render-fallback__dt">
        Атрибут
      </dt>
      <dd class="widget-render-fallback__dd">
        <code class="widget-render-fallback__code" v-text="widgetName"></code>
      </dd>
      <dt class="widget-render-fallback__dt">
        Тип
      </dt>
      <dd class="widget-render-fallback__dd">
        <code class="widget-render-fallback__code" v-text="widgetType"></code>
      </dd>
    </dl>
    <p class="widget-render-fallback__message" v-text="message"></p>
    <p v-if="detail" class="widget-render-fallback__detail" v-text="detail"></p>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'WidgetRenderFallback'
});

defineProps<{
  detail?: string;
  message: string;
  widgetName: string;
  widgetType: string;
}>();
</script>
