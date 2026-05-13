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
            <tr
              v-if="virtualState.topSpacerPx > 0 || virtualState.bottomSpacerPx > 0"
              class="widget-table__virtual-spacer"
              aria-hidden="true"
              role="presentation"
              @contextmenu.stop.prevent
            >
              <td
                :colspan="Math.max(1, tableColumns.length)"
                class="widget-table__virtual-spacer-proxy-cell"
                @contextmenu.stop.prevent
              ></td>
            </tr>
            <tr
              v-if="virtualState.topSpacerPx > 0"
              class="widget-table__virtual-padding widget-table__virtual-padding--top"
              aria-hidden="true"
              role="presentation"
              @contextmenu.stop.prevent
            >
              <td
                :colspan="Math.max(1, tableColumns.length)"
                class="widget-table__virtual-spacer-cell"
                :style="virtualTopSpacerStyle"
              ></td>
            </tr>
            <tr
              v-for="rowModel in visibleCellGrid"
              :key="rowModel.pathKey"
              :data-display-row="rowModel.displayIndex"
              :class="{
                'widget-table__row--odd': rowModel.displayIndex % 2 === 0,
                'widget-table__row--even': rowModel.displayIndex % 2 === 1
              }"
            >
              <template v-if="rowModel.kind === 'group'">
                <td
                  :colspan="Math.max(1, tableColumns.length)"
                  class="widget-table__group-row"
                  :style="groupRowStyle(rowModel.groupRow)"
                  tabindex="-1"
                  @click.stop.prevent="toggleGroupExpand(rowModel.groupRow.pathKey)"
                  @contextmenu="onGroupHeaderContextMenu($event)"
                >
                  <span class="widget-table__group-toggle" aria-hidden="true" v-text="groupExpanded(rowModel.groupRow.pathKey) ? '−' : '+'"></span>
                  <span class="widget-table__group-label" v-text="rowModel.groupRow.label"></span>
                </td>
              </template>
              <template v-else>
                <td
                  v-for="cell in rowModel.cells"
                  :key="cell.colKey || cell.colIndex"
                  :data-row="cell.displayIndex"
                  :data-row-id="cell.rowId"
                  :data-col="cell.colIndex"
                  :data-col-key="cell.colKey"
                  :class="[cell.tdClass, cellTdClass(cell.displayIndex, cell.colIndex)]"
                  :tabindex="cellTabindex(cell.displayIndex, cell.colIndex)"
                  :style="[cell.tdStyle, cellSelectionOutlineStyle(cell.displayIndex, cell.colIndex)]"
                  @click="onTableCellClick($event, cell.displayIndex, cell.colIndex)"
                  @dblclick.stop="onTableCellDblClick(cell.displayIndex, cell.colIndex)"
                  @mouseenter="syncCellOverflowHint($event)"
                  @mouseleave="clearCellOverflowHint($event)"
                  @mousedown="onTableCellMouseDown($event, cell.displayIndex, cell.colIndex)"
                  @contextmenu="onBodyContextMenu($event, cell.displayIndex, cell.colIndex)"
                >
                  <template v-if="cell.usesEmbeddedWidget">
                    <div
                      v-if="isEditable && cell.isEditing && cell.allowsEditing"
                      class="cell-editor-wrap"
                    >
                      <component
                        :is="cell.widgetComponent"
                        :ref="cell.widgetRefName"
                        :widget-config="cell.widgetConfig"
                        :widget-name="cell.widgetName"
                        @input="onCellWidgetPayloadByIdentity(cell.rowId, cell.colKey, $event)"
                      ></component>
                    </div>
                    <div v-else class="widget-table__cell-display" :class="cell.displayClass">
                      <span
                        class="widget-table__cell-display-text widget-table__cell-value"
                        :class="[cell.displayTextClass, cell.valueClass]"
                        :style="cell.textStyle"
                        v-text="cell.formattedValue"
                      ></span>
                      <span v-if="cell.actions.length" class="widget-table__cell-actions" :class="cell.actionsClass">
                        <template v-for="action in cell.actions" :key="action.kind">
                          <button
                            v-if="cell.allowsEditing"
                            type="button"
                            class="widget-table__cell-action"
                            :class="action.actionClass"
                            :aria-label="action.label"
                            @mousedown.stop.prevent
                            @click.stop.prevent="onCellDisplayActionByIdentity(cell.rowId, cell.colKey, cell.displayIndex, cell.colIndex, action.kind)"
                          >
                            <dropdown-chevron-icon v-if="action.kind === 'list'"></dropdown-chevron-icon>
                            <img v-else :src="iconSrc(action.icon)" alt="" aria-hidden="true">
                          </button>
                          <span v-else class="widget-table__cell-action widget-table__cell-action--readonly" :class="action.actionClass" aria-hidden="true">
                            <dropdown-chevron-icon v-if="action.kind === 'list'"></dropdown-chevron-icon>
                            <img v-else :src="iconSrc(action.icon)" alt="">
                          </span>
                        </template>
                      </span>
                    </div>
                  </template>
                  <template v-else-if="isEditable && cell.usesNativeInput && (!wordWrapEnabled || cell.isEditing)">
                    <input
                      type="text"
                      class="cell-input w-100"
                      :class="{ 'cell-input--view': !cell.isEditing }"
                      tabindex="-1"
                      :value="cell.rawValue"
                      :readOnly="!cell.isEditing"
                      @mousedown="onCellInputViewMouseDown($event, cell.displayIndex, cell.colIndex)"
                      :style="cell.textStyle"
                      @input="cell.effectiveType === 'ip' ? onIpInputByIdentity(cell.rowId, cell.colKey, $event) : onCellInputByIdentity(cell.rowId, cell.colKey, $event)"
                      @blur="cell.effectiveType === 'ip' ? onNativeCellBlurByIdentity(cell.rowId, cell.colKey, cell.displayIndex, cell.colIndex) : onTextCellBlurByIdentity(cell.rowId, cell.colKey, cell.displayIndex, cell.colIndex, cell.column)"
                    >
                    <span
                      aria-hidden="true"
                      class="widget-table__cell-text-proxy widget-table__cell-value"
                      :class="cell.valueClass"
                      :style="cell.textStyle"
                      v-text="cell.formattedValue"
                    ></span>
                  </template>
                  <template v-else>
                    <span
                      class="widget-table__cell-value"
                      :class="cell.valueClass"
                      :style="cell.textStyle"
                      v-text="cell.formattedValue"
                    ></span>
                  </template>
                </td>
              </template>
            </tr>
            <tr
              v-if="virtualState.bottomSpacerPx > 0"
              class="widget-table__virtual-padding widget-table__virtual-padding--bottom"
              aria-hidden="true"
              role="presentation"
              @contextmenu.stop.prevent
            >
              <td
                :colspan="Math.max(1, tableColumns.length)"
                class="widget-table__virtual-spacer-cell"
                :style="virtualBottomSpacerStyle"
              ></td>
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
  cellSelectionOutlineStyle,
  cellTabindex,
  cellTdClass,
  columnLetterLabels,
  clearCellOverflowHint,
  contextMenuItems,
  contextMenuOpen,
  contextMenuPosition,
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
  isEditable,
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
  tableUiLocked,
  tableZebra,
  toolbarState,
  toolbarEnabled,
  thAriaSort,
  toggleGroupExpand,
  virtualBottomSpacerStyle,
  virtualState,
  virtualTopSpacerStyle,
  visibleCellGrid,
  widgetConfig,
  wordWrapEnabled
} = tableRuntime;

const tableWidgetPublicSurface = {
  get contextMenuOpen() {
    return tableRuntime.contextMenuOpen.value;
  },
  get selFocus() {
    return tableRuntime.selFocus.value;
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
  ensureDisplayRowVisible: tableRuntime.ensureDisplayRowVisible,
  focusSelectionCell: tableRuntime.focusSelectionCell,
  getTableEl: tableRuntime.getTableEl,
  getValue: tableRuntime.getValue,
  getValueAsync: tableRuntime.getValueAsync,
  exportValueAsync: tableRuntime.exportValueAsync,
  initializeTable: tableRuntime.initializeTable,
  onTableEditableKeydown: tableRuntime.onTableEditableKeydown,
  scrollToDisplayRow: tableRuntime.scrollToDisplayRow,
  selectAllTable: tableRuntime.selectAllTable,
  setValue: tableRuntime.setValue,
  submitTableCommands: tableRuntime.submitTableCommands
} satisfies TableWidgetPublicSurface;

defineExpose(tableWidgetPublicSurface);
</script>
