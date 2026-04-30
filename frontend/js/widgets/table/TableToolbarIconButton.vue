<template>
  <button
    type="button"
    class="widget-table-toolbar__button"
    :class="{
      'widget-table-toolbar__button--active': active,
      'widget-table-toolbar__button--with-arrow': withArrow
    }"
    :disabled="disabled"
    :title="tooltip || button.label"
    :aria-label="button.label"
    :aria-expanded="expanded"
    @click="emit('press', button.id)"
  >
    <img :src="iconSrc" alt="" aria-hidden="true">
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import type { TableToolbarButton } from './table_toolbar_model.ts';

defineOptions({
  name: 'TableToolbarIconButton'
});

withDefaults(
  defineProps<{
    active?: boolean;
    button: TableToolbarButton;
    disabled?: boolean;
    expanded?: 'true' | 'false' | undefined;
    iconSrc: string;
    tooltip?: string;
    withArrow?: boolean;
  }>(),
  {
    active: false,
    disabled: false,
    expanded: undefined,
    tooltip: '',
    withArrow: false
  }
);

const emit = defineEmits<{
  press: [id: string];
}>();
</script>
