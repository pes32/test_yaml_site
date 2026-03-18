// Виджет для таблиц (table)

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
            
            <div class="widget-table-container">
                <table class="table table-striped widget-table" :class="{ 'widget-table--editable': isEditable }" style="margin-bottom: 0;">
                    <thead>
                        <tr v-for="(headerRow, rIdx) in headerRows" :key="rIdx">
                            <th v-for="(cell, cIdx) in headerRow" :key="cIdx" :colspan="cell.colspan" :rowspan="cell.rowspan" :style="{ width: cell.width }">
                                <span v-text="cell.label"></span>
                            </th>
                        </tr>
                        <tr v-if="hasColumnNumbers">
                            <th v-for="(column, index) in tableColumns" :key="'num-' + index">
                                <span v-text="column.number != null ? column.number : ''"></span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
                            <td v-for="(column, cellIndex) in tableColumns" :key="cellIndex"
                                @contextmenu="showContextMenu($event, rowIndex)"
                                style="cursor: pointer;">
                                <template v-if="isEditable">
                                    <!-- Встроенные инпуты вместо динамических компонентов для стабильности ввода -->
                                    <component v-if="column.type==='list' && listCellWidget"
                                               :is="listCellWidget"
                                               :widget-config="cellListConfig(rowIndex, cellIndex, column)"
                                               :widget-name="cellWidgetName(rowIndex, cellIndex)"
                                               @input="onCellWidgetPayload(rowIndex, cellIndex, $event)"/>
                                    <input v-else-if="column.type==='datetime'"
                                           type="datetime-local"
                                           class="cell-input w-100"
                                           :value="safeCell(row, cellIndex)"
                                           @input="onCellInput(rowIndex, cellIndex, $event)"
                                           @blur="onCellFormat(rowIndex, cellIndex, column)"
                                           @keydown="onCellKeydown(rowIndex, cellIndex, $event)"/>
                                    <input v-else-if="column.type==='date'"
                                           type="date"
                                           class="cell-input w-100"
                                           :value="safeCell(row, cellIndex)"
                                           @input="onCellInput(rowIndex, cellIndex, $event)"
                                           @keydown="onCellKeydown(rowIndex, cellIndex, $event)"/>
                                    <input v-else-if="column.type==='time'"
                                           type="time"
                                           class="cell-input w-100"
                                           :value="safeCell(row, cellIndex)"
                                           @input="onCellInput(rowIndex, cellIndex, $event)"
                                           @keydown="onCellKeydown(rowIndex, cellIndex, $event)"/>
                                    <component v-else-if="column.type==='ip' && ipCellWidget"
                                               :is="ipCellWidget"
                                               :widget-config="cellWidgetConfig()"
                                               :widget-name="cellWidgetName(rowIndex, cellIndex)"
                                               @input="onCellWidgetPayload(rowIndex, cellIndex, $event)"/>
                                    <input v-else-if="column.type==='ip'"
                                           type="text"
                                           class="cell-input w-100"
                                           :value="safeCell(row, cellIndex)"
                                           @input="onIpInput(rowIndex, cellIndex, $event)"
                                           @keydown="onCellKeydown(rowIndex, cellIndex, $event)"
                                           placeholder="xxx.xxx.xxx.xxx"/>
                                    <input v-else
                                        type="text"
                                           class="cell-input w-100"
                                        :value="safeCell(row, cellIndex)"
                                        @input="onCellInput(rowIndex, cellIndex, $event)"
                                           @blur="onCellFormat(rowIndex, cellIndex, column)"
                                           @keydown="onCellKeydown(rowIndex, cellIndex, $event)"/>
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
            
            <!-- Контекстное меню для таблицы -->
            <div v-if="showContextMenuFlag" 
                 class="context-menu" 
                 :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
                 @click.stop>
                <div class="context-menu-item" @click="addRowAbove">
                    <span aria-hidden="true">+</span> Добавить строку выше
                </div>
                <div class="context-menu-item" @click="addRowBelow">
                    <span aria-hidden="true">+</span> Добавить строку ниже
                </div>
                <div class="context-menu-item" @click="deleteRow" v-if="tableData.length > 1">
                    <span aria-hidden="true">×</span> Удалить строку
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            value: [],
            headerRows: [],
            tableColumns: [],
            tableData: [],
            showContextMenuFlag: false,
            contextMenuX: 0,
            contextMenuY: 0,
            selectedRowIndex: -1,
            ipCellWidget: (window.IpWidget && typeof Vue !== 'undefined') ? Vue.markRaw(window.IpWidget) : null,
            listCellWidget: (window.ListWidget && typeof Vue !== 'undefined') ? Vue.markRaw(window.ListWidget) : null
        };
    },
    computed: {
        isEditable() {
            // Таблица редактируемая по умолчанию; если явно указан readonly: true — только для чтения
            return !(this.widgetConfig && this.widgetConfig.readonly === true);
        },
        hasColumnNumbers() {
            return Array.isArray(this.tableColumns) && this.tableColumns.some(c => c && c.number != null);
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
    methods: {
        initializeTable() {
            this.headerRows = [];
            this.tableColumns = [];
            this.tableData = [];
            this.showContextMenuFlag = false;
            this.selectedRowIndex = -1;

            // Инициализация нового формата таблицы
            this.parseTableAttrs(this.widgetConfig.table_attrs);

            // Инициализация данных
            if (this.widgetConfig.source && typeof this.widgetConfig.source === 'object' && Array.isArray(this.widgetConfig.source)) {
                // Если source содержит массив данных (для таблиц только для чтения)
                this.tableData = JSON.parse(JSON.stringify(this.widgetConfig.source));
            } else if (this.widgetConfig.data) {
                // Fallback на старый формат data для обратной совместимости
                this.tableData = JSON.parse(JSON.stringify(this.widgetConfig.data));
            } else {
                this.tableData = [];
            }

            // Нормализуем данные под число колонок
            const cols = this.tableColumns.length;
            if (cols > 0) {
                if (this.tableData.length === 0 && this.isEditable) {
                    this.tableData = [Array(cols).fill('')];
                } else if (this.tableData.length > 0) {
                    this.tableData = this.tableData.map(row => {
                        const r = Array.isArray(row) ? [...row] : [];
                        if (r.length < cols) r.push(...Array(cols - r.length).fill(''));
                        if (r.length > cols) r.length = cols;
                        return r;
                    });
                }
            }

            this.onInput();
        },

        getMeasureContext() {
            if (!this._measureCtx) {
                const canvas = document.createElement('canvas');
                this._measureCtx = canvas.getContext('2d');
                // Приблизительно соответствуем шрифту заголовка таблицы
                this._measureCtx.font = '500 16px system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", \"Liberation Sans\", sans-serif';
            }
            return this._measureCtx;
        },

        computeAutoWidth(label) {
            try {
                const ctx = this.getMeasureContext();
                const text = String(label || '');
                const textWidth = Math.ceil(ctx.measureText(text).width);
                // Учитываем внутренние отступы ячейки
                const padding = 24; // ~12px слева и справа
                const max = 500;
                const width = Math.min(max, textWidth + padding);
                return `${width}px`;
            } catch (e) {
                // Фоллбек
                const approx = Math.min(500, (String(label || '').length * 10) + 24);
                return `${approx}px`;
            }
        },
        /**
         * Безопасно получить значение ячейки с учётом длины строки
         */
        safeCell(row, cellIndex) {
            if (!Array.isArray(row)) return '';
            return row[cellIndex] ?? '';
        },

        /**
         * Форматирование значения ячейки согласно типу данных
         */
        formatCellValue(value, column) {
            if (value === null || value === undefined) return '';

            const asString = String(value);

            const addThousands = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

            if (column.type === 'datetime') {
                const d = new Date(value);
                return isNaN(d.getTime()) ? asString : d.toLocaleString('ru-RU');
            }

            if (column.type === 'date') {
                const d = new Date(value);
                return isNaN(d.getTime()) ? asString : d.toLocaleDateString('ru-RU');
            }

            if (column.type === 'time') {
                // Ожидаем формат HH:MM, допускаем HH:MM:SS
                const m = String(value).match(/^([0-2]\d:[0-5]\d)(?::[0-5]\d)?$/);
                if (m) return m[1];
                const d = new Date(`1970-01-01T${value}`);
                if (!isNaN(d.getTime())) return d.toTimeString().slice(0, 5);
                return asString;
            }

            if (column.type === 'list') return asString;

            // Числовые форматы (#, .p, e/f/d)
            if (column.format) {
                const fmt = String(column.format);
                const hasThousands = /#,/.test(fmt) || /,/.test(fmt.replace(/^#/, ''));
                const precMatch = fmt.match(/\.([0-9]+)/);
                const precision = precMatch ? parseInt(precMatch[1], 10) : undefined;
                const kindMatch = fmt.match(/([def])\s*$/);
                const kind = kindMatch ? kindMatch[1] : undefined; // 'd' | 'e' | 'f' | undefined

                const num = Number(value);
                if (Number.isNaN(num)) return asString; // не удалось преобразовать

                if (kind === 'e') {
                    const p = precision !== undefined ? precision : 6;
                    return num.toExponential(p);
                }

                if (kind === 'd') {
                    const intStr = Math.trunc(num).toString();
                    return hasThousands ? addThousands(intStr) : intStr;
                }

                // kind === 'f' или не указан — формат с плавающей точкой
                if (precision !== undefined) {
                    const fixed = num.toFixed(precision);
                    if (hasThousands) {
                        const [intPart, fracPart = ''] = fixed.split('.');
                        const withSep = addThousands(intPart);
                        return fracPart ? `${withSep}.${fracPart}` : withSep;
                    }
                    return fixed;
                }
                // Без точности — как есть, при необходимости добавим разделители тысяч
                const plain = String(num);
                if (hasThousands) {
                    const [intPart, fracPart = ''] = plain.split('.');
                    const withSep = addThousands(intPart);
                    return fracPart ? `${withSep}.${fracPart}` : withSep;
                }
                return plain;
            }

            // По типу без format
            if (column.type === 'float' || column.type === 'int') {
                const num = Number(value);
                return Number.isNaN(num) ? asString : String(num);
            }

            return asString;
        },

        /**
         * Получение компонента для ввода в зависимости от типа данных
         */
        getInputComponent(type) {
            let component = null;
            
            switch (type) {
                case 'datetime':
                    component = 'DatetimeInput';
                    break;
                case 'int':
                    component = 'IntInput';
                    break;
                case 'float':
                    component = 'FloatInput';
                    break;
                case 'list':
                    component = 'ListInput';
                    break;
                case 'ip':
                    component = 'IpInput';
                    break;
                default:
                    component = 'StringInput';
                    break;
            }
            
            // Возвращаем сам объект компонента, если он есть в window,
            // иначе имя (на случай, если его зарегистрировали через app.component)
            const compObj = window[component];
            return compObj || component;
        },

        /**
         * Проверка доступности компонента
         */
        isComponentAvailable(type) {
            // Проверяем наличие глобального объекта компонента
            const nameMap = {
                datetime: 'DatetimeInput',
                int: 'IntInput',
                float: 'FloatInput',
                list: 'ListInput',
                ip: 'IpInput',
                str: 'StringInput'
            };
            const compName = nameMap[type] || 'StringInput';
            const exists = typeof window[compName] !== 'undefined';
            return exists;
        },

        onInput() {
            this.$emit('input', {
                name: this.widgetName,
                value: this.tableData,
                config: this.widgetConfig
            });
        },
        
        setValue(value) {
            const incoming = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : [];
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

            const isMulti = !!(attrCfg.multiselect || column?.multiselect);
            // Корректируем значение по типу
            let defVal = currentVal;
            if (isMulti) {
                if (!Array.isArray(defVal)) defVal = defVal ? [defVal] : [];
            } else {
                if (Array.isArray(defVal)) defVal = defVal[0] || '';
            }
            return {
                widget: 'list',
                source: this.getListOptions(column ? column.source : null),
                multiselect: isMulti,
                default: defVal
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

        onCellKeydown(rowIndex, cellIndex, event) {
            // При нажатии ENTER на последней ячейке создаем новую строку
            if (
                event.key === 'Enter' &&
                cellIndex === this.tableColumns.length - 1 &&
                rowIndex === this.tableData.length - 1
            ) {
                // Только если курсор в последней ячейке последней строки
                event.preventDefault();
                this.addNewRow();
            }
        },

        addNewRow() {
            const cols = this.tableColumns.length;
            const newRow = Array(cols).fill('');
            this.tableData.push(newRow);
            this.onInput();
        },

        deleteRow() {
            if (this.tableData.length > 1 && this.selectedRowIndex >= 0) {
                this.tableData.splice(this.selectedRowIndex, 1);
                this.onInput();
            }
            this.hideContextMenu();
        },

        addRowAbove() {
            if (this.selectedRowIndex >= 0) {
                const cols = this.tableColumns.length;
                const newRow = Array(cols).fill('');
                this.tableData.splice(this.selectedRowIndex, 0, newRow);
                this.onInput();
            }
            this.hideContextMenu();
        },

        addRowBelow() {
            if (this.selectedRowIndex >= 0) {
                const cols = this.tableColumns.length;
                const newRow = Array(cols).fill('');
                this.tableData.splice(this.selectedRowIndex + 1, 0, newRow);
                this.onInput();
            }
            this.hideContextMenu();
        },

        showContextMenu(event, rowIndex) {
            if (!this.isEditable) return;
            
            event.preventDefault();
            this.selectedRowIndex = rowIndex;
            this.contextMenuX = event.clientX;
            this.contextMenuY = event.clientY;
            this.showContextMenuFlag = true;
            
            // Скрываем меню при клике вне его
            setTimeout(() => {
                document.addEventListener('click', this.hideContextMenu, { once: true });
            }, 0);
        },

        hideContextMenu() {
            this.showContextMenuFlag = false;
            this.selectedRowIndex = -1;
        },

        // ---- Парсинг нового формата table_attrs ----
        parseTableAttrs(tableAttrs) {
            
            if (!tableAttrs) {
                this.tableColumns = [];
                return;
            }

            const lines = tableAttrs.trim().split('\n');
            const columns = [];
            const nodes = []; // список верхнего уровня: листья и группы
            let currentGroup = null;

            const parseLeafFromParts = (attrName, remainder) => {
                let label = '';
                let width = null;
                let type = 'str';
                let format = null;
                let source = null;
                let number = null;

                // Если остаток пустой, метка по умолчанию — имя атрибута
                label = (remainder || attrName || '').trim();

                const colonTokens = (remainder && remainder.match(/:\S+/g)) || [];
                const hashTokens = (remainder && remainder.match(/#[^\s]+/g)) || [];
                const numTokens = (remainder && remainder.match(/№\s*\d+/g)) || [];

                colonTokens.forEach(tok => {
                    const value = tok.substring(1);
                    if (/^\d+$/.test(value)) {
                        width = value + 'px';
                    } else if (value === 'ip' || value === 'ip_mask' || value === 'datetime' || value === 'date' || value === 'time' || value === 'int' || value === 'float') {
                        type = value;
                    } else {
                        source = value;
                        type = 'list';
                    }
                });

                if (hashTokens && hashTokens.length > 0) {
                    format = hashTokens[0];
                    type = 'float';
                }

                if (numTokens && numTokens.length > 0) {
                    const mNum = numTokens[0].match(/\d+/);
                    if (mNum) number = parseInt(mNum[0], 10);
                }

                // Очистка метки
                let cleanLabel = label;
                [...colonTokens, ...hashTokens, ...numTokens].forEach(tok => {
                    cleanLabel = cleanLabel.replace(tok, '');
                });
                cleanLabel = cleanLabel.replace(/^\/+/, '').replace(/\s{2,}/g, ' ').trim();
                if (!cleanLabel) cleanLabel = attrName;

                const leaf = { type: 'leaf', label: cleanLabel, attr: attrName, width, dataType: type, format, source, number };
                return leaf;
            };

            lines.forEach((line, index) => {
                line = line.trim();
                if (!line) {
                    // Пустая строка завершает текущую группу
                    currentGroup = null;
                    return;
                }

                // Заголовок группы
                if (line.startsWith('/')) {
                    const groupLabel = line.substring(1).trim();
                    currentGroup = { type: 'group', label: groupLabel, children: [] };
                    nodes.push(currentGroup);
                    return;
                }

                // Лист-колонка
                const firstSlashIndex = line.indexOf('/');
                let attrName = '';
                let remainder = '';
                if (firstSlashIndex > 0) {
                    attrName = line.substring(0, firstSlashIndex).trim();
                    remainder = line.substring(firstSlashIndex + 1).trim();
                } else {
                    const m = line.match(/^([^\s:#№]+)/);
                    attrName = m ? m[1] : line;
                    remainder = line.slice(attrName.length).trim();
                }

                const leaf = parseLeafFromParts(attrName, remainder);
                const flatColumn = { attr: leaf.attr, label: leaf.label, type: leaf.dataType, width: leaf.width, format: leaf.format, source: leaf.source, number: leaf.number };
                columns.push(flatColumn);

                if (currentGroup && currentGroup.type === 'group') {
                    currentGroup.children.push({ type: 'leaf', label: leaf.label, width: leaf.width });
                } else {
                    nodes.push({ type: 'leaf', label: leaf.label, width: leaf.width });
                }
            });
            
            // Назначаем авто-ширины там, где не указаны, и переносим их в узлы
            // Сначала дополним ширины у колонок
            columns.forEach(col => {
                if (!col.width) {
                    col.width = this.computeAutoWidth(col.label);
                }
            });

            // Затем проставим ширины в дереве узлов в порядке обхода листьев
            let leafIdx = 0;
            const assignWidths = (node) => {
                if (node.type === 'leaf') {
                    const col = columns[leafIdx++];
                    node.width = col && col.width ? col.width : this.computeAutoWidth(node.label);
                } else if (node.type === 'group') {
                    node.children.forEach(assignWidths);
                    // После назначения потомкам, вычислим суммарную ширину группы
                    const sumPx = node.children.reduce((acc, ch) => {
                        if (!ch.width) return acc;
                        const m = String(ch.width).match(/\d+/);
                        return acc + (m ? parseInt(m[0], 10) : 0);
                    }, 0);
                    node.width = sumPx ? `${sumPx}px` : undefined;
                }
            };
            nodes.forEach(assignWidths);

            // Построение строк заголовка на основе nodes
            const countLeaves = (n) => n.type === 'leaf' ? 1 : n.children.reduce((acc, ch) => acc + countLeaves(ch), 0);
            const maxDepth = Math.max(1, ...nodes.map(n => n.type === 'leaf' ? 1 : 2));
            const headerRows = Array.from({ length: maxDepth }, () => []);

            const walk = (node, level) => {
                if (node.type === 'leaf') {
                    headerRows[level].push({ label: node.label, colspan: 1, rowspan: maxDepth - level, width: node.width });
                } else if (node.type === 'group') {
                    const colspan = node.children.reduce((acc, ch) => acc + countLeaves(ch), 0);
                    headerRows[level].push({ label: node.label, colspan, rowspan: 1, width: node.width });
                    node.children.forEach(ch => walk(ch, level + 1));
                }
            };
            nodes.forEach(n => walk(n, 0));

            this.tableColumns = columns;
            this.headerRows = headerRows;
        },

        slugify(text) {
            return String(text || '')
                .toLowerCase()
                .normalize('NFD').replace(/\p{Diacritic}/gu, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }
    },
    
    mounted() {
        this.initializeTable();
    }
};

window.TableWidget = TableWidget;
