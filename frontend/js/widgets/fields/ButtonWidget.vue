<template>
  <div class="widget-container u-wide">
    <button
      class="widget-button inline-flex-center"
      :class="buttonClasses"
      :style="buttonStyle"
      :title="buttonTitle"
      @click="onButtonClick"
    >
      <img
        v-if="widgetConfig.icon && !isFontIcon(widgetConfig.icon)"
        :src="getIconSrc(widgetConfig.icon)"
        :style="iconStyle"
        alt=""
        class="button-icon"
        @error="onIconError"
      >
      <i v-else-if="widgetConfig.icon && isFontIcon(widgetConfig.icon)" :class="widgetConfig.icon"></i>
      <span v-if="widgetConfig.label" v-text="widgetConfig.label"></span>
    </button>

    <div v-if="widgetConfig.sup_text" class="widget-info">
      <span v-text="widgetConfig.sup_text"></span>
    </div>
  </div>
</template>

<script>
import { getIconSrc, isFontIcon, onIconError } from '../../gui_parser.js';
import { executeAction, parseButtonAction } from '../../runtime/action_runtime.js';

export default {
  name: 'ButtonWidget',
  inject: {
    getConfirmModal: { from: 'getConfirmModal', default: () => null },
    openUiModal: { from: 'openUiModal', default: null },
    closeUiModal: { from: 'closeUiModal', default: null }
  },
  props: {
    widgetConfig: {
      type: Object,
      required: true
    },
    widgetName: {
      type: String,
      required: true
    }
  },
  emits: ['execute'],
  data() {
    return {
      value: ''
    };
  },
  computed: {
    buttonAction() {
      return parseButtonAction(this.widgetConfig);
    },
    isIconOnly() {
      return Boolean(this.widgetConfig.icon && !this.widgetConfig.label);
    },
    hasBackground() {
      return Boolean(this.widgetConfig.fon);
    },
    buttonClasses() {
      return {
        'icon-only': this.isIconOnly,
        'icon-only--ghost': this.isIconOnly && !this.hasBackground
      };
    },
    buttonTitle() {
      if (this.isIconOnly && this.widgetConfig.hint) return this.widgetConfig.hint;
      if (this.widgetConfig.label) return this.widgetConfig.label;
      return 'Кнопка';
    },
    iconStyle() {
      if (!this.widgetConfig.icon || isFontIcon(this.widgetConfig.icon)) {
        return {};
      }
      const size = Number(this.widgetConfig.size) || 24;
      return {
        width: `${size}px`,
        height: `${size}px`
      };
    },
    buttonStyle() {
      const width = this.widgetConfig.width || this.widgetConfig.size;
      if (this.isIconOnly) {
        const iconRef = 24;
        const outerRef = 40;
        const borderTotal = 2;
        const padRef = (outerRef - borderTotal - iconRef) / 2;
        const iconSize = Number(this.widgetConfig.size) || iconRef;
        const widthRaw = this.widgetConfig.width;
        const hasExplicitWidth = widthRaw != null && widthRaw !== '';
        let widthValue;
        let pad;
        if (hasExplicitWidth) {
          const nextWidth = Number(widthRaw);
          widthValue = Number.isFinite(nextWidth) && nextWidth > 0 ? nextWidth : outerRef;
          pad = Math.max(0, Math.floor((widthValue - borderTotal - iconSize) / 2));
        } else {
          pad = Math.max(0, Math.round((padRef * iconSize) / iconRef));
          widthValue = iconSize + borderTotal + 2 * pad;
        }
        return {
          width: `${widthValue}px`,
          minWidth: `${widthValue}px`,
          height: `${widthValue}px`,
          minHeight: `${widthValue}px`,
          padding: `${pad}px`
        };
      }
      if (width != null && width !== '') {
        const widthValue = typeof width === 'number' ? `${width}px` : String(width);
        return {
          width: widthValue,
          justifyContent: 'flex-start',
          textAlign: 'left'
        };
      }
      return {};
    }
  },
  methods: {
    isFontIcon,
    getIconSrc,
    onIconError,
    onButtonClick() {
      if (!this.buttonAction) {
        return;
      }
      void executeAction(this, this.buttonAction, {
        dialog: this.widgetConfig.dialog || null,
        outputAttrs: this.widgetConfig.output_attrs,
        widgetName: this.widgetName
      });
    },
    setValue(value) {
      this.value = value;
    },
    getValue() {
      return this.value;
    }
  },
  mounted() {
    if (this.widgetConfig.default !== undefined) {
      this.value = this.widgetConfig.default;
    }
  }
};
</script>
