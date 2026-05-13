<template>
  <span
    v-if="iconName && !isFontIcon(iconName) && tintIconWithTextColor"
    class="button-icon button-icon--text-color"
    :style="iconMaskStyle"
    role="img"
    aria-hidden="true"
  ></span>
  <img
    v-else-if="iconName && !isFontIcon(iconName)"
    class="button-icon"
    :src="getIconSrc(iconName)"
    :style="iconStyle"
    alt=""
    @error="onIconError"
  >
  <i v-else-if="iconName && isFontIcon(iconName)" :class="iconName"></i>
  <span v-if="label" :class="labelClass">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getIconSrc, isFontIcon, onIconError } from '../../shared/icon_helpers.ts';
import type { ActionButtonContentProps } from './types.ts';

defineOptions({
  name: 'ActionButtonContent',
});

const props = withDefaults(defineProps<ActionButtonContentProps>(), {
  tintIconWithTextColor: false,
});

const iconMaskStyle = computed(() => {
  const url = getIconSrc(props.iconName);
  return {
    ...props.iconStyle,
    maskImage: `url("${url}")`,
    WebkitMaskImage: `url("${url}")`,
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
  };
});
</script>
