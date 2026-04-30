<template>
  <div class="widget-container">
    <div v-if="widgetConfig.label" class="widget-label">
      <span v-text="widgetConfig.label"></span>
    </div>

    <div
      v-if="toolbarEnabled"
      ref="tableToolbarHost"
      class="widget-table-toolbar-host"
    >
      <table-toolbar
        :can-redo="canRedo"
        :can-undo="canUndo"
        :disabled="tableUiLocked"
        :toolbar-state="toolbarState"
        @action="onTableToolbarAction"
      ></table-toolbar>
    </div>

    <div
      class="widget-table-container"
      :class="{ 'widget-table-container--locked': tableUiLocked }"
      @focusin.capture="onTableContainerFocusIn"
      @focusout.capture="onTableContainerFocusOut"
    >
      <div class="widget-table-wrapper">
        <table
          ref="tableRoot"
          class="table widget-table"
          :class="{
            'widget-table--editable': isEditable,
            'widget-table--no-zebra': !tableZebra,
            'widget-table--explicit-width': hasExplicitTableWidth,
            'widget-table--sortable': headerSortEnabled,
            'widget-table--grouping': groupingActive,
            'widget-table--sticky-header': stickyHeaderEnabled,
            'widget-table--word-wrap': wordWrapEnabled
          }"
          :style="tableInlineStyle"
          @keydown="onTableEditableKeydown"
        >
          <colgroup v-if="tableColumns.length">
            <col
              v-for="(column, colIdx) in tableColumns"
              :key="'col-' + colIdx"
              :style="leafColStyle(column)"
            >
          </colgroup>
          <thead ref="tableThead">
            <tr v-for="(headerRow, rIdx) in headerRows" :key="rIdx">
              <th
                v-for="(cell, cIdx) in headerRow"
                :key="cIdx"
                :colspan="cell.colspan"
                :rowspan="cell.rowspan"
                :style="headerThStyle(cell)"
                :aria-sort="thAriaSort(rIdx, cIdx, cell)"
                :data-header-row="rIdx"
                :data-header-cell="cIdx"
                :data-runtime-col-index="cell.runtimeColIndex != null ? cell.runtimeColIndex : -1"
                @contextmenu="onTableHeaderContextMenu($event, rIdx, cell, cell.runtimeColIndex)"
              >
                <div
                  v-if="showSortInHeaderCell(rIdx, cell)"
                  class="widget-table__th-inner"
                  role="button"
                  tabindex="0"
                  :aria-label="sortAriaLabel(cell.runtimeColIndex)"
                  @click="onHeaderSortClick(cell.runtimeColIndex, $event)"
                  @keydown.enter.prevent="onHeaderSortClick(cell.runtimeColIndex, $event)"
                  @keydown.space.prevent="onHeaderSortClick(cell.runtimeColIndex, $event)"
                >
                  <span class="widget-table__th-text" v-text="cell.label"></span>
                  <table-sort-icons :state-class="sortControlClass(cell.runtimeColIndex)"></table-sort-icons>
                </div>
                <span v-else v-text="cell.label"></span>
              </th>
            </tr>
            <tr v-if="hasColumnNumbers">
              <th
                v-for="(column, index) in tableColumns"
                :key="'num-' + index"
                @contextmenu="onColumnNumberHeaderContextMenu($event, index)"
              >
                <span v-text="column.number != null ? column.number : ''"></span>
              </th>
            </tr>
            <tr v-if="hasColumnLetters" class="widget-table__column-letters-row">
              <th
                v-for="(letter, index) in columnLetterLabels"
                :key="'abc-' + index"
                class="widget-table__column-letter"
                :class="{ 'widget-table__column-letter--empty': !letter }"
                tabindex="0"
                :aria-label="letter ? 'Выбрать столбец ' + letter : 'Выбрать всю таблицу'"
                @click="onColumnLetterHeaderClick($event, index)"
                @keydown.enter.prevent="onColumnLetterHeaderClick($event, index)"
                @keydown.space.prevent="onColumnLetterHeaderClick($event, index)"
                @contextmenu="letter ? onColumnNumberHeaderContextMenu($event, index) : $event.preventDefault()"
              >
                <span v-text="letter"></span>
              </th>
            </tr>
          </thead>
          <tbody @mousedown.capture="onTbodyMouseDownCapture">
            <tr v-for="(drow, rowIndex) in displayRows" :key="drow.pathKey">
              <template v-if="drow.kind === 'group'">
                <td
                  :colspan="Math.max(1, tableColumns.length)"
                  class="widget-table__group-row"
                  :style="groupRowStyle(drow)"
                  tabindex="-1"
                  @click.stop.prevent="toggleGroupExpand(drow.pathKey)"
                  @contextmenu="onGroupHeaderContextMenu($event)"
                >
                  <span class="widget-table__group-toggle" aria-hidden="true" v-text="groupExpanded(drow.pathKey) ? '−' : '+'"></span>
                  <span class="widget-table__group-label" v-text="drow.label"></span>
                </td>
              </template>
              <template v-else>
                <td
                  v-for="(column, cellIndex) in tableColumns"
                  :key="cellIndex"
                  :data-row="rowIndex"
                  :data-row-id="drow.rowId"
                  :data-col="cellIndex"
                  :data-col-key="runtimeColumnKeyList[cellIndex]"
                  :class="cellTdClass(rowIndex, cellIndex)"
                  :tabindex="cellTabindex(rowIndex, cellIndex)"
                  :style="cellTdStyleByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], rowIndex, cellIndex)"
                  @click="onTableCellClick($event, rowIndex, cellIndex)"
                  @dblclick.stop="onTableCellDblClick(rowIndex, cellIndex)"
                  @mouseenter="syncCellOverflowHint($event)"
                  @mouseleave="clearCellOverflowHint($event)"
                  @mousedown="onTableCellMouseDown($event, rowIndex, cellIndex)"
                  @contextmenu="onBodyContextMenu($event, rowIndex, cellIndex)"
                >
                  <template v-if="cellUsesEmbeddedWidgetByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)">
                    <div
                      v-if="isEditable && isCellEditing(rowIndex, cellIndex) && cellAllowsEditing(rowIndex, cellIndex)"
                      class="cell-editor-wrap"
                    >
                      <component
                        :is="cellWidgetComponentByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)"
                        :ref="cellWidgetRefNameByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], rowIndex, cellIndex)"
                        :widget-config="cellWidgetConfigByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], rowIndex, cellIndex, column)"
                        :widget-name="cellWidgetNameByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], rowIndex, cellIndex)"
                        @input="onCellWidgetPayloadByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], $event)"
                      ></component>
                    </div>
                    <div v-else class="widget-table__cell-display" :class="cellDisplayClassByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)">
                      <span
                        class="widget-table__cell-display-text widget-table__cell-value"
                        :class="cellDisplayTextClassByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)"
                        :style="cellVisualTextStyleByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)"
                        v-text="formatCellValueByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], column, cellIndex)"
                      ></span>
                      <span v-if="cellDisplayActionsByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column).length" class="widget-table__cell-actions" :class="cellDisplayActionsClassByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)">
                        <template v-for="action in cellDisplayActionsByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)" :key="action.kind">
                          <button
                            v-if="cellAllowsEditing(rowIndex, cellIndex)"
                            type="button"
                            class="widget-table__cell-action"
                            :class="cellDisplayActionClass(action)"
                            :aria-label="action.label"
                            @mousedown.stop.prevent
                            @click.stop.prevent="onCellDisplayActionByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], rowIndex, cellIndex, action.kind)"
                          >
                            <dropdown-chevron-icon v-if="action.kind === 'list'"></dropdown-chevron-icon>
                            <img v-else :src="iconSrc(action.icon)" alt="" aria-hidden="true">
                          </button>
                          <span v-else class="widget-table__cell-action widget-table__cell-action--readonly" :class="cellDisplayActionClass(action)" aria-hidden="true">
                            <dropdown-chevron-icon v-if="action.kind === 'list'"></dropdown-chevron-icon>
                            <img v-else :src="iconSrc(action.icon)" alt="">
                          </span>
                        </template>
                      </span>
                    </div>
                  </template>
                  <template v-else-if="isEditable && cellUsesNativeInputByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column) && (!wordWrapEnabled || isCellEditing(rowIndex, cellIndex))">
                    <input
                      type="text"
                      class="cell-input w-100"
                      :class="{ 'cell-input--view': !isCellEditing(rowIndex, cellIndex) }"
                      tabindex="-1"
                      :value="cellValueByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex)"
                      :readOnly="!isCellEditing(rowIndex, cellIndex)"
                      @mousedown="onCellInputViewMouseDown($event, rowIndex, cellIndex)"
                      :style="cellVisualTextStyleByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)"
                      @input="effectiveCellTypeByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column) === 'ip' ? onIpInputByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], $event) : onCellInputByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], $event)"
                      @blur="effectiveCellTypeByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column) === 'ip' ? onNativeCellBlurByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], rowIndex, cellIndex) : onTextCellBlurByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], rowIndex, cellIndex, column)"
                    >
                    <span
                      aria-hidden="true"
                      class="widget-table__cell-text-proxy widget-table__cell-value"
                      :style="cellVisualTextStyleByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)"
                      v-text="formatCellValueByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], column, cellIndex)"
                    ></span>
                  </template>
                  <template v-else>
                    <span class="widget-table__cell-value" :style="cellVisualTextStyleByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], cellIndex, column)" v-text="formatCellValueByIdentity(drow.rowId, runtimeColumnKeyList[cellIndex], column, cellIndex)"></span>
                  </template>
                </td>
              </template>
            </tr>
            <tr v-if="tableLazyUiActive" ref="lazySentinelRow" class="widget-table__lazy-sentinel" aria-hidden="true">
              <td :colspan="Math.max(1, tableColumns.length)" class="widget-table__lazy-hint">
                <span v-if="isLoadingChunk">Загрузка…</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="widgetConfig.sup_text" class="widget-info">
      <span v-text="widgetConfig.sup_text"></span>
    </div>

    <div
      v-if="contextMenuOpen"
      ref="contextMenuEl"
      class="context-menu"
      role="menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
      @keydown.escape.stop.prevent="hideContextMenu"
    >
      <template v-for="item in contextMenuItems" :key="item.id">
        <hr v-if="item.separatorBefore" class="context-menu-sep" role="separator">
        <div
          class="context-menu-item"
          :class="{ 'context-menu-item--disabled': item.disabled }"
          role="menuitem"
          :aria-disabled="item.disabled ? 'true' : 'false'"
          :tabindex="item.disabled ? -1 : 0"
          @click="onContextMenuItemActivate(item)"
          @keydown.enter.prevent="onContextMenuItemActivate(item)"
        >
          <span v-if="item.icon" class="context-menu-item__icon" aria-hidden="true">
            <img :class="['context-menu-item__img', item.iconClass || '']" :src="iconSrc(item.icon)" alt="" @error="onCtxIconError">
          </span>
          <span class="context-menu-item__label" v-text="item.label"></span>
          <span v-if="item.kbd" class="context-menu-item__kbd" v-text="item.kbd"></span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  TableRuntimePropsSurface,
  TableWidgetEmit,
  TableWidgetPublicSurface
} from './table_contract.ts';
import DropdownChevronIcon from '../common/DropdownChevronIcon.vue';
import TableSortIcons from '../common/SortIcons.vue';
import TableToolbar from './TableToolbar.vue';
import { useTableRuntime } from './useTableRuntime.ts';

defineOptions({
  name: 'TableWidget'
});

const props = defineProps<TableRuntimePropsSurface>();
const emit = defineEmits<TableWidgetEmit>();

const tableRuntime = useTableRuntime({
  props,
  emit
});

const {
  canRedo,
  canUndo,
  cellAllowsEditing,
  cellDisplayActionClass,
  cellDisplayActionsByIdentity,
  cellDisplayActionsClassByIdentity,
  cellDisplayClassByIdentity,
  cellDisplayTextClassByIdentity,
  cellTabindex,
  cellTdStyleByIdentity,
  cellTdClass,
  cellValueByIdentity,
  cellUsesEmbeddedWidgetByIdentity,
  cellUsesNativeInputByIdentity,
  cellVisualTextStyleByIdentity,
  cellWidgetComponentByIdentity,
  cellWidgetConfigByIdentity,
  cellWidgetNameByIdentity,
  cellWidgetRefNameByIdentity,
  columnLetterLabels,
  clearCellOverflowHint,
  contextMenuItems,
  contextMenuOpen,
  contextMenuPosition,
  displayRows,
  effectiveCellTypeByIdentity,
  formatCellValueByIdentity,
  groupExpanded,
  groupRowStyle,
  groupingActive,
  hasColumnLetters,
  hasColumnNumbers,
  hasExplicitTableWidth,
  headerRows,
  headerSortEnabled,
  headerThStyle,
  hideContextMenu,
  iconSrc,
  isCellEditing,
  isEditable,
  isLoadingChunk,
  leafColStyle,
  onBodyContextMenu,
  onCellDisplayActionByIdentity,
  onCellInputByIdentity,
  onCellInputViewMouseDown,
  onCellWidgetPayloadByIdentity,
  onColumnLetterHeaderClick,
  onColumnNumberHeaderContextMenu,
  onContextMenuItemActivate,
  onCtxIconError,
  onGroupHeaderContextMenu,
  onHeaderSortClick,
  onIpInputByIdentity,
  onNativeCellBlurByIdentity,
  runtimeColumnKeyList,
  onTableCellClick,
  onTableCellDblClick,
  onTableCellMouseDown,
  onTableContainerFocusIn,
  onTableContainerFocusOut,
  onTableEditableKeydown,
  onTableHeaderContextMenu,
  onTableToolbarAction,
  onTbodyMouseDownCapture,
  onTextCellBlurByIdentity,
  showSortInHeaderCell,
  sortAriaLabel,
  sortControlClass,
  stickyHeaderEnabled,
  syncCellOverflowHint,
  tableColumns,
  tableData,
  tableInlineStyle,
  tableLazyUiActive,
  tableUiLocked,
  tableZebra,
  toolbarState,
  toolbarEnabled,
  thAriaSort,
  toggleGroupExpand,
  widgetConfig,
  wordWrapEnabled
} = tableRuntime;

const tableWidgetPublicSurface = {
  get contextMenuOpen() {
    return tableRuntime.contextMenuOpen.value;
  },
  get stickyHeaderEnabled() {
    return tableRuntime.stickyHeaderEnabled.value;
  },
  get tableData() {
    return tableRuntime.tableData.value;
  },
  dispatchTableCommand(command, payload) {
    return tableRuntime.dispatchTableCommand(command, payload || {});
  },
  getTableEl: tableRuntime.getTableEl,
  getValue: tableRuntime.getValue,
  initializeTable: tableRuntime.initializeTable,
  onTableEditableKeydown: tableRuntime.onTableEditableKeydown,
  setValue: tableRuntime.setValue
} satisfies TableWidgetPublicSurface;

defineExpose(tableWidgetPublicSurface);
</script>
