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

<script>
export default {
  name: 'ImgWidget',
  props: {
    widgetConfig: { type: Object, required: true },
    widgetName: { type: String, required: true }
  },
  data() {
    return { loadError: false };
  },
  computed: {
    imageSrc() {
      if (this.loadError || !this.widgetConfig.source) return null;
      const src = String(this.widgetConfig.source).trim();
      if (/^https?:\/\//i.test(src)) return src;
      if (src.startsWith('/')) return src;
      return '/' + src;
    },
    imgStyle() {
      const width = this.widgetConfig.width;
      if (width == null || width === '') return {};
      const widthValue = typeof width === 'number' ? `${width}px` : String(width);
      return { width: widthValue, maxWidth: '100%', height: 'auto' };
    }
  },
  methods: {
    onImageError() {
      this.loadError = true;
    },
    setValue() {},
    getValue() {
      return null;
    }
  }
};
</script>
