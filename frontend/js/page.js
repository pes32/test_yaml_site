// Страница с виджетами YAML System

import { normalizePageResponse } from './runtime/api_client.js';
import { ensureAttrsLoaded as ensureAttrsLoadedFlow, fetchActiveViewAttrs as fetchActiveViewAttrsFlow } from './runtime/attrs_loader.js';
import readPageBootstrap from './runtime/bootstrap.js';
import {
    FRONTEND_ERROR_PRESENTATIONS,
    FRONTEND_ERROR_SCOPES,
    normalizeFrontendError,
    presentFrontendError
} from './runtime/error_model.ts';
import { executeCommand as executeCommandFlow } from './runtime/execute_flow.js';
import {
    createEmptyModalRuntimeState,
    createModalRuntimeController
} from './runtime/modal_runtime_service.ts';
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
import {
    finishInitialViewActivation as finishInitialViewActivationFlow,
    getActiveViewId as getActiveViewIdFlow,
    getSectionCollapseId as getSectionCollapseIdFlow,
    handleHashChange as handleHashChangeFlow,
    handleMenuClick as handleMenuClickFlow,
    handleTabClick as handleTabClickFlow,
    isSectionCollapsed as isSectionCollapsedFlow,
    normalizeActiveState as normalizeActiveStateFlow,
    prefetchActiveViewWidgets as prefetchActiveViewWidgetsFlow,
    prefetchWidgetsByNames as prefetchWidgetsByNamesFlow,
    refreshActiveViewAfterNavigation as refreshActiveViewAfterNavigationFlow,
    registerHashListener as registerHashListenerFlow,
    rememberActiveViewScroll as rememberActiveViewScrollFlow,
    restoreActiveViewScroll as restoreActiveViewScrollFlow,
    setActiveViewFromHash as setActiveViewFromHashFlow,
    toggleSectionCollapse as toggleSectionCollapseFlow,
    unregisterHashListener as unregisterHashListenerFlow,
    updateHash as updateHashFlow
} from './runtime/page_view_runtime.js';

const pageAppOptions = {
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
        this.modalRuntimeController = createModalRuntimeController(this, this.modalRuntimeState);
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
            registerHashListenerFlow(this);
        },

        unregisterHashListener() {
            unregisterHashListenerFlow(this);
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
            await finishInitialViewActivationFlow(this);
        },

        normalizeActiveState() {
            normalizeActiveStateFlow(this);
        },

        setActiveViewFromHash() {
            setActiveViewFromHashFlow(this);
        },

        updateHash() {
            updateHashFlow(this);
        },

        async onHashChange() {
            await handleHashChangeFlow(this);
        },

        onMenuClick(index) {
            handleMenuClickFlow(this, index);
        },

        onTabClick(index) {
            handleTabClickFlow(this, index);
        },

        async refreshActiveViewAfterNavigation() {
            await refreshActiveViewAfterNavigationFlow(this);
        },

        async prefetchWidgetsByNames(names) {
            await prefetchWidgetsByNamesFlow(this, names);
        },

        async prefetchActiveViewWidgets() {
            await prefetchActiveViewWidgetsFlow(this);
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
            return getActiveViewIdFlow(this);
        },

        getPageScrollRoot() {
            return this.$refs.pageScrollRoot || null;
        },

        rememberActiveViewScroll() {
            rememberActiveViewScrollFlow(this);
        },

        restoreActiveViewScroll(viewId = this.getActiveViewId()) {
            restoreActiveViewScrollFlow(this, viewId);
        },

        getSectionCollapseId(sectionIndex) {
            return getSectionCollapseIdFlow(this, sectionIndex);
        },

        isSectionCollapsed(sectionIndex) {
            return isSectionCollapsedFlow(this, sectionIndex);
        },

        toggleSectionCollapse(sectionIndex) {
            toggleSectionCollapseFlow(this, sectionIndex);
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
};

export { pageAppOptions };
export default pageAppOptions;
