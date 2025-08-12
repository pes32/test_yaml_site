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
                        <tr>
                            <th v-for="header in tableHeaders" :key="header">
                                <span v-text="header"></span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
                            <td v-for="(cell, cellIndex) in row" :key="cellIndex">
                                <template v-if="isEditable">
                                    <input
                                        type="text"
                                        class="form-control form-control-sm"
                                        :value="tableData[rowIndex][cellIndex]"
                                        @input="onCellInput(rowIndex, cellIndex, $event)"
                                    />
                                </template>
                                <template v-else>
                                    <span v-text="cell"></span>
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
            tableHeaders: [],
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
        onInput() {
            this.$emit('input', {
                name: this.widgetName,
                value: this.tableData,
                config: this.widgetConfig
            });
        },
        
        setValue(value) {
            this.tableData = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : [];
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
        }
    },
    
    mounted() {
        // Инициализация значений по умолчанию
        // Инициализация таблицы
        if (this.widgetConfig.headers) {
            this.tableHeaders = this.widgetConfig.headers;
        }
        if (this.widgetConfig.data) {
            // Делаем глубокую копию, чтобы не мутировать исходную конфигурацию
            this.tableData = JSON.parse(JSON.stringify(this.widgetConfig.data));
        }

        // Если данных нет, но заданы заголовки и таблица редактируемая — создадим пустую строку
        if (this.tableData.length === 0 && this.tableHeaders.length > 0 && this.isEditable) {
            this.tableData = [Array(this.tableHeaders.length).fill('')];
        }

        this.onInput();
    }
};

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.TableWidget = TableWidget;
}
