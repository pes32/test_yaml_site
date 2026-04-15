<template>
  <img
    v-if="iconName && !isFontIcon(iconName)"
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
import { getIconSrc, isFontIcon, onIconError } from '../../shared/icon_helpers.ts';
import type { ActionButtonContentProps } from './types.ts';

defineOptions({
  name: 'ActionButtonContent'
});

defineProps<ActionButtonContentProps>();
</script>
