// Виджет для модальных окон (modal)

const ModalWidget = {
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
    emits: ['execute'],
    template: `
        <div class="widget-container">
            <div v-if="widgetConfig.description" class="widget-label">
                <span v-text="widgetConfig.description"></span>
            </div>
            
            <button 
                type="button" 
                class="btn btn-primary"
                @click="openModal">
                <i v-if="widgetConfig.icon" class="fas fa-window-maximize me-2"></i>
                <span v-text="widgetConfig.description || 'Открыть'"></span>
            </button>
            
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
                    
                    <!-- Футер модального окна -->
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="closeModal">Закрыть</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            showModal: false,
            activeTabIndex: 0,
            modalConfig: null
        };
    },
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
        openModal() {
            // Получаем конфигурацию модального окна из команды
            const command = this.widgetConfig.command;
            if (command && command.includes(' -ui')) {
                const modalName = command.replace(' -ui', '').trim();
                this.loadModalConfig(modalName);
            }
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
            if (window.pageData && window.pageData.pageConfig && window.pageData.pageConfig.gui) {
                const gui = window.pageData.pageConfig.gui;
                if (gui[modalName]) {
                    this.modalConfig = gui[modalName];
                    return;
                }
            }
            
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

// Регистрируем виджет глобально
if (typeof window !== 'undefined') {
    window.ModalWidget = ModalWidget;
}
