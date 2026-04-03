// Виджет таблицы. Скрипты (порядок в page.html): table_core → … → table_keyboard →
// table_widget_helpers (WidgetMeasure, WidgetUiCoords) → table_widget.

import { markRaw } from 'vue';

import { createStore as createTableStore, getListOptions } from './table_api.js';
import tableEngine from './table_core.js';
import { FRONTEND_ERROR_SCOPES } from '../../runtime/error_model.js';
import {
    blankCellValueForColumn as selectBlankCellValueForColumn,
    defaultCellValueForColumn as selectDefaultCellValueForColumn,
    defaultCellValueFromColumn as selectDefaultCellValueFromColumn,
    getCellDisplayActionClass,
    getCellDisplayActions,
    getCellDisplayActionsClass,
    getCellDisplayClass,
    getCellDisplayTextClass,
    getCellDisplayTextStyle,
    getColumnAttrConfig as selectColumnAttrConfig,
    getColumnTableCellOptions as selectColumnTableCellOptions,
    isListColumnMultiselect,
    normalizeCellWidgetValue as selectNormalizeCellWidgetValue,
    resolveTableLazyEnabled as selectResolveTableLazyEnabled,
    tableCellConsumeKeys as selectTableCellConsumeKeys
} from './table_selectors.js';
import { DateTimeWidget, DateWidget, TimeWidget } from '../datetime_widgets.js';
import FloatWidget from '../float.js';
import IntWidget from '../int.js';
import { IpMaskWidget, IpWidget } from '../ip_widgets.js';
import ListWidget from '../list.js';
import StringWidget from '../string.js';
import VocWidget from '../voc.js';

const TableWidget = {
    inject: {
        getAllAttrsMapFromRuntime: {
            from: 'getAllAttrsMap',
            default: null
        },
        handleRecoverableAppErrorFromRuntime: {
            from: 'handleRecoverableAppError',
            default: null
        },
        showAppNotificationFromRuntime: {
            from: 'showAppNotification',
            default: null
        }
    },
    props: {
        widgetConfig: {
            type: Object,
            required: true
        },
        widgetName: {
            type: String,
            required: true
        }
    },
    emits: ['input'],
    template: `
        <div class="widget-container">
            <div v-if="widgetConfig.label" class="widget-label">
                <span v-text="widgetConfig.label"></span>
            </div>
            
            <div class="widget-table-container" :class="{ 'widget-table-container--locked': tableUiLocked }" @focusin.capture="onTableContainerFocusIn" @focusout.capture="onTableContainerFocusOut">
                <div class="widget-table-wrapper">
                <table ref="tableRoot" class="table widget-table" :class="{ 'widget-table--editable': isEditable, 'widget-table--no-zebra': !tableZebra, 'widget-table--explicit-width': hasExplicitTableWidth, 'widget-table--sortable': headerSortEnabled, 'widget-table--grouping': groupingActive, 'widget-table--sticky-header': stickyHeaderEnabled, 'widget-table--word-wrap': wordWrapEnabled }" :style="tableInlineStyle" @keydown="onTableEditableKeydown">
                    <colgroup v-if="tableColumns.length">
                        <col v-for="(column, colIdx) in tableColumns" :key="'col-' + colIdx" :style="leafColStyle(column)">
                    </colgroup>
                    <thead ref="tableThead">
                        <tr v-for="(headerRow, rIdx) in headerRows" :key="rIdx">
                            <th v-for="(cell, cIdx) in headerRow" :key="cIdx" :colspan="cell.colspan" :rowspan="cell.rowspan" :style="headerThStyle(cell)" :aria-sort="thAriaSort(rIdx, cIdx, cell)"
                                :data-header-row="rIdx"
                                :data-header-cell="cIdx"
                                :data-runtime-col-index="cell.runtimeColIndex != null ? cell.runtimeColIndex : -1"
                                @contextmenu="onTableHeaderContextMenu($event, rIdx, cell, cell.runtimeColIndex)">
                                <div
                                    v-if="showSortInHeaderCell(rIdx, cell)"
                                    class="widget-table__th-inner"
                                    role="button"
                                    tabindex="0"
                                    :aria-label="sortAriaLabel(cell.runtimeColIndex)"
                                    @click="onHeaderSortClick(cell.runtimeColIndex, $event)"
                                    @keydown.enter.prevent="onHeaderSortClick(cell.runtimeColIndex, $event)"
                                    @keydown.space.prevent="onHeaderSortClick(cell.runtimeColIndex, $event)">
                                    <span class="widget-table__th-text" v-text="cell.label"></span>
                                    <div class="widget-table__sort-icons" :class="sortControlClass(cell.runtimeColIndex)" aria-hidden="true">
                                        <svg class="widget-table__sort-svg widget-table__sort-svg--up" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.5845 17.7447L22.3941 8.93511C23.202 8.12722 23.202 6.80556 22.3941 5.99859L21.6588 5.26239C20.8528 4.45543 19.5302 4.45543 18.7232 5.26239L12 11.9856L5.27679 5.2624C4.46983 4.45543 3.14724 4.45543 2.34119 5.2624L1.60591 5.9986C0.798027 6.80556 0.798027 8.12723 1.60592 8.93511L10.4173 17.7447C10.8502 18.1785 11.4311 18.3715 12.0009 18.3393C12.568 18.3715 13.1498 18.1785 13.5845 17.7447Z"/></svg>
                                        <svg class="widget-table__sort-svg widget-table__sort-svg--down" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.5845 17.7447L22.3941 8.93511C23.202 8.12722 23.202 6.80556 22.3941 5.99859L21.6588 5.26239C20.8528 4.45543 19.5302 4.45543 18.7232 5.26239L12 11.9856L5.27679 5.2624C4.46983 4.45543 3.14724 4.45543 2.34119 5.2624L1.60591 5.9986C0.798027 6.80556 0.798027 8.12723 1.60592 8.93511L10.4173 17.7447C10.8502 18.1785 11.4311 18.3715 12.0009 18.3393C12.568 18.3715 13.1498 18.1785 13.5845 17.7447Z"/></svg>
                                    </div>
                                </div>
                                <span v-else v-text="cell.label"></span>
                            </th>
                        </tr>
                        <tr v-if="hasColumnNumbers">
                            <th v-for="(column, index) in tableColumns" :key="'num-' + index">
                                <span v-text="column.number != null ? column.number : ''"></span>
                            </th>
                        </tr>
                    </thead>
                    <tbody v-if="!groupingActive" @mousedown.capture="onTbodyMouseDownCapture">
                        <tr v-for="(row, rowIndex) in tableData" :key="row.id || ('r' + rowIndex)">
                            <td v-for="(column, cellIndex) in tableColumns" :key="cellIndex"
                                :data-row="rowIndex"
                                :data-col="cellIndex"
                                :class="cellTdClass(rowIndex, cellIndex)"
                                :tabindex="cellTabindex(rowIndex, cellIndex)"
                                :style="cellSelectionOutlineStyle(rowIndex, cellIndex)"
                                @click="onTableCellClick($event, rowIndex, cellIndex)"
                                @dblclick.stop="onTableCellDblClick(rowIndex, cellIndex)"
                                @mouseenter="syncCellOverflowHint($event)"
                                @mouseleave="clearCellOverflowHint($event)"
                                @mousedown="onTableCellMouseDown($event, rowIndex, cellIndex)"
                                @contextmenu="onBodyContextMenu($event, rowIndex, cellIndex)"
                                style="cursor: pointer;">
                                <template v-if="cellUsesEmbeddedWidget(column)">
                                    <div
                                         v-if="isEditable && isCellEditing(rowIndex, cellIndex) && cellAllowsEditing(rowIndex, cellIndex)"
                                         class="cell-editor-wrap">
                                        <component
                                               :is="cellWidgetComponent(column)"
                                               :ref="cellWidgetRefName(rowIndex, cellIndex)"
                                               :widget-config="cellWidgetConfig(rowIndex, cellIndex, column)"
                                               :widget-name="cellWidgetName(rowIndex, cellIndex)"
                                               @input="onCellWidgetPayload(rowIndex, cellIndex, $event)"/>
                                    </div>
                                    <div v-else class="widget-table__cell-display" :class="cellDisplayClass(column)">
                                        <span class="widget-table__cell-display-text widget-table__cell-value" :class="cellDisplayTextClass(column)" :style="cellDisplayTextStyle(column)" v-text="formatCellValue(safeCell(row, cellIndex), column)"></span>
                                        <span v-if="cellDisplayActions(column).length" class="widget-table__cell-actions" :class="cellDisplayActionsClass(column)">
                                            <template v-for="action in cellDisplayActions(column)" :key="action.kind">
                                                <button
                                                    v-if="cellAllowsEditing(rowIndex, cellIndex)"
                                                    type="button"
                                                    class="widget-table__cell-action"
                                                    :class="cellDisplayActionClass(action)"
                                                    :aria-label="action.label"
                                                    @mousedown.stop.prevent
                                                    @click.stop.prevent="onCellDisplayAction(rowIndex, cellIndex, action.kind)">
                                                    <svg v-if="action.kind === 'list'" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                                        <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"/>
                                                    </svg>
                                                    <img v-else :src="iconSrc(action.icon)" alt="" aria-hidden="true">
                                                </button>
                                                <span v-else class="widget-table__cell-action widget-table__cell-action--readonly" :class="cellDisplayActionClass(action)" aria-hidden="true">
                                                    <svg v-if="action.kind === 'list'" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"/>
                                                    </svg>
                                                    <img v-else :src="iconSrc(action.icon)" alt="">
                                                </span>
                                            </template>
                                        </span>
                                    </div>
                                </template>
                                <input v-else-if="isEditable && cellUsesNativeInput(column) && column.type==='ip' && (!wordWrapEnabled || isCellEditing(rowIndex, cellIndex))"
                                       type="text"
                                       class="cell-input w-100"
                                       :class="{ 'cell-input--view': !isCellEditing(rowIndex, cellIndex) }"
                                       tabindex="-1"
                                       :value="safeCell(row, cellIndex)"
                                       :readOnly="!isCellEditing(rowIndex, cellIndex)"
                                       @mousedown="onCellInputViewMouseDown($event, rowIndex, cellIndex)"
                                       @input="onIpInput(rowIndex, cellIndex, $event)"
                                       @blur="onNativeCellBlur(rowIndex, cellIndex)"/>
                                <input v-else-if="isEditable && cellUsesNativeInput(column) && (!wordWrapEnabled || isCellEditing(rowIndex, cellIndex))"
                                    type="text"
                                    class="cell-input w-100"
                                    :class="{ 'cell-input--view': !isCellEditing(rowIndex, cellIndex) }"
                                    tabindex="-1"
                                    :value="safeCell(row, cellIndex)"
                                    :readOnly="!isCellEditing(rowIndex, cellIndex)"
                                    @mousedown="onCellInputViewMouseDown($event, rowIndex, cellIndex)"
                                    @input="onCellInput(rowIndex, cellIndex, $event)"
                                    @blur="onTextCellBlur(rowIndex, cellIndex, column)"/>
                                <template v-else>
                                    <span class="widget-table__cell-value" v-text="formatCellValue(safeCell(row, cellIndex), column)"></span>
                                </template>
                            </td>
                        </tr>
                        <tr v-if="tableLazyUiActive" ref="lazySentinelRow" class="widget-table__lazy-sentinel" aria-hidden="true">
                            <td :colspan="Math.max(1, tableColumns.length)" class="widget-table__lazy-hint">
                                <span v-if="isLoadingChunk">Загрузка…</span>
                            </td>
                        </tr>
                    </tbody>
                    <tbody v-else @mousedown.capture="onTbodyMouseDownCapture">
                        <tr v-for="(drow, rowIndex) in displayRows" :key="drow.pathKey">
                            <template v-if="drow.kind === 'group'">
                                <td :colspan="Math.max(1, tableColumns.length)" class="widget-table__group-row" :style="groupRowStyle(drow)" tabindex="-1" @click.stop.prevent="toggleGroupExpand(drow.pathKey)">
                                    <span class="widget-table__group-toggle" aria-hidden="true" v-text="groupExpanded(drow.pathKey) ? '−' : '+'"></span>
                                    <span class="widget-table__group-label" v-text="drow.label"></span>
                                </td>
                            </template>
                            <template v-else>
                                <td v-for="(column, cellIndex) in tableColumns" :key="cellIndex"
                                    :data-row="rowIndex"
                                    :data-col="cellIndex"
                                    :class="cellTdClass(rowIndex, cellIndex)"
                                    :tabindex="cellTabindex(rowIndex, cellIndex)"
                                    :style="cellSelectionOutlineStyle(rowIndex, cellIndex)"
                                    @click="onTableCellClick($event, rowIndex, cellIndex)"
                                    @dblclick.stop="onTableCellDblClick(rowIndex, cellIndex)"
                                    @mouseenter="syncCellOverflowHint($event)"
                                    @mouseleave="clearCellOverflowHint($event)"
                                    @mousedown="onTableCellMouseDown($event, rowIndex, cellIndex)"
                                    @contextmenu="onBodyContextMenu($event, rowIndex, cellIndex)"
                                    style="cursor: pointer;">
                                    <template v-if="cellUsesEmbeddedWidget(column)">
                                        <div
                                             v-if="isEditable && isCellEditing(rowIndex, cellIndex) && cellAllowsEditing(rowIndex, cellIndex)"
                                             class="cell-editor-wrap">
                                            <component
                                                   :is="cellWidgetComponent(column)"
                                                   :ref="cellWidgetRefName(rowIndex, cellIndex)"
                                                   :widget-config="cellWidgetConfig(rowIndex, cellIndex, column)"
                                                   :widget-name="cellWidgetName(rowIndex, cellIndex)"
                                                   @input="onCellWidgetPayload(rowIndex, cellIndex, $event)"/>
                                        </div>
                                        <div v-else class="widget-table__cell-display" :class="cellDisplayClass(column)">
                                            <span class="widget-table__cell-display-text widget-table__cell-value" :class="cellDisplayTextClass(column)" :style="cellDisplayTextStyle(column)" v-text="formatCellValue(safeCell(dataRowByDisplayIndex(rowIndex), cellIndex), column)"></span>
                                            <span v-if="cellDisplayActions(column).length" class="widget-table__cell-actions" :class="cellDisplayActionsClass(column)">
                                                <template v-for="action in cellDisplayActions(column)" :key="action.kind">
                                                    <button
                                                        v-if="cellAllowsEditing(rowIndex, cellIndex)"
                                                        type="button"
                                                        class="widget-table__cell-action"
                                                        :class="cellDisplayActionClass(action)"
                                                        :aria-label="action.label"
                                                        @mousedown.stop.prevent
                                                        @click.stop.prevent="onCellDisplayAction(rowIndex, cellIndex, action.kind)">
                                                        <svg v-if="action.kind === 'list'" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                                            <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"/>
                                                        </svg>
                                                        <img v-else :src="iconSrc(action.icon)" alt="" aria-hidden="true">
                                                    </button>
                                                    <span v-else class="widget-table__cell-action widget-table__cell-action--readonly" :class="cellDisplayActionClass(action)" aria-hidden="true">
                                                        <svg v-if="action.kind === 'list'" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"/>
                                                        </svg>
                                                        <img v-else :src="iconSrc(action.icon)" alt="">
                                                    </span>
                                                </template>
                                            </span>
                                        </div>
                                    </template>
                                    <input v-else-if="isEditable && cellUsesNativeInput(column) && column.type==='ip' && (!wordWrapEnabled || isCellEditing(rowIndex, cellIndex))"
                                           type="text"
                                           class="cell-input w-100"
                                           :class="{ 'cell-input--view': !isCellEditing(rowIndex, cellIndex) }"
                                           tabindex="-1"
                                           :value="safeCell(dataRowByDisplayIndex(rowIndex), cellIndex)"
                                           :readOnly="!isCellEditing(rowIndex, cellIndex)"
                                           @mousedown="onCellInputViewMouseDown($event, rowIndex, cellIndex)"
                                           @input="onIpInput(rowIndex, cellIndex, $event)"
                                           @blur="onNativeCellBlur(rowIndex, cellIndex)"/>
                                    <input v-else-if="isEditable && cellUsesNativeInput(column) && (!wordWrapEnabled || isCellEditing(rowIndex, cellIndex))"
                                        type="text"
                                        class="cell-input w-100"
                                        :class="{ 'cell-input--view': !isCellEditing(rowIndex, cellIndex) }"
                                        tabindex="-1"
                                        :value="safeCell(dataRowByDisplayIndex(rowIndex), cellIndex)"
                                        :readOnly="!isCellEditing(rowIndex, cellIndex)"
                                        @mousedown="onCellInputViewMouseDown($event, rowIndex, cellIndex)"
                                        @input="onCellInput(rowIndex, cellIndex, $event)"
                                        @blur="onTextCellBlur(rowIndex, cellIndex, column)"/>
                                    <template v-else>
                                        <span class="widget-table__cell-value" v-text="formatCellValue(safeCell(dataRowByDisplayIndex(rowIndex), cellIndex), column)"></span>
                                    </template>
                                </td>
                            </template>
                        </tr>
                    </tbody>
                </table>
                </div>
            </div>
            
            <div v-if="widgetConfig.sup_text" class="widget-info">
                <span v-text="widgetConfig.sup_text"></span>
            </div>
            
            <div v-if="contextMenuOpen"
                 ref="contextMenuEl"
                 class="context-menu"
                 role="menu"
                 :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
                 @click.stop
                 @keydown.escape.stop.prevent="hideContextMenu">
                <template v-for="item in contextMenuItems" :key="item.id">
                    <hr v-if="item.separatorBefore" class="context-menu-sep" role="separator" />
                    <div
                        class="context-menu-item"
                        :class="{ 'context-menu-item--disabled': item.disabled }"
                        role="menuitem"
                        :aria-disabled="item.disabled ? 'true' : 'false'"
                        :tabindex="item.disabled ? -1 : 0"
                        @click="onContextMenuItemActivate(item)"
                        @keydown.enter.prevent="onContextMenuItemActivate(item)">
                        <span v-if="item.icon" class="context-menu-item__icon" aria-hidden="true">
                            <img :class="['context-menu-item__img', item.iconClass || '']" :src="iconSrc(item.icon)" alt="" @error="onCtxIconError" />
                        </span>
                        <span class="context-menu-item__label" v-text="item.label"></span>
                        <span v-if="item.kbd" class="context-menu-item__kbd" v-text="item.kbd"></span>
                    </div>
                </template>
            </div>
        </div>
    `,
    data() {
        const tableStore = createTableStore({
            stickyHeaderEnabled: !!(this.widgetConfig && this.widgetConfig.sticky_header === true)
        });
        return {
            value: [],
            tableSchema: null,
            headerRows: [],
            tableColumns: [],
            tableData: [],
            tableStore: tableStore,
            contextMenuOpen: false,
            contextMenuPosition: { x: 0, y: 0 },
            contextMenuTarget: null,
            contextMenuContext: null,
            contextMenuSessionId: 0,
            _pasteInProgress: false,
            selectedRowIndex: -1,
            /** Углы прямоугольного выделения (Excel: якорь + активная ячейка). */
            selAnchor: { r: 0, c: 0 },
            selFocus: { r: 0, c: 0 },
            /** Выделение «все столбцы» для строк r0..r1; якорь остаётся в selAnchor (ячейка вызова). */
            selFullWidthRows: null,
            _tableProgrammaticFocus: false,
            /** После Shift+mousedown ждём click: если Shift отпустили до click, не вызывать setSelectionSingle (сохранить прямоугольник). */
            _shiftSelectGesture: false,
            /** Один якорь на серию Shift+mousedown до обычного клика. */
            _shiftAnchorLocked: false,
            _contextMenuClickHandler: null,
            _contextMenuKeydownHandler: null,
            /** Активная ячейка в режиме правки; null — только навигация/выделение. */
            editingCell: null,
            stringCellWidget: markRaw(StringWidget),
            intCellWidget: markRaw(IntWidget),
            floatCellWidget: markRaw(FloatWidget),
            dateCellWidget: markRaw(DateWidget),
            timeCellWidget: markRaw(TimeWidget),
            datetimeCellWidget: markRaw(DateTimeWidget),
            ipCellWidget: markRaw(IpWidget),
            ipMaskCellWidget: markRaw(IpMaskWidget),
            listCellWidget: markRaw(ListWidget),
            vocCellWidget: markRaw(VocWidget),
            /** true после focus в tbody; без этого не показываем box-shadow выделения (избегаем «фейкового фокуса» при загрузке). */
            _tableFocusWithin: false,
            /** Порядок ссылок на строки до первого клика сортировки в текущем цикле (asc→desc→сброс). */
            _sortCycleRowOrder: null,
            cellValidationErrors: {},
            _lazyObserver: null,
            _lazyDebounceTimer: null,
            /** true на цепочке ПКМ по ячейке: focusin не схлопывает full-row / прямоугольник до contextmenu. */
            _tableContextMenuMouseDown: false,
            _stickyTheadPinned: false,
            _stickyScrollRoot: null,
            _stickyRaf: 0,
            _stickyOnScroll: null,
            _stickyRo: null
        };
    },
    computed: {
        sortKeys: {
            get() {
                return this.tableStore.sorting.sortKeys;
            },
            set(value) {
                this.tableStore.sorting.sortKeys = Array.isArray(value) ? value : [];
            }
        },
        groupingState: {
            get() {
                return this.tableStore.grouping.state;
            },
            set(value) {
                this.tableStore.grouping.state = value && typeof value === 'object'
                    ? value
                    : { levels: [], expanded: new Set() };
            }
        },
        groupingViewCache: {
            get() {
                return this.tableStore.grouping.viewCache;
            },
            set(value) {
                this.tableStore.grouping.viewCache = value || null;
            }
        },
        isFullyLoaded: {
            get() {
                return !!this.tableStore.loading.isFullyLoaded;
            },
            set(value) {
                this.tableStore.loading.isFullyLoaded = !!value;
            }
        },
        lazySessionId: {
            get() {
                return this.tableStore.loading.lazySessionId || 0;
            },
            set(value) {
                this.tableStore.loading.lazySessionId = Number(value) || 0;
            }
        },
        isLoadingChunk: {
            get() {
                return !!this.tableStore.loading.isLoadingChunk;
            },
            set(value) {
                this.tableStore.loading.isLoadingChunk = !!value;
            }
        },
        tableUiLocked: {
            get() {
                return !!this.tableStore.loading.tableUiLocked;
            },
            set(value) {
                this.tableStore.loading.tableUiLocked = !!value;
            }
        },
        lazyEnabled: {
            get() {
                return !!this.tableStore.loading.lazyEnabled;
            },
            set(value) {
                this.tableStore.loading.lazyEnabled = !!value;
            }
        },
        _lazyPendingRows: {
            get() {
                return this.tableStore.loading.lazyPendingRows;
            },
            set(value) {
                this.tableStore.loading.lazyPendingRows = Array.isArray(value) ? value : [];
            }
        },
        stickyHeaderRuntimeEnabled: {
            get() {
                return !!this.tableStore.preferences.stickyHeaderRuntimeEnabled;
            },
            set(value) {
                this.tableStore.preferences.stickyHeaderRuntimeEnabled = !!value;
            }
        },
        wordWrapRuntimeEnabled: {
            get() {
                return !!this.tableStore.preferences.wordWrapRuntimeEnabled;
            },
            set(value) {
                this.tableStore.preferences.wordWrapRuntimeEnabled = !!value;
            }
        },
        isEditable() {
            // Таблица редактируемая по умолчанию; если явно указан readonly: true — только для чтения
            return !(this.widgetConfig && this.widgetConfig.readonly === true);
        },
        /** Полосы чёт/нечёт: по умолчанию включены; zebra: false в YAML отключает. */
        tableZebra() {
            const z = this.widgetConfig && this.widgetConfig.zebra;
            if (z === false) return false;
            return true;
        },
        hasColumnNumbers() {
            return Array.isArray(this.tableColumns) && this.tableColumns.some(c => c && c.number != null);
        },
        /** Явная ширина таблицы из YAML (`width`) — колонки без :NN делят оставшееся место. */
        hasExplicitTableWidth() {
            const w = this.widgetConfig && this.widgetConfig.width;
            return w != null && String(w).trim() !== '';
        },
        tableInlineStyle() {
            const o = {
                marginBottom: 0,
                tableLayout: 'fixed'
            };
            const M = tableEngine.WidgetMeasure;
            const sumWidths =
                M && typeof M.sumColumnWidthsPx === 'function'
                    ? M.sumColumnWidthsPx(this.tableColumns)
                    : null;
            if (!this.hasExplicitTableWidth) {
                if (sumWidths) {
                    // `table-layout: fixed` needs a concrete table width; with `width:auto`
                    // long cell content can still affect the final column layout.
                    o.width = sumWidths;
                    o.minWidth = sumWidths;
                }
                return o;
            }
            const w = this.widgetConfig.width;
            o.width = typeof w === 'number' ? `${w}px` : String(w);
            o.tableLayout = 'fixed';
            return o;
        },
        /** Сортировка по заголовкам включена, если в YAML не указано sort: false */
        headerSortEnabled() {
            return !(this.widgetConfig && this.widgetConfig.sort === false);
        },
        /**
         * Минимальное число строк из `row` в YAML (целое ≥ 1). Нет параметра или невалидно → 0.
         */
        tableMinRowCount() {
            const r = this.widgetConfig && this.widgetConfig.row;
            if (r == null || r === '') return 0;
            const n = typeof r === 'number' ? r : parseInt(String(r).trim(), 10);
            if (!Number.isFinite(n) || n < 1) return 0;
            return Math.floor(n);
        },
        contextMenuItems() {
            const CM = tableEngine.ContextMenu;
            const build = CM && CM.buildMenuItems;
            if (!build || !this.contextMenuOpen || !this.contextMenuTarget || !this.contextMenuContext) {
                return [];
            }
            const G = tableEngine.Grouping;
            const n = this.tableColumns.length;
            const glen = this.groupingState.levels.length;
            const canAdd =
                G && typeof G.canAddGroupingLevel === 'function'
                    ? G.canAddGroupingLevel(n, glen)
                    : false;
            return build({
                target: this.contextMenuTarget,
                snapshot: this.contextMenuContext,
                isApple: CM.isApplePlatform && CM.isApplePlatform(),
                tableDataLength: this.tableData.length,
                numCols: this.tableColumns.length,
                headerSortEnabled: this.headerSortEnabled,
                isEditable: this.isEditable,
                isEditingCell: !!this.editingCell,
                groupingActive: this.groupingActive,
                tableUiLocked: this.tableUiLocked,
                isFullyLoaded: this.isFullyLoaded,
                groupingLevelsLen: glen,
                groupingCanAddLevel: canAdd,
                stickyHeaderEnabled: this.stickyHeaderEnabled,
                wordWrapEnabled: this.wordWrapEnabled,
                headerColumn:
                    this.contextMenuTarget &&
                    this.contextMenuTarget.kind === 'header'
                        ? this.tableColumns[this.contextMenuTarget.col] || null
                        : null
            });
        },
        groupingActive() {
            return this.groupingState.levels.length > 0;
        },
        displayRows() {
            if (!this.groupingActive) return [];
            const c = this.groupingViewCache;
            return c && Array.isArray(c.displayRows) ? c.displayRows : [];
        },
        tableLazyUiActive() {
            return this.lazyEnabled && !this.isFullyLoaded && !this.groupingActive;
        },
        /** Липкий thead при вертикальном скролле области контента (YAML: sticky_header: true). */
        stickyHeaderEnabled() {
            return !!this.stickyHeaderRuntimeEnabled;
        },
        wordWrapEnabled() {
            return !!this.wordWrapRuntimeEnabled;
        },
        /** Индекс первичного столбца сортировки для UI стрелок (v1). */
        sortColumnIndex() {
            const k = this.sortKeys[0];
            return k ? k.col : null;
        },
        sortDirection() {
            const k = this.sortKeys[0];
            return k && k.dir === 'desc' ? 'desc' : 'asc';
        }
    },
    watch: {
        widgetName() {
            this.initializeTable();
        },

        widgetConfig() {
            this.initializeTable();
        },

        tableLazyUiActive(val) {
            this.$nextTick(() => {
                if (val) this._setupLazyObserver();
                else this._teardownLazyObserver();
            });
        },

        stickyHeaderEnabled(val) {
            this.$nextTick(() => {
                this._unbindStickyThead();
                if (val) this._bindStickyThead();
            });
        }
    },
    methods: Object.assign(
        {},
        tableEngine.SelectionMethods || {},
        {
        getAllAttrsMap() {
            if (typeof this.getAllAttrsMapFromRuntime === 'function') {
                const attrs = this.getAllAttrsMapFromRuntime();
                if (attrs && typeof attrs === 'object') {
                    return attrs;
                }
            }
            return {};
        },

        isLineNumberColumn(column) {
            const U = tableEngine.Utils;
            return !!(
                U &&
                typeof U.isLineNumberColumn === 'function' &&
                U.isLineNumberColumn(column)
            );
        },

        lineNumberColumnIndex() {
            const U = tableEngine.Utils;
            return U && typeof U.getLineNumberColumnIndex === 'function'
                ? U.getLineNumberColumnIndex(this.tableColumns)
                : -1;
        },

        canMutateColumnIndex(colIndex) {
            const column = this.tableColumns[colIndex];
            if (!column) return false;
            if (!this.isEditable) return false;
            if (this.isLineNumberColumn(column)) return false;
            const attrCfg = this.getColumnAttrConfig(column);
            if (column.readonly === true || attrCfg.readonly === true) return false;
            return true;
        },

        cellAllowsEditing(rowIndex, colIndex) {
            void rowIndex;
            return this.canMutateColumnIndex(colIndex);
        },

        cellUsesNativeInput(column) {
            if (!column) return false;
            return (
                !this.isLineNumberColumn(column) &&
                !this.getColumnAttrConfig(column).readonly &&
                !column.readonly &&
                !this.cellUsesEmbeddedWidget(column)
            );
        },

        columnWidgetComponentByType(type) {
            const key = String(type || '').trim();
            if (key === 'str') return this.stringCellWidget;
            if (key === 'int') return this.intCellWidget;
            if (key === 'float') return this.floatCellWidget;
            if (key === 'date') return this.dateCellWidget;
            if (key === 'time') return this.timeCellWidget;
            if (key === 'datetime') return this.datetimeCellWidget;
            if (key === 'list') return this.listCellWidget;
            if (key === 'voc') return this.vocCellWidget;
            if (key === 'ip') return this.ipCellWidget;
            if (key === 'ip_mask') return this.ipMaskCellWidget;
            return null;
        },

        cellWidgetComponent(column) {
            return this.columnWidgetComponentByType(column && column.type);
        },

        cellUsesEmbeddedWidget(column) {
            return !!(column && this.cellWidgetComponent(column));
        },

        cellDisplayActions(column) {
            return getCellDisplayActions(column);
        },

        cellDisplayKind(column) {
            if (!column) return '';
            const type = String(column.type || '').trim();
            if (
                type === 'ip' ||
                type === 'ip_mask' ||
                type === 'list' ||
                type === 'voc' ||
                type === 'date' ||
                type === 'time' ||
                type === 'datetime'
            ) {
                return type === 'voc' ? 'list' : type;
            }
            return '';
        },

        cellDisplayClass(column) {
            return getCellDisplayClass(column);
        },

        cellDisplayTextClass(column) {
            return getCellDisplayTextClass(column);
        },

        cellDisplayTextStyle(column) {
            return getCellDisplayTextStyle(column);
        },

        cellDisplayActionsClass(column) {
            return getCellDisplayActionsClass(column);
        },

        cellDisplayActionClass(action) {
            return getCellDisplayActionClass(action);
        },

        resolveTableLazyEnabled(rowCount) {
            const G = tableEngine.Grouping;
            const threshold = G && G.TABLE_LAZY_THRESHOLD ? G.TABLE_LAZY_THRESHOLD : 100;
            return selectResolveTableLazyEnabled(this.widgetConfig, rowCount, threshold);
        },

        defaultCellValueFromColumn(column) {
            const tableCellOptions =
                column && column.tableCellOptions && typeof column.tableCellOptions === 'object'
                    ? column.tableCellOptions
                    : {};
            return selectDefaultCellValueFromColumn(column, {
                isLineNumberColumn: (item) => this.isLineNumberColumn(item),
                isListColumnMultiselect: this.listColumnIsMultiselect(column),
                now: new Date(),
                tableCellOptions
            });
        },

        defaultCellValueForColumn(colIndex) {
            return selectDefaultCellValueForColumn(this.tableColumns, colIndex, {
                isLineNumberColumn: (column) => this.isLineNumberColumn(column),
                isListColumnMultiselect: this.listColumnIsMultiselect(this.tableColumns[colIndex]),
                now: new Date(),
                tableCellOptions:
                    this.tableColumns[colIndex] && this.tableColumns[colIndex].tableCellOptions
                        ? this.tableColumns[colIndex].tableCellOptions
                        : {}
            });
        },

        blankCellValueForColumn(colIndex) {
            return selectBlankCellValueForColumn(this.tableColumns, colIndex, {
                isListColumnMultiselect: this.listColumnIsMultiselect(this.tableColumns[colIndex])
            });
        },

        normalizeExternalRowsOrWarn(rows) {
            const U = tableEngine.Utils;
            const validate = U && U.validateExternalTableRows;
            const normalizeRows = U && U.normalizeTableRows;
            if (!normalizeRows) return [];
            const check =
                typeof validate === 'function'
                    ? validate(rows, this.tableColumns)
                    : { ok: true };
            if (!check.ok) {
                this.showTableError(
                    'setValue() и source таблицы принимают только внешний формат без колонки №.'
                );
                return null;
            }
            const normalized = normalizeRows(rows, this.tableColumns, {
                inputMode: 'external'
            });
            const lineNumberCol = this.lineNumberColumnIndex();
            if (lineNumberCol >= 0) {
                for (let i = 0; i < normalized.length; i++) {
                    normalized[i].cells[lineNumberCol] = i + 1;
                }
            }
            return normalized;
        },

        initializeTable() {
            this.headerRows = [];
            this.tableSchema = null;
            this.tableColumns = [];
            this.tableData = [];
            this.cellValidationErrors = {};
            this.contextMenuOpen = false;
            this.contextMenuContext = null;
            this.contextMenuTarget = null;
            this.selectedRowIndex = -1;
            this.selAnchor = { r: 0, c: 0 };
            this.selFocus = { r: 0, c: 0 };
            this.selFullWidthRows = null;
            this._shiftAnchorLocked = false;
            this._tableFocusWithin = false;
            this.sortKeys = [];
            this._sortCycleRowOrder = null;
            this._tableContextMenuMouseDown = false;
            this.exitCellEdit();
            this._teardownLazyObserver();
            this.lazySessionId = (this.lazySessionId || 0) + 1;
            this.isLoadingChunk = false;
            this.tableUiLocked = false;
            this.lazyEnabled = false;
            this._lazyPendingRows = [];
            this.stickyHeaderRuntimeEnabled = !!(this.widgetConfig && this.widgetConfig.sticky_header === true);
            this.wordWrapRuntimeEnabled = false;
            this.groupingState = { levels: [], expanded: new Set() };
            this.groupingViewCache = null;

            // Инициализация нового формата таблицы
            this.parseTableAttrs(this.widgetConfig.table_attrs);

            const U = tableEngine.Utils;
            const clone =
                (U && U.cloneTableData) ||
                ((v) => (Array.isArray(v) ? v.map((row) => (Array.isArray(row) ? row.slice() : [])) : []));
            const normalizeRows = U && U.normalizeTableRows;
            let incoming = [];
            if (Array.isArray(this.widgetConfig.value)) {
                incoming = clone(this.widgetConfig.value);
            } else if (this.widgetConfig.source && typeof this.widgetConfig.source === 'object' && Array.isArray(this.widgetConfig.source)) {
                incoming = clone(this.widgetConfig.source);
            } else if (this.widgetConfig.data) {
                incoming = clone(this.widgetConfig.data);
            }

            const cols = this.tableColumns.length;
            const G = tableEngine.Grouping;
            const lazyTh = G && G.TABLE_LAZY_THRESHOLD ? G.TABLE_LAZY_THRESHOLD : 100;
            let normalized = [];

            if (cols > 0 && normalizeRows) {
                normalized = this.normalizeExternalRowsOrWarn(incoming) || [];
                this.lazyEnabled = this.resolveTableLazyEnabled(normalized.length);
                if (this.lazyEnabled && normalized.length > lazyTh) {
                    this._lazyPendingRows = normalized.slice(lazyTh);
                    normalized = normalized.slice(0, lazyTh);
                    this.isFullyLoaded = false;
                } else {
                    this._lazyPendingRows = [];
                    this.isFullyLoaded = true;
                }
                if (normalized.length === 0 && this.isEditable) {
                    this.tableData = [this.makeEmptyRow()];
                } else {
                    this.tableData = normalized;
                }
            } else {
                this.tableData = [];
                this._lazyPendingRows = [];
                this.isFullyLoaded = true;
            }

            this.ensureMinTableRows();
            this.onInput();
            this.$nextTick(() => {
                this._setupLazyObserver();
                this._unbindStickyThead();
                if (this.stickyHeaderEnabled) this._bindStickyThead();
            });
        },

        /** Пустая строка с учётом типов колонок (list multiselect → []). */
        makeEmptyRow() {
            const cols = this.tableColumns.length;
            const U = tableEngine.Utils;
            const gen = U && U.generateTableRowId;
            if (cols === 0) return { id: gen ? gen() : 'tr_0', cells: [] };
            const cells = [];
            for (let c = 0; c < cols; c++) {
                cells.push(this.defaultCellValueForColumn(c));
            }
            const lineNumberIndex = this.lineNumberColumnIndex();
            if (lineNumberIndex >= 0) {
                const nextLine = U && U.nextLineNumber ? U.nextLineNumber(this.tableData, this.tableColumns) : this.tableData.length + 1;
                cells[lineNumberIndex] = nextLine;
            }
            return { id: gen ? gen() : 'tr_0', cells };
        },

        /** Дополняет tableData пустыми строками до `widgetConfig.row` (только при загрузке / setValue; после удалений пользователем не вызывается). */
        ensureMinTableRows() {
            const minR = this.tableMinRowCount;
            if (minR === 0) return;
            const cols = this.tableColumns.length;
            if (cols === 0) return;
            while (this.tableData.length < minR) {
                this.tableData.push(this.makeEmptyRow());
            }
        },

        leafColStyle(column) {
            if (!column || !column.width) return {};
            return {
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width
            };
        },

        headerThStyle(cell) {
            if (!cell || !cell.width) return {};
            return {
                width: cell.width,
                minWidth: cell.width
            };
        },

        groupRowStyle(displayRow) {
            const depth = displayRow && Number.isFinite(displayRow.depth) ? displayRow.depth : 0;
            return {
                '--widget-table-group-depth': depth
            };
        },

        isLeafHeaderRow(rIdx) {
            return rIdx === this.headerRows.length - 1;
        },

        showSortInHeaderCell(rIdx, cell) {
            void rIdx;
            return (
                this.headerSortEnabled &&
                cell &&
                cell.colspan === 1 &&
                cell.runtimeColIndex != null
            );
        },

        thAriaSort(rIdx, cIdx, cell) {
            void cIdx;
            if (!this.showSortInHeaderCell(rIdx, cell)) return undefined;
            if (this.sortColumnIndex !== cell.runtimeColIndex) return undefined;
            return this.sortDirection === 'asc' ? 'ascending' : 'descending';
        },

        sortControlClass(colIdx) {
            return {
                'widget-table__sort-icons--active': this.sortColumnIndex === colIdx,
                'widget-table__sort-icons--asc':
                    this.sortColumnIndex === colIdx && this.sortDirection === 'asc',
                'widget-table__sort-icons--desc':
                    this.sortColumnIndex === colIdx && this.sortDirection === 'desc'
            };
        },

        sortAriaLabel(colIdx) {
            const col = this.tableColumns[colIdx];
            const name = col && col.label ? String(col.label) : String(colIdx + 1);
            if (this.sortColumnIndex !== colIdx) {
                return `Сортировать по столбцу «${name}». Шаги: по возрастанию, по убыванию, сброс.`;
            }
            if (this.sortDirection === 'asc') {
                return `Столбец «${name}»: по возрастанию. Следующий шаг — по убыванию.`;
            }
            return `Столбец «${name}»: по убыванию. Следующий шаг — сброс сортировки.`;
        },

        sortTableDataInPlace() {
            const S = tableEngine.Sort;
            if (!S || typeof S.compareRowsComposite !== 'function' || !this.sortKeys.length) {
                return;
            }
            const listMulti = (column) => this.listColumnIsMultiselect(column);
            const sorted = [...this.tableData].sort((rowA, rowB) =>
                S.compareRowsComposite(rowA, rowB, this.sortKeys, this.tableColumns, listMulti)
            );
            this.tableData.splice(0, this.tableData.length, ...sorted);
        },

        applyColumnSort(colIdx, direction) {
            this.sortKeys = [{ col: colIdx, dir: direction === 'desc' ? 'desc' : 'asc' }];
            this.sortTableDataInPlace();
        },

        restoreSortCycleRowOrder() {
            const snap = this._sortCycleRowOrder;
            this._sortCycleRowOrder = null;
            if (!snap || snap.length !== this.tableData.length) return;
            const cur = new Set(this.tableData);
            for (let i = 0; i < snap.length; i++) {
                if (!cur.has(snap[i])) return;
            }
            this.tableData.splice(0, this.tableData.length, ...snap.slice());
        },

        normRow(r) {
            const U = tableEngine.Utils;
            const clamp = U && U.clamp;
            const c = clamp || ((v, lo, hi) => Math.max(lo, Math.min(hi, v)));
            const len = this.groupingActive ? this.displayRows.length : this.tableData.length;
            const max = Math.max(0, len - 1);
            return c(r, 0, max);
        },

        tbodyRowCount() {
            return this.groupingActive ? this.displayRows.length : this.tableData.length;
        },

        resolveDataRowIndex(viewRow) {
            if (!this.groupingActive) return this.normRow(viewRow);
            const dr = this.displayRows[viewRow];
            if (!dr || dr.kind !== 'data') return -1;
            return dr.dataIndex;
        },

        dataRowByDisplayIndex(viewRow) {
            const di = this.resolveDataRowIndex(viewRow);
            if (di < 0) return null;
            return this.tableData[di];
        },

        groupExpanded(pathKey) {
            return this.groupingState.expanded.has(pathKey);
        },

        toggleGroupExpand(pathKey) {
            const next = new Set(this.groupingState.expanded);
            if (next.has(pathKey)) next.delete(pathKey);
            else next.add(pathKey);
            this.groupingState = Object.assign({}, this.groupingState, { expanded: next });
            this.refreshGroupingViewFromData();
        },

        /**
         * Пересобирает кэш дерева группировки из текущего tableData (и prune expanded).
         * Не вызывать при каждом вводе в ячейку — только сортировка, чанки, смена уровней, expand/collapse.
         */
        refreshGroupingViewFromData() {
            if (!this.groupingActive || !this.isFullyLoaded) {
                this.groupingViewCache = null;
                this.$nextTick(() => this._scheduleStickyTheadUpdate());
                return;
            }
            const G = tableEngine.Grouping;
            if (!G || typeof G.buildDisplayRows !== 'function' || typeof G.pruneExpanded !== 'function') {
                return;
            }
            let expanded = this.groupingState.expanded;
            let r = G.buildDisplayRows(
                this.tableData,
                this.groupingState.levels,
                expanded,
                this.tableColumns
            );
            const pruned = G.pruneExpanded(expanded, r.validPathKeys);
            if (pruned.size !== expanded.size || [...expanded].some((k) => !pruned.has(k))) {
                expanded = pruned;
                this.groupingState = Object.assign({}, this.groupingState, { expanded });
                r = G.buildDisplayRows(
                    this.tableData,
                    this.groupingState.levels,
                    expanded,
                    this.tableColumns
                );
            }
            this.groupingViewCache = { displayRows: r.displayRows, validPathKeys: r.validPathKeys };
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
        },

        /**
         * Единая точка мутации tableData: сортировка по sortKeys, кэш группировки, emit.
         */
        applyTableMutation(mutator, options) {
            const o = options || {};
            if (this.tableUiLocked && !o.force) return;
            mutator();
            if (!o.skipSort && this.sortKeys.length) {
                this.sortTableDataInPlace();
            }
            const skipGrp = o.skipGroupingViewRefresh === true || o.skipGroupingSync === true;
            if (!skipGrp && this.groupingActive && this.isFullyLoaded) {
                this.refreshGroupingViewFromData();
            }
            if (!o.skipEmit) this.onInput();
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
        },

        showTableError(message, options = {}) {
            const normalizedMessage = String(message || 'Ошибка таблицы').trim() || 'Ошибка таблицы';
            const sourceError = options && options.cause ? options.cause : new Error(normalizedMessage);

            if (typeof this.handleRecoverableAppErrorFromRuntime === 'function') {
                this.handleRecoverableAppErrorFromRuntime(sourceError, {
                    scope: FRONTEND_ERROR_SCOPES.table,
                    message: normalizedMessage,
                    details: options && options.details ? options.details : null
                });
                return;
            }

            if (typeof this.showAppNotificationFromRuntime === 'function') {
                this.showAppNotificationFromRuntime(normalizedMessage, 'danger');
                return;
            }

            const root = this.$root;
            if (root && typeof root.showNotification === 'function') {
                root.showNotification(normalizedMessage, 'danger');
            }
        },

        _lazyChunkSize() {
            const G = tableEngine.Grouping;
            const def = G && G.TABLE_LAZY_THRESHOLD ? G.TABLE_LAZY_THRESHOLD : 100;
            const n = this.widgetConfig && this.widgetConfig.lazy_chunk_size;
            const parsed = typeof n === 'number' ? n : parseInt(String(n || ''), 10);
            if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
            return def;
        },

        _teardownLazyObserver() {
            if (this._lazyDebounceTimer) {
                clearTimeout(this._lazyDebounceTimer);
                this._lazyDebounceTimer = null;
            }
            if (this._lazyObserver) {
                try {
                    this._lazyObserver.disconnect();
                } catch (e) {}
                this._lazyObserver = null;
            }
        },

        _setupLazyObserver() {
            this._teardownLazyObserver();
            if (!this.tableLazyUiActive || typeof IntersectionObserver === 'undefined') return;
            const root = this.$refs.tableRoot;
            if (!root) return;
            const opts = { root: null, rootMargin: '80px', threshold: 0 };
            this._lazyObserver = new IntersectionObserver((entries) => {
                const hit = entries.some((e) => e.isIntersecting);
                if (!hit || this.isFullyLoaded || this.isLoadingChunk || this.groupingActive) return;
                if (this._lazyDebounceTimer) clearTimeout(this._lazyDebounceTimer);
                this._lazyDebounceTimer = setTimeout(() => {
                    this._lazyDebounceTimer = null;
                    this._requestLazyChunk();
                }, 160);
            }, opts);
            const row = this.$refs.lazySentinelRow;
            if (row) this._lazyObserver.observe(row);
        },

        _appendRowsDedup(rows) {
            const U = tableEngine.Utils;
            if (!U || typeof U.normalizeRowToDataRow !== 'function') return;
            const cols = this.tableColumns.length;
            const seen = new Set(this.tableData.map((x) => String(x.id)));
            for (let i = 0; i < rows.length; i++) {
                const norm = U.normalizeRowToDataRow(rows[i], this.tableColumns, {
                    inputMode: 'runtime'
                });
                if (!norm) continue;
                const id = String(norm.id);
                if (seen.has(id)) {
                    if (tableEngine.DEBUG) {
                        console.warn('[TableWidget] duplicate row id on merge', id);
                    }
                    continue;
                }
                seen.add(id);
                this.tableData.push(norm);
            }
        },

        _requestLazyChunk() {
            if (this.tableUiLocked || !this.tableLazyUiActive || this.isLoadingChunk) return;
            const pending = this._lazyPendingRows;
            if (!pending || !pending.length) {
                this.isFullyLoaded = true;
                this._teardownLazyObserver();
                return;
            }
            this.isLoadingChunk = true;
            const sid = this.lazySessionId;
            const chunk = pending.splice(0, this._lazyChunkSize());
            try {
                this.applyTableMutation(
                    () => {
                        this._appendRowsDedup(chunk);
                    },
                    { skipSort: false, skipEmit: true, force: true }
                );
            } finally {
                this.isLoadingChunk = false;
            }
            if (sid !== this.lazySessionId) return;
            if (!pending.length) {
                this.isFullyLoaded = true;
                this._teardownLazyObserver();
            }
            this.onInput();
            this.$nextTick(() => this._setupLazyObserver());
        },

        /** Синхронная полная дозагрузка для группировки (v1: из _lazyPendingRows). */
        flushLazyFullLoadInternal() {
            if (this.isFullyLoaded) return true;
            if (this.widgetConfig && this.widgetConfig.lazy_fail_full_load === true) {
                return false;
            }
            const rest = this._lazyPendingRows.slice();
            this.applyTableMutation(
                () => {
                    this._lazyPendingRows = [];
                    this._appendRowsDedup(rest);
                },
                { skipSort: false, skipEmit: true, force: true }
            );
            this.isFullyLoaded = true;
            this._teardownLazyObserver();
            return true;
        },

        clearSelectedCells() {
            if (this.groupingActive || this.tableUiLocked) return;
            const SM = tableEngine.SelectionMethods;
            const fn = SM && SM.clearSelectedCells;
            if (typeof fn === 'function') fn.call(this);
        },

        onHeaderSortClick(colIdx, event) {
            if (!this.headerSortEnabled || this.tableUiLocked) return;
            if (colIdx < 0 || colIdx >= this.tableColumns.length) return;
            const S = tableEngine.Sort;
            if (!S || typeof S.compareRowsComposite !== 'function') return;
            const ev = event || {};
            const shift = !!ev.shiftKey;

            if (shift) {
                const i = this.sortKeys.findIndex((k) => k.col === colIdx);
                if (i >= 0) {
                    const cur = this.sortKeys[i];
                    const nextDir = cur.dir === 'asc' ? 'desc' : 'asc';
                    this.sortKeys = this.sortKeys.map((k, j) =>
                        j === i ? { col: cur.col, dir: nextDir } : k
                    );
                } else {
                    this.sortKeys = this.sortKeys.concat([{ col: colIdx, dir: 'asc' }]);
                }
                this.sortTableDataInPlace();
                this.refreshGroupingViewFromData();
                tableEngine.log('sort multi', colIdx, this.sortKeys);
                this.onInput();
                return;
            }

            const one = this.sortKeys.length === 1 && this.sortKeys[0].col === colIdx ? this.sortKeys[0] : null;
            if (one) {
                if (one.dir === 'asc') {
                    this.sortKeys = [{ col: colIdx, dir: 'desc' }];
                    this.sortTableDataInPlace();
                    this.refreshGroupingViewFromData();
                    tableEngine.log(
                        'sort',
                        colIdx,
                        'desc',
                        this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
                    );
                    this.onInput();
                    return;
                }
                this.sortKeys = [];
                this.restoreSortCycleRowOrder();
                this.refreshGroupingViewFromData();
                tableEngine.log(
                    'sort reset',
                    colIdx,
                    this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
                );
                this.onInput();
                return;
            }

            this._sortCycleRowOrder = this.tableData.slice();
            this.sortKeys = [{ col: colIdx, dir: 'asc' }];
            this.sortTableDataInPlace();
            this.refreshGroupingViewFromData();
            tableEngine.log(
                'sort',
                colIdx,
                'asc',
                this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
            );
            this.onInput();
        },

        getTableEl() {
            const r = this.$refs.tableRoot;
            if (r && r.nodeType === 1) return r;
            return this.$el && this.$el.querySelector('.widget-table');
        },

        /**
         * Пиксели к автоширине листового th при включённой сортировке:
         * две стрелки 10px + gap (--space-xs) + небольшой запас (см. .widget-table__sort-icons).
         */
        headerSortAffordancePx() {
            const M = tableEngine.WidgetMeasure;
            return M && M.headerSortAffordancePx
                ? M.headerSortAffordancePx(this.widgetConfig)
                : this.widgetConfig && this.widgetConfig.sort === false
                  ? 0
                  : 26;
        },

        computeAutoWidth(label) {
            const M = tableEngine.WidgetMeasure;
            if (M && M.computeAutoWidth) {
                return M.computeAutoWidth(
                    label,
                    this.headerSortAffordancePx(),
                    this.getTableEl()
                );
            }
            const sortExtra = this.headerSortAffordancePx();
            return `${Math.min(
                500,
                String(label || '').length * 10 + 24 + sortExtra
            )}px`;
        },
        /**
         * Безопасно получить значение ячейки с учётом длины строки
         */
        safeCell(row, cellIndex) {
            const U = tableEngine.Utils;
            if (U && U.safeCellValue) return U.safeCellValue(row, cellIndex);
            if (!Array.isArray(row)) return '';
            return row[cellIndex] ?? '';
        },

        /** Форматирование для отображения/применения — логика в table_format.js */
        formatCellValue(value, column) {
            const F = tableEngine.Format;
            const fmt = F && F.formatCellValue;
            if (fmt) return fmt(value, column);
            return value === null || value === undefined ? '' : String(value);
        },

        onInput() {
            const U = tableEngine.Utils;
            const strip = U && U.stripTableDataForEmit;
            this.$emit('input', {
                name: this.widgetName,
                value: strip ? strip(this.tableData, this.tableColumns) : this.tableData,
                config: this.widgetConfig
            });
        },

        setValue(value) {
            const U = tableEngine.Utils;
            const clone = U && U.cloneTableData;
            const incoming = Array.isArray(value)
                ? clone
                    ? clone(value)
                    : value.map((row) => (Array.isArray(row) ? row.slice() : []))
                : [];
            const cols = this.tableColumns.length;
            const G = tableEngine.Grouping;
            const lazyTh = G && G.TABLE_LAZY_THRESHOLD ? G.TABLE_LAZY_THRESHOLD : 100;
            let normalized = null;
            if (cols > 0) {
                normalized = this.normalizeExternalRowsOrWarn(incoming);
                if (normalized == null) return;
            }
            this.sortKeys = [];
            this._sortCycleRowOrder = null;
            this.groupingState = { levels: [], expanded: new Set() };
            this.groupingViewCache = null;
            this.cellValidationErrors = {};
            this.lazySessionId = (this.lazySessionId || 0) + 1;
            this._lazyPendingRows = [];
            this.isFullyLoaded = true;
            this._teardownLazyObserver();
            if (cols > 0) {
                this.lazyEnabled = this.resolveTableLazyEnabled(normalized.length);
                if (this.lazyEnabled && normalized.length > lazyTh) {
                    this._lazyPendingRows = normalized.slice(lazyTh);
                    normalized = normalized.slice(0, lazyTh);
                    this.isFullyLoaded = false;
                } else {
                    this._lazyPendingRows = [];
                    this.isFullyLoaded = true;
                }
                this.tableData = normalized;
            } else {
                this.lazyEnabled = false;
                this.tableData = [];
            }
            this.ensureMinTableRows();
            this.onInput();
        },

        getValue() {
            const U = tableEngine.Utils;
            return U && U.stripTableDataForEmit
                ? U.stripTableDataForEmit(this.tableData, this.tableColumns)
                : this.tableData;
        },

        getColumnAttrConfig(column) {
            return selectColumnAttrConfig(this.getAllAttrsMap(), column);
        },

        getColumnTableCellOptions(column) {
            const C = tableEngine.TableSchema;
            const sanitize = C && C.sanitizeTableCellOptions;
            return selectColumnTableCellOptions(
                this.getAllAttrsMap(),
                column,
                sanitize
            );
        },

        normalizeCellWidgetValue(column, currentVal) {
            return selectNormalizeCellWidgetValue(
                column,
                currentVal,
                this.listColumnIsMultiselect(column)
            );
        },

        tableCellConsumeKeys(column) {
            return selectTableCellConsumeKeys(column);
        },

        cellWidgetConfig(rowIndex, cellIndex, column) {
            const di = this.resolveDataRowIndex(rowIndex);
            const src = di >= 0 ? this.tableData[di] : null;
            const currentVal = this.safeCell(src || [], cellIndex);
            const attrCfg = this.getColumnAttrConfig(column);
            const options = Object.assign(
                {},
                this.getColumnTableCellOptions(column)
            );
            const isEditing = this.isCellEditing(rowIndex, cellIndex);
            const val = this.normalizeCellWidgetValue(column, currentVal);
            const isMulti = this.listColumnIsMultiselect(column);
            const readonly = !this.cellAllowsEditing(rowIndex, cellIndex) || !isEditing;
            const config = {
                ...options,
                widget: column.type,
                value: val,
                default: undefined,
                label:
                    attrCfg && attrCfg.label !== undefined
                        ? attrCfg.label
                        : String(column && column.label ? column.label : ''),
                sup_text: '',
                table_cell_mode: true,
                table_consume_keys: this.tableCellConsumeKeys(column),
                table_cell_validation_handler: (message) =>
                    this.onCellWidgetValidation(rowIndex, cellIndex, message),
                table_cell_tab_handler: (shiftKey) =>
                    this.navigateTableByTabFromCell(rowIndex, cellIndex, !!shiftKey),
                table_cell_ui_lock_handler: (locked) => {
                    this.tableUiLocked = !!locked;
                },
                readonly
            };
            if (column && column.type === 'list') {
                config.source = this.getListOptions(
                    column && column.source ? column.source : column && column.widgetRef
                );
                if ((!config.source || !config.source.length) && Array.isArray(options.source)) {
                    config.source = options.source.slice();
                }
                config.multiselect = isMulti;
                if (attrCfg && attrCfg.editable !== undefined) {
                    config.editable = attrCfg.editable;
                }
            } else if (column && column.type === 'voc') {
                config.source =
                    attrCfg && Object.prototype.hasOwnProperty.call(attrCfg, 'source')
                        ? attrCfg.source
                        : options.source;
                config.columns =
                    attrCfg && Array.isArray(attrCfg.columns)
                        ? attrCfg.columns.slice()
                        : Array.isArray(options.columns)
                          ? options.columns.slice()
                          : [];
                config.multiselect = isMulti;
                if (attrCfg && attrCfg.placeholder !== undefined) {
                    config.placeholder = attrCfg.placeholder;
                }
            }
            return config;
        },
        cellWidgetName(rowIndex, cellIndex) {
            const di = this.resolveDataRowIndex(rowIndex);
            const key = di >= 0 ? di : 'v' + rowIndex;
            return `cell_${key}_${cellIndex}`;
        },
        cellWidgetRefName(rowIndex, cellIndex) {
            const di = this.resolveDataRowIndex(rowIndex);
            const key = di >= 0 ? di : 'v' + rowIndex;
            return `cell_widget_${key}_${cellIndex}`;
        },
        cellValidationKeyByDataIndex(dataIndex, colIndex) {
            if (dataIndex == null || dataIndex < 0) return '';
            const row = this.tableData[dataIndex];
            if (!row || row.id == null) return '';
            return `${String(row.id)}::${this.normCol(colIndex)}`;
        },
        setCellValidationError(rowIndex, colIndex, message) {
            const di = this.resolveDataRowIndex(rowIndex);
            const key = this.cellValidationKeyByDataIndex(di, colIndex);
            if (!key) return;
            const next = Object.assign({}, this.cellValidationErrors);
            const errorMessage = String(message || '').trim();
            if (errorMessage) next[key] = errorMessage;
            else delete next[key];
            this.cellValidationErrors = next;
        },
        onCellWidgetValidation(rowIndex, cellIndex, message) {
            this.setCellValidationError(rowIndex, cellIndex, message);
        },
        cellHasCommitError(rowIndex, colIndex) {
            const di = this.resolveDataRowIndex(rowIndex);
            const key = this.cellValidationKeyByDataIndex(di, colIndex);
            return !!(key && this.cellValidationErrors[key]);
        },
        onCellWidgetPayload(rowIndex, cellIndex, payload) {
            if (!payload || typeof payload.value === 'undefined') return;
            if (!this.canMutateColumnIndex(cellIndex)) return;
            const di = this.resolveDataRowIndex(rowIndex);
            if (di < 0) return;
            const U = tableEngine.Utils;
            const rowObj = this.tableData[di];
            this.applyTableMutation(
                () => {
                    const nextRow =
                        U && typeof U.replaceRowCellValue === 'function'
                            ? U.replaceRowCellValue(rowObj, cellIndex, payload.value)
                            : { id: rowObj.id, cells: [...(U && U.getRowCells ? U.getRowCells(rowObj) : [])] };
                    if (!(U && typeof U.replaceRowCellValue === 'function')) {
                        nextRow.cells[cellIndex] = payload.value;
                    }
                    this.tableData.splice(di, 1, nextRow);
                },
                { skipSort: true, skipGroupingViewRefresh: true }
            );
            tableEngine.log('cell widget input', di, cellIndex);
        },

        getListOptions(sourceName) {
            if (!sourceName) return [];
            try {
                const attrs = this.getAllAttrsMap();
                return getListOptions(attrs, sourceName);
            } catch (e) {}
            return [];
        },

        onCellInput(rowIndex, cellIndex, event) {
            if (!this.canMutateColumnIndex(cellIndex)) return;
            const newValue = event.target ? event.target.value : event;
            const di = this.resolveDataRowIndex(rowIndex);
            if (di < 0) return;
            const U = tableEngine.Utils;
            const rowObj = this.tableData[di];
            const cells = [...(U && U.getRowCells ? U.getRowCells(rowObj) : [])];
            cells[cellIndex] = newValue;
            this.applyTableMutation(
                () => {
                    this.tableData.splice(di, 1, { id: rowObj.id, cells });
                },
                { skipSort: true, skipGroupingViewRefresh: true }
            );
            tableEngine.log('cell input', di, cellIndex);
        },

        // Специальная обработка IP: только цифры и точки; не более 4 октетов по 3 цифры
        onIpInput(rowIndex, cellIndex, event) {
            if (!this.canMutateColumnIndex(cellIndex)) return;
            const raw = event.target.value || '';
            let filtered = raw.replace(/[^\d.]/g, '');
            const parts = filtered.split('.').slice(0, 4).map(p => p.replace(/\D/g, '').slice(0, 3));
            filtered = parts.join('.');
            const di = this.resolveDataRowIndex(rowIndex);
            if (di < 0) return;
            const U = tableEngine.Utils;
            const rowObj = this.tableData[di];
            const cells = [...(U && U.getRowCells ? U.getRowCells(rowObj) : [])];
            cells[cellIndex] = filtered;
            this.applyTableMutation(
                () => {
                    this.tableData.splice(di, 1, { id: rowObj.id, cells });
                },
                { skipSort: true, skipGroupingViewRefresh: true }
            );
            tableEngine.log('cell ip input', di, cellIndex);
        },

        // Приведение значения ячейки по формату колонки (например #,.3f)
        onCellFormat(rowIndex, cellIndex, column) {
            try {
                if (!column) return;
                if (!column.format && column.type !== 'int' && column.type !== 'float') return;
                const di = this.resolveDataRowIndex(rowIndex);
                if (di < 0) return;
                const rowObj = this.tableData[di];
                const raw = this.safeCell(rowObj, cellIndex);
                if (raw === '') return;
                const formatted = this.formatCellValue(raw, column);
                if (formatted !== raw) {
                    const U = tableEngine.Utils;
                    const cells = [...(U && U.getRowCells ? U.getRowCells(rowObj) : [])];
                    cells[cellIndex] = formatted;
                    this.applyTableMutation(
                        () => {
                            this.tableData.splice(di, 1, { id: rowObj.id, cells });
                        },
                        { skipSort: true, skipGroupingViewRefresh: true }
                    );
                }
            } catch (e) {}
        },

        listColumnIsMultiselect(column) {
            return isListColumnMultiselect(this.getAllAttrsMap(), column);
        },

        onCellInputViewMouseDown(event, row, col) {
            if (!this.isCellEditing(row, col)) event.preventDefault();
        },

        endProgrammaticFocusSoon() {
            this.$nextTick(() => {
                requestAnimationFrame(() => {
                    this._tableProgrammaticFocus = false;
                });
            });
        },
        isCellEditing(r, c) {
            const e = this.editingCell;
            return !!(e && e.r === r && e.c === c);
        },
        exitCellEdit() {
            const e = this.editingCell;
            if (e) {
                const er = e.r;
                const ec = e.c;
                const active = document.activeElement;
                const tableEl = this.getTableEl();
                const td = tableEl
                    ? tableEl.querySelector(`tbody td[data-row="${this.normRow(er)}"][data-col="${this.normCol(ec)}"]`)
                    : null;
                if (
                    active &&
                    td &&
                    active !== td &&
                    td.contains(active) &&
                    typeof active.blur === 'function'
                ) {
                    active.blur();
                }
                const colDef = this.tableColumns[ec];
                this.applyTrimToEditedTextCell(er, ec);
                if (colDef) this.onCellFormat(er, ec, colDef);
            }
            this.editingCell = null;
        },

        /** Обрезка пробелов и переносов только по краям при выходе из правки текстовой/IP-ячейки. */
        applyTrimToEditedTextCell(r, c) {
            const column = this.tableColumns[c];
            if (!column) return;
            if (this.cellUsesEmbeddedWidget(column)) return;
            const el = this.getCellEditorElement(r, c);
            if (!el || el.tagName !== 'INPUT') return;
            const raw = String(el.value ?? '');
            const trimmed = raw.trim();
            if (trimmed === raw) return;
            el.value = trimmed;
            this.patchCellValue(r, c, trimmed);
        },
        patchCellValue(row, col, value) {
            if (this.tableUiLocked) return;
            const r = this.normRow(row);
            const c = this.normCol(col);
            if (!this.canMutateColumnIndex(c)) return;
            const di = this.resolveDataRowIndex(r);
            if (di < 0) return;
            const rowObj = this.tableData[di];
            const U = tableEngine.Utils;
            const cells = [...(U && U.getRowCells ? U.getRowCells(rowObj) : [])];
            cells[c] = value;
            this.applyTableMutation(
                () => {
                    this.tableData.splice(di, 1, { id: rowObj.id, cells });
                },
                { skipSort: true, skipGroupingViewRefresh: true }
            );
        },
        getCellEditorElement(r, c) {
            const tableEl = this.getTableEl();
            if (!tableEl) return null;
            const row = this.normRow(r);
            const col = this.normCol(c);
            const td = tableEl.querySelector(`tbody td[data-row="${row}"][data-col="${col}"]`);
            if (!td) return null;
            return td.querySelector(
                '[data-table-editor-target="true"]:not([disabled]), input.cell-input:not([disabled]), select:not([disabled])'
            );
        },
        getCellEditorActionElement(r, c, kind) {
            const tableEl = this.getTableEl();
            if (!tableEl) return null;
            const row = this.normRow(r);
            const col = this.normCol(c);
            const td = tableEl.querySelector(`tbody td[data-row="${row}"][data-col="${col}"]`);
            if (!td) return null;
            if (!kind) {
                return td.querySelector('[data-table-action-trigger]:not([disabled])');
            }
            return td.querySelector(
                `[data-table-action-trigger="${String(kind)}"]:not([disabled])`
            );
        },
        focusSelectionCell(row, col) {
            this.exitCellEdit();
            const tableEl = this.getTableEl();
            if (!tableEl) return;
            const c = this.normCol(col);
            const r = this.normRow(row);
            const td = tableEl.querySelector(`tbody td[data-row="${r}"][data-col="${c}"]`);
            if (!td || typeof td.focus !== 'function') return;
            this._tableProgrammaticFocus = true;
            td.focus();
            this.endProgrammaticFocusSoon();
        },

        /** Две попытки в соседних $nextTick; иначе no-op и один warn при DEBUG. */
        focusSelectionCellWithRetry(row, col) {
            const r0 = this.normRow(row);
            const c0 = this.normCol(col);
            const attempt = () => {
                this.exitCellEdit();
                const tableEl = this.getTableEl();
                if (!tableEl) return false;
                const td = tableEl.querySelector(
                    `tbody td[data-row="${r0}"][data-col="${c0}"]`
                );
                if (!td || typeof td.focus !== 'function') return false;
                this._tableProgrammaticFocus = true;
                td.focus();
                this.endProgrammaticFocusSoon();
                return true;
            };
            this.$nextTick(() => {
                if (attempt()) return;
                this.$nextTick(() => {
                    if (attempt()) return;
                    const C = tableEngine;
                    if (C && C.DEBUG) {
                        console.warn('[TableWidget] focusSelectionCellWithRetry failed', r0, c0);
                    }
                });
            });
        },

        /**
         * Переместить строку на одну позицию (delta -1 | +1). Одна мутация + onInput.
         * v1 после операции — одиночное выделение (setSelectionSingle сбрасывает full-row).
         */
        moveTableRowRelative(rowIndex, delta, anchorCol) {
            if (this.groupingActive || this.tableUiLocked) return;
            const len = this.tableData.length;
            const r = this.normRow(rowIndex);
            const target = r + delta;
            if (target < 0 || target >= len) return;
            const c = this.normCol(
                anchorCol != null ? anchorCol : this.selFocus.c
            );
            this.applyTableMutation(
                () => {
                    const [row] = this.tableData.splice(r, 1);
                    this.tableData.splice(target, 0, row);
                },
                { skipSort: true }
            );
            this.setSelectionSingle(target, c);
            this.focusSelectionCellWithRetry(target, c);
        },

        /**
         * Дубликат строки выше/ниже относительно rowIndex. Глубокий clone через Utils.cloneTableRowDeep.
         */
        duplicateTableRowRelative(rowIndex, where, anchorCol) {
            if (this.groupingActive || this.tableUiLocked) return;
            const U = tableEngine.Utils;
            const cloneFn = U && U.cloneTableRowDeep;
            if (typeof cloneFn !== 'function') return;
            const r = this.normRow(rowIndex);
            const len = this.tableData.length;
            if (r < 0 || r >= len) return;
            const c = this.normCol(
                anchorCol != null ? anchorCol : this.selFocus.c
            );
            const copy = cloneFn(this.tableData[r], this.tableColumns);
            const U2 = tableEngine.Utils;
            const nextLine =
                U2 && U2.nextLineNumber
                    ? U2.nextLineNumber(this.tableData, this.tableColumns)
                    : this.tableData.length + 1;
            if (U2 && typeof U2.assignRowLineNumber === 'function') {
                Object.assign(copy, U2.assignRowLineNumber(copy, this.tableColumns, nextLine));
            }
            if (where === 'above') {
                this.applyTableMutation(
                    () => {
                        this.tableData.splice(r, 0, copy);
                    },
                    { skipSort: true }
                );
                this.setSelectionSingle(r, c);
                this.focusSelectionCellWithRetry(r, c);
            } else {
                this.applyTableMutation(
                    () => {
                        this.tableData.splice(r + 1, 0, copy);
                    },
                    { skipSort: true }
                );
                this.setSelectionSingle(r + 1, c);
                this.focusSelectionCellWithRetry(r + 1, c);
            }
        },

        moveRowUpFromSnapshot(snapshot) {
            if (snapshot.sessionId !== this.contextMenuSessionId) {
                this.hideContextMenu();
                return;
            }
            const ar = snapshot.anchorRow;
            if (ar <= 0) return;
            this.hideContextMenu();
            this.moveTableRowRelative(ar, -1, snapshot.anchorCol);
        },

        moveRowDownFromSnapshot(snapshot) {
            if (snapshot.sessionId !== this.contextMenuSessionId) {
                this.hideContextMenu();
                return;
            }
            const ar = snapshot.anchorRow;
            if (ar < 0 || ar >= this.tableData.length - 1) return;
            this.hideContextMenu();
            this.moveTableRowRelative(ar, 1, snapshot.anchorCol);
        },

        duplicateRowAboveFromSnapshot(snapshot) {
            if (snapshot.sessionId !== this.contextMenuSessionId) {
                this.hideContextMenu();
                return;
            }
            const ar = snapshot.anchorRow;
            if (ar < 0 || ar >= this.tableData.length) return;
            this.hideContextMenu();
            this.duplicateTableRowRelative(ar, 'above', snapshot.anchorCol);
        },

        duplicateRowBelowFromSnapshot(snapshot) {
            if (snapshot.sessionId !== this.contextMenuSessionId) {
                this.hideContextMenu();
                return;
            }
            const ar = snapshot.anchorRow;
            if (ar < 0 || ar >= this.tableData.length) return;
            this.hideContextMenu();
            this.duplicateTableRowRelative(ar, 'below', snapshot.anchorCol);
        },
        enterCellEditAt(row, col, opts) {
            const o = opts || {};
            const r = this.normRow(row);
            const c = this.normCol(col);
            if (!this.canMutateColumnIndex(c)) {
                this.editingCell = null;
                return;
            }
            this.editingCell = { r, c };
            this._tableProgrammaticFocus = true;
            this.$nextTick(() => {
                const el = this.getCellEditorElement(r, c);
                if (!el || typeof el.focus !== 'function') {
                    this.exitCellEdit();
                    this.endProgrammaticFocusSoon();
                    return;
                }
                el.focus();
                if (el.setSelectionRange) {
                    const len = (el.value != null ? String(el.value) : '').length;
                    if (o.caretEnd === false) {
                        el.setSelectionRange(0, 0);
                    } else {
                        el.setSelectionRange(len, len);
                    }
                }
                this.endProgrammaticFocusSoon();
            });
        },
        onTableCellClick(event, row, col) {
            if (!this.isEditable) return;
            this._shiftAnchorLocked = false;
            if (event.shiftKey) {
                this._shiftSelectGesture = false;
                return;
            }
            if (this._shiftSelectGesture) {
                this._shiftSelectGesture = false;
                return;
            }
            if (event.button !== 0) return;
            const r = this.normRow(row);
            const c = this.normCol(col);
            this.setSelectionSingle(r, c);
            this.exitCellEdit();
            this.$nextTick(() => this.focusSelectionCell(r, c));
        },
        onTableCellDblClick(row, col) {
            if (!this.isEditable) return;
            const r = this.normRow(row);
            const c = this.normCol(col);
            this.setSelectionSingle(r, c);
            if (!this.canMutateColumnIndex(c)) {
                this.$nextTick(() => this.focusSelectionCell(r, c));
                return;
            }
            this.enterCellEditAt(r, c, { caretEnd: true });
        },
        onCellDisplayAction(row, col, actionKind) {
            if (!this.isEditable) return;
            const r = this.normRow(row);
            const c = this.normCol(col);
            this.setSelectionSingle(r, c);
            if (!this.canMutateColumnIndex(c)) {
                this.$nextTick(() => this.focusSelectionCell(r, c));
                return;
            }
            this.enterCellEditAt(r, c, { caretEnd: true });
            this.activateCellEditorAction(r, c, actionKind);
        },
        getCellWidgetInstance(row, col) {
            const name = this.cellWidgetRefName(row, col);
            const ref = this.$refs ? this.$refs[name] : null;
            if (Array.isArray(ref)) return ref[0] || null;
            return ref || null;
        },
        invokeCellWidgetAction(row, col, actionKind) {
            const widget = this.getCellWidgetInstance(row, col);
            if (!widget) return false;
            const kind = String(actionKind || '').trim();
            let methodName = '';
            if (kind === 'list') {
                methodName =
                    typeof widget.onArrowClick === 'function'
                        ? 'onArrowClick'
                        : typeof widget.toggleDropdown === 'function'
                          ? 'toggleDropdown'
                          : '';
            } else if (kind === 'date') {
                methodName =
                    typeof widget.openDatePicker === 'function'
                        ? 'openDatePicker'
                        : typeof widget.openPicker === 'function'
                          ? 'openPicker'
                          : '';
            } else if (kind === 'time') {
                methodName =
                    typeof widget.openTimePicker === 'function'
                        ? 'openTimePicker'
                        : typeof widget.openPicker === 'function'
                          ? 'openPicker'
                          : '';
            }
            if (!methodName || typeof widget[methodName] !== 'function') {
                return false;
            }
            widget[methodName]();
            return true;
        },
        activateCellEditorAction(row, col, actionKind, attempt = 0) {
            const r = this.normRow(row);
            const c = this.normCol(col);
            this.$nextTick(() => {
                if (this.invokeCellWidgetAction(r, c, actionKind)) {
                    return;
                }
                const trigger = this.getCellEditorActionElement(r, c, actionKind);
                if (trigger && typeof trigger.click === 'function') {
                    trigger.click();
                    return;
                }
                if (attempt >= 3) {
                    const input = this.getCellEditorElement(r, c);
                    if (input && typeof input.focus === 'function') {
                        input.focus();
                    }
                    return;
                }
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(() =>
                        this.activateCellEditorAction(r, c, actionKind, attempt + 1)
                    );
                    return;
                }
                this.activateCellEditorAction(r, c, actionKind, attempt + 1);
            });
        },
        navigateTableByTabFromCell(row, col, shiftKey) {
            const lastRow = this.tbodyRowCount() - 1;
            const lastCol = this.tableColumns.length - 1;
            if (lastRow < 0 || lastCol < 0) return false;
            const r = this.normRow(row);
            const c = this.normCol(col);
            let nextRow;
            let nextCol;
            if (shiftKey) {
                if (c > 0) {
                    nextRow = r;
                    nextCol = c - 1;
                } else if (r > 0) {
                    nextRow = r - 1;
                    nextCol = lastCol;
                } else {
                    return false;
                }
            } else if (c < lastCol) {
                nextRow = r;
                nextCol = c + 1;
            } else if (r < lastRow) {
                nextRow = r + 1;
                nextCol = 0;
            } else {
                return false;
            }
            this.exitCellEdit();
            this.setSelectionSingle(nextRow, nextCol);
            this.$nextTick(() => this.focusSelectionCell(nextRow, nextCol));
            return true;
        },
        onNativeCellBlur(row, col) {
            this.$nextTick(() => {
                if (this._tableProgrammaticFocus) return;
                const ae = document.activeElement;
                const td = ae && ae.closest ? ae.closest('tbody td') : null;
                if (td && this.$el.contains(td)) {
                    const tr = parseInt(td.getAttribute('data-row'), 10);
                    const tc = parseInt(td.getAttribute('data-col'), 10);
                    if (tr === row && tc === col) return;
                }
                if (this.isCellEditing(row, col)) this.exitCellEdit();
            });
        },
        onTextCellBlur(row, col, column) {
            this.onNativeCellBlur(row, col);
        },
        isPrintableCellKey(event) {
            if (event.ctrlKey || event.metaKey || event.altKey) return false;
            if (event.key.length !== 1) return false;
            const k = event.key;
            if (k === '\r' || k === '\n') return false;
            return true;
        },
        startTypingReplacingCell(row, col, ch) {
            const r = this.normRow(row);
            const c = this.normCol(col);
            if (!this.canMutateColumnIndex(c)) return;
            const column = this.tableColumns[c];
            const isEmbedded = this.cellUsesEmbeddedWidget(column);

            if (isEmbedded) {
                this.patchCellValue(r, c, this.emptyCellValueForColumn(c));
                this.setSelectionSingle(r, c);
                this.editingCell = { r, c };
                this._tableProgrammaticFocus = true;
                this.$nextTick(() => {
                    this.$nextTick(() => {
                        const el = this.getCellEditorElement(r, c);
                        if (!el) {
                            this.exitCellEdit();
                            this.endProgrammaticFocusSoon();
                            return;
                        }
                        el.focus();
                        el.value = ch;
                        try {
                            el.dispatchEvent(
                                new InputEvent('input', {
                                    bubbles: true,
                                    data: ch,
                                    inputType: 'insertText'
                                })
                            );
                        } catch (e) {
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        this.endProgrammaticFocusSoon();
                    });
                });
                return;
            }

            this.patchCellValue(r, c, ch);
            this.enterCellEditAt(r, c, { caretEnd: true });
        },
        onTableCellMouseDown(event, row, col) {
            if (!this.isEditable) return;
            if (!event.shiftKey) return;
            event.preventDefault();
            const r = this.normRow(row);
            const c = this.normCol(col);
            this._shiftSelectGesture = true;
            this.selFullWidthRows = null;
            if (!this._shiftAnchorLocked) {
                this.selAnchor = { r: this.selFocus.r, c: this.selFocus.c };
                this._shiftAnchorLocked = true;
            }
            this.selFocus = { r, c };
            this.focusSelectionCell(r, c);
        },

        /**
         * focusin на td с t===td сейчас сужает выделение; для ПКМ внутри блока это ломает меню (см. _tableContextMenuMouseDown).
         * Долг: перенос синхронизации selection в явные действия (клик, клавиатура), focusin — только focus-within / выход из edit.
         */
        onTableContainerFocusIn(event) {
            if (!this.isEditable) return;
            const t = event.target;
            const td = t.closest?.('tbody td');
            if (!td || !this.$el.contains(td)) return;
            this._tableFocusWithin = true;
            if (this._tableProgrammaticFocus) return;
            const r = parseInt(td.getAttribute('data-row'), 10);
            const c = parseInt(td.getAttribute('data-col'), 10);
            if (Number.isNaN(r) || Number.isNaN(c)) return;
            if (t === td) {
                const rcm = this._tableContextMenuMouseDown;
                const keepForMenu =
                    rcm &&
                    this.isCellInSelection(r, c) &&
                    (this.selectionIsFullRowBlock() || this.getSelectionCellCount() > 1);
                if (keepForMenu) {
                    this.exitCellEdit();
                    return;
                }
                this.setSelectionSingle(r, c);
                this.exitCellEdit();
                return;
            }
            if (t.tagName === 'INPUT' || t.tagName === 'SELECT') {
                if (t.tagName === 'INPUT' && t.readOnly) return;
                const e = this.editingCell;
                if (e && (e.r !== r || e.c !== c)) {
                    this.exitCellEdit();
                }
                this.setSelectionSingle(r, c);
                this.editingCell = { r, c };
            }
        },

        onTableContainerFocusOut(event) {
            if (!this.isEditable) return;
            const rel = event.relatedTarget;
            if (rel && this.$el && this.$el.contains(rel)) return;
            this._tableFocusWithin = false;
        },

        onTableEditableKeydown(event) {
            const K = tableEngine.Keyboard;
            const h = K && K.handleKeydown;
            if (typeof h === 'function') h(this, event);
        },

        /** Результат jumpTarget: выход из правки, одиночное выделение, фокус. */
        applyJumpNavigate(j) {
            if (!j) return;
            this.exitCellEdit();
            this.setSelectionSingle(j.r, j.c);
            this.$nextTick(() => this.focusSelectionCell(j.r, j.c));
        },

        /**
         * Расширение выделения по Cmd/Ctrl+Shift+стрелка: фокус из прыжка + полосы строк.
         * @param {{ r: number, c: number }} j
         * @param {number} anchorRow строка якоря (selAnchor.r)
         */
        applyJumpExtendSelection(j, anchorRow, dr, dc) {
            if (!j) return;
            const jr = j.r;
            const jc = j.c;
            this.selFocus = { r: jr, c: jc };
            if (this.selFullWidthRows && dr !== 0 && dc === 0) {
                this.setSelFullWidthRowSpan(anchorRow, jr);
            } else if (this.selFullWidthRows && dc !== 0) {
                this.selFullWidthRows = null;
            }
            this.exitCellEdit();
            this.$nextTick(() =>
                this.focusSelectionCell(this.selFocus.r, this.selFocus.c)
            );
        },

        activeCellCol() {
            const active = document.activeElement;
            const td = active?.closest?.('tbody td');
            if (!td || !this.$el.contains(td)) return 0;
            const c = parseInt(td.getAttribute('data-col'), 10);
            return Number.isNaN(c) ? 0 : c;
        },

        deleteKeyboardSelectedRows() {
            if (this.groupingActive || this.tableUiLocked) return;
            if (!this.selectionIsFullRowBlock()) return;
            const { r0, r1 } = this.getSelRect();
            const col = this.activeCellCol();
            let removed = 0;
            for (let r = r1; r >= r0; r--) {
                if (this.tableData.length <= 1) break;
                this.tableData.splice(r, 1);
                removed++;
            }
            if (removed === 0) return;
            this.refreshGroupingViewFromData();
            this.onInput();
            const newLen = this.tableData.length;
            const nr = Math.min(r0, newLen - 1);
            const safeCol = this.normCol(col);
            this.setSelectionSingle(nr, safeCol);
            this.$nextTick(() => this.focusSelectionCell(nr, safeCol));
        },

        insertRowBelowFullSelection() {
            if (this.groupingActive || this.tableUiLocked) return;
            if (!this.selectionIsFullRowBlock()) return;
            const col = this.activeCellCol();
            const { r1 } = this.getSelRect();
            const newRow = this.makeEmptyRow();
            this.applyTableMutation(
                () => {
                    this.tableData.splice(r1 + 1, 0, newRow);
                },
                { skipSort: true }
            );
            this.$nextTick(() => {
                const c = this.normCol(col);
                this.focusSelectionCell(this.normRow(this.selFocus.r), c);
            });
        },

        addNewRow() {
            if (this.groupingActive || this.tableUiLocked) return;
            const newRow = this.makeEmptyRow();
            this.applyTableMutation(
                () => {
                    this.tableData.push(newRow);
                },
                { skipSort: true }
            );
            const last = this.tableData.length - 1;
            this.setSelectionSingle(last, 0);
            this.$nextTick(() => this.focusSelectionCell(last, 0));
        },

        iconSrc(name) {
            const U = tableEngine.WidgetUiCoords;
            if (U && U.contextMenuIconSrc) return U.contextMenuIconSrc(name);
            const n = String(name || '').trim();
            return n ? '/templates/icons/' + n : '';
        },
        onCtxIconError(e) {
            const img = e && e.target;
            if (img) img.style.display = 'none';
        },

        computeBodyModeForMenu() {
            if (this.selectionIsFullRowBlock()) return 'row';
            const { r0, r1, c0, c1 } = this.getSelRect();
            if (r0 === r1 && c0 === c1) return 'cell';
            return 'cells';
        },

        computePasteAnchorRect(rect) {
            const U = tableEngine.WidgetUiCoords;
            if (U && U.computePasteAnchorRect) {
                return U.computePasteAnchorRect(rect, this.selFocus);
            }
            const { r0, r1, c0, c1 } = rect;
            if (r0 === r1 && c0 === c1) {
                return { r: this.selFocus.r, c: this.selFocus.c };
            }
            return { r: r0, c: c0 };
        },

        cloneRect(rect) {
            const U = tableEngine.WidgetUiCoords;
            return U && U.cloneRect ? U.cloneRect(rect) : { r0: rect.r0, r1: rect.r1, c0: rect.c0, c1: rect.c1 };
        },

        /**
         * Снимок для меню и для async paste (immutable поля примитивы; rect клон).
         */
        buildContextMenuSnapshot(kind, anchorR, anchorC, headerCol) {
            const rect = this.cloneRect(this.getSelRect());
            const pasteAnchor = this.computePasteAnchorRect(this.getSelRect());
            const bodyMode =
                kind === 'header' ? null : this.computeBodyModeForMenu();
            const sk = Array.isArray(this.sortKeys)
                ? this.sortKeys.map((k) => ({ col: k.col, dir: k.dir }))
                : [];
            return {
                sessionId: this.contextMenuSessionId,
                bodyMode,
                anchorRow: anchorR,
                anchorCol: anchorC,
                rect,
                headerCol: headerCol != null ? headerCol : null,
                pasteAnchor: { r: pasteAnchor.r, c: pasteAnchor.c },
                sortKeys: sk,
                groupingLevelsSnapshot: (this.groupingState.levels || []).slice(),
                stickyHeaderEnabled: this.stickyHeaderEnabled,
                wordWrapEnabled: this.wordWrapEnabled
            };
        },

        /** Снимок для шорткатов C/X/V (локально в keyboard; sessionId = текущий счётчик). */
        buildClipboardActionSnapshot() {
            const rect = this.cloneRect(this.getSelRect());
            const pasteAnchor = this.computePasteAnchorRect(this.getSelRect());
            const sk = Array.isArray(this.sortKeys)
                ? this.sortKeys.map((k) => ({ col: k.col, dir: k.dir }))
                : [];
            return {
                sessionId: this.contextMenuSessionId,
                bodyMode: this.computeBodyModeForMenu(),
                anchorRow: this.selFocus.r,
                anchorCol: this.selFocus.c,
                rect,
                headerCol: null,
                pasteAnchor: { r: pasteAnchor.r, c: pasteAnchor.c },
                sortKeys: sk,
                groupingLevelsSnapshot: (this.groupingState.levels || []).slice(),
                stickyHeaderEnabled: this.stickyHeaderEnabled,
                wordWrapEnabled: this.wordWrapEnabled
            };
        },

        findCellOverflowContentEl(cellEl) {
            if (!cellEl || !cellEl.querySelector) return null;
            return (
                cellEl.querySelector('.widget-table__cell-value') ||
                cellEl.querySelector('input.cell-input--view')
            );
        },

        syncCellOverflowHint(event) {
            const cellEl = event && event.currentTarget;
            if (!cellEl || !cellEl.removeAttribute) return;
            cellEl.removeAttribute('title');
            if (this.wordWrapEnabled) return;
            const contentEl = this.findCellOverflowContentEl(cellEl);
            if (!contentEl) return;
            const text =
                contentEl.tagName === 'INPUT' || contentEl.tagName === 'TEXTAREA'
                    ? String(contentEl.value || '').trim()
                    : String(contentEl.textContent || '').trim();
            if (!text) return;
            const overflowX = contentEl.scrollWidth > contentEl.clientWidth + 1;
            const overflowY = contentEl.scrollHeight > contentEl.clientHeight + 1;
            if (overflowX || overflowY) {
                cellEl.setAttribute('title', text);
            }
        },

        clearCellOverflowHint(event) {
            const cellEl = event && event.currentTarget;
            if (!cellEl || !cellEl.removeAttribute) return;
            cellEl.removeAttribute('title');
        },

        clearAllCellOverflowHints() {
            const table = this.getTableEl();
            if (!table || !table.querySelectorAll) return;
            table
                .querySelectorAll('tbody td[title]')
                .forEach((cellEl) => cellEl.removeAttribute('title'));
        },

        clampMenuPosition(event) {
            const U = tableEngine.WidgetUiCoords;
            if (U && U.clampMenuPosition) return U.clampMenuPosition(event);
            const x = (event.clientX || 0) + (window.scrollX || 0);
            const y = (event.clientY || 0) + (window.scrollY || 0);
            const pad = 8;
            const w = typeof window !== 'undefined' ? window.innerWidth : 800;
            const h = typeof window !== 'undefined' ? window.innerHeight : 600;
            const mw = 280;
            const mh = 400;
            return {
                x: Math.min(Math.max(pad, x), Math.max(pad, w - mw - pad)),
                y: Math.min(Math.max(pad, y), Math.max(pad, h - mh - pad))
            };
        },

        _detachContextMenuGlobalListeners() {
            if (this._contextMenuClickHandler) {
                document.removeEventListener('mousedown', this._contextMenuClickHandler, true);
                this._contextMenuClickHandler = null;
            }
            if (this._contextMenuKeydownHandler) {
                document.removeEventListener('keydown', this._contextMenuKeydownHandler, true);
                this._contextMenuKeydownHandler = null;
            }
        },

        _attachContextMenuGlobalListeners() {
            this._detachContextMenuGlobalListeners();
            this._contextMenuClickHandler = (ev) => {
                const el = this.$refs.contextMenuEl;
                if (el && el.contains(ev.target)) return;
                this.hideContextMenu();
            };
            this._contextMenuKeydownHandler = (ev) => {
                if (ev.key === 'Escape') {
                    ev.stopPropagation();
                    this.hideContextMenu();
                }
            };
            document.addEventListener('mousedown', this._contextMenuClickHandler, true);
            document.addEventListener('keydown', this._contextMenuKeydownHandler, true);
        },

        onTbodyMouseDownCapture(event) {
            if (!this.isEditable) return;
            if (event.button !== 2) return;
            const td = event.target.closest?.('tbody td');
            if (!td || !this.$el.contains(td)) return;
            this._tableContextMenuMouseDown = true;
            setTimeout(() => {
                if (this._tableContextMenuMouseDown && !this.contextMenuOpen) {
                    this._tableContextMenuMouseDown = false;
                }
            }, 0);
        },

        onBodyContextMenu(event, r, c) {
            if (!this.isEditable) return;
            event.preventDefault();
            this._tableContextMenuMouseDown = false;
            this._openContextMenuPrepare();
            const rr = this.normRow(r);
            const cc = this.normCol(c);
            const inside = this.getSelectionCellCount() > 0 && this.isCellInSelection(rr, cc);
            if (!inside) {
                this.setSelectionSingle(rr, cc);
            }
            this.selectedRowIndex = rr;
            this.exitCellEdit();
            this.contextMenuSessionId += 1;
            this.contextMenuTarget = { kind: 'body', row: rr, col: cc };
            this.contextMenuContext = this.buildContextMenuSnapshot('body', rr, cc, null);
            this.contextMenuPosition = this.clampMenuPosition(event);
            this.contextMenuOpen = true;
            this._attachContextMenuGlobalListeners();
        },

        onTableHeaderContextMenu(event, rIdx, cell, cIdx) {
            if (!cell || cell.colspan !== 1 || cIdx == null) return;
            const nCols = this.tableColumns.length;
            const G = tableEngine.Grouping;
            const headerColumn = cIdx >= 0 ? this.tableColumns[cIdx] : null;
            const isLineNumber = this.isLineNumberColumn(headerColumn);
            const canGroup =
                G &&
                typeof G.canAddGroupingLevel === 'function' &&
                G.canAddGroupingLevel(nCols, (this.groupingState.levels || []).length) &&
                cIdx >= 0 &&
                !isLineNumber;
            const canToggleSticky = cIdx >= 0 && nCols > 0;
            const canToggleWordWrap = nCols > 0;
            const showMenu =
                this.headerSortEnabled ||
                this.groupingActive ||
                canGroup ||
                canToggleSticky ||
                canToggleWordWrap ||
                isLineNumber;
            if (!showMenu) return;
            event.preventDefault();
            this._openContextMenuPrepare();
            this.exitCellEdit();
            this.contextMenuSessionId += 1;
            const col = cIdx;
            this.contextMenuTarget = { kind: 'header', col };
            this.contextMenuContext = this.buildContextMenuSnapshot('header', -1, -1, col);
            this.contextMenuPosition = this.clampMenuPosition(event);
            this.contextMenuOpen = true;
            this._attachContextMenuGlobalListeners();
        },

        _openContextMenuPrepare() {
            this._detachContextMenuGlobalListeners();
            this.contextMenuOpen = false;
            this.contextMenuContext = null;
            this.contextMenuTarget = null;
        },

        hideContextMenu() {
            this._tableContextMenuMouseDown = false;
            this._detachContextMenuGlobalListeners();
            this.contextMenuOpen = false;
            this.contextMenuContext = null;
            this.contextMenuTarget = null;
            this.$nextTick(() => {
                if (this.tableColumns.length > 0 && this.tableData.length > 0) {
                    this.focusSelectionCell(this.selFocus.r, this.selFocus.c);
                }
            });
        },

        onContextMenuItemActivate(item) {
            if (!item || item.disabled) return;
            const snap = this.contextMenuContext;
            if (!snap) return;
            this.runContextMenuAction(item.id, snap);
        },

        runContextMenuAction(id, snapshot) {
            const sortIds = { sort_asc: 1, sort_desc: 1, sort_reset: 1 };
            const groupIds = { group_add_level: 1, group_clear: 1 };
            const stickyIds = { toggle_sticky_header: 1 };
            const wrapIds = { toggle_word_wrap: 1 };
            if (!this.isEditable && id !== 'copy' && !sortIds[id] && !groupIds[id] && !stickyIds[id] && !wrapIds[id]) return;
            if (this.tableUiLocked) return;
            if (!snapshot) return;
            switch (id) {
                case 'add_row_above':
                    this.addRowAboveFromSnapshot(snapshot);
                    break;
                case 'add_row_below':
                    this.addRowBelowFromSnapshot(snapshot);
                    break;
                case 'delete_row':
                    this.deleteRowFromSnapshot(snapshot);
                    break;
                case 'move_row_up':
                    this.moveRowUpFromSnapshot(snapshot);
                    break;
                case 'move_row_down':
                    this.moveRowDownFromSnapshot(snapshot);
                    break;
                case 'duplicate_row_above':
                    this.duplicateRowAboveFromSnapshot(snapshot);
                    break;
                case 'duplicate_row_below':
                    this.duplicateRowBelowFromSnapshot(snapshot);
                    break;
                case 'copy':
                    this.copySelection(snapshot);
                    break;
                case 'cut':
                    this.cutSelection(snapshot);
                    break;
                case 'paste':
                    this.pasteFromClipboard(snapshot);
                    break;
                case 'clear':
                    this.clearSelectionFromSnapshot(snapshot);
                    break;
                case 'sort_asc':
                    this.applySortFromMenu(snapshot, 'asc');
                    break;
                case 'sort_desc':
                    this.applySortFromMenu(snapshot, 'desc');
                    break;
                case 'sort_reset':
                    this.applySortResetFromMenu(snapshot);
                    break;
                case 'group_add_level':
                    this.onGroupAddLevelFromSnapshot(snapshot);
                    break;
                case 'group_clear':
                    this.onGroupClearFromSnapshot(snapshot);
                    break;
                case 'toggle_sticky_header':
                    this.toggleStickyHeaderFromSnapshot(snapshot);
                    break;
                case 'toggle_word_wrap':
                    this.toggleWordWrapFromSnapshot(snapshot);
                    break;
                case 'recalculate_line_numbers':
                    this.recalculateLineNumbersFromSnapshot(snapshot);
                    break;
                default:
                    break;
            }
        },

        toggleStickyHeaderFromSnapshot() {
            this.hideContextMenu();
            this.stickyHeaderRuntimeEnabled = !this.stickyHeaderRuntimeEnabled;
        },

        toggleWordWrapFromSnapshot() {
            this.hideContextMenu();
            this.wordWrapRuntimeEnabled = !this.wordWrapRuntimeEnabled;
            if (this.wordWrapEnabled) {
                this.$nextTick(() => this.clearAllCellOverflowHints());
            }
        },

        applySortFromMenu(snapshot, direction) {
            if (this.tableUiLocked) return;
            const col = snapshot.headerCol;
            if (col == null || col < 0) return;
            this.hideContextMenu();
            this._sortCycleRowOrder = this.tableData.slice();
            this.sortKeys = [{ col, dir: direction === 'asc' ? 'asc' : 'desc' }];
            this.sortTableDataInPlace();
            this.refreshGroupingViewFromData();
            this.onInput();
        },

        applySortResetFromMenu(snapshot) {
            if (this.tableUiLocked) return;
            const col = snapshot.headerCol;
            if (col == null) return;
            this.hideContextMenu();
            const next = this.sortKeys.filter((k) => k.col !== col);
            if (next.length === this.sortKeys.length) return;
            this.sortKeys = next;
            if (next.length === 0) {
                this.restoreSortCycleRowOrder();
            } else {
                this.sortTableDataInPlace();
            }
            this.refreshGroupingViewFromData();
            this.onInput();
        },

        onGroupAddLevelFromSnapshot(snapshot) {
            const col = snapshot.headerCol;
            this.hideContextMenu();
            if (col == null || col < 0) return;
            if (this.isLineNumberColumn(this.tableColumns[col])) return;
            if (this.groupingState.levels.indexOf(col) >= 0) return;
            const prevLevels = this.groupingState.levels.slice();
            const prevExpanded = new Set(this.groupingState.expanded);
            const prevPending = this._lazyPendingRows.slice();
            const prevFull = this.isFullyLoaded;
            this.tableUiLocked = true;
            try {
                if (!this.isFullyLoaded) {
                    const ok = this.flushLazyFullLoadInternal();
                    if (!ok) {
                        this._lazyPendingRows = prevPending;
                        this.isFullyLoaded = prevFull;
                        this.showTableError(
                            'Не удалось полностью загрузить данные для группировки.'
                        );
                        return;
                    }
                }
                this.groupingState = {
                    levels: prevLevels.concat(col),
                    expanded: new Set()
                };
                this.sortTableDataInPlace();
                this.refreshGroupingViewFromData();
                this.onInput();
            } catch (e) {
                this.groupingState = { levels: prevLevels, expanded: prevExpanded };
                this.refreshGroupingViewFromData();
                this.showTableError('Не удалось применить группировку.', {
                    cause: e,
                    details: {
                        action: 'group_add_level'
                    }
                });
            } finally {
                this.tableUiLocked = false;
            }
        },

        onGroupClearFromSnapshot() {
            this.hideContextMenu();
            this.groupingViewCache = null;
            this.groupingState = { levels: [], expanded: new Set() };
            this.onInput();
            this.$nextTick(() => this._scheduleStickyTheadUpdate());
        },

        selectedDataRowIdFromViewRow(viewRow) {
            const dataIndex = this.resolveDataRowIndex(viewRow);
            if (dataIndex < 0 || dataIndex >= this.tableData.length) return '';
            const row = this.tableData[dataIndex];
            return row && row.id != null ? String(row.id) : '';
        },

        restoreSelectionByRowIds(focusRowId, anchorRowId, focusCol, anchorCol, useFullWidthRows) {
            const rowIndexById = new Map();
            for (let i = 0; i < this.tableData.length; i++) {
                const row = this.tableData[i];
                const id = row && row.id != null ? String(row.id) : '';
                if (id) rowIndexById.set(id, i);
            }
            const nextFocusRow = rowIndexById.has(focusRowId)
                ? rowIndexById.get(focusRowId)
                : 0;
            const nextAnchorRow = rowIndexById.has(anchorRowId)
                ? rowIndexById.get(anchorRowId)
                : nextFocusRow;
            const fc = this.normCol(focusCol != null ? focusCol : 0);
            const ac = this.normCol(anchorCol != null ? anchorCol : fc);
            this.selFullWidthRows = null;
            this.selAnchor = { r: nextAnchorRow, c: ac };
            this.selFocus = { r: nextFocusRow, c: fc };
            if (useFullWidthRows && this.tableColumns.length > 0) {
                this.setSelFullWidthRowSpan(nextAnchorRow, nextFocusRow);
            }
            this.$nextTick(() => this.focusSelectionCell(nextFocusRow, fc));
        },

        recalculateLineNumbersFromSnapshot(snapshot) {
            if (snapshot.sessionId !== this.contextMenuSessionId) {
                this.hideContextMenu();
                return;
            }
            this.hideContextMenu();
            this.recalculateLineNumbers();
        },

        recalculateLineNumbers() {
            const lineNumberIndex = this.lineNumberColumnIndex();
            if (lineNumberIndex < 0 || this.tableUiLocked) return;
            const U = tableEngine.Utils;
            const G = tableEngine.Grouping;
            const assignLineNumber = U && U.assignRowLineNumber;
            if (typeof assignLineNumber !== 'function') return;

            const focusRowId = this.selectedDataRowIdFromViewRow(this.selFocus.r);
            const anchorRowId = this.selectedDataRowIdFromViewRow(this.selAnchor.r);
            const focusCol = this.selFocus.c;
            const anchorCol = this.selAnchor.c;
            const useFullWidthRows = !!this.selFullWidthRows;

            this.tableUiLocked = true;
            try {
                if (!this.isFullyLoaded) {
                    const ok = this.flushLazyFullLoadInternal();
                    if (!ok) {
                        this.showTableError(
                            'Не удалось полностью загрузить данные для пересчёта нумерации.'
                        );
                        return;
                    }
                }
                const order =
                    this.groupingActive &&
                    G &&
                    typeof G.buildGroupedDataOrder === 'function'
                        ? G.buildGroupedDataOrder(
                            this.tableData,
                            this.groupingState.levels,
                            this.tableColumns
                        )
                        : this.tableData.map((_, index) => index);
                const nextNumbers = new Map();
                order.forEach((dataIndex, index) => {
                    const row = this.tableData[dataIndex];
                    if (!row || row.id == null) return;
                    nextNumbers.set(String(row.id), index + 1);
                });
                const updated = this.tableData.map((row) =>
                    assignLineNumber(
                        row,
                        this.tableColumns,
                        nextNumbers.get(String(row.id))
                    )
                );
                this.tableData.splice(0, this.tableData.length, ...updated);
                this.sortKeys = [];
                this._sortCycleRowOrder = null;
                this.groupingState = { levels: [], expanded: new Set() };
                this.groupingViewCache = null;
                this.onInput();
                this.restoreSelectionByRowIds(
                    focusRowId,
                    anchorRowId,
                    focusCol,
                    anchorCol,
                    useFullWidthRows
                );
            } catch (e) {
                this.showTableError('Не удалось пересчитать нумерацию.', {
                    cause: e,
                    details: {
                        action: 'recalculate_line_numbers'
                    }
                });
            } finally {
                this.tableUiLocked = false;
                this.$nextTick(() => this._scheduleStickyTheadUpdate());
            }
        },

        /**
         * В режимах cell/cells строка вставки — anchorRow (строка ПКМ), не верх/низ rect.
         * Пустая таблица: первая строка через makeEmptyRow(), anchorRow не используется.
         */
        addRowAboveFromSnapshot(snapshot) {
            if (this.tableData.length === 0) {
                const newRow = this.makeEmptyRow();
                this.applyTableMutation(
                    () => {
                        this.tableData.splice(0, 0, newRow);
                    },
                    { skipSort: true }
                );
                this.hideContextMenu();
                return;
            }
            const ar = snapshot.anchorRow;
            if (ar < 0 || ar > this.tableData.length) return;
            const newRow = this.makeEmptyRow();
            this.applyTableMutation(
                () => {
                    this.tableData.splice(ar, 0, newRow);
                },
                { skipSort: true }
            );
            this.hideContextMenu();
        },

        addRowBelowFromSnapshot(snapshot) {
            if (this.tableData.length === 0) {
                const newRow = this.makeEmptyRow();
                this.applyTableMutation(
                    () => {
                        this.tableData.push(newRow);
                    },
                    { skipSort: true }
                );
                this.hideContextMenu();
                return;
            }
            const ar = snapshot.anchorRow;
            if (ar < 0 || ar >= this.tableData.length) return;
            const newRow = this.makeEmptyRow();
            this.applyTableMutation(
                () => {
                    this.tableData.splice(ar + 1, 0, newRow);
                },
                { skipSort: true }
            );
            this.hideContextMenu();
        },

        /** v1: удаление строки только из row-mode (пункт меню не показывается иначе). */
        deleteRowFromSnapshot(snapshot) {
            if (snapshot.bodyMode !== 'row') return;
            const ar = snapshot.anchorRow;
            if (this.tableData.length <= 1) return;
            if (ar < 0 || ar >= this.tableData.length) return;
            this.applyTableMutation(
                () => {
                    this.tableData.splice(ar, 1);
                },
                { skipSort: true }
            );
            const newLen = this.tableData.length;
            const nr = Math.min(ar, newLen - 1);
            const sc = this.normCol(this.selFocus.c);
            this.setSelectionSingle(nr, sc);
            this.hideContextMenu();
            this.$nextTick(() => this.focusSelectionCell(nr, sc));
        },

        listMultiFn() {
            return (col) => this.listColumnIsMultiselect(this.tableColumns[col]);
        },

        async writeClipboardText(text) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                }
            } catch (e) {
                this.showTableError('Не удалось скопировать данные в буфер обмена.', {
                    cause: e,
                    details: {
                        action: 'clipboard_write'
                    }
                });
            }
        },

        copySelection(snapshot) {
            if (!this.isEditable || this.groupingActive) return;
            const C = tableEngine.Clipboard;
            if (!C || typeof C.serializeSelectionToTsv !== 'function') return;
            const tsv = C.serializeSelectionToTsv(
                this.tableData,
                this.tableColumns,
                snapshot.rect,
                this.listMultiFn()
            );
            this.writeClipboardText(tsv);
            if (this.contextMenuOpen) this.hideContextMenu();
        },

        cutSelection(snapshot) {
            if (!this.isEditable || this.groupingActive) return;
            const C = tableEngine.Clipboard;
            if (!C || typeof C.serializeSelectionToTsv !== 'function') return;
            const tsv = C.serializeSelectionToTsv(
                this.tableData,
                this.tableColumns,
                snapshot.rect,
                this.listMultiFn()
            );
            this.writeClipboardText(tsv);
            this.clearRectangleValues(snapshot.rect);
            this.onInput();
            if (this.contextMenuOpen) this.hideContextMenu();
        },

        clearRectangleValues(rect) {
            if (this.groupingActive || this.tableUiLocked) return;
            const U = tableEngine.Utils;
            const getCells = U && U.getRowCells;
            const { r0, r1, c0, c1 } = rect;
            for (let r = r0; r <= r1; r++) {
                const row = this.tableData[r];
                if (!row) continue;
                const base = getCells ? [...getCells(row)] : [...(Array.isArray(row) ? row : [])];
                for (let c = c0; c <= c1; c++) {
                    if (!this.canMutateColumnIndex(c)) continue;
                    base[c] = this.emptyCellValueForColumn(c);
                }
                if (row && typeof row === 'object' && row.id != null && !Array.isArray(row)) {
                    this.tableData.splice(r, 1, { id: row.id, cells: base });
                } else {
                    this.tableData.splice(r, 1, base);
                }
            }
        },

        clearSelectionFromSnapshot(snapshot) {
            if (!this.isEditable || this.groupingActive) return;
            this.clearRectangleValues(snapshot.rect);
            this.onInput();
            this.hideContextMenu();
        },

        isPasteAnchorInTable(snapshot) {
            const { r, c } = snapshot.pasteAnchor;
            return (
                r >= 0 &&
                r < this.tableData.length &&
                c >= 0 &&
                c < this.tableColumns.length
            );
        },

        applyPasteMatrix(snapshot, matrix) {
            if (this.groupingActive || this.tableUiLocked) return;
            const U = tableEngine.Utils;
            const getCells = U && U.getRowCells;
            const { r: pr, c: pc } = snapshot.pasteAnchor;
            const nCols = this.tableColumns.length;
            const neededRows = pr + matrix.length;
            while (this.tableData.length < neededRows) {
                this.tableData.push(this.makeEmptyRow());
            }
            const nRows = this.tableData.length;
            for (let i = 0; i < matrix.length; i++) {
                const r = pr + i;
                if (r < 0 || r >= nRows) continue;
                const rowData = matrix[i];
                if (!Array.isArray(rowData)) continue;
                const prev = this.tableData[r];
                const row = getCells ? [...getCells(prev)] : [...(Array.isArray(prev) ? prev : [])];
                for (let j = 0; j < rowData.length; j++) {
                    const c = pc + j;
                    if (c < 0 || c >= nCols) continue;
                    if (!this.canMutateColumnIndex(c)) continue;
                    row[c] = rowData[j];
                }
                if (prev && typeof prev === 'object' && prev.id != null && !Array.isArray(prev)) {
                    this.tableData.splice(r, 1, { id: prev.id, cells: row });
                } else {
                    this.tableData.splice(r, 1, row);
                }
            }
            this.onInput();
        },

        async pasteFromClipboard(snapshot) {
            if (!this.isEditable || this.groupingActive) return;
            if (this._pasteInProgress) return;
            if (!this.isPasteAnchorInTable(snapshot)) return;
            const sid = snapshot.sessionId;
            const hadMenu = this.contextMenuOpen;
            this._pasteInProgress = true;
            try {
                let text = '';
                try {
                    if (navigator.clipboard && navigator.clipboard.readText) {
                        text = await navigator.clipboard.readText();
                    }
                } catch (e) {
                    this.showTableError('Не удалось прочитать данные из буфера обмена.', {
                        cause: e,
                        details: {
                            action: 'clipboard_read'
                        }
                    });
                    return;
                }
                if (text == null || text === '') return;
                if (sid !== this.contextMenuSessionId) return;
                const C = tableEngine.Clipboard;
                if (!C || typeof C.deserializeTsvToMatrix !== 'function') return;
                const matrix = C.deserializeTsvToMatrix(
                    text,
                    this.tableColumns,
                    this.listMultiFn()
                );
                if (!matrix.length) return;
                if (!this.isPasteAnchorInTable(snapshot)) return;
                this.applyPasteMatrix(snapshot, matrix);
            } finally {
                this._pasteInProgress = false;
                if (hadMenu) this.hideContextMenu();
            }
        },

        _scheduleStickyTheadUpdate() {
            const Sticky = tableEngine.Sticky;
            if (Sticky && typeof Sticky.scheduleUpdate === 'function') {
                Sticky.scheduleUpdate(this);
            }
        },

        _updateStickyThead() {
            const Sticky = tableEngine.Sticky;
            if (Sticky && typeof Sticky.updateStickyThead === 'function') {
                Sticky.updateStickyThead(this);
            }
        },

        _bindStickyThead() {
            const Sticky = tableEngine.Sticky;
            if (Sticky && typeof Sticky.bindStickyThead === 'function') {
                Sticky.bindStickyThead(this);
            }
        },

        _unbindStickyThead() {
            const Sticky = tableEngine.Sticky;
            if (Sticky && typeof Sticky.unbindStickyThead === 'function') {
                Sticky.unbindStickyThead(this);
            }
        },

        parseTableAttrs(tableAttrs) {
            const C = tableEngine;
            const fn =
                C && typeof C.parseTableAttrs === 'function'
                    ? C.parseTableAttrs
                    : null;
            if (fn) fn(this, tableAttrs);
        }
    }),

    mounted() {
        this.initializeTable();
    },

    beforeUnmount() {
        this._unbindStickyThead();
        this._detachContextMenuGlobalListeners();
        this._teardownLazyObserver();
    }
};

export { TableWidget };
export default TableWidget;
