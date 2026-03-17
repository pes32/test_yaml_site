// Загрузчик виджетов
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
            :key="componentKey"
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
        },

        componentKey() {
            const widgetType = this.widgetConfig && this.widgetConfig.widget
                ? this.widgetConfig.widget
                : 'str';
            return `${widgetType}:${this.widgetName}`;
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
                label: 'Закрыть',
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
            activeTabIndex: 0,
            collapsedModalSections: {},
            collapsingModalSectionId: null
        };
    },
    mounted() {
        // Делаем менеджер доступным глобально на случай, если ref недоступен
        if (typeof window !== 'undefined') {
            window.modalManager = this;
        }
    },
    template: `
        <div v-if="showModal" class="modal-overlay" @click="closeModal">
            <div class="modal-content" @click.stop>
                <div class="modal-header">
                    <div class="d-flex align-items-center gap-2">
                        <span v-if="modalConfig && modalConfig.icon" class="page-item-icon">
                            <img v-if="!isFontIcon(modalConfig.icon)"
                                 :src="getIconSrc(modalConfig.icon)"
                                 alt=""
                                 @error="onIconError">
                            <i v-else :class="modalConfig.icon"></i>
                        </span>
                        <h5 class="modal-title" v-text="modalTitle"></h5>
                    </div>
                    <button type="button" class="btn-close" @click="closeModal"></button>
                </div>
                
                <div class="modal-body">
                    <div v-if="modalConfig">
                        <ul v-if="modalTabs.length > 1" class="nav nav-tabs mb-3">
                            <li class="nav-item" v-for="(tab, index) in modalTabs" :key="index">
                                <a class="nav-link" 
                                   :class="{ active: index === activeTabIndex }" 
                                   @click.prevent="setActiveTab(index)"
                                   href="#">
                                    <span v-if="tab.icon" class="page-item-icon">
                                        <img v-if="!isFontIcon(tab.icon)"
                                             :src="getIconSrc(tab.icon)"
                                             alt=""
                                             @error="onIconError">
                                        <i v-else :class="tab.icon"></i>
                                    </span>
                                    <span v-text="tab.name || ('Вкладка ' + (index + 1))"></span>
                                </a>
                            </li>
                        </ul>
                        
                        <div class="tab-content">
                            <div class="tab-pane active">
                                <div v-for="(section, sidx) in activeSections" :key="sidx" class="mb-3">
                                    <div class="card">
                                        <div v-if="section.showHeader"
                                             class="card-header"
                                             :class="{ collapsed: section.collapsible && isModalSectionCollapsed(sidx) }"
                                             @click="section.collapsible ? toggleModalSectionCollapse(sidx) : null"
                                             :style="section.collapsible ? 'cursor: pointer;' : ''">
                                            <h6 class="mb-0 d-flex align-items-center">
                                                <img v-if="section.collapsible"
                                                     src="/templates/icons/arrow.svg"
                                                     class="collapse-icon me-2"
                                                     alt="">
                                                <span v-if="section.icon" class="page-item-icon">
                                                    <img v-if="!isFontIcon(section.icon)"
                                                         :src="getIconSrc(section.icon)"
                                                         alt=""
                                                         @error="onIconError">
                                                    <i v-else :class="section.icon"></i>
                                                </span>
                                                <span v-text="section.name"></span>
                                            </h6>
                                        </div>

                                        <div :class="section.collapsible ? ('collapse ' + (isModalSectionCollapsed(sidx) ? '' : 'show')) : ''"
                                             :id="section.collapsible ? getModalSectionCollapseId(sidx) : null">
                                            <div class="collapse-inner" :class="{ 'collapse-animating': section.collapsible && collapsingModalSectionId === getModalSectionCollapseId(sidx) }">
                                            <div class="card-body">
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
                                                    <div v-else-if="row.columns && typeof row.columns === 'object'" class="col-12">
                                                        <div class="row">
                                                            <div v-for="(column, colIndex) in row.columns"
                                                                 :key="colIndex"
                                                                 :class="'col-md-' + (12 / Object.keys(row.columns).length)">
                                                                <div v-for="(item, itemIndex) in column.widgets" :key="itemIndex" class="mb-2">
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
                        </div>
                    </div>
                </div>
                
                <div v-if="modalConfig && modalConfig.buttons && modalConfig.buttons.length" class="modal-footer">
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
        modalTabs() {
            if (!this.modalConfig || !Array.isArray(this.modalConfig.tabs)) {
                return [];
            }

            return this.modalConfig.tabs;
        },
        activeSections() {
            if (!this.modalConfig) {
                return [];
            }

            if (this.modalTabs.length) {
                const safeIndex = Math.max(0, Math.min(this.activeTabIndex, this.modalTabs.length - 1));
                const activeTab = this.modalTabs[safeIndex];
                return activeTab && Array.isArray(activeTab.content) ? activeTab.content : [];
            }

            return Array.isArray(this.modalConfig.content) ? this.modalConfig.content : [];
        }
    },
    methods: {
        async openModal(modalName) {
            this.loadModalConfig(modalName);
            // лениво подгружаем атрибуты (ждём завершения)
            await this.ensureModalAttrsLoaded();
            this.showModal = true;
        },
        
        closeModal() {
            this.showModal = false;
            this.activeTabIndex = 0;
        },
        
        setActiveTab(index) {
            if (index < 0 || index >= this.modalTabs.length) {
                return;
            }

            this.activeTabIndex = index;
        },

        getModalSectionCollapseId(sectionIndex) {
            const tabPart = this.modalTabs.length ? this.activeTabIndex : 'content';
            return `modal-section-${tabPart}-${sectionIndex}`;
        },

        isModalSectionCollapsed(sectionIndex) {
            return Boolean(this.collapsedModalSections[this.getModalSectionCollapseId(sectionIndex)]);
        },

        toggleModalSectionCollapse(sectionIndex) {
            const id = this.getModalSectionCollapseId(sectionIndex);
            this.collapsingModalSectionId = id;
            this.collapsedModalSections = { ...this.collapsedModalSections, [id]: !this.collapsedModalSections[id] };
            setTimeout(() => {
                this.collapsingModalSectionId = null;
            }, 350);
        },

        getParsedGui() {
            if (!window.pageData || !window.pageData.pageConfig || !window.GuiParser) {
                return { menus: [], modals: {} };
            }

            if (!window.pageData.parsedGui) {
                const pageConfig = window.pageData.pageConfig;
                window.pageData.parsedGui = window.GuiParser.parsePageGui(pageConfig || {});
            }

            return window.pageData.parsedGui;
        },

        loadModalConfig(modalName) {
            const parsedGui = this.getParsedGui();
            if (parsedGui.modals && parsedGui.modals[modalName]) {
                this.modalConfig = parsedGui.modals[modalName];
                this.activeTabIndex = 0;
                return;
            }

            console.warn('Modal config not found for:', modalName);

            this.modalConfig = {
                id: modalName,
                name: modalName,
                icon: '',
                tabs: [],
                content: [{
                    type: 'box',
                    name: '',
                    icon: '',
                    rows: [{
                        widgets: ['popup_string', 'popup_int']
                    }],
                    collapsible: false,
                    showHeader: false
                }],
                buttons: ['CLOSE']
            };
        },
        
        getWidgetConfig(widgetName) {
            // Получаем конфигурацию виджета из глобальных данных
            if (window.pageData && window.pageData.allAttrs) {
                return window.pageData.allAttrs[widgetName] || {
                    widget: 'str',
                    label: widgetName
                };
                }
            return {
                widget: 'str',
                label: widgetName
            };
        },
        
        onWidgetExecute(data) {
            // Передаем события от виджетов в модальном окне
            this.$emit('execute', data);
        },

        collectModalWidgetNames() {
            if (!window.GuiParser || !this.modalConfig) {
                return [];
            }

            return window.GuiParser.collectWidgetNamesFromModal(this.modalConfig);
        },

        async ensureModalAttrsLoaded() {
            try {
                const required = this.collectModalWidgetNames();
                if (!required.length) return;
                const globalAttrs = (window.pageData && window.pageData.allAttrs) || {};
                const pageName = (
                    window.pageData
                    && window.pageData.pageConfig
                    && window.pageData.pageConfig.name
                ) || "";
                const namesToLoad = required.filter((n) => !(n in globalAttrs));
                if (!namesToLoad.length) return;

                const query = encodeURIComponent(namesToLoad.join(","));
                const resp = await fetch(`/api/attrs?page=${encodeURIComponent(pageName)}&names=${query}`);
                if (!resp.ok) return;
                const data = await resp.json();
                // merge
                Object.assign(globalAttrs, data);
                if (window.pageData) window.pageData.allAttrs = globalAttrs;
            } catch (e) {
                console.error("Не удалось подгрузить атрибуты для модального окна", e);
            }
        },

        getModalSectionCollapseId(sectionIndex) {
            const tabPart = this.modalTabs.length ? this.activeTabIndex : 'content';
            return `modal-section-${tabPart}-${sectionIndex}`;
        },

        isFontIcon(icon) {
            return window.GuiParser ? window.GuiParser.isFontIcon(icon) : false;
        },

        getIconSrc(icon) {
            return window.GuiParser ? window.GuiParser.getIconSrc(icon) : null;
        },

        onIconError(event) {
            const img = event && event.target;
            if (!img) {
                return;
            }

            img.style.display = 'none';
            if (img.parentElement) {
                img.parentElement.style.display = 'none';
            }
        }
    }
};

// Регистрируем глобально
if (typeof window !== 'undefined') {
    window.ModalManager = ModalManager;
    window.ModalButtons = ModalButtons;
} 
