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
            <div v-if="widgetConfig.description" class="widget-label">
                <span v-text="widgetConfig.description"></span>
            </div>
            
            <div class="widget-table-container">
                <table class="table table-striped widget-table">
                    <thead>
                        <tr v-for="(headerRow, rIdx) in headerRows" :key="rIdx">
                            <th v-for="(cell, cIdx) in headerRow" :key="cIdx" :colspan="cell.colspan" :rowspan="cell.rowspan">
                                <span v-text="cell.label"></span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
                            <td v-for="(leaf, cellIndex) in flatHeaders" :key="cellIndex">
                                <template v-if="isEditable">
                                    <input
                                        type="text"
                                        class="form-control form-control-sm"
                                        :value="safeCell(row, cellIndex)"
                                        @input="onCellInput(rowIndex, cellIndex, $event)"
                                    />
                                </template>
                                <template v-else>
                                    <span v-text="safeCell(row, cellIndex)"></span>
                                </template>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div v-if="widgetConfig.info" class="widget-info">
                <span v-text="widgetConfig.info"></span>
            </div>
        </div>
    `,
    data() {
        return {
            value: [],
            headerRows: [],
            flatHeaders: [],
            columnIds: [],
            tableData: []
        };
    },
    computed: {
        isEditable() {
            // Таблица редактируемая по умолчанию; если явно указан readonly: true — только для чтения
            return !(this.widgetConfig && this.widgetConfig.readonly === true);
        }
    },
    methods: {
        /**
         * Безопасно получить значение ячейки с учётом длины строки
         */
        safeCell(row, cellIndex) {
            if (!Array.isArray(row)) return '';
            return row[cellIndex] ?? '';
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
            const cols = this.flatHeaders.length;
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

        onCellInput(rowIndex, cellIndex, event) {
            const newValue = event.target.value;
            // Обновляем реактивно, создавая новый массив строки
            const updatedRow = [...this.tableData[rowIndex]];
            updatedRow[cellIndex] = newValue;
            // Заменяем строку в данных
            this.tableData.splice(rowIndex, 1, updatedRow);
            this.onInput();
        },

        // ---- Парсинг заголовков ----
        parseHeaders(headers) {
            // Поддержка старого формата: ["A", "B", ...]
            if (!Array.isArray(headers)) {
                this.headerRows = [[]];
                this.flatHeaders = [];
                this.columnIds = [];
                return;
            }

            // Нормализуем до структуры из узлов: { type:'leaf'|'group', label, id?, children? }
            const normalize = (item) => {
                if (typeof item === 'string') {
                    return { type: 'leaf', label: item, id: this.slugify(item) };
                }
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    // Вариант явной схемы: { id, label } или { group, columns }
                    if (item.label && !item.columns && !item.group) {
                        return { type: 'leaf', label: String(item.label), id: String(item.id || item.attr || this.slugify(item.label)) };
                    }
                    if (item.group && Array.isArray(item.columns)) {
                        return {
                            type: 'group',
                            label: String(item.group),
                            children: item.columns.map(normalize)
                        };
                    }
                    // YAML-короткая форма: { "Документ": ["код", "дата"] }
                    const keys = Object.keys(item);
                    if (keys.length === 1 && Array.isArray(item[keys[0]])) {
                        return {
                            type: 'group',
                            label: String(keys[0]),
                            children: item[keys[0]].map(normalize)
                        };
                    }
                }
                // Фоллбек — трактуем как лист
                return { type: 'leaf', label: String(item), id: this.slugify(String(item)) };
            };

            const nodes = headers.map(normalize);

            // Вычисляем максимальную глубину
            const getDepth = (node) => node.type === 'leaf' ? 1 : 1 + Math.max(0, ...node.children.map(getDepth));
            const maxDepth = Math.max(1, ...nodes.map(getDepth));

            // Собираем строки для thead и список конечных колонок
            const headerRows = Array.from({ length: maxDepth }, () => []);
            const flat = [];
            const ids = [];

            const walk = (node, level) => {
                if (node.type === 'leaf') {
                    headerRows[level].push({ label: node.label, colspan: 1, rowspan: maxDepth - level });
                    flat.push(node.label);
                    ids.push(node.id || this.slugify(node.label));
                } else if (node.type === 'group') {
                    // Кол-во листьев под группой
                    const countLeaves = (n) => n.type === 'leaf' ? 1 : n.children.reduce((acc, ch) => acc + countLeaves(ch), 0);
                    const colspan = node.children.reduce((acc, ch) => acc + countLeaves(ch), 0);
                    headerRows[level].push({ label: node.label, colspan, rowspan: 1 });
                    node.children.forEach(child => walk(child, level + 1));
                }
            };

            nodes.forEach(n => walk(n, 0));

            this.headerRows = headerRows;
            this.flatHeaders = flat;
            this.columnIds = ids;
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
        // Инициализация значений по умолчанию
        // Инициализация заголовков (поддержка групп)
        this.parseHeaders(this.widgetConfig.headers || []);

        // Инициализация данных
        if (this.widgetConfig.data) {
            this.tableData = JSON.parse(JSON.stringify(this.widgetConfig.data));
        } else {
            this.tableData = [];
        }

        // Нормализуем данные под число колонок
        const cols = this.flatHeaders.length;
        if (this.tableData.length === 0 && cols > 0 && this.isEditable) {
            this.tableData = [Array(cols).fill('')];
        } else if (cols > 0) {
            this.tableData = this.tableData.map(row => {
                const r = Array.isArray(row) ? [...row] : [];
                if (r.length < cols) r.push(...Array(cols - r.length).fill(''));
                if (r.length > cols) r.length = cols;
                return r;
            });
        }

        this.onInput();
    }
};

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.TableWidget = TableWidget;
}
