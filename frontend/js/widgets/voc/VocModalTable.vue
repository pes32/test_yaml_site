<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay flex-center"
      @click.self="emit('cancel')"
    >
      <div
        ref="modalRoot"
        class="modal-content gui-modal voc-modal-content"
        @click.stop
        @keydown.stop="emit('keydown', $event)"
      >
        <div class="modal-header">
          <h5 class="modal-title page-section-title" v-text="title"></h5>
          <button type="button" class="ui-close-button" aria-label="Закрыть" @click="emit('cancel')"></button>
        </div>
        <div class="modal-body">
          <div class="gui-modal-body-inner voc-modal-body-inner">
            <div>
              <input
                ref="modalSearchInput"
                type="text"
                class="form-control voc-modal-search-input"
                :value="modalSearch"
                placeholder="Поиск"
                @input="emitSearchInput"
                @keydown.stop="emit('keydown', $event)"
              >
            </div>
            <div class="gui-modal-tab-single voc-modal-table-wrap">
              <table class="table widget-table widget-table--sticky-header widget-table--sortable">
                <thead>
                  <tr>
                    <th v-if="isMultiselect" class="voc-modal-checkbox-cell"></th>
                    <th
                      v-for="(columnLabel, columnIndex) in columns"
                      :key="'voc-th-' + columnIndex"
                    >
                      <div
                        class="widget-table__th-inner"
                        role="button"
                        tabindex="0"
                        :aria-label="'Сортировать по колонке ' + columnLabel"
                        @click="emit('sort', columnIndex)"
                        @keydown.enter.prevent="emit('sort', columnIndex)"
                        @keydown.space.prevent="emit('sort', columnIndex)"
                      >
                        <span class="widget-table__th-text" v-text="columnLabel"></span>
                        <table-sort-icons :state-class="sortControlClass(columnIndex)"></table-sort-icons>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody v-if="rows.length">
                  <tr
                    v-for="row in rows"
                    :key="row.id"
                    class="voc-modal-row"
                    :data-modal-active="isRowActive(row) ? 'true' : null"
                    @click="emit('row-click', row)"
                    @dblclick="emit('row-double-click', row)"
                  >
                    <td
                      v-if="isMultiselect"
                      :class="['voc-modal-checkbox-cell', cellClass(row)]"
                    >
                      <input
                        type="checkbox"
                        tabindex="-1"
                        :checked="isRowSelected(row)"
                        @click.stop="emit('row-toggle', row)"
                      >
                    </td>
                    <td
                      v-for="(cellValue, cellIndex) in row.cells"
                      :key="row.id + '-c-' + cellIndex"
                      :class="cellClass(row)"
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
            @click="emit('cancel')"
          >
            Отмена
          </button>
          <button
            type="button"
            class="widget-button confirm-modal-action"
            @click="emit('apply')"
          >
            Выбрать
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TableSortIcons from '../common/SortIcons.vue';
import type { VocRow } from '../../runtime/voc_contract.ts';

type RowClassResolver = (row: VocRow | null | undefined) => Record<string, boolean>;
type RowPredicate = (row: VocRow | null | undefined) => boolean;
type SortClassResolver = (columnIndex: number) => Record<string, boolean>;

type VocModalTableProps = {
  cellClass: RowClassResolver;
  columns: string[];
  isMultiselect: boolean;
  isOpen: boolean;
  isRowActive: RowPredicate;
  isRowSelected: RowPredicate;
  modalSearch: string;
  rows: VocRow[];
  sortControlClass: SortClassResolver;
  title: string;
};

type VocModalTableEmit = {
  (event: 'apply'): void;
  (event: 'cancel'): void;
  (event: 'keydown', keyboardEvent: KeyboardEvent): void;
  (event: 'row-click', row: VocRow): void;
  (event: 'row-double-click', row: VocRow): void;
  (event: 'row-toggle', row: VocRow): void;
  (event: 'search-input', value: string): void;
  (event: 'sort', columnIndex: number): void;
};

defineOptions({
  name: 'VocModalTable'
});

defineProps<VocModalTableProps>();
const emit = defineEmits<VocModalTableEmit>();

const modalRoot = ref<HTMLElement | null>(null);
const modalSearchInput = ref<HTMLInputElement | null>(null);

function emitSearchInput(event: Event): void {
  const target = event.target instanceof HTMLInputElement ? event.target : null;
  emit('search-input', target?.value == null ? '' : String(target.value));
}

defineExpose({
  modalRoot,
  modalSearchInput
});
</script>
