<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ error: !!displayError }"
    :has-supporting="!!(widgetConfig.sup_text || displayError)"
  >
    <input
      ref="inputRef"
      v-model="inputValue"
      type="text"
      class="form-control widget-ip"
      data-table-editor-target="true"
      v-bind="tableCellRootAttrs"
      :disabled="widgetConfig.readonly"
      :tabindex="widgetConfig.readonly ? -1 : null"
      :maxlength="maxLength"
      :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
      @input="onInputHandler"
      @keydown="onKeyDown"
      @blur="handleBlur"
      @focus="onFocus"
    >
    <template #supporting>
      <span v-if="displayError" class="md3-error" v-text="displayError"></span>
      <span v-else v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>

<script setup lang="ts">
import Md3Field from '../common/Md3Field.vue';
import {
  useIpLikeField,
  type IpLikeWidgetEmit,
  type IpLikeWidgetProps
} from './useIpLikeField.ts';

defineOptions({
  name: 'IpLikeWidget'
});

const props = defineProps<IpLikeWidgetProps>();
const emit = defineEmits<IpLikeWidgetEmit>();

const {
  commitDraft,
  commitPendingState,
  displayError,
  error,
  getValue,
  hasValue,
  inputRef,
  inputValue,
  isFocused,
  labelFloats,
  maxLength,
  onFocus,
  onInputHandler,
  onKeyDown,
  handleBlur,
  setValue,
  showPlaceholder,
  tableCellRootAttrs
} = useIpLikeField(props, emit);

defineExpose({
  commitDraft,
  commitPendingState,
  displayError,
  error,
  getValue,
  setValue,
  value: inputValue
});
</script>
