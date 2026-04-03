// Страница с виджетами YAML System

import { createApp } from 'vue';
import { getIconSrc, isFontIcon, onIconError } from './gui_parser.js';
import { normalizePageResponse } from './runtime/api_client.js';
import { ensureAttrsLoaded as ensureAttrsLoadedFlow, fetchActiveViewAttrs as fetchActiveViewAttrsFlow } from './runtime/attrs_loader.js';
import readPageBootstrap from './runtime/bootstrap.js';
import {
    FRONTEND_ERROR_PRESENTATIONS,
    FRONTEND_ERROR_SCOPES,
    normalizeFrontendError,
    presentFrontendError
} from './runtime/error_model.js';
import { executeCommand as executeCommandFlow } from './runtime/execute_flow.js';
import {
    closeModal as closeModalRuntime,
    createEmptyModalRuntimeState,
    getModalSectionCollapseId,
    isModalSectionCollapsed,
    openModal as openModalRuntime,
    setActiveModalTab,
    toggleModalSectionCollapse
} from './runtime/modal_runtime_service.js';
import {
    applyPagePayload as applyPagePayloadFlow,
    loadPageConfig as loadPageConfigFlow,
    parseConfiguration as parseConfigurationFlow
} from './runtime/page_bootstrap_flow.js';
import {
    getActiveMenu,
    getActiveSections,
    getActiveTabs,
    getCurrentPageName as selectCurrentPageName,
    getMenus,
    getParsedGuiState,
    getRootContentOnly,
    selectWidgetAttrs,
    selectWidgetRuntimeValue,
    getWidgetConfig as selectWidgetConfig,
    getWidgetValue as selectWidgetValue
} from './runtime/page_selectors.js';
import PageSessionStore from './runtime/page_session_store.js';
import PageRuntimeStore from './runtime/page_store.js';
import { ConfirmModal } from './widgets/confirm_modal.js';
import ModalManager from './widgets/modal_manager.js';
import {
    ContentRows,
    ItemIcon,
    ModalButtons,
    SectionCard,
    WidgetRenderer
} from './widgets.js';
import { ErrorPanel } from './widgets/feedback.js';

const app = createApp({
    provide() {
        return {
            getConfirmModal: () => this.$refs.confirmModal,
            openUiModal: (modalName) => this.modalRuntimeController
                ? this.modalRuntimeController.openModal(modalName)
                : Promise.resolve(null),
            closeUiModal: () => {
                this.commitActiveDraftWidget();
                if (this.modalRuntimeController) {
                    this.modalRuntimeController.closeModal();
                }
            },
            getWidgetConfigByName: (widgetName) => this.getWidgetConfig(widgetName),
            getWidgetAttrsByName: (widgetName) => this.getWidgetAttrs(widgetName),
            getWidgetRuntimeValueByName: (widgetName) => this.getWidgetRuntimeValue(widgetName),
            getModalRuntimeState: () => this.modalRuntimeState,
            getModalRuntimeController: () => this.modalRuntimeController,
            getCurrentPageNameFromRuntime: () => this.getCurrentPageName(),
            getAllAttrsMap: () => this.allAttrs,
            showAppNotification: (message, type) => this.showNotification(message, type),
            reportAppError: (error, options) => this.reportDiagnosticError(error, options),
            handleRecoverableAppError: (error, options) => this.handleRecoverableError(error, options),
            setActiveDraftWidgetController: (controller) =>
                this.setActiveDraftWidgetController(controller),
            clearActiveDraftWidgetController: (controller) =>
                this.clearActiveDraftWidgetController(controller)
        };
    },

    data() {
        return {
            configState: PageRuntimeStore.createEmptyStore(),
            sessionState: PageSessionStore.createEmptyStore(),
            modalRuntimeState: createEmptyModalRuntimeState(),
            modalRuntimeController: null,
            draftState: {
                activeController: null
            },
            uiState: {
                activeMenuIndex: 0,
                activeTabIndex: 0,
                collapsedSections: {},
                viewScrollTopById: {},
                tabsFocused: false,
                snackbar: null,
                snackbarHideTimerId: 0,
                snackbarSeq: 0,
                hashListenerBound: false
            },
            asyncState: {
                loading: true,
                pageError: null
            }
        };
    },

    created() {
        this.modalRuntimeController = {
            closeModal: () => closeModalRuntime(this.modalRuntimeState),
            getModalSectionCollapseId: (tabIndex, sectionIndex) =>
                getModalSectionCollapseId(this.modalRuntimeState, tabIndex, sectionIndex),
            isModalSectionCollapsed: (tabIndex, sectionIndex) =>
                isModalSectionCollapsed(this.modalRuntimeState, tabIndex, sectionIndex),
            openModal: (modalName) => openModalRuntime(this, this.modalRuntimeState, modalName),
            setActiveTab: (index) => setActiveModalTab(this.modalRuntimeState, index),
            toggleModalSectionCollapse: (tabIndex, sectionIndex) =>
                toggleModalSectionCollapse(this.modalRuntimeState, tabIndex, sectionIndex)
        };
    },

    computed: {
        pageConfig() {
            return this.configState.pageConfig;
        },

        allAttrs() {
            return this.configState.attrsByName || {};
        },

        snapshotVersion() {
            return this.configState.snapshotVersion || '';
        },

        diagnostics() {
            return Array.isArray(this.configState.diagnostics)
                ? this.configState.diagnostics
                : [];
        },

        widgetValues() {
            return this.sessionState.widgetValues || {};
        },

        loadedAttrNames() {
            return Array.isArray(this.sessionState.loadedAttrNames)
                ? this.sessionState.loadedAttrNames
                : [];
        },

        loadedModalIds() {
            return Array.isArray(this.sessionState.loadedModalIds)
                ? this.sessionState.loadedModalIds
                : [];
        },

        parsedGui() {
            return getParsedGuiState(this.sessionState);
        },

        menus() {
            return getMenus(this.sessionState);
        },

        rootContentOnly() {
            return getRootContentOnly(this.sessionState);
        },

        activeMenuIndex: {
            get() {
                return Number(this.uiState.activeMenuIndex) || 0;
            },
            set(value) {
                this.uiState.activeMenuIndex = Number(value) || 0;
            }
        },

        activeTabIndex: {
            get() {
                return Number(this.uiState.activeTabIndex) || 0;
            },
            set(value) {
                this.uiState.activeTabIndex = Number(value) || 0;
            }
        },

        loading: {
            get() {
                return Boolean(this.asyncState.loading);
            },
            set(value) {
                this.asyncState.loading = Boolean(value);
            }
        },

        pageError: {
            get() {
                return this.asyncState.pageError;
            },
            set(value) {
                this.asyncState.pageError = value || null;
            }
        },

        collapsedSections: {
            get() {
                return this.uiState.collapsedSections;
            },
            set(value) {
                this.uiState.collapsedSections = value && typeof value === 'object' ? value : {};
            }
        },

        viewScrollTopById: {
            get() {
                return this.uiState.viewScrollTopById;
            },
            set(value) {
                this.uiState.viewScrollTopById = value && typeof value === 'object' ? value : {};
            }
        },

        tabsFocused: {
            get() {
                return Boolean(this.uiState.tabsFocused);
            },
            set(value) {
                this.uiState.tabsFocused = Boolean(value);
            }
        },

        snackbar: {
            get() {
                return this.uiState.snackbar;
            },
            set(value) {
                this.uiState.snackbar = value;
            }
        },

        snackbarHideTimerId: {
            get() {
                return Number(this.uiState.snackbarHideTimerId) || 0;
            },
            set(value) {
                this.uiState.snackbarHideTimerId = Number(value) || 0;
            }
        },

        snackbarSeq: {
            get() {
                return Number(this.uiState.snackbarSeq) || 0;
            },
            set(value) {
                this.uiState.snackbarSeq = Number(value) || 0;
            }
        },

        activeMenu() {
            return getActiveMenu(this.sessionState, this.activeMenuIndex);
        },

        activeTabs() {
            return getActiveTabs(this.activeMenu);
        },

        activeSections() {
            return getActiveSections(this.activeMenu, this.activeTabIndex, this.activeTabs);
        },

        blockingPageError() {
            if (!this.pageError) {
                return null;
            }
            return this.pageError.presentation === FRONTEND_ERROR_PRESENTATIONS.fatal
                ? this.pageError
                : null;
        }
    },

    async mounted() {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        try {
            await this.bootstrapPage();
        } catch (error) {
            this.reportFatalError(error, {
                scope: FRONTEND_ERROR_SCOPES.page,
                message: 'Ошибка загрузки конфигурации страницы',
                asPageError: true
            });
        } finally {
            this.loading = false;
        }
    },

    beforeUnmount() {
        this.unregisterHashListener();
        this.clearSnackbarTimer();
    },

    methods: {
        waitForViewUpdate() {
            return new Promise((resolve) => {
                this.$nextTick(resolve);
            });
        },

        normalizeAppError(error, options = {}) {
            return presentFrontendError(
                normalizeFrontendError(error, options)
            );
        },

        reportError(error, options = {}) {
            const normalized = this.normalizeAppError(error, options);
            if (normalized.presentation === FRONTEND_ERROR_PRESENTATIONS.fatal || options.asPageError === true) {
                this.pageError = normalized;
            }
            return normalized;
        },

        reportFatalError(error, options = {}) {
            return this.reportError(error, {
                presentation: FRONTEND_ERROR_PRESENTATIONS.fatal,
                recoverable: false,
                ...options
            });
        },

        reportDiagnosticError(error, options = {}) {
            return this.reportError(error, {
                presentation: FRONTEND_ERROR_PRESENTATIONS.diagnostic,
                recoverable: false,
                ...options
            });
        },

        handleRecoverableError(error, options = {}) {
            const normalized = this.reportError(error, {
                presentation: FRONTEND_ERROR_PRESENTATIONS.recoverable,
                recoverable: true,
                ...options
            });
            this.showNotification(normalized.message, 'danger');
            return normalized;
        },

        dismissPageError() {
            this.pageError = null;
        },

        registerHashListener() {
            if (this.uiState.hashListenerBound) {
                return;
            }
            window.addEventListener('hashchange', this.onHashChange);
            this.uiState.hashListenerBound = true;
        },

        unregisterHashListener() {
            if (!this.uiState.hashListenerBound) {
                return;
            }
            window.removeEventListener('hashchange', this.onHashChange);
            this.uiState.hashListenerBound = false;
        },

        async bootstrapPage() {
            const bootstrapPayload = readPageBootstrap();

            if (bootstrapPayload) {
                this.applyPagePayload(normalizePageResponse(bootstrapPayload));
                this.parseConfiguration();
            } else {
                await this.loadPageConfig();
            }

            await this.finishInitialViewActivation();
        },

        applyPagePayload(payload) {
            applyPagePayloadFlow(this, payload || {});
        },

        async loadPageConfig() {
            return loadPageConfigFlow(this);
        },

        parseConfiguration() {
            parseConfigurationFlow(this);
        },

        async finishInitialViewActivation() {
            this.setActiveViewFromHash();
            await this.waitForViewUpdate();
            this.restoreActiveViewScroll();
            await this.fetchActiveViewAttrs();
            this.registerHashListener();
        },

        normalizeActiveState() {
            if (!this.menus.length) {
                this.activeMenuIndex = 0;
                this.activeTabIndex = 0;
                return;
            }

            if (this.activeMenuIndex < 0 || this.activeMenuIndex >= this.menus.length) {
                this.activeMenuIndex = 0;
            }

            const tabs = this.activeTabs;
            if (!tabs.length) {
                this.activeTabIndex = 0;
                return;
            }

            if (this.activeTabIndex < 0 || this.activeTabIndex >= tabs.length) {
                this.activeTabIndex = 0;
            }
        },

        setActiveViewFromHash() {
            const hash = window.location.hash || '';
            const match = hash.match(/^#menu-(\d+)(?:-tab-(\d+))?$/);

            if (!match) {
                this.activeMenuIndex = 0;
                this.activeTabIndex = 0;
                this.normalizeActiveState();
                return;
            }

            const menuIndex = parseInt(match[1], 10);
            const tabIndex = match[2] !== undefined ? parseInt(match[2], 10) : 0;

            this.activeMenuIndex = Number.isNaN(menuIndex) ? 0 : menuIndex;
            this.activeTabIndex = Number.isNaN(tabIndex) ? 0 : tabIndex;
            this.normalizeActiveState();
        },

        updateHash() {
            if (!this.activeMenu) {
                return;
            }

            let nextHash = `#menu-${this.activeMenuIndex}`;
            if (this.activeTabs.length) {
                nextHash += `-tab-${this.activeTabIndex}`;
            }

            if (window.location.hash !== nextHash) {
                history.replaceState(null, '', nextHash);
            }
        },

        async onHashChange() {
            this.commitActiveDraftWidget();
            this.rememberActiveViewScroll();
            this.setActiveViewFromHash();
            await this.waitForViewUpdate();
            this.restoreActiveViewScroll();
            await this.fetchActiveViewAttrs();
        },

        onMenuClick(index) {
            if (index < 0 || index >= this.menus.length) {
                return;
            }

            this.commitActiveDraftWidget();
            this.rememberActiveViewScroll();
            this.activeMenuIndex = index;
            this.activeTabIndex = 0;
            this.normalizeActiveState();
            this.updateHash();
            void this.refreshActiveViewAfterNavigation();
        },

        onTabClick(index) {
            if (!this.activeTabs.length || index < 0 || index >= this.activeTabs.length) {
                return;
            }

            this.commitActiveDraftWidget();
            this.rememberActiveViewScroll();
            this.activeTabIndex = index;
            this.normalizeActiveState();
            this.updateHash();
            void this.refreshActiveViewAfterNavigation();
        },

        async refreshActiveViewAfterNavigation() {
            await this.waitForViewUpdate();
            this.restoreActiveViewScroll();
            await this.fetchActiveViewAttrs();
        },

        getCurrentPageName() {
            return selectCurrentPageName(this.configState);
        },

        async ensureAttrsLoaded(names) {
            try {
                return await ensureAttrsLoadedFlow(this, names);
            } catch (error) {
                throw this.handleRecoverableError(error, {
                    scope: FRONTEND_ERROR_SCOPES.attrs,
                    message: 'Не удалось загрузить атрибуты'
                });
            }
        },

        async fetchActiveViewAttrs() {
            if (!this.activeMenu) {
                return;
            }

            try {
                await fetchActiveViewAttrsFlow(this);
            } catch (error) {
                this.handleRecoverableError(error, {
                    scope: FRONTEND_ERROR_SCOPES.attrs,
                    message: 'Не удалось загрузить данные для активного раздела'
                });
            }
        },

        setActiveDraftWidgetController(controller) {
            this.draftState.activeController = controller || null;
        },

        clearActiveDraftWidgetController(controller) {
            if (!controller || this.draftState.activeController === controller) {
                this.draftState.activeController = null;
            }
        },

        commitActiveDraftWidget() {
            const controller = this.draftState.activeController;
            if (controller && typeof controller.commitDraft === 'function') {
                controller.commitDraft();
            }
        },

        getWidgetAttrs(widgetName) {
            return selectWidgetAttrs(this.allAttrs, widgetName);
        },

        getWidgetRuntimeValue(widgetName) {
            return selectWidgetRuntimeValue(this.sessionState, this.allAttrs, widgetName);
        },

        getWidgetConfig(widgetName) {
            return selectWidgetConfig(this.allAttrs, widgetName);
        },

        onWidgetInput(payload) {
            if (!payload || !payload.name) {
                return;
            }

            PageSessionStore.setWidgetValue(
                this.sessionState,
                this.allAttrs,
                payload.name,
                payload.value
            );
        },

        getWidgetValue(widgetName) {
            return selectWidgetValue(this.sessionState, this.allAttrs, widgetName);
        },

        getActiveViewId() {
            if (!this.activeMenu) {
                return '';
            }

            const tabPart = this.activeTabs.length ? `tab-${this.activeTabIndex}` : 'content';
            return `menu-${this.activeMenuIndex}-${tabPart}`;
        },

        getPageScrollRoot() {
            return this.$refs.pageScrollRoot || null;
        },

        rememberActiveViewScroll() {
            const viewId = this.getActiveViewId();
            const scrollRoot = this.getPageScrollRoot();
            if (!viewId || !scrollRoot) {
                return;
            }

            this.viewScrollTopById = {
                ...this.viewScrollTopById,
                [viewId]: scrollRoot.scrollTop || 0
            };
        },

        restoreActiveViewScroll(viewId = this.getActiveViewId()) {
            this.$nextTick(() => {
                if (!viewId || viewId !== this.getActiveViewId()) {
                    return;
                }

                const scrollRoot = this.getPageScrollRoot();
                if (!scrollRoot) {
                    return;
                }

                const top = Object.prototype.hasOwnProperty.call(this.viewScrollTopById, viewId)
                    ? this.viewScrollTopById[viewId]
                    : 0;

                if (typeof scrollRoot.scrollTo === 'function') {
                    scrollRoot.scrollTo({ top, left: 0, behavior: 'auto' });
                } else {
                    scrollRoot.scrollTop = top;
                }

                if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                    window.scrollTo(0, 0);
                }
            });
        },

        getSectionCollapseId(sectionIndex) {
            const tabPart = this.activeTabs.length ? this.activeTabIndex : 'content';
            return `page-section-${this.activeMenuIndex}-${tabPart}-${sectionIndex}`;
        },

        isSectionCollapsed(sectionIndex) {
            return Boolean(this.collapsedSections[this.getSectionCollapseId(sectionIndex)]);
        },

        toggleSectionCollapse(sectionIndex) {
            const sectionId = this.getSectionCollapseId(sectionIndex);
            this.collapsedSections = {
                ...this.collapsedSections,
                [sectionId]: !this.collapsedSections[sectionId]
            };
        },

        async executeCommand(commandData) {
            try {
                await executeCommandFlow(this, commandData);
            } catch (error) {
                this.handleRecoverableError(error, {
                    scope: FRONTEND_ERROR_SCOPES.execute,
                    message: error && error.message
                        ? error.message
                        : 'Не удалось выполнить команду'
                });
            }
        },

        onTabsFocusOut(event) {
            if (!this.$refs.pageTabs || this.$refs.pageTabs.contains(event.relatedTarget)) {
                return;
            }
            this.tabsFocused = false;
        },

        clearSnackbarTimer() {
            if (!this.snackbarHideTimerId) {
                return;
            }
            clearTimeout(this.snackbarHideTimerId);
            this.snackbarHideTimerId = 0;
        },

        closeNotification() {
            this.clearSnackbarTimer();
            this.snackbar = null;
        },

        showNotification(message, type = 'info') {
            const notificationId = this.snackbarSeq + 1;
            this.snackbarSeq = notificationId;
            this.clearSnackbarTimer();
            this.snackbar = {
                id: notificationId,
                type,
                message: String(message || ''),
                duration: 5000
            };

            this.snackbarHideTimerId = window.setTimeout(() => {
                if (this.snackbar && this.snackbar.id === notificationId) {
                    this.snackbar = null;
                }
                this.snackbarHideTimerId = 0;
            }, this.snackbar.duration);
        }
    }
});

app.config.globalProperties.$isFontIcon = (icon) => isFontIcon(icon);
app.config.globalProperties.$getIconSrc = (icon) => getIconSrc(icon);
app.config.globalProperties.$onIconError = (event) => onIconError(event);

app.component('widget-renderer', WidgetRenderer);
app.component('item-icon', ItemIcon);
app.component('section-card', SectionCard);
app.component('content-rows', ContentRows);
app.component('modal-manager', ModalManager);
app.component('modal-buttons', ModalButtons);
app.component('confirm-modal', ConfirmModal);
app.component('error-panel', ErrorPanel);
app.mount('#app');
