<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ error: !!fieldError }"
    :has-supporting="!!(widgetConfig.sup_text || fieldError)"
    wrap-variant="textarea"
    container-modifier="textarea"
  >
    <div class="md3-textarea-wrap w-100 min-w-0">
      <textarea
        v-model="value"
        class="form-control"
        :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
        :disabled="widgetConfig.readonly"
        :tabindex="widgetConfig.readonly ? -1 : null"
        :rows="textareaRows"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.ctrl.enter.prevent="onCommitShortcut"
        @keydown.meta.enter.prevent="onCommitShortcut"
      >
      </textarea>
    </div>
    <template #supporting>
      <span v-if="fieldError" class="md3-error" v-text="fieldError"></span>
      <span v-else v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Md3Field from '../common/Md3Field.vue';
import useSimpleFieldWidget, {
  type SimpleFieldEmit,
  type SimpleFieldWidgetProps
} from '../composables/useSimpleFieldWidget.ts';

defineOptions({
  name: 'TextWidget'
});

const props = defineProps<SimpleFieldWidgetProps>();
const emit = defineEmits<SimpleFieldEmit>();

const {
  commitDraft,
  commitPendingState,
  fieldError,
  getValue,
  hasValue,
  isDraftEditing,
  isFocused,
  labelFloats,
  onBlur,
  onCommitShortcut,
  onFocus,
  onInput,
  setValue,
  showPlaceholder,
  value
} = useSimpleFieldWidget(props, emit, { kind: 'text' });

const textareaRows = computed(() => {
  const rows = Number(props.widgetConfig.rows);
  return Number.isInteger(rows) && rows > 0 ? rows : 3;
});

defineExpose({
  commitDraft,
  commitPendingState,
  fieldError,
  getValue,
  isDraftEditing,
  setValue,
  value
});
</script>
