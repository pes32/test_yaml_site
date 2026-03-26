import GuiParser from '../gui_parser.js';
import { ensureAttrsLoaded as ensureAttrsLoadedFlow } from './attrs_loader.js';
import { FRONTEND_ERROR_SCOPES } from './error_model.js';
import { ensureModalDefinition as ensureModalDefinitionFlow } from './modal_flow.js';

function createEmptyModalRuntimeState() {
    return {
        showModal: false,
        modalConfig: null,
        activeTabIndex: 0,
        collapsedSections: {},
        modalScrollTopByView: {},
        loading: false,
        error: null
    };
}

function getModalConfig(state) {
    return state && state.modalConfig && typeof state.modalConfig === 'object'
        ? state.modalConfig
        : null;
}

function getModalTabs(state) {
    const modalConfig = getModalConfig(state);
    return modalConfig && Array.isArray(modalConfig.tabs)
        ? modalConfig.tabs
        : [];
}

function getModalTitle(state) {
    const modalConfig = getModalConfig(state);
    if (!modalConfig) {
        return 'Модальное окно';
    }
    return modalConfig.name || 'Модальное окно';
}

function sectionsForTab(state, tabIndex) {
    const modalConfig = getModalConfig(state);
    if (!GuiParser || !modalConfig) {
        return [];
    }
    return GuiParser.getActiveSections(modalConfig, tabIndex, getModalTabs(state));
}

function collectModalWidgetNames(state) {
    const modalConfig = getModalConfig(state);
    if (!GuiParser || !modalConfig) {
        return [];
    }
    return GuiParser.collectWidgetNamesFromModal(modalConfig);
}

function getActiveModalViewId(state) {
    const modalConfig = getModalConfig(state);
    if (!modalConfig) {
        return '';
    }

    const modalId = modalConfig.id || modalConfig.name || 'modal';
    const modalTabs = getModalTabs(state);
    const tabPart = modalTabs.length
        ? `tab-${Number(state && state.activeTabIndex) || 0}`
        : 'content';
    return `${modalId}-${tabPart}`;
}

function rememberActiveModalScroll(state, scrollRoot) {
    const viewId = getActiveModalViewId(state);
    if (!viewId || !scrollRoot) {
        return;
    }

    state.modalScrollTopByView = {
        ...(state.modalScrollTopByView || {}),
        [viewId]: scrollRoot.scrollTop || 0
    };
}

function restoreActiveModalScroll(state, schedule, resolveScrollRoot, viewId = getActiveModalViewId(state)) {
    if (typeof schedule !== 'function') {
        return;
    }

    schedule(() => {
        if (!state.showModal || !viewId || viewId !== getActiveModalViewId(state)) {
            return;
        }

        const scrollRoot = typeof resolveScrollRoot === 'function'
            ? resolveScrollRoot()
            : null;

        if (!scrollRoot) {
            return;
        }

        const top = Object.prototype.hasOwnProperty.call(state.modalScrollTopByView || {}, viewId)
            ? state.modalScrollTopByView[viewId]
            : 0;

        if (typeof scrollRoot.scrollTo === 'function') {
            scrollRoot.scrollTo({ top, left: 0, behavior: 'auto' });
        } else {
            scrollRoot.scrollTop = top;
        }
    });
}

function closeModal(state) {
    state.showModal = false;
    state.activeTabIndex = 0;
}

function setActiveModalTab(state, index) {
    const modalTabs = getModalTabs(state);
    if (index < 0 || index >= modalTabs.length) {
        return;
    }
    state.activeTabIndex = index;
}

function getModalSectionCollapseId(state, tabIndex, sectionIndex) {
    const modalTabs = getModalTabs(state);
    if (!modalTabs.length) {
        return `modal-section-content-${sectionIndex}`;
    }
    const idx = modalTabs.length === 1 ? 0 : tabIndex;
    return `modal-section-${idx}-${sectionIndex}`;
}

function isModalSectionCollapsed(state, tabIndex, sectionIndex) {
    return Boolean(
        (state.collapsedSections || {})[getModalSectionCollapseId(state, tabIndex, sectionIndex)]
    );
}

function toggleModalSectionCollapse(state, tabIndex, sectionIndex) {
    const sectionId = getModalSectionCollapseId(state, tabIndex, sectionIndex);
    state.collapsedSections = {
        ...(state.collapsedSections || {}),
        [sectionId]: !state.collapsedSections[sectionId]
    };
}

async function openModal(vm, state, modalName) {
    state.loading = true;
    state.error = null;

    try {
        const modal = await ensureModalDefinitionFlow(vm, modalName);
        if (!modal) {
            throw new Error(`Не удалось определить конфигурацию модального окна "${modalName}"`);
        }

        state.modalConfig = modal;
        state.activeTabIndex = 0;

        const required = collectModalWidgetNames(state);
        if (required.length) {
            await ensureAttrsLoadedFlow(vm, required);
        }

        state.showModal = true;
        return modal;
    } catch (error) {
        const normalized = typeof vm.handleRecoverableError === 'function'
            ? vm.handleRecoverableError(error, {
                scope: FRONTEND_ERROR_SCOPES.modal,
                message: `Не удалось открыть модальное окно "${modalName}"`
            })
            : error;

        state.error = normalized;
        state.showModal = false;
        throw normalized;
    } finally {
        state.loading = false;
    }
}

const ModalRuntimeService = {
    closeModal,
    collectModalWidgetNames,
    createEmptyModalRuntimeState,
    getActiveModalViewId,
    getModalConfig,
    getModalSectionCollapseId,
    getModalTabs,
    getModalTitle,
    isModalSectionCollapsed,
    openModal,
    rememberActiveModalScroll,
    restoreActiveModalScroll,
    sectionsForTab,
    setActiveModalTab,
    toggleModalSectionCollapse
};

export {
    ModalRuntimeService,
    closeModal,
    collectModalWidgetNames,
    createEmptyModalRuntimeState,
    getActiveModalViewId,
    getModalConfig,
    getModalSectionCollapseId,
    getModalTabs,
    getModalTitle,
    isModalSectionCollapsed,
    openModal,
    rememberActiveModalScroll,
    restoreActiveModalScroll,
    sectionsForTab,
    setActiveModalTab,
    toggleModalSectionCollapse
};

export default ModalRuntimeService;
