<template>
  <div class="widget-container">
    <div v-if="widgetConfig.label" class="widget-label">
      <span v-text="widgetConfig.label"></span>
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
                  :data-col-key="runtimeColumnKey(cellIndex)"
                  :class="cellTdClass(rowIndex, cellIndex)"
                  :tabindex="cellTabindex(rowIndex, cellIndex)"
                  :style="cellSelectionOutlineStyle(rowIndex, cellIndex)"
                  style="cursor: pointer;"
                  @click="onTableCellClick($event, rowIndex, cellIndex)"
                  @dblclick.stop="onTableCellDblClick(rowIndex, cellIndex)"
                  @mouseenter="syncCellOverflowHint($event)"
                  @mouseleave="clearCellOverflowHint($event)"
                  @mousedown="onTableCellMouseDown($event, rowIndex, cellIndex)"
                  @contextmenu="onBodyContextMenu($event, rowIndex, cellIndex)"
                >
                  <template v-if="cellUsesEmbeddedWidget(column)">
                    <div
                      v-if="isEditable && isCellEditing(rowIndex, cellIndex) && cellAllowsEditing(rowIndex, cellIndex)"
                      class="cell-editor-wrap"
                    >
                      <component
                        :is="cellWidgetComponent(column)"
                        :ref="cellWidgetRefNameByIdentity(drow.rowId, runtimeColumnKey(cellIndex), rowIndex, cellIndex)"
                        :widget-config="cellWidgetConfigByIdentity(drow.rowId, runtimeColumnKey(cellIndex), rowIndex, cellIndex, column)"
                        :widget-name="cellWidgetNameByIdentity(drow.rowId, runtimeColumnKey(cellIndex), rowIndex, cellIndex)"
                        @input="onCellWidgetPayloadByIdentity(drow.rowId, runtimeColumnKey(cellIndex), $event)"
                      ></component>
                    </div>
                    <div v-else class="widget-table__cell-display" :class="cellDisplayClass(column)">
                      <span
                        class="widget-table__cell-display-text widget-table__cell-value"
                        :class="cellDisplayTextClass(column)"
                        :style="cellDisplayTextStyle(column)"
                        v-text="formatCellValueByIdentity(drow.rowId, runtimeColumnKey(cellIndex), column, cellIndex)"
                      ></span>
                      <span v-if="cellDisplayActions(column).length" class="widget-table__cell-actions" :class="cellDisplayActionsClass(column)">
                        <template v-for="action in cellDisplayActions(column)" :key="action.kind">
                          <button
                            v-if="cellAllowsEditing(rowIndex, cellIndex)"
                            type="button"
                            class="widget-table__cell-action"
                            :class="cellDisplayActionClass(action)"
                            :aria-label="action.label"
                            @mousedown.stop.prevent
                            @click.stop.prevent="onCellDisplayActionByIdentity(drow.rowId, runtimeColumnKey(cellIndex), rowIndex, cellIndex, action.kind)"
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
                  <template v-else-if="isEditable && cellUsesNativeInput(column) && (!wordWrapEnabled || isCellEditing(rowIndex, cellIndex))">
                    <input
                      type="text"
                      class="cell-input w-100"
                      :class="{ 'cell-input--view': !isCellEditing(rowIndex, cellIndex) }"
                      tabindex="-1"
                      :value="cellValueByIdentity(drow.rowId, runtimeColumnKey(cellIndex), cellIndex)"
                      :readOnly="!isCellEditing(rowIndex, cellIndex)"
                      @mousedown="onCellInputViewMouseDown($event, rowIndex, cellIndex)"
                      @input="column.type === 'ip' ? onIpInputByIdentity(drow.rowId, runtimeColumnKey(cellIndex), $event) : onCellInputByIdentity(drow.rowId, runtimeColumnKey(cellIndex), $event)"
                      @blur="column.type === 'ip' ? onNativeCellBlurByIdentity(drow.rowId, runtimeColumnKey(cellIndex), rowIndex, cellIndex) : onTextCellBlurByIdentity(drow.rowId, runtimeColumnKey(cellIndex), rowIndex, cellIndex, column)"
                    >
                    <span
                      aria-hidden="true"
                      class="widget-table__cell-text-proxy"
                      v-text="formatCellValueByIdentity(drow.rowId, runtimeColumnKey(cellIndex), column, cellIndex)"
                    ></span>
                  </template>
                  <template v-else>
                    <span class="widget-table__cell-value" v-text="formatCellValueByIdentity(drow.rowId, runtimeColumnKey(cellIndex), column, cellIndex)"></span>
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
import TableSortIcons from './TableSortIcons.vue';
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
  cellAllowsEditing,
  cellDisplayActionClass,
  cellDisplayActions,
  cellDisplayActionsClass,
  cellDisplayClass,
  cellDisplayTextClass,
  cellDisplayTextStyle,
  cellSelectionOutlineStyle,
  cellTabindex,
  cellTdClass,
  cellValueByIdentity,
  cellUsesEmbeddedWidget,
  cellUsesNativeInput,
  cellWidgetComponent,
  cellWidgetConfigByIdentity,
  cellWidgetNameByIdentity,
  cellWidgetRefNameByIdentity,
  clearCellOverflowHint,
  contextMenuItems,
  contextMenuOpen,
  contextMenuPosition,
  displayRows,
  formatCellValueByIdentity,
  groupExpanded,
  groupRowStyle,
  groupingActive,
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
  onColumnNumberHeaderContextMenu,
  onContextMenuItemActivate,
  onCtxIconError,
  onGroupHeaderContextMenu,
  onHeaderSortClick,
  onIpInputByIdentity,
  onNativeCellBlurByIdentity,
  runtimeColumnKey,
  onTableCellClick,
  onTableCellDblClick,
  onTableCellMouseDown,
  onTableContainerFocusIn,
  onTableContainerFocusOut,
  onTableEditableKeydown,
  onTableHeaderContextMenu,
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
