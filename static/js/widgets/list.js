// Виджет для списков (list)

const ListWidget = {
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
        <div class="widget-container" @focusout="onFocusOut">
            <div v-if="widgetConfig.description" class="widget-label">
                <span v-text="widgetConfig.description"></span>
            </div>
            
            <!-- Выпадающий список -->
            <div class="dropdown widget-dropdown" ref="dropdownRoot">
                <button class="btn btn-outline-secondary dropdown-toggle" 
                        type="button" 
                        data-bs-toggle="dropdown" 
                        :data-bs-auto-close="widgetConfig.multiselect ? 'outside' : true"
                        aria-expanded="false"
                        ref="dropdownToggle"
                        :disabled="widgetConfig.readonly"
                        :tabindex="widgetConfig.readonly ? -1 : null"
                        :title="getDisplayValue()"
                        :data-bs-toggle="widgetConfig.multiselect ? 'tooltip' : 'dropdown'"
                        :data-bs-placement="'top'"
                        @keydown.tab="onTab">
                    <span v-text="getDisplayValue()"></span>
                </button>
                <ul class="dropdown-menu" @keydown.tab="onTab">
                    <li v-for="item in listSource" :key="item">
                        <a class="dropdown-item" 
                           href="#" 
                           @click.prevent="selectItem(item, $event)"
                           :class="{ 'active': isItemSelected(item) }"
                           :title="item"
                           :data-bs-toggle="tooltip"
                           :data-bs-placement="'top'">
                            <span v-text="item"></span>
                        </a>
                    </li>
                </ul>
            </div>
            
            <div v-if="widgetConfig.info" class="widget-info">
                <span v-text="widgetConfig.info"></span>
            </div>
        </div>
    `,
    data() {
        return {
            value: null,
            lastSelectedItem: null
        };
    },
    computed: {
        // Получаем источник данных для списка
        listSource() {
            if (this.widgetConfig.source) {
                if (Array.isArray(this.widgetConfig.source)) {
                    return this.widgetConfig.source;
                } else if (typeof this.widgetConfig.source === 'object' && this.widgetConfig.source.command) {
                    // Здесь будет логика получения данных через команду
                    return ['Загрузка...'];
                }
            }
            return [];
        }
    },
    methods: {
        selectItem(item, event) {
            if (this.widgetConfig.multiselect) {
                // Множественный выбор
                if (!Array.isArray(this.value)) {
                    this.value = [];
                }
                
                if (event && event.shiftKey && this.lastSelectedItem) {
                    // Выбор диапазона с Shift
                    const lastIndex = this.listSource.indexOf(this.lastSelectedItem);
                    const currentIndex = this.listSource.indexOf(item);
                    const start = Math.min(lastIndex, currentIndex);
                    const end = Math.max(lastIndex, currentIndex);
                    
                    // Добавляем все элементы в диапазоне
                    for (let i = start; i <= end; i++) {
                        const rangeItem = this.listSource[i];
                        if (!this.value.includes(rangeItem)) {
                            this.value.push(rangeItem);
                        }
                    }
                } else {
                    // Обычный выбор
                    const index = this.value.indexOf(item);
                    if (index > -1) {
                        // Убираем элемент если уже выбран
                        this.value.splice(index, 1);
                    } else {
                        // Добавляем элемент
                        this.value.push(item);
                    }
                }
                
                this.lastSelectedItem = item;
                
                // ВАЖНО: НЕ закрываем список при множественном выборе!
                // Список должен оставаться открытым для выбора других элементов
            } else {
                // Одиночный выбор - закрываем список
                this.value = item;
                this.closeDropdown();
            }
            
            this.onInput();
        },
        
        isItemSelected(item) {
            if (this.widgetConfig.multiselect) {
                return Array.isArray(this.value) && this.value.includes(item);
            } else {
                return this.value === item;
            }
        },
        
        getDisplayValue() {
            if (this.widgetConfig.multiselect) {
                if (Array.isArray(this.value) && this.value.length > 0) {
                    return this.value.join(', ');
                } else {
                    return 'Выберите элементы';
                }
            } else {
                return this.value || 'Выберите элемент';
            }
        },
        
        closeDropdown() {
            // Закрываем dropdown используя Bootstrap API (toggle-кнопка)
            const toggle = this.$refs.dropdownToggle;
            if (toggle) {
                const dropdown = bootstrap.Dropdown.getOrCreateInstance(toggle, {
                    autoClose: this.widgetConfig.multiselect ? 'outside' : true
                });
                dropdown.hide();
            }
        },
        
        onTab() {
            // Закрываем по Tab только для multiselect
            if (this.widgetConfig.multiselect) {
                this.closeDropdown();
            }
        },
        
        onFocusOut() {
            // Если фокус ушел за пределы компонента — закрываем (только для multiselect)
            if (!this.widgetConfig.multiselect) return;
            setTimeout(() => {
                const root = this.$refs.dropdownRoot;
                if (!root) return;
                if (!root.contains(document.activeElement)) {
                    this.closeDropdown();
                }
            }, 0);
        },
        
        onInput() {
            this.$emit('input', {
                name: this.widgetName,
                value: this.value,
                config: this.widgetConfig
            });
        },
        
        setValue(value) {
            this.value = value;
        },
        
        getValue() {
            return this.value;
        },
        
        initTooltips() {
            // Инициализируем Bootstrap tooltips для элементов списка и кнопки
            this.$nextTick(() => {
                // Tooltips для элементов списка
                const tooltipElements = this.$el.querySelectorAll('[data-bs-toggle="tooltip"]');
                tooltipElements.forEach(element => {
                    new bootstrap.Tooltip(element, {
                        trigger: 'hover',
                        placement: 'top'
                    });
                });
                
                // Tooltip для кнопки выбора (только для multiselect)
                if (this.widgetConfig.multiselect) {
                    const toggleButton = this.$refs.dropdownToggle;
                    if (toggleButton) {
                        new bootstrap.Tooltip(toggleButton, {
                            trigger: 'hover',
                            placement: 'top'
                        });
                    }
                }
            });
        }
    },
    
    mounted() {
        
        // Инициализация значений по умолчанию
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        }
        
        // Инициализируем правильный тип значения
        if (this.widgetConfig.multiselect) {
            // Для multiselect значение должно быть массивом
            if (!Array.isArray(this.value)) {
                this.value = [];
            }
        } else {
            // Для обычного list значение должно быть строкой
            if (Array.isArray(this.value)) {
                this.value = this.value[0] || '';
            } else if (this.value === null || this.value === undefined) {
                this.value = '';
            }
        }
        
        // Инициализируем tooltips
        this.initTooltips();
    },
    
    updated() {
        // Переинициализируем tooltips при обновлении компонента
        this.initTooltips();
    }
};

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.ListWidget = ListWidget;
}
