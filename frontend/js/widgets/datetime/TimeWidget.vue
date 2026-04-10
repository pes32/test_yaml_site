<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ 'widget-dt': true, error: !!tableCellCommitError }"
    :wrap-data="{ 'data-type': 'time' }"
    :has-supporting="!!widgetConfig.sup_text"
  >
    <div
      ref="pickerHost"
      class="widget-dt-host"
      v-bind="tableCellRootAttrs"
    >
      <div class="widget-dt-inner">
        <div ref="timeAnchor" class="widget-dt-segment widget-dt-segment--single">
          <input
            v-model="value"
            type="text"
            class="form-control widget-dt-input widget-dt-input--time"
            data-table-editor-target="true"
            :disabled="widgetConfig.readonly"
            :tabindex="widgetConfig.readonly ? -1 : null"
            @input="onInput"
            @focus="onFocus"
            @blur="onBlur"
            @keydown.enter="onEnterCommit"
          >
          <span class="widget-dt-icon-wrap">
            <span
              class="widget-dt-icon"
              data-table-action-trigger="time"
              role="button"
              tabindex="-1"
              aria-label="Выбрать время"
              @click="openPicker"
              @mousedown.prevent
            >
              <img :src="clockIconSrc" alt="">
            </span>
          </span>
        </div>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="isTimeOpen"
        ref="timePopover"
        class="widget-dt-popover widget-dt-popover--time"
        :style="timePopoverStyle"
      >
        <div class="widget-dt-panel-head">
          <div class="widget-dt-panel-label">Время</div>
        </div>
        <div class="widget-dt-time-preview" v-text="timePreview"></div>
        <div class="widget-dt-time-editors">
          <div class="widget-dt-time-editor">
            <span class="widget-dt-time-caption">Часы</span>
            <input
              type="text"
              inputmode="numeric"
              class="widget-dt-time-editor-input"
              :value="pickerHour"
              @input="onPickerPartInput('pickerHour', 23, $event)"
              @blur="commitPickerPart('pickerHour', 23)"
              @keydown.enter.prevent="commitPickerPart('pickerHour', 23)"
            >
          </div>
          <div class="widget-dt-time-separator">:</div>
          <div class="widget-dt-time-editor">
            <span class="widget-dt-time-caption">Минуты</span>
            <input
              type="text"
              inputmode="numeric"
              class="widget-dt-time-editor-input"
              :value="pickerMinute"
              @input="onPickerPartInput('pickerMinute', 59, $event)"
              @blur="commitPickerPart('pickerMinute', 59)"
              @keydown.enter.prevent="commitPickerPart('pickerMinute', 59)"
            >
          </div>
          <div class="widget-dt-time-separator">:</div>
          <div class="widget-dt-time-editor">
            <span class="widget-dt-time-caption">Секунды</span>
            <input
              type="text"
              inputmode="numeric"
              class="widget-dt-time-editor-input"
              :value="pickerSecond"
              @input="onPickerPartInput('pickerSecond', 59, $event)"
              @blur="commitPickerPart('pickerSecond', 59, true)"
              @keydown.enter.prevent="commitPickerPart('pickerSecond', 59, true)"
            >
          </div>
        </div>
      </div>
    </Teleport>
    <template #supporting>
      <span v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>

<script>
import Md3Field from '../common/Md3Field.vue';
import useWidgetField from '../composables/useWidgetField.ts';
import {
  addFloatingListener,
  addOutsideListener,
  applyTimePickerState,
  composePickerTimeValue,
  getNow,
  hasValue,
  labelFloats,
  normalizeTimeInputValue,
  normalizeTimePart,
  removeFloatingListener,
  removeOutsideListener,
  setHiddenPopover,
  syncTimePickerState,
  updateFloatingPopover
} from './datetime_shared.ts';

const CLOCK_ICON_SRC = '/templates/icons/clock.svg';

export default {
  name: 'TimeWidget',
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
    return {
      value: '',
      isFocused: false,
      isTimeOpen: false,
      pickerHour: '00',
      pickerMinute: '00',
      pickerSecond: '00',
      pickerHasSeconds: false,
      timePopoverStyle: { visibility: 'hidden' },
      clockIconSrc: CLOCK_ICON_SRC,
      _outsideClick: null,
      _floatingUpdate: null
    };
  },
  computed: {
    hasValue,
    labelFloats,
    timePreview() {
      return `${this.pickerHour}:${this.pickerMinute}:${this.pickerSecond}`;
    }
  },
  methods: {
    addFloatingListener,
    addOutsideListener,
    applyTimePickerState,
    composePickerTimeValue,
    getNow,
    normalizeTimeInputValue,
    normalizeTimePart,
    removeFloatingListener,
    removeOutsideListener,
    setHiddenPopover,
    syncTimePickerState,
    updateFloatingPopover,
    closePopovers() {
      this.isTimeOpen = false;
      this.removeOutsideListener('_outsideClick');
      this.removeFloatingListener('_floatingUpdate');
    },
    syncTimePopoverPosition() {
      if (!this.isTimeOpen) {
        return;
      }
      this.updateFloatingPopover('timeAnchor', 'timePopover', 'timePopoverStyle', { align: 'end' });
    },
    applyPickedTime(shouldClose = false) {
      this.value = this.composePickerTimeValue();
      this.emitInput(this.value);
      if (shouldClose) {
        this.closePopovers();
      }
    },
    onPickerPartInput(part, max, event) {
      const digits = String(event.target.value || '').replace(/\D+/g, '').slice(0, 2);
      this[part] = digits;
      if (part === 'pickerSecond' && digits.length) {
        this.pickerHasSeconds = true;
      }
    },
    commitPickerPart(part, max, shouldClose = false) {
      const normalized = this.normalizeTimePart(this[part], max) || '00';
      this[part] = normalized;
      if (part === 'pickerSecond') {
        this.pickerHasSeconds = true;
      }
      this.applyPickedTime(shouldClose);
    },
    onFocus() {
      this.isFocused = true;
      this.activateDraftController();
    },
    onInput() {
      if (this.tableCellMode) {
        this.emitInput(this.value);
        return;
      }

      this.activateDraftController();
    },
    onBlur() {
      this.isFocused = false;
      try {
        this.commitDraft();
      } finally {
        this.deactivateDraftController();
      }
    },
    onEnterCommit(event) {
      if (this.tableCellMode) {
        return;
      }

      event.preventDefault();
      try {
        this.commitDraft();
      } finally {
        event.target?.blur?.();
      }
    },
    commitInput() {
      if (!this.value) {
        this.handleTableCellCommitValidation('');
        this.emitInput(this.value);
        return;
      }

      const { value, parsedTime } = this.normalizeTimeInputValue(this.value);
      this.value = value;
      this.applyTimePickerState(parsedTime);
      this.handleTableCellCommitValidation(parsedTime ? '' : 'Неверный формат времени');
      this.emitInput(this.value);
    },
    commitDraft() {
      this.commitInput();
    },
    openPicker() {
      if (this.widgetConfig.readonly) {
        return;
      }
      this.syncTimePickerState(this.value);
      this.isTimeOpen = true;
      this.setHiddenPopover('timePopoverStyle');
      this.addOutsideListener('_outsideClick', ['pickerHost', 'timePopover']);
      this.$nextTick(() => {
        this.syncTimePopoverPosition();
        this.addFloatingListener('_floatingUpdate', () => this.syncTimePopoverPosition());
      });
    },
    setValue(v) {
      if (!v) {
        this.value = '';
        return;
      }

      const { value, parsedTime } = this.normalizeTimeInputValue(v);
      this.value = value;
      this.applyTimePickerState(parsedTime);
    },
    getValue() {
      return this.value;
    }
  },
  watch: {
    'widgetConfig.value': {
      immediate: true,
      handler(value) {
        if (value === undefined) {
          return;
        }
        this.syncCommittedValue(value, (nextValue) => this.setValue(nextValue));
      }
    }
  },
  beforeUnmount() {
    this.removeOutsideListener('_outsideClick');
    this.removeFloatingListener('_floatingUpdate');
  }
};
</script>
