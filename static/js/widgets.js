// Загрузчик виджетов для LowCode System

// Создаем глобальный компонент WidgetRenderer для Vue.js
// Этот компонент использует фабрику виджетов для динамического рендеринга

const WidgetRenderer = {
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
    emits: ['input', 'execute'],
    
    template: `
        <component 
            :is="widgetComponent"
            :widget-config="widgetConfig"
            :widget-name="widgetName"
            @input="onInput"
            @execute="onExecute">
        </component>
    `,
    
    computed: {
        widgetComponent() {
            // Получаем компонент виджета из фабрики
            if (window.widgetFactory && this.widgetConfig.widget) {
                return window.widgetFactory.getWidgetComponent(this.widgetConfig.widget);
            }
            
            // Fallback на StringWidget если фабрика не загружена
            return window.StringWidget || 'div';
        }
    },
    
    methods: {
        onInput(data) {
            this.$emit('input', data);
        },
        
        onExecute(data) {
            this.$emit('execute', data);
        }
    }
};

// Регистрируем компонент глобально
if (typeof window !== 'undefined') {
    window.WidgetRenderer = WidgetRenderer;
} 

// Компонент для кнопок модального окна
const ModalButtons = {
    props: {
        buttons: {
            type: Array,
            required: true
        }
    },
    emits: ['close'],
    template: `
        <div class="d-flex gap-2 justify-content-end">
            <template v-for="buttonName in buttons" :key="buttonName">
                <!-- Кнопка CLOSE - используем стандартный виджет кнопки -->
                <widget-renderer v-if="buttonName === 'CLOSE'"
                    :widget-config="getCloseButtonConfig()"
                    :widget-name="'CLOSE'">
                </widget-renderer>
                
                <!-- Обычная кнопка из attrs -->
                <widget-renderer v-else
                    :widget-config="getWidgetConfig(buttonName)"
                    :widget-name="buttonName">
                </widget-renderer>
            </template>
        </div>
    `,
    methods: {
        getCloseButtonConfig() {
            // Создаем стандартную конфигурацию для кнопки закрытия
            return {
                widget: 'button',
                description: 'Закрыть',
                command: 'CLOSE_MODAL'
            };
        },
        getWidgetConfig(widgetName) {
            if (window.pageData && window.pageData.allAttrs && window.pageData.allAttrs[widgetName]) {
                return window.pageData.allAttrs[widgetName];
            }
            return null;
        }
    }
};

// Глобальный менеджер модальных окон
const ModalManager = {
    data() {
        return {
            showModal: false,
            modalConfig: null,
            activeTabIndex: 0
        };
    },
    template: `
        <div v-if="showModal" class="modal-overlay" @click="closeModal">
            <div class="modal-content" @click.stop>
                <!-- Заголовок модального окна -->
                <div class="modal-header">
                    <h5 class="modal-title" v-text="modalTitle"></h5>
                    <button type="button" class="btn-close" @click="closeModal"></button>
                </div>
                
                <!-- Тело модального окна -->
                <div class="modal-body">
                    <div v-if="modalConfig">
                        <!-- Вкладки -->
                        <ul v-if="modalConfig.tabs && modalConfig.tabs.length > 1" class="nav nav-tabs mb-3">
                            <li class="nav-item" v-for="(tab, index) in modalConfig.tabs" :key="index">
                                <a class="nav-link" 
                                   :class="{ active: index === activeTabIndex }" 
                                   @click="setActiveTab(index)"
                                   href="#">
                                    <span v-text="tab.name"></span>
                                </a>
                            </li>
                        </ul>
                        
                        <!-- Содержимое активной вкладки -->
                        <div v-if="activeTabContent" class="tab-content">
                            <div class="tab-pane active">
                                <!-- Секции -->
                                <div v-for="(section, sidx) in activeTabContent.content" :key="sidx" class="mb-3">
                                    <div class="card">
                                        <!-- Заголовок секции (опциональный) -->
                                        <div v-if="section.showHeader" class="card-header">
                                            <h6 class="mb-0" v-text="section.name"></h6>
                                        </div>
                                        
                                        <!-- Тело секции -->
                                        <div class="card-body">
                                            <!-- Строки -->
                                            <div v-for="(row, rowIndex) in section.rows" :key="rowIndex" class="row mb-2">
                                                <div v-if="typeof row === 'string'" class="col-12">
                                                    <span class="text-muted" v-text="row"></span>
                                                </div>
                                                <div v-else-if="row.widgets && Array.isArray(row.widgets)" class="col-12">
                                                    <div class="row">
                                                        <div v-for="(item, itemIndex) in row.widgets" :key="itemIndex" class="col-auto">
                                                            <widget-renderer 
                                                                :widget-config="getWidgetConfig(item)"
                                                                :widget-name="item"
                                                                @execute="onWidgetExecute">
                                                            </widget-renderer>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Линия кнопок -->
                <div v-if="modalConfig && modalConfig.buttons" class="modal-footer">
                    <modal-buttons 
                        :buttons="modalConfig.buttons"
                        @close="closeModal">
                    </modal-buttons>
                </div>
            </div>
        </div>
    `,
    computed: {
        modalTitle() {
            if (!this.modalConfig) return 'Модальное окно';
            return this.modalConfig.name || 'Модальное окно';
        },
        activeTabContent() {
            if (!this.modalConfig || !this.modalConfig.tabs) return null;
            if (this.modalConfig.tabs.length === 0) return null;
            if (this.modalConfig.tabs.length === 1) return this.modalConfig.tabs[0];
            return this.modalConfig.tabs[this.activeTabIndex];
        }
    },
    methods: {
        openModal(modalName) {
            this.loadModalConfig(modalName);
            this.showModal = true;
        },
        
        closeModal() {
            this.showModal = false;
            this.activeTabIndex = 0;
        },
        
        setActiveTab(index) {
            this.activeTabIndex = index;
        },
        
        loadModalConfig(modalName) {
            // Ищем конфигурацию модального окна в глобальных данных страницы
            if (window.pageData && window.pageData.pageConfig) {
                const pageConfig = window.pageData.pageConfig;
                
                // Сначала ищем на верхнем уровне pageConfig
                if (pageConfig[modalName]) {
                    this.modalConfig = pageConfig[modalName];
                    console.log('Modal config found at top level:', this.modalConfig);
                    return;
                }
                
                // Затем ищем внутри gui
                if (pageConfig.gui && pageConfig.gui[modalName]) {
                    const guiConfig = pageConfig.gui[modalName];
                    
                    // Если это массив, берем первый элемент
                    if (Array.isArray(guiConfig) && guiConfig.length > 0) {
                        this.modalConfig = guiConfig[0];
                        console.log('Modal config found in gui (array):', this.modalConfig);
                        return;
                    }
                    
                    // Если это объект, используем как есть
                    if (typeof guiConfig === 'object') {
                        this.modalConfig = guiConfig;
                        console.log('Modal config found in gui (object):', this.modalConfig);
                        return;
                    }
                }
            }
            
            console.warn('Modal config not found for:', modalName);
            
            // Fallback: создаем простую конфигурацию
            this.modalConfig = {
                name: modalName,
                tabs: [{
                    name: 'Основная',
                    content: [{
                        name: 'Содержимое',
                        rows: [{
                            widgets: ['popup_string', 'popup_int']
                        }]
                    }]
                }]
            };
        },
        
        getWidgetConfig(widgetName) {
            // Получаем конфигурацию виджета из глобальных данных
            if (window.pageData && window.pageData.allAttrs) {
                return window.pageData.allAttrs[widgetName] || {
                    widget: 'str',
                    description: widgetName
                };
                }
            return {
                widget: 'str',
                description: widgetName
            };
        },
        
        onWidgetExecute(data) {
            // Передаем события от виджетов в модальном окне
            this.$emit('execute', data);
        }
    }
};

// Регистрируем глобально
if (typeof window !== 'undefined') {
    window.ModalManager = ModalManager;
    window.ModalButtons = ModalButtons;
} 
