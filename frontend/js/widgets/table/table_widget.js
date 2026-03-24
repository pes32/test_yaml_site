// Виджет таблицы. Скрипты (порядок в page.html): table_core → … → table_keyboard →
// table_widget_helpers (WidgetMeasure, WidgetUiCoords) → table_widget.

const TableWidget = {
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
            
            <div class="widget-table-container" @focusin.capture="onTableContainerFocusIn" @focusout.capture="onTableContainerFocusOut">
                <table ref="tableRoot" class="table widget-table" :class="{ 'widget-table--editable': isEditable, 'widget-table--no-zebra': !tableZebra, 'widget-table--explicit-width': hasExplicitTableWidth, 'widget-table--sortable': headerSortEnabled }" :style="tableInlineStyle" @keydown="onTableEditableKeydown">
                    <thead>
                        <tr v-for="(headerRow, rIdx) in headerRows" :key="rIdx">
                            <th v-for="(cell, cIdx) in headerRow" :key="cIdx" :colspan="cell.colspan" :rowspan="cell.rowspan" :style="headerThStyle(cell)" :aria-sort="thAriaSort(rIdx, cIdx, cell)"
                                @contextmenu="onTableHeaderContextMenu($event, rIdx, cell, cIdx)">
                                <div
                                    v-if="showSortInHeaderCell(rIdx, cell)"
                                    class="widget-table__th-inner"
                                    role="button"
                                    tabindex="0"
                                    :aria-label="sortAriaLabel(cIdx)"
                                    @click="onHeaderSortClick(cIdx)"
                                    @keydown.enter.prevent="onHeaderSortClick(cIdx)"
                                    @keydown.space.prevent="onHeaderSortClick(cIdx)">
                                    <span class="widget-table__th-text" v-text="cell.label"></span>
                                    <div class="widget-table__sort-icons" :class="sortControlClass(cIdx)" aria-hidden="true">
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
                    <tbody @mousedown.capture="onTbodyMouseDownCapture">
                        <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
                            <td v-for="(column, cellIndex) in tableColumns" :key="cellIndex"
                                :data-row="rowIndex"
                                :data-col="cellIndex"
                                :class="cellTdClass(rowIndex, cellIndex)"
                                :tabindex="cellTabindex(rowIndex, cellIndex)"
                                :style="cellSelectionOutlineStyle(rowIndex, cellIndex)"
                                @click="onTableCellClick($event, rowIndex, cellIndex)"
                                @dblclick.stop="onTableCellDblClick(rowIndex, cellIndex)"
                                @mousedown="onTableCellMouseDown($event, rowIndex, cellIndex)"
                                @contextmenu="onBodyContextMenu($event, rowIndex, cellIndex)"
                                style="cursor: pointer;">
                                <template v-if="isEditable">
                                    <div v-if="column.type==='list' && listCellWidget"
                                         class="cell-editor-wrap"
                                         :class="{ 'cell-editor-wrap--inactive': !isCellEditing(rowIndex, cellIndex) }">
                                        <component
                                               :is="listCellWidget"
                                               :widget-config="cellListConfig(rowIndex, cellIndex, column)"
                                               :widget-name="cellWidgetName(rowIndex, cellIndex)"
                                               @input="onCellWidgetPayload(rowIndex, cellIndex, $event)"/>
                                    </div>
                                    <div v-else-if="column.type==='ip' && ipCellWidget"
                                         class="cell-editor-wrap"
                                         :class="{ 'cell-editor-wrap--inactive': !isCellEditing(rowIndex, cellIndex) }">
                                        <component
                                               :is="ipCellWidget"
                                               :widget-config="cellWidgetConfig()"
                                               :widget-name="cellWidgetName(rowIndex, cellIndex)"
                                               @input="onCellWidgetPayload(rowIndex, cellIndex, $event)"/>
                                    </div>
                                    <input v-else-if="column.type==='ip'"
                                           type="text"
                                           class="cell-input w-100"
                                           :class="{ 'cell-input--view': !isCellEditing(rowIndex, cellIndex) }"
                                           tabindex="-1"
                                           :value="safeCell(row, cellIndex)"
                                           :readOnly="!isCellEditing(rowIndex, cellIndex)"
                                           @mousedown="onCellInputViewMouseDown($event, rowIndex, cellIndex)"
                                           @input="onIpInput(rowIndex, cellIndex, $event)"
                                           @blur="onNativeCellBlur(rowIndex, cellIndex)"
                                           placeholder="xxx.xxx.xxx.xxx"/>
                                    <input v-else
                                        type="text"
                                        class="cell-input w-100"
                                        :class="{ 'cell-input--view': !isCellEditing(rowIndex, cellIndex) }"
                                        tabindex="-1"
                                        :value="safeCell(row, cellIndex)"
                                        :readOnly="!isCellEditing(rowIndex, cellIndex)"
                                        @mousedown="onCellInputViewMouseDown($event, rowIndex, cellIndex)"
                                        @input="onCellInput(rowIndex, cellIndex, $event)"
                                        @blur="onTextCellBlur(rowIndex, cellIndex, column)"/>
                                </template>
                                <template v-else>
                                    <span v-text="formatCellValue(row[cellIndex], column)"></span>
                                </template>
                            </td>
                        </tr>
                    </tbody>
                </table>
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
        return {
            value: [],
            headerRows: [],
            tableColumns: [],
            tableData: [],
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
            ipCellWidget: (window.IpWidget && typeof Vue !== 'undefined') ? Vue.markRaw(window.IpWidget) : null,
            listCellWidget: (window.ListWidget && typeof Vue !== 'undefined') ? Vue.markRaw(window.ListWidget) : null,
            /** true после focus в tbody; без этого не показываем box-shadow выделения (избегаем «фейкового фокуса» при загрузке). */
            _tableFocusWithin: false,
            /** Индекс столбца активной сортировки; null — не сортировали с момента инициализации/сброса. */
            sortColumnIndex: null,
            /** 'asc' | 'desc' — только пока sortColumnIndex !== null */
            sortDirection: 'asc',
            /** Порядок ссылок на строки до первого клика сортировки в текущем цикле (asc→desc→сброс). */
            _sortCycleRowOrder: null,
            /** true на цепочке ПКМ по ячейке: focusin не схлопывает full-row / прямоугольник до contextmenu. */
            _tableContextMenuMouseDown: false
        };
    },
    computed: {
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
            const o = { marginBottom: 0 };
            if (!this.hasExplicitTableWidth) return o;
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
            const CM = window.TableWidgetCore && window.TableWidgetCore.ContextMenu;
            const build = CM && CM.buildMenuItems;
            if (!build || !this.contextMenuOpen || !this.contextMenuTarget || !this.contextMenuContext) {
                return [];
            }
            return build({
                target: this.contextMenuTarget,
                snapshot: this.contextMenuContext,
                isApple: CM.isApplePlatform && CM.isApplePlatform(),
                tableDataLength: this.tableData.length,
                numCols: this.tableColumns.length,
                headerSortEnabled: this.headerSortEnabled,
                isEditable: this.isEditable,
                isEditingCell: !!this.editingCell
            });
        }
    },
    watch: {
        widgetName() {
            this.initializeTable();
        },

        widgetConfig() {
            this.initializeTable();
        }
    },
    methods: Object.assign(
        {},
        typeof window !== 'undefined' &&
            window.TableWidgetCore &&
            window.TableWidgetCore.SelectionMethods
            ? window.TableWidgetCore.SelectionMethods
            : {},
        {
        initializeTable() {
            this.headerRows = [];
            this.tableColumns = [];
            this.tableData = [];
            this.contextMenuOpen = false;
            this.contextMenuContext = null;
            this.contextMenuTarget = null;
            this.selectedRowIndex = -1;
            this.selAnchor = { r: 0, c: 0 };
            this.selFocus = { r: 0, c: 0 };
            this.selFullWidthRows = null;
            this._shiftAnchorLocked = false;
            this._tableFocusWithin = false;
            this.sortColumnIndex = null;
            this.sortDirection = 'asc';
            this._sortCycleRowOrder = null;
            this._tableContextMenuMouseDown = false;
            this.exitCellEdit();

            // Инициализация нового формата таблицы
            this.parseTableAttrs(this.widgetConfig.table_attrs);

            // Инициализация данных
            const U =
                typeof window !== 'undefined' &&
                window.TableWidgetCore &&
                window.TableWidgetCore.Utils;
            const clone =
                (U && U.cloneTableData) ||
                ((v) => (Array.isArray(v) ? v.map((row) => (Array.isArray(row) ? row.slice() : [])) : []));
            if (this.widgetConfig.source && typeof this.widgetConfig.source === 'object' && Array.isArray(this.widgetConfig.source)) {
                this.tableData = clone(this.widgetConfig.source);
            } else if (this.widgetConfig.data) {
                this.tableData = clone(this.widgetConfig.data);
            } else {
                this.tableData = [];
            }

            // Нормализуем данные под число колонок
            const cols = this.tableColumns.length;
            if (cols > 0) {
                if (this.tableData.length === 0 && this.isEditable) {
                    this.tableData = [this.makeEmptyRow()];
                } else if (this.tableData.length > 0) {
                    this.tableData = this.tableData.map(row => {
                        const r = Array.isArray(row) ? [...row] : [];
                        if (r.length < cols) r.push(...Array(cols - r.length).fill(''));
                        if (r.length > cols) r.length = cols;
                        return r;
                    });
                }
            }

            this.ensureMinTableRows();
            this.onInput();
        },

        /** Пустая строка с учётом типов колонок (list multiselect → []). */
        makeEmptyRow() {
            const cols = this.tableColumns.length;
            if (cols === 0) return [];
            const row = [];
            for (let c = 0; c < cols; c++) {
                row.push(this.emptyCellValueForColumn(c));
            }
            return row;
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

        headerThStyle(cell) {
            if (!cell || !cell.width) return {};
            return { width: cell.width };
        },

        isLeafHeaderRow(rIdx) {
            return rIdx === this.headerRows.length - 1;
        },

        showSortInHeaderCell(rIdx, cell) {
            return (
                this.headerSortEnabled &&
                this.isLeafHeaderRow(rIdx) &&
                cell &&
                cell.colspan === 1
            );
        },

        thAriaSort(rIdx, cIdx, cell) {
            if (!this.showSortInHeaderCell(rIdx, cell)) return undefined;
            if (this.sortColumnIndex !== cIdx) return undefined;
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

        applyColumnSort(colIdx, direction) {
            const S = window.TableWidgetCore && window.TableWidgetCore.Sort;
            if (!S || typeof S.compareRows !== 'function') return;
            const sign = direction === 'asc' ? 1 : -1;
            const listMulti = (c) => this.listColumnIsMultiselect(c);
            const sorted = [...this.tableData].sort((rowA, rowB) =>
                sign * S.compareRows(rowA, rowB, colIdx, this.tableColumns, listMulti)
            );
            this.tableData.splice(0, this.tableData.length, ...sorted);
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

        onHeaderSortClick(colIdx) {
            if (!this.headerSortEnabled) return;
            if (colIdx < 0 || colIdx >= this.tableColumns.length) return;
            const S = window.TableWidgetCore && window.TableWidgetCore.Sort;
            if (!S || typeof S.compareRows !== 'function') return;

            if (this.sortColumnIndex === colIdx) {
                if (this.sortDirection === 'asc') {
                    this.sortDirection = 'desc';
                    this.applyColumnSort(colIdx, 'desc');
                    window.TableWidgetCore?.log(
                        'sort',
                        colIdx,
                        'desc',
                        this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
                    );
                } else {
                    this.sortColumnIndex = null;
                    this.sortDirection = 'asc';
                    this.restoreSortCycleRowOrder();
                    window.TableWidgetCore?.log(
                        'sort reset',
                        colIdx,
                        this.tableColumns[colIdx] && this.tableColumns[colIdx].attr
                    );
                }
                this.onInput();
                return;
            }

            this._sortCycleRowOrder = this.tableData.slice();
            this.sortColumnIndex = colIdx;
            this.sortDirection = 'asc';
            this.applyColumnSort(colIdx, 'asc');
            window.TableWidgetCore?.log(
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
            const M = window.TableWidgetCore && window.TableWidgetCore.WidgetMeasure;
            return M && M.headerSortAffordancePx
                ? M.headerSortAffordancePx(this.widgetConfig)
                : this.widgetConfig && this.widgetConfig.sort === false
                  ? 0
                  : 26;
        },

        computeAutoWidth(label) {
            const M = window.TableWidgetCore && window.TableWidgetCore.WidgetMeasure;
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
            const U = window.TableWidgetCore && window.TableWidgetCore.Utils;
            if (U && U.safeCellValue) return U.safeCellValue(row, cellIndex);
            if (!Array.isArray(row)) return '';
            return row[cellIndex] ?? '';
        },

        /** Форматирование для отображения/применения — логика в table_format.js */
        formatCellValue(value, column) {
            const F =
                typeof window !== 'undefined' &&
                window.TableWidgetCore &&
                window.TableWidgetCore.Format;
            const fmt = F && F.formatCellValue;
            if (fmt) return fmt(value, column);
            return value === null || value === undefined ? '' : String(value);
        },

        onInput() {
            this.$emit('input', {
                name: this.widgetName,
                value: this.tableData,
                config: this.widgetConfig
            });
        },
        
        setValue(value) {
            const U = window.TableWidgetCore && window.TableWidgetCore.Utils;
            const clone = U && U.cloneTableData;
            const incoming = Array.isArray(value)
                ? clone
                    ? clone(value)
                    : value.map((row) => (Array.isArray(row) ? row.slice() : []))
                : [];
            // Нормализуем длину строк под число конечных колонок
            const cols = this.tableColumns.length;
            this.tableData = incoming.map(row => {
                const r = Array.isArray(row) ? [...row] : [];
                if (r.length < cols) {
                    r.push(...Array(cols - r.length).fill(''));
                } else if (r.length > cols) {
                    r.length = cols;
                }
                return r;
            });
            this.sortColumnIndex = null;
            this.sortDirection = 'asc';
            this._sortCycleRowOrder = null;
            this.ensureMinTableRows();
            this.onInput();
        },
        
        getValue() {
            return this.tableData;
        },

        // Конфигурация для реюза виджета как ячейки
        cellWidgetConfig() {
            return { label: '', readonly: false };
        },
        cellListConfig(rowIndex, cellIndex, column) {
            const currentVal = this.safeCell(this.tableData[rowIndex] || [], cellIndex);
            // Пытаемся определить конфиг поля из allAttrs
            const allAttrs = (window.pageData && window.pageData.allAttrs) || {};
            // 1) пробуем по source (для колонок вида :pack_types),
            // 2) затем по имени самой колонки
            let attrCfg = {};
            if (column && column.source && allAttrs[column.source]) {
                attrCfg = allAttrs[column.source] || {};
            } else if (column && column.attr && allAttrs[column.attr]) {
                attrCfg = allAttrs[column.attr] || {};
            }

            const isMulti = this.listColumnIsMultiselect(column);
            let val = currentVal;
            if (isMulti) {
                if (!Array.isArray(val)) val = val ? [val] : [];
            } else {
                if (Array.isArray(val)) val = val[0] || '';
            }
            return {
                ...attrCfg,
                widget: 'list',
                source: this.getListOptions(column ? column.source : null),
                multiselect: isMulti,
                value: val,
                default: undefined
            };
        },
        cellWidgetName(rowIndex, cellIndex) {
            return `cell_${rowIndex}_${cellIndex}`;
        },
        onCellWidgetPayload(rowIndex, cellIndex, payload) {
            // Ожидаем payload.value
            if (!payload || typeof payload.value === 'undefined') return;
            const updatedRow = [...this.tableData[rowIndex]];
            updatedRow[cellIndex] = payload.value;
            this.tableData.splice(rowIndex, 1, updatedRow);
            window.TableWidgetCore?.log('cell widget input', rowIndex, cellIndex);
            this.onInput();
        },

        getListOptions(sourceName) {
            if (!sourceName) return [];
            // Ищем данные в window.pageData.allAttrs как описано пользователем
            try {
                const attrs = (window.pageData && window.pageData.allAttrs) || {};
                const attr = attrs[sourceName];
                if (attr && Array.isArray(attr.source)) return attr.source;
            } catch (e) {}
            return [];
        },

        onCellInput(rowIndex, cellIndex, event) {
            const newValue = event.target ? event.target.value : event;
            // Обновляем реактивно, создавая новый массив строки
            const updatedRow = [...this.tableData[rowIndex]];
            updatedRow[cellIndex] = newValue;
            // Заменяем строку в данных
            this.tableData.splice(rowIndex, 1, updatedRow);
            window.TableWidgetCore?.log('cell input', rowIndex, cellIndex);
            this.onInput();
        },

        // Специальная обработка IP: только цифры и точки; не более 4 октетов по 3 цифры
        onIpInput(rowIndex, cellIndex, event) {
            const raw = event.target.value || '';
            // Оставляем только цифры и точки
            let filtered = raw.replace(/[^\d.]/g, '');
            // Разбиваем, ограничиваем до 4 октетов и по 3 цифры в каждом
            const parts = filtered.split('.').slice(0, 4).map(p => p.replace(/\D/g, '').slice(0, 3));
            filtered = parts.join('.');
            // Обновляем значение
            const updatedRow = [...this.tableData[rowIndex]];
            updatedRow[cellIndex] = filtered;
            this.tableData.splice(rowIndex, 1, updatedRow);
            window.TableWidgetCore?.log('cell ip input', rowIndex, cellIndex);
            this.onInput();
        },

        // Приведение значения ячейки по формату колонки (например #,.3f)
        onCellFormat(rowIndex, cellIndex, column) {
            try {
                if (!column) return;
                if (!column.format && column.type !== 'int' && column.type !== 'float') return;
                const raw = this.safeCell(this.tableData[rowIndex], cellIndex);
                if (raw === '') return;
                const formatted = this.formatCellValue(raw, column);
                // Если форматирование изменило строку — применяем результат
                if (formatted !== raw) {
                    const updatedRow = [...this.tableData[rowIndex]];
                    updatedRow[cellIndex] = formatted;
                    this.tableData.splice(rowIndex, 1, updatedRow);
                    this.onInput();
                }
            } catch (e) {}
        },

        listColumnIsMultiselect(column) {
            if (!column || column.type !== 'list') return false;
            const allAttrs = (window.pageData && window.pageData.allAttrs) || {};
            let attrCfg = {};
            if (column.source && allAttrs[column.source]) {
                attrCfg = allAttrs[column.source] || {};
            } else if (column.attr && allAttrs[column.attr]) {
                attrCfg = allAttrs[column.attr] || {};
            }
            return !!(attrCfg.multiselect || column.multiselect);
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
            if (column.type === 'list' && this.listCellWidget) return;
            if (column.type === 'ip' && this.ipCellWidget) return;
            const el = this.getCellEditorElement(r, c);
            if (!el || el.tagName !== 'INPUT') return;
            const raw = String(el.value ?? '');
            const trimmed = raw.trim();
            if (trimmed === raw) return;
            el.value = trimmed;
            this.patchCellValue(r, c, trimmed);
        },
        patchCellValue(row, col, value) {
            const r = this.normRow(row);
            const c = this.normCol(col);
            const updatedRow = [...this.tableData[r]];
            updatedRow[c] = value;
            this.tableData.splice(r, 1, updatedRow);
            this.onInput();
        },
        getCellEditorElement(r, c) {
            const tableEl = this.getTableEl();
            if (!tableEl) return null;
            const row = this.normRow(r);
            const col = this.normCol(c);
            const td = tableEl.querySelector(`tbody td[data-row="${row}"][data-col="${col}"]`);
            if (!td) return null;
            return td.querySelector(
                '.list-combobox-input:not([disabled]), input.cell-input:not([disabled]), input.widget-ip:not([disabled]), select:not([disabled])'
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
                    const C = typeof window !== 'undefined' && window.TableWidgetCore;
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
            const len = this.tableData.length;
            const r = this.normRow(rowIndex);
            const target = r + delta;
            if (target < 0 || target >= len) return;
            const c = this.normCol(
                anchorCol != null ? anchorCol : this.selFocus.c
            );
            const [row] = this.tableData.splice(r, 1);
            this.tableData.splice(target, 0, row);
            this.onInput();
            this.setSelectionSingle(target, c);
            this.focusSelectionCellWithRetry(target, c);
        },

        /**
         * Дубликат строки выше/ниже относительно rowIndex. Глубокий clone через Utils.cloneTableRowDeep.
         */
        duplicateTableRowRelative(rowIndex, where, anchorCol) {
            const U =
                typeof window !== 'undefined' &&
                window.TableWidgetCore &&
                window.TableWidgetCore.Utils;
            const cloneFn = U && U.cloneTableRowDeep;
            if (typeof cloneFn !== 'function') return;
            const r = this.normRow(rowIndex);
            const len = this.tableData.length;
            if (r < 0 || r >= len) return;
            const c = this.normCol(
                anchorCol != null ? anchorCol : this.selFocus.c
            );
            const copy = cloneFn(this.tableData[r]);
            if (where === 'above') {
                this.tableData.splice(r, 0, copy);
                this.onInput();
                this.setSelectionSingle(r, c);
                this.focusSelectionCellWithRetry(r, c);
            } else {
                this.tableData.splice(r + 1, 0, copy);
                this.onInput();
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
            this.enterCellEditAt(r, c, { caretEnd: true });
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
            const column = this.tableColumns[c];
            const isList = column && column.type === 'list' && this.listCellWidget;
            const isIpComp = column && column.type === 'ip' && this.ipCellWidget;

            if (isList || isIpComp) {
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
            const K =
                typeof window !== 'undefined' &&
                window.TableWidgetCore &&
                window.TableWidgetCore.Keyboard;
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
            this.onInput();
            const newLen = this.tableData.length;
            const nr = Math.min(r0, newLen - 1);
            const safeCol = this.normCol(col);
            this.setSelectionSingle(nr, safeCol);
            this.$nextTick(() => this.focusSelectionCell(nr, safeCol));
        },

        insertRowBelowFullSelection() {
            if (!this.selectionIsFullRowBlock()) return;
            const col = this.activeCellCol();
            const { r1 } = this.getSelRect();
            const newRow = this.makeEmptyRow();
            this.tableData.splice(r1 + 1, 0, newRow);
            this.onInput();
            this.$nextTick(() => {
                const c = this.normCol(col);
                this.focusSelectionCell(this.normRow(this.selFocus.r), c);
            });
        },

        addNewRow() {
            const newRow = this.makeEmptyRow();
            this.tableData.push(newRow);
            this.onInput();
            const last = this.tableData.length - 1;
            this.setSelectionSingle(last, 0);
            this.$nextTick(() => this.focusSelectionCell(last, 0));
        },

        iconSrc(name) {
            const U = window.TableWidgetCore && window.TableWidgetCore.WidgetUiCoords;
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
            const U = window.TableWidgetCore && window.TableWidgetCore.WidgetUiCoords;
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
            const U = window.TableWidgetCore && window.TableWidgetCore.WidgetUiCoords;
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
            return {
                sessionId: this.contextMenuSessionId,
                bodyMode,
                anchorRow: anchorR,
                anchorCol: anchorC,
                rect,
                headerCol: headerCol != null ? headerCol : null,
                pasteAnchor: { r: pasteAnchor.r, c: pasteAnchor.c },
                sortColumnIndex: this.sortColumnIndex,
                sortDirection: this.sortDirection
            };
        },

        /** Снимок для шорткатов C/X/V (локально в keyboard; sessionId = текущий счётчик). */
        buildClipboardActionSnapshot() {
            const rect = this.cloneRect(this.getSelRect());
            const pasteAnchor = this.computePasteAnchorRect(this.getSelRect());
            return {
                sessionId: this.contextMenuSessionId,
                bodyMode: this.computeBodyModeForMenu(),
                anchorRow: this.selFocus.r,
                anchorCol: this.selFocus.c,
                rect,
                headerCol: null,
                pasteAnchor: { r: pasteAnchor.r, c: pasteAnchor.c },
                sortColumnIndex: this.sortColumnIndex,
                sortDirection: this.sortDirection
            };
        },

        clampMenuPosition(event) {
            const U = window.TableWidgetCore && window.TableWidgetCore.WidgetUiCoords;
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
            if (!this.headerSortEnabled) return;
            if (!this.isLeafHeaderRow(rIdx) || !cell || cell.colspan !== 1) return;
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
            if (!this.isEditable && id !== 'copy' && !sortIds[id]) return;
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
                default:
                    break;
            }
        },

        applySortFromMenu(snapshot, direction) {
            const col = snapshot.headerCol;
            if (col == null || col < 0) return;
            this.hideContextMenu();
            if (this.sortColumnIndex !== col) {
                this._sortCycleRowOrder = this.tableData.slice();
            }
            this.sortColumnIndex = col;
            this.sortDirection = direction === 'asc' ? 'asc' : 'desc';
            this.applyColumnSort(col, this.sortDirection);
            this.onInput();
        },

        applySortResetFromMenu(snapshot) {
            const col = snapshot.headerCol;
            if (col == null) return;
            this.hideContextMenu();
            if (this.sortColumnIndex !== col) return;
            this.sortColumnIndex = null;
            this.sortDirection = 'asc';
            this.restoreSortCycleRowOrder();
            this.onInput();
        },

        /**
         * В режимах cell/cells строка вставки — anchorRow (строка ПКМ), не верх/низ rect.
         * Пустая таблица: первая строка через makeEmptyRow(), anchorRow не используется.
         */
        addRowAboveFromSnapshot(snapshot) {
            if (this.tableData.length === 0) {
                const newRow = this.makeEmptyRow();
                this.tableData.splice(0, 0, newRow);
                this.onInput();
                this.hideContextMenu();
                return;
            }
            const ar = snapshot.anchorRow;
            if (ar < 0 || ar > this.tableData.length) return;
            const newRow = this.makeEmptyRow();
            this.tableData.splice(ar, 0, newRow);
            this.onInput();
            this.hideContextMenu();
        },

        addRowBelowFromSnapshot(snapshot) {
            if (this.tableData.length === 0) {
                const newRow = this.makeEmptyRow();
                this.tableData.push(newRow);
                this.onInput();
                this.hideContextMenu();
                return;
            }
            const ar = snapshot.anchorRow;
            if (ar < 0 || ar >= this.tableData.length) return;
            const newRow = this.makeEmptyRow();
            this.tableData.splice(ar + 1, 0, newRow);
            this.onInput();
            this.hideContextMenu();
        },

        /** v1: удаление строки только из row-mode (пункт меню не показывается иначе). */
        deleteRowFromSnapshot(snapshot) {
            if (snapshot.bodyMode !== 'row') return;
            const ar = snapshot.anchorRow;
            if (this.tableData.length <= 1) return;
            if (ar < 0 || ar >= this.tableData.length) return;
            this.tableData.splice(ar, 1);
            this.onInput();
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
                console.warn('[TableWidget] clipboard write', e);
            }
        },

        copySelection(snapshot) {
            if (!this.isEditable) return;
            const C = window.TableWidgetCore && window.TableWidgetCore.Clipboard;
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
            if (!this.isEditable) return;
            const C = window.TableWidgetCore && window.TableWidgetCore.Clipboard;
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
            const { r0, r1, c0, c1 } = rect;
            for (let r = r0; r <= r1; r++) {
                if (!this.tableData[r]) continue;
                const updatedRow = [...this.tableData[r]];
                for (let c = c0; c <= c1; c++) {
                    updatedRow[c] = this.emptyCellValueForColumn(c);
                }
                this.tableData.splice(r, 1, updatedRow);
            }
        },

        clearSelectionFromSnapshot(snapshot) {
            if (!this.isEditable) return;
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
            const { r: pr, c: pc } = snapshot.pasteAnchor;
            const nRows = this.tableData.length;
            const nCols = this.tableColumns.length;
            for (let i = 0; i < matrix.length; i++) {
                const r = pr + i;
                if (r < 0 || r >= nRows) continue;
                const rowData = matrix[i];
                if (!Array.isArray(rowData)) continue;
                const row = [...this.tableData[r]];
                for (let j = 0; j < rowData.length; j++) {
                    const c = pc + j;
                    if (c < 0 || c >= nCols) continue;
                    row[c] = rowData[j];
                }
                this.tableData.splice(r, 1, row);
            }
            this.onInput();
        },

        async pasteFromClipboard(snapshot) {
            if (!this.isEditable) return;
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
                    console.warn('[TableWidget] clipboard read', e);
                    return;
                }
                if (text == null || text === '') return;
                if (sid !== this.contextMenuSessionId) return;
                const C = window.TableWidgetCore && window.TableWidgetCore.Clipboard;
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

        parseTableAttrs(tableAttrs) {
            const C = typeof window !== 'undefined' && window.TableWidgetCore;
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
        this._detachContextMenuGlobalListeners();
    }
};

window.TableWidget = TableWidget;

/** Регистрация типа `table` в WidgetFactory (вызывается из factory.js после создания фабрики). */
window.registerTableWidget = function registerTableWidget(factory) {
    if (factory && typeof factory.register === 'function') {
        factory.register('table', TableWidget);
    }
};
