import {
    getModalTabs,
    getModalTitle,
    rememberActiveModalScroll,
    restoreActiveModalScroll,
    sectionsForTab
} from '../runtime/modal_runtime_service.js';
import { ItemIcon, ModalButtons, SectionCard } from '../widgets.js';

const ModalManager = {
    inject: {
        getModalRuntimeController: {
            from: 'getModalRuntimeController',
            default: null
        },
        getModalRuntimeState: {
            from: 'getModalRuntimeState',
            default: null
        },
        getWidgetAttrsByName: {
            from: 'getWidgetAttrsByName',
            default: null
        },
        getWidgetRuntimeValueByName: {
            from: 'getWidgetRuntimeValueByName',
            default: null
        }
    },
    emits: ['execute', 'input'],
    template: `
        <div v-if="showModal" class="modal-overlay flex-center" @click="closeModal">
            <div class="modal-content w-100 gui-modal" @click.stop>
                <div class="modal-header">
                    <div class="d-flex align-items-center gap-2">
                        <item-icon v-if="modalConfig && modalConfig.icon" :icon="modalConfig.icon"></item-icon>
                        <h5 class="modal-title page-section-title" v-text="modalTitle"></h5>
                    </div>
                    <button type="button" class="ui-close-button" @click="closeModal" aria-label="Закрыть"></button>
                </div>

                <div class="modal-body">
                    <div v-if="modalConfig" class="gui-modal-body-inner">
                        <ul v-if="modalTabs.length > 1" class="nav nav-tabs page-tabs" role="tablist">
                            <li class="nav-item" v-for="(tab, index) in modalTabs" :key="index">
                                <a class="nav-link"
                                   :class="{ active: index === activeTabIndex }"
                                   @click.prevent="setActiveTab(index)"
                                   href="#"
                                   role="tab">
                                    <item-icon v-if="tab.icon" :icon="tab.icon"></item-icon>
                                    <span class="page-tab-label" v-text="tab.name || ('Вкладка ' + (index + 1))"></span>
                                </a>
                            </li>
                        </ul>

                        <div ref="modalScrollRoot"
                             class="tab-content page-tab-content gui-modal-tab-pane-outer u-wide"
                             :class="{ 'page-tab-content--with-tabs': modalTabs.length > 1 }">
                            <div v-if="modalTabs.length > 1" class="gui-modal-tab-stack">
                                <div v-for="(tab, tidx) in modalTabs"
                                     :key="'mtab-' + tidx"
                                     class="gui-modal-tab-layer"
                                     :class="{ 'gui-modal-tab-layer--active': tidx === activeTabIndex }">
                                    <section-card
                                        v-for="(section, sidx) in sectionsForTab(tidx)"
                                        :key="'mt-' + tidx + '-' + sidx"
                                        :section="section"
                                        :section-index="sidx"
                                        :collapse-id="getModalSectionCollapseId(tidx, sidx)"
                                        :is-collapsed="isModalSectionCollapsed(tidx, sidx)"
                                        :on-toggle="() => toggleModalSectionCollapse(tidx, sidx)"
                                        :on-input="onWidgetInput"
                                        :get-widget-attrs="getWidgetAttrs"
                                        :get-widget-value="getWidgetValue"
                                        :on-execute="onWidgetExecute">
                                    </section-card>
                                </div>
                            </div>
                            <div v-else class="tab-pane active show u-wide gui-modal-tab-single">
                                <section-card
                                    v-for="(section, sidx) in sectionsForTab(0)"
                                    :key="sidx"
                                    :section="section"
                                    :section-index="sidx"
                                    :collapse-id="getModalSectionCollapseId(0, sidx)"
                                    :is-collapsed="isModalSectionCollapsed(0, sidx)"
                                    :on-toggle="() => toggleModalSectionCollapse(0, sidx)"
                                    :on-input="onWidgetInput"
                                    :get-widget-attrs="getWidgetAttrs"
                                    :get-widget-value="getWidgetValue"
                                    :on-execute="onWidgetExecute">
                                </section-card>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="modalConfig && modalConfig.buttons && modalConfig.buttons.length" class="modal-footer">
                    <modal-buttons
                        :buttons="modalConfig.buttons"
                        @close="closeModal"
                        @execute="onWidgetExecute">
                    </modal-buttons>
                </div>
            </div>
        </div>
    `,
    computed: {
        modalRuntimeState() {
            if (typeof this.getModalRuntimeState !== 'function') {
                return {};
            }
            return this.getModalRuntimeState() || {};
        },
        modalRuntimeController() {
            if (typeof this.getModalRuntimeController !== 'function') {
                return null;
            }
            return this.getModalRuntimeController();
        },
        showModal() {
            return !!this.modalRuntimeState.showModal;
        },
        modalConfig() {
            return this.modalRuntimeState.modalConfig || null;
        },
        activeTabIndex() {
            return Number(this.modalRuntimeState.activeTabIndex) || 0;
        },
        modalTitle() {
            return getModalTitle(this.modalRuntimeState);
        },
        modalTabs() {
            return getModalTabs(this.modalRuntimeState);
        }
    },
    methods: {
        getModalScrollRoot() {
            return this.$refs.modalScrollRoot || null;
        },
        rememberActiveModalScroll() {
            rememberActiveModalScroll(this.modalRuntimeState, this.getModalScrollRoot());
        },
        restoreActiveModalScroll() {
            restoreActiveModalScroll(
                this.modalRuntimeState,
                (callback) => this.$nextTick(callback),
                () => this.getModalScrollRoot()
            );
        },
        closeModal() {
            this.$root?.commitActiveDraftWidget?.();
            this.rememberActiveModalScroll();
            if (this.modalRuntimeController && typeof this.modalRuntimeController.closeModal === 'function') {
                this.modalRuntimeController.closeModal();
            }
        },
        setActiveTab(index) {
            if (!this.modalRuntimeController || typeof this.modalRuntimeController.setActiveTab !== 'function') {
                return;
            }

            this.$root?.commitActiveDraftWidget?.();
            this.rememberActiveModalScroll();
            this.modalRuntimeController.setActiveTab(index);
            this.restoreActiveModalScroll();
        },
        getModalSectionCollapseId(tabIndex, sectionIndex) {
            if (!this.modalRuntimeController || typeof this.modalRuntimeController.getModalSectionCollapseId !== 'function') {
                return `modal-section-${tabIndex}-${sectionIndex}`;
            }
            return this.modalRuntimeController.getModalSectionCollapseId(tabIndex, sectionIndex);
        },
        isModalSectionCollapsed(tabIndex, sectionIndex) {
            return this.modalRuntimeController && typeof this.modalRuntimeController.isModalSectionCollapsed === 'function'
                ? this.modalRuntimeController.isModalSectionCollapsed(tabIndex, sectionIndex)
                : false;
        },
        toggleModalSectionCollapse(tabIndex, sectionIndex) {
            if (!this.modalRuntimeController || typeof this.modalRuntimeController.toggleModalSectionCollapse !== 'function') {
                return;
            }
            this.modalRuntimeController.toggleModalSectionCollapse(tabIndex, sectionIndex);
        },
        sectionsForTab(tabIndex) {
            return sectionsForTab(this.modalRuntimeState, tabIndex);
        },
        getWidgetAttrs(widgetName) {
            if (typeof this.getWidgetAttrsByName === 'function') {
                return this.getWidgetAttrsByName(widgetName);
            }
            return {
                widget: 'str',
                label: widgetName
            };
        },
        getWidgetValue(widgetName) {
            return typeof this.getWidgetRuntimeValueByName === 'function'
                ? this.getWidgetRuntimeValueByName(widgetName)
                : undefined;
        },
        onWidgetExecute(payload) {
            this.$emit('execute', payload);
        },
        onWidgetInput(payload) {
            this.$emit('input', payload);
        }
    },
    updated() {
        if (this.showModal) {
            this.restoreActiveModalScroll();
        }
    }
};

export { ModalManager };
export default ModalManager;
