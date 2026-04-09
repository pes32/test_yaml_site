<template>
  <md3-field
    :widget-config="widgetConfig"
    :has-value="hasValue"
    :label-floats="labelFloats"
    :is-focused="isFocused"
    :wrap-extra="{ 'md3-dropdown-wrap': true, error: !!combinedFieldError }"
    :has-supporting="!!(widgetConfig.sup_text || combinedFieldError)"
    @focusout="onWidgetFocusOut"
    @container-focusout="onWidgetFocusOut"
  >
    <div
      ref="dropdownRoot"
      class="dropdown widget-dropdown list-combobox w-100 min-w-0 max-w-none"
      :class="{ show: shouldShowInlineDropdown }"
      :data-dropdown-open="shouldShowInlineDropdown ? 'true' : undefined"
      v-bind="tableCellRootAttrs"
    >
      <div ref="dropdownToggle" class="list-combobox-inner">
        <input
          type="text"
          class="list-combobox-input"
          data-table-editor-target="true"
          role="combobox"
          :aria-controls="listMenuId"
          :aria-expanded="shouldShowInlineDropdown ? 'true' : 'false'"
          :aria-activedescendant="highlightedId || undefined"
          :value="inputDisplayValue"
          :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
          :disabled="widgetConfig.readonly"
          :tabindex="widgetConfig.readonly ? -1 : null"
          :title="inputDisplayValue"
          @input="onInputChange"
          @focus="onInputFocus"
          @blur="onInputBlur"
          @keydown="onInputKeydown"
        >
        <span class="list-combobox-arrow-wrap">
          <span
            class="list-combobox-arrow"
            data-table-action-trigger="list"
            role="button"
            tabindex="-1"
            aria-label="Открыть справочник"
            @click.prevent="onArrowClick"
            @mousedown.prevent
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"></path>
            </svg>
          </span>
        </span>
      </div>
      <Teleport to="body">
        <ul
          v-if="shouldShowInlineDropdown"
          ref="dropdownMenu"
          class="dropdown-menu widget-dd-menu widget-dd-menu--teleport"
          :id="listMenuId"
          :class="{ show: shouldShowInlineDropdown, scrollable: inlineRows.length > 10 }"
          :style="menuPosition"
          role="listbox"
          tabindex="-1"
          @keydown="onMenuKeydown"
        >
          <li
            v-for="(row, idx) in inlineRows"
            :id="listItemId(idx)"
            :key="row.id"
            role="option"
          >
            <a
              class="dropdown-item"
              href="#"
              :tabindex="-1"
              :class="{ active: highlightedIndex === idx }"
              :title="formatRowLabel(row)"
              @click.prevent="selectInlineRow(row)"
              @mousedown.prevent="highlightedIndex = idx"
            >
              <span v-text="formatRowLabel(row)"></span>
            </a>
          </li>
        </ul>
      </Teleport>
    </div>
    <Teleport to="body">
      <div
        v-if="isModalOpen"
        class="modal-overlay flex-center"
        @click.self="closeModalFromCancel"
      >
        <div
          ref="modalRoot"
          class="modal-content gui-modal"
          :style="modalInlineStyle"
          @click.stop
          @keydown.stop="onModalKeydown"
        >
          <div class="modal-header">
            <h5 class="modal-title page-section-title" v-text="modalTitle"></h5>
            <button type="button" class="ui-close-button" aria-label="Закрыть" @click="closeModalFromCancel"></button>
          </div>
          <div class="modal-body">
            <div class="gui-modal-body-inner" :style="modalBodyInnerStyle">
              <div>
                <input
                  ref="modalSearchInput"
                  type="text"
                  class="form-control voc-modal-search-input"
                  :value="modalSearch"
                  :style="modalSearchInputStyle"
                  placeholder="Поиск"
                  @input="onModalSearchInput"
                  @keydown.stop="onModalKeydown"
                >
              </div>
              <div class="gui-modal-tab-single" :style="modalTableWrapStyle">
                <table class="table widget-table widget-table--sticky-header widget-table--sortable">
                  <thead>
                    <tr>
                      <th v-if="isMultiselect" :style="checkboxCellStyle"></th>
                      <th
                        v-for="(columnLabel, columnIndex) in columns"
                        :key="'voc-th-' + columnIndex"
                      >
                        <div
                          class="widget-table__th-inner"
                          role="button"
                          tabindex="0"
                          :aria-label="'Сортировать по колонке ' + columnLabel"
                          @click="toggleModalSort(columnIndex)"
                          @keydown.enter.prevent="toggleModalSort(columnIndex)"
                          @keydown.space.prevent="toggleModalSort(columnIndex)"
                        >
                          <span class="widget-table__th-text" v-text="columnLabel"></span>
                          <div class="widget-table__sort-icons" :class="modalSortControlClass(columnIndex)" aria-hidden="true">
                            <svg class="widget-table__sort-svg widget-table__sort-svg--up" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.5845 17.7447L22.3941 8.93511C23.202 8.12722 23.202 6.80556 22.3941 5.99859L21.6588 5.26239C20.8528 4.45543 19.5302 4.45543 18.7232 5.26239L12 11.9856L5.27679 5.2624C4.46983 4.45543 3.14724 4.45543 2.34119 5.2624L1.60591 5.9986C0.798027 6.80556 0.798027 8.12723 1.60592 8.93511L10.4173 17.7447C10.8502 18.1785 11.4311 18.3715 12.0009 18.3393C12.568 18.3715 13.1498 18.1785 13.5845 17.7447Z"></path></svg>
                            <svg class="widget-table__sort-svg widget-table__sort-svg--down" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.5845 17.7447L22.3941 8.93511C23.202 8.12722 23.202 6.80556 22.3941 5.99859L21.6588 5.26239C20.8528 4.45543 19.5302 4.45543 18.7232 5.26239L12 11.9856L5.27679 5.2624C4.46983 4.45543 3.14724 4.45543 2.34119 5.2624L1.60591 5.9986C0.798027 6.80556 0.798027 8.12723 1.60592 8.93511L10.4173 17.7447C10.8502 18.1785 11.4311 18.3715 12.0009 18.3393C12.568 18.3715 13.1498 18.1785 13.5845 17.7447Z"></path></svg>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody v-if="modalRows.length">
                    <tr
                      v-for="row in modalRows"
                      :key="row.id"
                      :data-modal-active="isModalRowActive(row) ? 'true' : null"
                      :style="modalRowStyle(row)"
                      @click="onModalRowClick(row)"
                      @dblclick="onModalRowDoubleClick(row)"
                    >
                      <td v-if="isMultiselect" :style="modalCellStyle(row, checkboxCellStyle)">
                        <input
                          type="checkbox"
                          tabindex="-1"
                          :checked="isModalRowSelected(row)"
                          @click.stop="toggleModalRow(row)"
                        >
                      </td>
                      <td
                        v-for="(cellValue, cellIndex) in row.cells"
                        :key="row.id + '-c-' + cellIndex"
                        :style="modalCellStyle(row)"
                      >
                        <span class="widget-table__cell-value" v-text="cellValue"></span>
                      </td>
                    </tr>
                  </tbody>
                  <tbody v-else>
                    <tr>
                      <td :colspan="columns.length + (isMultiselect ? 1 : 0)">
                        <span class="widget-table__cell-value">Нет данных</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="widget-button confirm-modal-action confirm-modal-action--secondary"
              @click="closeModalFromCancel"
            >
              Отмена
            </button>
            <button
              type="button"
              class="widget-button confirm-modal-action"
              @click="applyModalSelection"
            >
              Выбрать
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <template #supporting>
      <span v-if="combinedFieldError" class="md3-error" v-text="combinedFieldError"></span>
      <span v-else v-text="widgetConfig.sup_text"></span>
    </template>
  </md3-field>
</template>

<script>
import Md3Field from '../common/Md3Field.vue';
import useWidgetField from '../composables/useWidgetField.ts';
import {
  vocModalComputed,
  vocModalMethods,
  vocModalWatch
} from './voc_modal_shared.js';
import {
  beforeUnmountVocWidget,
  createVocWidgetState,
  vocComputed,
  vocMethods,
  vocWatch
} from './voc_shared.js';

export default {
  name: 'VocWidget',
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
    return createVocWidgetState();
  },
  computed: {
    ...vocComputed,
    ...vocModalComputed
  },
  methods: {
    ...vocMethods,
    ...vocModalMethods
  },
  watch: {
    ...vocWatch,
    ...vocModalWatch
  },
  beforeUnmount() {
    beforeUnmountVocWidget.call(this);
  }
};
</script>
