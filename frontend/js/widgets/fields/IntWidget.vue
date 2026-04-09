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
      @input="onIntInput"
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

<script>
import Md3Field from '../common/Md3Field.vue';
import useWidgetField from '../composables/useWidgetField.ts';

export default {
  name: 'IntWidget',
  components: { Md3Field },
  props: {
    widgetConfig: { type: Object, required: true },
    widgetName: { type: String, required: true }
  },
  emits: ['input'],
  setup(props, { emit }) {
    return useWidgetField(props, emit);
  },
  data() {
    return { value: '', regexError: '', intError: '', isFocused: false };
  },
  computed: {
    hasValue() { return Boolean(this.value); },
    labelFloats() { return this.hasValue || this.isFocused; },
    showPlaceholder() { return !this.hasValue && this.isFocused && this.widgetConfig.placeholder; }
  },
  methods: {
    onFocus() {
      this.isFocused = true;
      this.activateDraftController();
    },
    onIntInput() {
      const intValue = this.value.replace(/[^0-9-]/g, '');
      if (intValue === '-' || intValue === '') {
        this.value = intValue;
        this.intError = '';
      } else {
        const num = parseInt(intValue, 10);
        if (isNaN(num)) {
          this.intError = 'Введите целое число';
        } else {
          this.value = num.toString();
          this.intError = '';
        }
      }

      this.validateRegex();
      if (this.tableCellMode) {
        this.emitInput(this.value);
        return;
      }

      this.activateDraftController();
    },
    onBlur() {
      this.isFocused = false;
      this.commitDraft();
      this.deactivateDraftController();
    },
    onEnterCommit(event) {
      if (this.tableCellMode) {
        return;
      }

      event.preventDefault();
      this.commitDraft();
      event.target?.blur?.();
    },
    commitDraft() {
      this.validateRegex();
      this.handleTableCellCommitValidation(this.fieldError);
      this.emitInput(this.value);
    },
    setValue(value) {
      this.value = value == null ? '' : String(value);
      this.intError = '';
      this.validateRegex();
    },
    getValue() {
      return this.value;
    }
  },
  watch: {
    'widgetConfig.value': {
      immediate: true,
      handler(value) {
        if (value === undefined) return;
        this.syncCommittedValue(value, (nextValue) => this.setValue(nextValue));
      }
    }
  },
  mounted() {
    this.validateRegex();
  }
};
</script>
