<template>
  <span v-if="icon" class="page-item-icon inline-flex-center">
    <img v-if="!isFontIcon(icon)" :src="getIconSrc(icon)" alt="" @error="onIconError">
    <i v-else :class="icon"></i>
  </span>
</template>

<script setup lang="ts">
import { getIconSrc, isFontIcon, onIconError } from '../../shared/icon_helpers.ts';

defineOptions({
  name: 'ItemIcon'
});

withDefaults(defineProps<{
  icon?: string;
}>(), {
  icon: ''
});
</script>
