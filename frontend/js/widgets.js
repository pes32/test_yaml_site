// Загрузчик виджетов
// Создаем глобальный компонент WidgetRenderer для Vue.js
// Этот компонент использует фабрику виджетов для динамического рендеринга

import widgetFactory from './widgets/factory.js';

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
            if (widgetFactory && this.widgetConfig.widget) {
                return widgetFactory.getWidgetComponent(this.widgetConfig.widget);
            }
            
            // Fallback на StringWidget если фабрика не загружена
            return 'div';
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
                            <img v-if="section.collapsible" src="/templates/icons/arrow.svg" class="collapse-icon" alt="">
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
            return {
                'page-section': true,
                'page-section--bare': !this.section.showHeader,
                'page-section--box': this.section.hasFrame
            };
        },
        cardClass() {
            return 'card page-section-card u-wide';
        },
        headerClass() {
            return {
                collapsed: this.section.collapsible && this.isCollapsed,
                'page-section-header': true
            };
        },
        headerStyle() {
            return this.section.collapsible ? { cursor: 'pointer' } : null;
        },
        titleTag() {
            return 'h5';
        },
        titleClass() {
            return 'page-section-title';
        },
        arrowSlotClass() {
            return 'page-section-arrow-slot inline-flex-center';
        },
        bodyClass() {
            return 'card-body page-section-body u-wide';
        },
        contentTextClass() {
            return 'page-section-text';
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

// Компонент для кнопок модального окна
const ModalButtons = {
    inject: {
        getWidgetConfigByName: {
            from: 'getWidgetConfigByName',
            default: null
        }
    },
    props: {
        buttons: {
            type: Array,
            required: true
        }
    },
    emits: ['close', 'execute'],
    template: `
        <div class="d-flex gap-2 justify-content-end w-100">
            <template v-for="buttonName in buttons" :key="buttonName">
                <!-- Кнопка CLOSE - используем стандартный виджет кнопки -->
                <widget-renderer v-if="buttonName === 'CLOSE'"
                    :widget-config="getCloseButtonConfig()"
                    :widget-name="'CLOSE'"
                    @execute="$emit('execute', $event)">
                </widget-renderer>
                
                <!-- Обычная кнопка из attrs -->
                <widget-renderer v-else
                    :widget-config="getWidgetConfig(buttonName)"
                    :widget-name="buttonName"
                    @execute="$emit('execute', $event)">
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
            if (typeof this.getWidgetConfigByName === 'function') {
                return this.getWidgetConfigByName(widgetName);
            }
            return {
                widget: 'str',
                label: widgetName
            };
        }
    }
};

export {
    ContentRows,
    ItemIcon,
    ModalButtons,
    SectionCard,
    WidgetRenderer
};
