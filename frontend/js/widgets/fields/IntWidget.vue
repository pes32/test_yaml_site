<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ error: !!fieldError }"
    :has-supporting="!!(widgetConfig.sup_text || fieldError)"
  >
    <input
      v-model="value"
      type="text"
      class="form-control"
      data-table-editor-target="true"
      v-bind="tableCellRootAttrs"
      :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
      :disabled="widgetConfig.readonly"
      :tabindex="widgetConfig.readonly ? -1 : null"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.enter="onEnterCommit"
    >
    <template #supporting>
      <span v-if="fieldError" class="md3-error" v-text="fieldError"></span>
      <span v-else v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>

<script setup lang="ts">
import Md3Field from '../common/Md3Field.vue';
import useSimpleFieldWidget, {
  type SimpleFieldEmit,
  type SimpleFieldWidgetProps
} from '../composables/useSimpleFieldWidget.ts';

defineOptions({
  name: 'IntWidget'
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
  onEnterCommit,
  onFocus,
  onInput,
  setValue,
  showPlaceholder,
  tableCellRootAttrs,
  value
} = useSimpleFieldWidget(props, emit, { kind: 'int' });

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
