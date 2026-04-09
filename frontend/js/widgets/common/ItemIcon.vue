<template>
  <span v-if="icon" class="page-item-icon inline-flex-center">
    <img v-if="!isFontIcon(icon)" :src="getIconSrc(icon)" alt="" @error="onIconError">
    <i v-else :class="icon"></i>
  </span>
</template>

<script setup>
import { getIconSrc, isFontIcon, onIconError } from '../../gui_parser.js';

defineOptions({
  name: 'ItemIcon'
});

defineProps({
  icon: {
    type: String,
    default: ''
  }
});
</script>
