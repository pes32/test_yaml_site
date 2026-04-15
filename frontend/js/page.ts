// Страница с виджетами YAML System

import { normalizePageResponse } from './runtime/api_client.ts';
import { ensureAttrsLoaded as ensureAttrsLoadedFlow, fetchActiveViewAttrs as fetchActiveViewAttrsFlow } from './runtime/attrs_loader.ts';
import readPageBootstrap from './runtime/bootstrap.ts';
import {
    FRONTEND_ERROR_PRESENTATIONS,
    FRONTEND_ERROR_SCOPES,
    normalizeFrontendError,
    presentFrontendError
} from './runtime/error_model.ts';
import { executeCommand as executeCommandFlow } from './runtime/execute_flow.ts';
import {
    createEmptyModalRuntimeState,
    createModalRuntimeController
} from './runtime/modal_runtime_service.ts';
import { resetModalRuntimeState } from './runtime/modal_runtime_store.ts';
import {
    createEmptyDraftRuntimeState,
    resetDraftRuntime,
    runBoundaryAction as runBoundaryActionFlow,
    setActiveWidgetLifecycle as setActiveWidgetLifecycleFlow,
    clearActiveWidgetLifecycle as clearActiveWidgetLifecycleFlow,
    type BoundaryActionKind
} from './runtime/page_draft_runtime.ts';
import {
    clearNotificationTimer as clearNotificationTimerFlow,
    closeNotification as closeNotificationFlow,
    createEmptyNotificationState,
    resetNotifications as resetNotificationsFlow,
    showNotification as showNotificationFlow
} from './runtime/page_notification_store.ts';
import {
    applyPagePayload as applyPagePayloadFlow,
    loadPageConfig as loadPageConfigFlow,
    parseConfiguration as parseConfigurationFlow
} from './runtime/page_bootstrap_flow.ts';
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
} from './runtime/page_selectors.ts';
import PageSessionStore from './runtime/page_session_store.ts';
import PageRuntimeStore from './runtime/page_store.ts';
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
} from './runtime/page_view_runtime.ts';
import { PAGE_HOST_RUNTIME_SERVICES_KEY } from './runtime/widget_runtime_bridge.ts';
import type { ExecuteCommandData } from './runtime/execute_flow.ts';
import type { WidgetLifecycleHandle } from './widgets/factory.ts';

type PageCompatVm = any;

function compatOptions<T extends Record<string, unknown>>(options: T & ThisType<PageCompatVm>): any {
    return options;
}

function compatBlock<T extends Record<string, unknown>>(block: T & ThisType<PageCompatVm>): T {
    return block;
}

function buildPageHostRuntimeServices(vm: PageCompatVm) {
    return {
        clearActiveWidgetLifecycle: (handle: unknown) => vm.clearActiveWidgetLifecycle(handle),
        closeUiModal: () => vm.closeUiModal(),
        getAllAttrsMap: () => vm.allAttrs,
        getConfirmModal: () => vm.$refs.confirmModal,
        getCurrentPageNameFromRuntime: () => vm.getCurrentPageName(),
        getModalRuntimeController: () => vm.modalRuntimeController,
        getModalRuntimeState: () => vm.modalRuntimeState,
        getWidgetAttrsByName: (widgetName: string) => vm.getWidgetAttrs(widgetName),
        getWidgetRuntimeValueByName: (widgetName: string) => vm.getWidgetRuntimeValue(widgetName),
        handleRecoverableAppError: (error: unknown, options?: Record<string, unknown>) => vm.handleRecoverableError(error, options),
        openUiModal: (modalName: string) => vm.openUiModal(modalName),
        reportAppError: (error: unknown, options?: Record<string, unknown>) => vm.reportDiagnosticError(error, options),
        runBoundaryAction: (kind: BoundaryActionKind, action: () => unknown) => vm.runBoundaryAction(kind, action),
        setActiveWidgetLifecycle: (handle: unknown) => vm.setActiveWidgetLifecycle(handle),
        showAppNotification: (message: string, type?: string) => vm.showNotification(message, type)
    };
}

const pageAppOptions = compatOptions({
    provide() {
        return {
            [PAGE_HOST_RUNTIME_SERVICES_KEY]: buildPageHostRuntimeServices(this)
        };
    },

    data() {
        return {
            configState: PageRuntimeStore.createEmptyStore(),
            sessionState: PageSessionStore.createEmptyStore(),
            modalRuntimeState: createEmptyModalRuntimeState(),
            modalRuntimeController: null,
            draftRuntimeState: createEmptyDraftRuntimeState(),
            notificationState: createEmptyNotificationState(),
            uiState: {
                activeMenuIndex: 0,
                activeTabIndex: 0,
                collapsedSections: {},
                viewScrollTopById: {},
                tabsFocused: false,
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

    computed: compatBlock({
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
            set(value: unknown) {
                this.uiState.activeMenuIndex = Number(value) || 0;
            }
        },

        activeTabIndex: {
            get() {
                return Number(this.uiState.activeTabIndex) || 0;
            },
            set(value: unknown) {
                this.uiState.activeTabIndex = Number(value) || 0;
            }
        },

        loading: {
            get() {
                return Boolean(this.asyncState.loading);
            },
            set(value: unknown) {
                this.asyncState.loading = Boolean(value);
            }
        },

        pageError: {
            get() {
                return this.asyncState.pageError;
            },
            set(value: unknown) {
                this.asyncState.pageError = value || null;
            }
        },

        collapsedSections: {
            get() {
                return this.uiState.collapsedSections;
            },
            set(value: unknown) {
                this.uiState.collapsedSections = value && typeof value === 'object' ? value : {};
            }
        },

        viewScrollTopById: {
            get() {
                return this.uiState.viewScrollTopById;
            },
            set(value: unknown) {
                this.uiState.viewScrollTopById = value && typeof value === 'object' ? value : {};
            }
        },

        tabsFocused: {
            get() {
                return Boolean(this.uiState.tabsFocused);
            },
            set(value: unknown) {
                this.uiState.tabsFocused = Boolean(value);
            }
        },

        snackbar: {
            get() {
                return this.notificationState.snackbar;
            },
            set(value: unknown) {
                this.notificationState.snackbar = value;
            }
        },

        snackbarHideTimerId: {
            get() {
                return Number(this.notificationState.snackbarHideTimerId) || 0;
            },
            set(value: unknown) {
                this.notificationState.snackbarHideTimerId = Number(value) || 0;
            }
        },

        snackbarSeq: {
            get() {
                return Number(this.notificationState.snackbarSeq) || 0;
            },
            set(value: unknown) {
                this.notificationState.snackbarSeq = Number(value) || 0;
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
    }),

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
        resetNotificationsFlow(this.notificationState);
        resetDraftRuntime(this.draftRuntimeState);
        resetModalRuntimeState(this.modalRuntimeState);
    },

    methods: compatBlock({
        waitForViewUpdate() {
            return new Promise((resolve) => {
                this.$nextTick(resolve);
            });
        },

        normalizeAppError(error: unknown, options: Record<string, unknown> = {}) {
            return presentFrontendError(
                normalizeFrontendError(error, options)
            );
        },

        reportError(error: unknown, options: Record<string, unknown> & { asPageError?: boolean } = {}) {
            const normalized = this.normalizeAppError(error, options);
            if (normalized.presentation === FRONTEND_ERROR_PRESENTATIONS.fatal || options.asPageError === true) {
                this.pageError = normalized;
            }
            return normalized;
        },

        reportFatalError(error: unknown, options: Record<string, unknown> = {}) {
            return this.reportError(error, {
                presentation: FRONTEND_ERROR_PRESENTATIONS.fatal,
                recoverable: false,
                ...options
            });
        },

        reportDiagnosticError(error: unknown, options: Record<string, unknown> = {}) {
            return this.reportError(error, {
                presentation: FRONTEND_ERROR_PRESENTATIONS.diagnostic,
                recoverable: false,
                ...options
            });
        },

        handleRecoverableError(error: unknown, options: Record<string, unknown> = {}) {
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

        applyPagePayload(payload: unknown) {
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

        onMenuClick(index: number) {
            handleMenuClickFlow(this, index);
        },

        onTabClick(index: number) {
            handleTabClickFlow(this, index);
        },

        async refreshActiveViewAfterNavigation() {
            await refreshActiveViewAfterNavigationFlow(this);
        },

        async prefetchWidgetsByNames(names: string[]) {
            await prefetchWidgetsByNamesFlow(this, names);
        },

        async prefetchActiveViewWidgets() {
            await prefetchActiveViewWidgetsFlow(this);
        },

        getCurrentPageName() {
            return selectCurrentPageName(this.configState);
        },

        async ensureAttrsLoaded(names: unknown) {
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

        setActiveWidgetLifecycle(handle: WidgetLifecycleHandle | null | undefined) {
            return setActiveWidgetLifecycleFlow(this.draftRuntimeState, handle);
        },

        clearActiveWidgetLifecycle(handle?: WidgetLifecycleHandle | null) {
            return clearActiveWidgetLifecycleFlow(this.draftRuntimeState, handle);
        },

        async runBoundaryAction(kind: BoundaryActionKind, action: () => unknown) {
            return runBoundaryActionFlow(this.draftRuntimeState, kind, action, {
                onFatalError: (error: unknown) => {
                    this.reportFatalError(error, {
                        scope: FRONTEND_ERROR_SCOPES.page,
                        message: 'Критическая ошибка boundary commit',
                        asPageError: true
                    });
                },
                onRecoverableError: (error: unknown) => {
                    const message = error instanceof Error && error.message
                        ? error.message
                        : 'Не удалось зафиксировать изменения перед выполнением действия';
                    this.handleRecoverableError(error, {
                        scope: FRONTEND_ERROR_SCOPES.page,
                        message
                    });
                }
            });
        },

        openUiModal(modalName: string) {
            return this.modalRuntimeController
                ? this.modalRuntimeController.openModal(modalName)
                : Promise.resolve(null);
        },

        async closeUiModal() {
            return this.runBoundaryAction('modal-close', async () => {
                if (this.modalRuntimeController) {
                    this.modalRuntimeController.closeModal();
                }

                return null;
            });
        },

        getWidgetAttrs(widgetName: string) {
            return selectWidgetAttrs(this.allAttrs, widgetName);
        },

        getWidgetRuntimeValue(widgetName: string) {
            return selectWidgetRuntimeValue(this.sessionState, this.allAttrs, widgetName);
        },

        getWidgetConfig(widgetName: string) {
            return selectWidgetConfig(this.allAttrs, widgetName);
        },

        onWidgetInput(payload: { name?: string; value?: unknown } | null | undefined) {
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

        getWidgetValue(widgetName: string) {
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

        restoreActiveViewScroll(this: PageCompatVm, viewId = this.getActiveViewId()) {
            restoreActiveViewScrollFlow(this, viewId);
        },

        getSectionCollapseId(sectionIndex: number) {
            return getSectionCollapseIdFlow(this, sectionIndex);
        },

        isSectionCollapsed(sectionIndex: number) {
            return isSectionCollapsedFlow(this, sectionIndex);
        },

        toggleSectionCollapse(sectionIndex: number) {
            toggleSectionCollapseFlow(this, sectionIndex);
        },

        async executeCommand(commandData: ExecuteCommandData) {
            try {
                await executeCommandFlow(this, commandData);
            } catch (error) {
                const message = error instanceof Error && error.message
                    ? error.message
                    : 'Не удалось выполнить команду';
                this.handleRecoverableError(error, {
                    scope: FRONTEND_ERROR_SCOPES.execute,
                    message
                });
            }
        },

        onTabsFocusOut(event: FocusEvent) {
            if (!this.$refs.pageTabs || this.$refs.pageTabs.contains(event.relatedTarget)) {
                return;
            }
            this.tabsFocused = false;
        },

        clearSnackbarTimer() {
            clearNotificationTimerFlow(this.notificationState);
        },

        closeNotification() {
            closeNotificationFlow(this.notificationState);
        },

        showNotification(message: string, type = 'info') {
            showNotificationFlow(this.notificationState, message, type);
        }
    })
});

export { pageAppOptions };
export default pageAppOptions;
