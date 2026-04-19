<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ error: !!fieldError }"
    :has-supporting="!!(widgetConfig.sup_text || fieldError)"
    :wrap-variant="isTextArea ? 'textarea' : undefined"
    :container-modifier="isTextArea ? 'textarea' : undefined"
  >
    <div v-if="isTextArea" class="md3-textarea-wrap w-100 min-w-0">
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
    <input
      v-else
      v-model="value"
      type="text"
      class="form-control"
      data-table-editor-target="true"
      v-bind="tableCellRootAttrs"
      :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
      :disabled="widgetConfig.readonly"
      :tabindex="widgetConfig.readonly ? -1 : null"
      :title="simpleFieldKind === 'string' ? value : undefined"
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
import { computed } from 'vue';
import Md3Field from '../common/Md3Field.vue';
import useSimpleFieldWidget, {
  type SimpleFieldEmit,
  type SimpleFieldKind,
  type SimpleFieldWidgetProps
} from '../composables/useSimpleFieldWidget.ts';

defineOptions({
  name: 'SimpleFieldWidget'
});

const props = defineProps<SimpleFieldWidgetProps>();
const emit = defineEmits<SimpleFieldEmit>();

function resolveSimpleFieldKind(widgetType: unknown): SimpleFieldKind {
  const key = String(widgetType || '').trim();
  if (key === 'int' || key === 'float' || key === 'text') {
    return key;
  }
  return 'string';
}

const simpleFieldKind = resolveSimpleFieldKind(props.widgetConfig.widget);
const isTextArea = simpleFieldKind === 'text';
const textareaRows = computed(() => {
  const rows = Number(props.widgetConfig.rows);
  return Number.isInteger(rows) && rows > 0 ? rows : 3;
});

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
  onEnterCommit,
  onFocus,
  onInput,
  setValue,
  showPlaceholder,
  tableCellRootAttrs,
  value
} = useSimpleFieldWidget(props, emit, { kind: simpleFieldKind });

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
