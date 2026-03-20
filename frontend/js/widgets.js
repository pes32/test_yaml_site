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
window.WidgetRenderer = WidgetRenderer;

// Компонент иконки (SVG или FontAwesome)
const ItemIcon = {
    props: { icon: { type: String, default: '' } },
    template: `
        <span v-if="icon" class="page-item-icon inline-flex-center">
            <img v-if="!$isFontIcon(icon)" :src="$getIconSrc(icon)" alt="" @error="$onIconError">
            <i v-else :class="icon"></i>
        </span>
    `
};
window.ItemIcon = ItemIcon;

// Общий компонент рендеринга рядов секции (текст и row)
const ContentRows = {
    props: {
        rows: { type: Array, required: true },
        getWidgetConfig: { type: Function, required: true },
        textClass: { type: String, default: 'page-section-text' }
    },
    emits: ['execute', 'input'],
    methods: {
        nextRowHasWidgets(rowIndex) {
            const next = this.rows[rowIndex + 1];
            return next && typeof next === 'object' && next.widgets && Array.isArray(next.widgets);
        }
    },
    template: `
        <template v-for="(row, rowIndex) in rows" :key="rowIndex">
            <div class="row row--section"
                 :class="{ 'row--text': typeof row === 'string', 'row--before-widgets': nextRowHasWidgets(rowIndex) }">
                <div v-if="typeof row === 'string'" class="col-12">
                    <span :class="textClass" v-text="row"></span>
                </div>
                <div v-else-if="row.widgets && Array.isArray(row.widgets)" class="col-12">
                    <div class="row">
                        <div v-for="(item, itemIndex) in row.widgets" :key="itemIndex" class="col-auto">
                            <widget-renderer
                                :widget-config="getWidgetConfig(item)"
                                :widget-name="item"
                                @input="$emit('input', $event)"
                                @execute="$emit('execute', $event)">
                            </widget-renderer>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    `
};

window.ContentRows = ContentRows;

// Карточка секции (заголовок + collapse + content). Одинакова для страницы и модалки.
const SectionCard = {
    props: {
        section: { type: Object, required: true },
        sectionIndex: { type: Number, required: true },
        collapseId: { type: String, default: '' },
        isCollapsed: { type: Boolean, default: false },
        onToggle: { type: Function, default: null },
        onInput: { type: Function, default: null },
        getWidgetConfig: { type: Function, required: true },
        onExecute: { type: Function, required: true },
        variant: { type: String, default: 'page' },
        headerId: { type: String, default: '' }
    },
    data() {
        return {
            collapseAnimating: false,
            collapseStyle: null,
            collapseRafId: 0,
            removeCollapseTransitionListener: null
        };
    },
    template: `
        <div :class="wrapperClass">
            <div :class="cardClass">
                <div v-if="section.showHeader"
                     class="card-header"
                     :class="headerClass"
                     :id="headerId || undefined"
                     @click="section.collapsible && onToggle ? onToggle() : null"
                     :style="headerStyle">
                    <component :is="titleTag" class="mb-0 d-flex align-items-center" :class="titleClass">
                        <span v-if="section.showHeader" :class="arrowSlotClass">
                            <img v-if="section.collapsible" src="/templates/icons/arrow.svg" class="collapse-icon" :class="collapseIconExtra" alt="">
                        </span>
                        <item-icon v-if="section.icon" :icon="section.icon"></item-icon>
                        <span v-text="section.name"></span>
                    </component>
                </div>
                <div :class="collapseClass"
                     :id="section.collapsible ? collapseId : null"
                     :style="collapseStyle"
                     ref="collapseEl">
                    <div class="collapse-inner" ref="collapseInner">
                        <div :class="bodyClass">
                            <content-rows
                                :rows="section.rows"
                                :get-widget-config="getWidgetConfig"
                                :text-class="contentTextClass"
                                @input="onInput ? onInput($event) : null"
                                @execute="onExecute">
                            </content-rows>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    computed: {
        collapseClass() {
            if (!this.section.collapsible) return '';
            return {
                collapse: true,
                show: !this.isCollapsed,
                'collapse-animating': this.collapseAnimating
            };
        },
        wrapperClass() {
            if (this.variant === 'modal') return 'mb-3';
            return {
                'page-section': true,
                'page-section--bare': !this.section.showHeader,
                'page-section--box': this.section.hasFrame
            };
        },
        cardClass() {
            return this.variant === 'page' ? 'card page-section-card u-wide' : 'card u-wide';
        },
        headerClass() {
            const base = { collapsed: this.section.collapsible && this.isCollapsed };
            if (this.variant === 'page') base['page-section-header'] = true;
            return base;
        },
        headerStyle() {
            return this.section.collapsible ? { cursor: 'pointer' } : null;
        },
        titleTag() { return this.variant === 'page' ? 'h5' : 'h6'; },
        titleClass() { return this.variant === 'page' ? 'page-section-title' : ''; },
        arrowSlotClass() { return this.variant === 'page' ? 'page-section-arrow-slot inline-flex-center' : 'inline-flex-center'; },
        collapseIconExtra() { return this.variant === 'modal' ? 'me-2' : ''; },
        bodyClass() {
            return this.variant === 'page' ? 'card-body page-section-body u-wide' : 'card-body u-wide';
        },
        contentTextClass() {
            return this.variant === 'modal' ? 'text-muted' : 'page-section-text';
        }
    },
    watch: {
        isCollapsed(next, prev) {
            if (!this.section.collapsible || next === prev) {
                return;
            }

            this.animateCollapse();
        }
    },
    mounted() {
        this.syncCollapseState();
    },
    beforeUnmount() {
        this.stopCollapseAnimation();
    },
    methods: {
        stopCollapseAnimation() {
            if (this.collapseRafId) {
                cancelAnimationFrame(this.collapseRafId);
                this.collapseRafId = 0;
            }

            if (this.removeCollapseTransitionListener) {
                this.removeCollapseTransitionListener();
                this.removeCollapseTransitionListener = null;
            }
        },
        syncCollapseState() {
            if (!this.section.collapsible) {
                return;
            }

            this.stopCollapseAnimation();
            this.collapseAnimating = false;
            this.collapseStyle = this.isCollapsed ? { height: '0px' } : { height: 'auto' };
        },
        animateCollapse() {
            const collapseEl = this.$refs.collapseEl;
            const collapseInner = this.$refs.collapseInner;

            if (!collapseEl || !collapseInner) {
                this.syncCollapseState();
                return;
            }

            this.stopCollapseAnimation();

            const startHeight = `${collapseEl.getBoundingClientRect().height}px`;
            const endHeight = this.isCollapsed ? '0px' : `${collapseInner.scrollHeight}px`;

            if (startHeight === endHeight) {
                this.collapseAnimating = false;
                this.collapseStyle = this.isCollapsed ? { height: '0px' } : { height: 'auto' };
                return;
            }

            this.collapseAnimating = true;
            this.collapseStyle = { height: startHeight };

            const onTransitionEnd = (event) => {
                if (event.target !== collapseEl || event.propertyName !== 'height') {
                    return;
                }

                this.stopCollapseAnimation();
                this.collapseAnimating = false;
                this.collapseStyle = this.isCollapsed ? { height: '0px' } : { height: 'auto' };
            };

            collapseEl.addEventListener('transitionend', onTransitionEnd);
            this.removeCollapseTransitionListener = () => {
                collapseEl.removeEventListener('transitionend', onTransitionEnd);
            };

            this.$nextTick(() => {
                const animatedEl = this.$refs.collapseEl;
                if (!animatedEl) {
                    return;
                }

                // Даём DOM применить стартовую высоту и класс анимации перед переходом к целевой высоте.
                void animatedEl.offsetHeight;

                this.collapseRafId = requestAnimationFrame(() => {
                    this.collapseRafId = 0;
                    this.collapseStyle = { height: endHeight };
                });
            });
        }
    }
};
window.SectionCard = SectionCard;

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
    emits: ['execute', 'input'],
    data() {
        return {
            showModal: false,
            modalConfig: null,
            activeTabIndex: 0,
            collapsedModalSections: {}
        };
    },
    mounted() {
        window.modalManager = this;
    },
    template: `
        <div v-if="showModal" class="modal-overlay flex-center" @click="closeModal">
            <div class="modal-content w-100" @click.stop>
                <div class="modal-header">
                    <div class="d-flex align-items-center gap-2">
                        <item-icon v-if="modalConfig && modalConfig.icon" :icon="modalConfig.icon"></item-icon>
                        <h5 class="modal-title" v-text="modalTitle"></h5>
                    </div>
                    <button type="button" class="ui-close-button" @click="closeModal" aria-label="Закрыть"></button>
                </div>
                
                <div class="modal-body">
                    <div v-if="modalConfig">
                        <ul v-if="modalTabs.length > 1" class="nav nav-tabs mb-3">
                            <li class="nav-item" v-for="(tab, index) in modalTabs" :key="index">
                                <a class="nav-link" 
                                   :class="{ active: index === activeTabIndex }" 
                                   @click.prevent="setActiveTab(index)"
                                   href="#">
                                    <item-icon v-if="tab.icon" :icon="tab.icon"></item-icon>
                                    <span v-text="tab.name || ('Вкладка ' + (index + 1))"></span>
                                </a>
                            </li>
                        </ul>
                        
                        <div class="tab-content u-wide">
                            <div class="tab-pane active u-wide">
                                <section-card
                                    v-for="(section, sidx) in activeSections"
                                    :key="sidx"
                                    :section="section"
                                    :section-index="sidx"
                                    :collapse-id="getModalSectionCollapseId(sidx)"
                                    :is-collapsed="isModalSectionCollapsed(sidx)"
                                    :on-toggle="() => toggleModalSectionCollapse(sidx)"
                                    :on-input="onWidgetInput"
                                    :get-widget-config="getWidgetConfig"
                                    :on-execute="onWidgetExecute"
                                    variant="modal">
                                </section-card>
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
            return window.GuiParser
                ? window.GuiParser.getActiveSections(this.modalConfig, this.activeTabIndex, this.modalTabs)
                : [];
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
            this.collapsedModalSections = { ...this.collapsedModalSections, [id]: !this.collapsedModalSections[id] };
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

        onWidgetInput(data) {
            this.$emit('input', data);
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
                if (this.$root) {
                    if (!this.$root.allAttrs) {
                        this.$root.allAttrs = {};
                    }
                    if (!this.$root.widgets) {
                        this.$root.widgets = {};
                    }

                    Object.assign(this.$root.allAttrs, data);
                    Object.assign(this.$root.widgets, data);
                }
                if (this.$root && typeof this.$root.initializeWidgetValues === 'function') {
                    this.$root.initializeWidgetValues(data);
                }
            } catch (e) {
                console.error("Не удалось подгрузить атрибуты для модального окна", e);
            }
        },

        getModalSectionCollapseId(sectionIndex) {
            const tabPart = this.modalTabs.length ? this.activeTabIndex : 'content';
            return `modal-section-${tabPart}-${sectionIndex}`;
        },

    }
};

window.ModalManager = ModalManager;
window.ModalButtons = ModalButtons; 
