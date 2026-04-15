<template>
  <div class="widget-container widget-img u-wide">
    <div v-if="widgetConfig.label" class="widget-img-description">
      <span v-text="widgetConfig.label"></span>
    </div>
    <img
      v-if="imageSrc"
      :src="imageSrc"
      :alt="widgetConfig.label || ''"
      :style="imgStyle"
      class="widget-img-element"
      @error="onImageError"
    >
    <div v-if="widgetConfig.sup_text" class="widget-img-sup">
      <span v-text="widgetConfig.sup_text"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue';

type ImgWidgetConfig = Record<string, unknown> & {
  label?: string;
  source?: unknown;
  sup_text?: unknown;
  width?: number | string;
};

type ImgWidgetProps = {
  widgetConfig: ImgWidgetConfig;
  widgetName: string;
};

defineOptions({
  name: 'ImgWidget'
});

const props = defineProps<ImgWidgetProps>();
const loadError = ref(false);

const imageSrc = computed<string | null>(() => {
  if (loadError.value || !props.widgetConfig.source) return null;
  const src = String(props.widgetConfig.source).trim();
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/')) return src;
  return `/${src}`;
});

const imgStyle = computed<CSSProperties>(() => {
  const width = props.widgetConfig.width;
  if (width == null || width === '') return {};
  const widthValue = typeof width === 'number' ? `${width}px` : String(width);
  return { width: widthValue, maxWidth: '100%', height: 'auto' };
});

function onImageError(): void {
  loadError.value = true;
}

function setValue(): void {
  /* non-stateful image widget */
}

function getValue(): null {
  return null;
}

defineExpose({
  getValue,
  setValue
});
</script>
