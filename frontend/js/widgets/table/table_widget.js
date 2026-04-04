// Виджет таблицы. Скрипты (порядок в page.html): table_core → … → table_keyboard →
// table_widget_helpers (WidgetMeasure, WidgetUiCoords) → table_widget.

import { markRaw } from 'vue';

import { createStore as createTableStore } from './table_api.js';
import tableEngine from './table_core.js';
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
        tableEngine.ViewRuntimeMethods || {},
        tableEngine.DataRuntimeMethods || {},
        tableEngine.DataViewRuntimeMethods || {},
        tableEngine.CellRuntimeMethods || {},
        tableEngine.RowRuntimeMethods || {},
        tableEngine.EditingRuntimeMethods || {},
        tableEngine.InteractionRuntimeMethods || {},
        tableEngine.MenuRuntimeMethods || {},
        tableEngine.ClipboardRuntimeMethods || {}
    ),

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
