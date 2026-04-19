// Страница с виджетами YAML System

import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    provide,
    reactive,
    ref,
    type ComputedRef,
    type Ref,
    type WritableComputedRef
} from 'vue';
import { normalizePageResponse } from './runtime/api_client.ts';
import { ensureAttrsLoaded as ensureAttrsLoadedFlow, fetchActiveViewAttrs as fetchActiveViewAttrsFlow } from './runtime/attrs_loader.ts';
import readPageBootstrap from './runtime/bootstrap.ts';
import {
    FRONTEND_ERROR_PRESENTATIONS,
    FRONTEND_ERROR_SCOPES,
    normalizeFrontendError,
    presentFrontendError,
    type FrontendErrorOptions,
    type FrontendRuntimeError
} from './runtime/error_model.ts';
import { executeCommand as executeCommandFlow } from './runtime/execute_flow.ts';
import {
    createEmptyModalRuntimeState,
    createModalRuntimeController,
    type ModalRuntimeController,
    type ModalRuntimeState
} from './runtime/modal_runtime_service.ts';
import { resetModalRuntimeState } from './runtime/modal_runtime_store.ts';
import {
    createEmptyDraftRuntimeState,
    resetDraftRuntime,
    runBoundaryAction as runBoundaryActionFlow,
    setActiveWidgetLifecycle as setActiveWidgetLifecycleFlow,
    clearActiveWidgetLifecycle as clearActiveWidgetLifecycleFlow,
    type BoundaryActionKind,
    type BoundaryActionResult,
    type PageDraftRuntimeState
} from './runtime/page_draft_runtime.ts';
import {
    clearNotificationTimer as clearNotificationTimerFlow,
    closeNotification as closeNotificationFlow,
    createEmptyNotificationState,
    resetNotifications as resetNotificationsFlow,
    showNotification as showNotificationFlow,
    type PageNotificationRecord,
    type PageNotificationState
} from './runtime/page_notification_store.ts';
import {
    applyPagePayload as applyPagePayloadFlow,
    loadPageConfig as loadPageConfigFlow,
    parseConfiguration as parseConfigurationFlow
} from './runtime/page_bootstrap_flow.ts';
import type {
    AttrConfigMap,
    FrontendDiagnostic,
    PageAttrConfig,
    PageConfigRecord,
    PageConfigState,
    PageScrollRoot,
    PageSessionState,
    PageViewHost,
    ParsedGuiMenu,
    ParsedGuiSection,
    ParsedGuiTab,
    UnknownRecord
} from './runtime/page_contract.ts';
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
import {
    PAGE_HOST_RUNTIME_SERVICES_KEY,
    type PageHostRuntimeServices
} from './runtime/widget_runtime_bridge.ts';
import { asRecord } from './shared/object_record.ts';
import type { ExecuteCommandData } from './runtime/execute_flow.ts';
import type { WidgetLifecycleHandle } from './widgets/factory.ts';

type ConfirmModalPublicSurface = {
    open(config?: { accept?: string; cancel?: string; text?: string; title?: string } | null): void;
    hide(): void;
};

type PageUiState = {
    activeMenuIndex: number;
    activeTabIndex: number;
    collapsedSections: Record<string, boolean>;
    hashListenerBound: boolean;
    tabsFocused: boolean;
    viewScrollTopById: Record<string, number>;
};

type PageAsyncState = {
    loading: boolean;
    pageError: FrontendRuntimeError | null;
};

type WidgetInputPayload = {
    name?: string;
    value?: unknown;
};

type PageAppPublicSurface = {
    bootstrapPage(): Promise<void>;
    closeUiModal(): Promise<BoundaryActionResult<null>>;
    executeCommand(commandData: unknown): Promise<void>;
    getCurrentPageName(): string;
    getWidgetAttrs(widgetName: string): PageAttrConfig;
    getWidgetRuntimeValue(widgetName: string): unknown;
    getWidgetValue(widgetName: string): unknown;
    openUiModal(modalName: string): Promise<unknown>;
    showNotification(message: string, type?: string): void;
};

type PageAppBindings = PageAppPublicSurface & {
    activeMenu: ComputedRef<ParsedGuiMenu | null>;
    activeMenuIndex: WritableComputedRef<number>;
    activeSections: ComputedRef<ParsedGuiSection[]>;
    activeTabIndex: WritableComputedRef<number>;
    activeTabs: ComputedRef<ParsedGuiTab[]>;
    blockingPageError: ComputedRef<FrontendRuntimeError | null>;
    closeNotification(): void;
    confirmModal: Ref<ConfirmModalPublicSurface | null>;
    dismissPageError(): void;
    getSectionCollapseId(sectionIndex: number): string;
    getWidgetAttrs(widgetName: string): PageAttrConfig;
    getWidgetRuntimeValue(widgetName: string): unknown;
    isSectionCollapsed(sectionIndex: number): boolean;
    loading: WritableComputedRef<boolean>;
    menus: ComputedRef<ParsedGuiMenu[]>;
    onMenuClick(index: number): void;
    onTabClick(index: number): void;
    onTabsFocusOut(event: FocusEvent): void;
    onWidgetInput(payload: unknown): void;
    pageError: WritableComputedRef<FrontendRuntimeError | null>;
    pageScrollRoot: Ref<PageScrollRoot | null>;
    pageTabs: Ref<HTMLElement | null>;
    publicSurface: PageAppPublicSurface;
    rootContentOnly: ComputedRef<boolean>;
    snackbar: ComputedRef<PageNotificationRecord | null>;
    tabsFocused: WritableComputedRef<boolean>;
    toggleSectionCollapse(sectionIndex: number): void;
};

type PageAppRuntimeHost = PageViewHost & {
    clearActiveWidgetLifecycle(handle?: WidgetLifecycleHandle | null): WidgetLifecycleHandle | null;
    closeUiModal(): Promise<BoundaryActionResult<null>>;
    getWidgetAttrs(widgetName: string): PageAttrConfig;
    getWidgetRuntimeValue(widgetName: string): unknown;
    getWidgetValue(widgetName: string): unknown;
    handleRecoverableError(error: unknown, options?: FrontendErrorOptions): FrontendRuntimeError;
    loadedAttrNames: string[];
    modalRuntimeController: ModalRuntimeController | null;
    modalRuntimeState: ModalRuntimeState;
    openUiModal(modalName: string): Promise<unknown>;
    prefetchWidgetsByNames(names: string[]): Promise<void>;
    reportDiagnosticError(error: unknown, options?: FrontendErrorOptions): FrontendRuntimeError;
    runBoundaryAction<T>(kind: string, action: () => Promise<T> | T): Promise<BoundaryActionResult<T>>;
    setActiveWidgetLifecycle(handle: WidgetLifecycleHandle | null | undefined): WidgetLifecycleHandle | null;
    showNotification(message: string, type?: string): void;
};

function normalizeBoundaryActionKind(kind: string): BoundaryActionKind {
    if (kind === 'modal-close' || kind === 'navigation' || kind === 'execute') {
        return kind;
    }

    return 'execute';
}

function normalizeExecuteCommandData(value: unknown): ExecuteCommandData | null {
    const payload = asRecord(value);
    if (!payload || typeof payload.command !== 'string' || typeof payload.widget !== 'string') {
        return null;
    }

    return {
        command: payload.command,
        outputAttrs: Array.isArray(payload.outputAttrs)
            ? payload.outputAttrs.map((item) => String(item || '').trim()).filter(Boolean)
            : undefined,
        widget: payload.widget
    };
}

function normalizeWidgetInputPayload(value: unknown): WidgetInputPayload | null {
    const payload = asRecord(value);
    if (!payload || typeof payload.name !== 'string' || !payload.name.trim()) {
        return null;
    }

    return {
        name: payload.name,
        value: payload.value
    };
}

function createPageHostRuntimeServices(host: PageAppRuntimeHost, confirmModal: Ref<ConfirmModalPublicSurface | null>): PageHostRuntimeServices {
    return {
        clearActiveWidgetLifecycle: (handle?: WidgetLifecycleHandle | null) => {
            host.clearActiveWidgetLifecycle(handle);
        },
        closeUiModal: () => host.closeUiModal(),
        getAllAttrsMap: () => host.allAttrs,
        getConfirmModal: () => confirmModal.value,
        getCurrentPageNameFromRuntime: () => host.getCurrentPageName(),
        getModalRuntimeController: () => host.modalRuntimeController,
        getModalRuntimeState: () => host.modalRuntimeState,
        getWidgetAttrsByName: (widgetName: string) => host.getWidgetAttrs(widgetName),
        getWidgetRuntimeValueByName: (widgetName: string) => host.getWidgetRuntimeValue(widgetName),
        handleRecoverableAppError: (error: unknown, options?: UnknownRecord) => host.handleRecoverableError(error, options),
        openUiModal: (modalName: string) => host.openUiModal(modalName),
        reportAppError: (error: unknown, options?: UnknownRecord) => host.reportDiagnosticError(error, options),
        runBoundaryAction: (kind: string, action: () => Promise<unknown> | unknown) => host.runBoundaryAction(kind, action),
        setActiveWidgetLifecycle: (handle?: WidgetLifecycleHandle | null) => {
            host.setActiveWidgetLifecycle(handle);
        },
        showAppNotification: (message: string, type?: string) => {
            host.showNotification(message, type);
        }
    };
}

function usePageApp(): PageAppBindings {
    const confirmModal = ref<ConfirmModalPublicSurface | null>(null);
    const pageTabs = ref<HTMLElement | null>(null);
    const pageScrollRoot = ref<PageScrollRoot | null>(null);

    const configState: PageConfigState = reactive(PageRuntimeStore.createEmptyStore());
    const sessionState: PageSessionState = reactive(PageSessionStore.createEmptyStore());
    const modalRuntimeState: ModalRuntimeState = reactive(createEmptyModalRuntimeState());
    const draftRuntimeState: PageDraftRuntimeState = reactive(createEmptyDraftRuntimeState());
    const notificationState: PageNotificationState = reactive(createEmptyNotificationState());
    const uiState: PageUiState = reactive({
        activeMenuIndex: 0,
        activeTabIndex: 0,
        collapsedSections: {},
        hashListenerBound: false,
        tabsFocused: false,
        viewScrollTopById: {}
    });
    const asyncState: PageAsyncState = reactive({
        loading: true,
        pageError: null
    });

    let modalRuntimeController: ModalRuntimeController | null = null;

    const pageConfig = computed<PageConfigRecord | null>(() => configState.pageConfig);
    const allAttrs = computed<AttrConfigMap>(() => configState.attrsByName || {});
    const diagnostics = computed<FrontendDiagnostic[]>(() =>
        Array.isArray(configState.diagnostics) ? configState.diagnostics : []
    );
    const loadedAttrNames = computed<string[]>(() =>
        Array.isArray(sessionState.loadedAttrNames) ? sessionState.loadedAttrNames : []
    );
    const parsedGui = computed(() => getParsedGuiState(sessionState));
    const menus = computed(() => getMenus(sessionState));
    const rootContentOnly = computed(() => getRootContentOnly(sessionState));
    const activeMenuIndex = computed({
        get: () => Number(uiState.activeMenuIndex) || 0,
        set: (value: number) => {
            uiState.activeMenuIndex = Number(value) || 0;
        }
    });
    const activeTabIndex = computed({
        get: () => Number(uiState.activeTabIndex) || 0,
        set: (value: number) => {
            uiState.activeTabIndex = Number(value) || 0;
        }
    });
    const loading = computed({
        get: () => Boolean(asyncState.loading),
        set: (value: boolean) => {
            asyncState.loading = Boolean(value);
        }
    });
    const pageError = computed({
        get: () => asyncState.pageError,
        set: (value: FrontendRuntimeError | null) => {
            asyncState.pageError = value || null;
        }
    });
    const collapsedSections = computed({
        get: () => uiState.collapsedSections,
        set: (value: Record<string, boolean>) => {
            uiState.collapsedSections = value && typeof value === 'object' ? value : {};
        }
    });
    const viewScrollTopById = computed({
        get: () => uiState.viewScrollTopById,
        set: (value: Record<string, number>) => {
            uiState.viewScrollTopById = value && typeof value === 'object' ? value : {};
        }
    });
    const tabsFocused = computed({
        get: () => Boolean(uiState.tabsFocused),
        set: (value: boolean) => {
            uiState.tabsFocused = Boolean(value);
        }
    });
    const snackbar = computed(() => notificationState.snackbar);
    const activeMenu = computed(() => getActiveMenu(sessionState, activeMenuIndex.value));
    const activeTabs = computed(() => getActiveTabs(activeMenu.value));
    const activeSections = computed(() =>
        getActiveSections(activeMenu.value, activeTabIndex.value, activeTabs.value)
    );
    const blockingPageError = computed(() =>
        pageError.value?.presentation === FRONTEND_ERROR_PRESENTATIONS.fatal
            ? pageError.value
            : null
    );

    function waitForViewUpdate(): Promise<void> {
        return nextTick();
    }

    function normalizeAppError(error: unknown, options: FrontendErrorOptions = {}): FrontendRuntimeError {
        return presentFrontendError(
            normalizeFrontendError(error, options)
        );
    }

    function reportError(error: unknown, options: FrontendErrorOptions = {}): FrontendRuntimeError {
        const normalized = normalizeAppError(error, options);
        if (normalized.presentation === FRONTEND_ERROR_PRESENTATIONS.fatal || options.asPageError === true) {
            pageError.value = normalized;
        }
        return normalized;
    }

    function reportFatalError(error: unknown, options: FrontendErrorOptions = {}): FrontendRuntimeError {
        return reportError(error, {
            presentation: FRONTEND_ERROR_PRESENTATIONS.fatal,
            recoverable: false,
            ...options
        });
    }

    function reportDiagnosticError(error: unknown, options: FrontendErrorOptions = {}): FrontendRuntimeError {
        return reportError(error, {
            presentation: FRONTEND_ERROR_PRESENTATIONS.diagnostic,
            recoverable: false,
            ...options
        });
    }

    function handleRecoverableError(error: unknown, options: FrontendErrorOptions = {}): FrontendRuntimeError {
        const normalized = reportError(error, {
            presentation: FRONTEND_ERROR_PRESENTATIONS.recoverable,
            recoverable: true,
            ...options
        });
        showNotification(normalized.message, 'danger');
        return normalized;
    }

    function dismissPageError(): void {
        pageError.value = null;
    }

    function registerHashListener(): void {
        registerHashListenerFlow(pageHost);
    }

    function unregisterHashListener(): void {
        unregisterHashListenerFlow(pageHost);
    }

    async function bootstrapPage(): Promise<void> {
        const bootstrapPayload = readPageBootstrap();

        if (bootstrapPayload) {
            applyPagePayload(normalizePageResponse(bootstrapPayload));
            parseConfiguration();
        } else {
            await loadPageConfig();
        }

        await finishInitialViewActivation();
    }

    function applyPagePayload(payload: unknown): void {
        applyPagePayloadFlow(pageHost, payload || {});
    }

    async function loadPageConfig(): Promise<unknown> {
        return loadPageConfigFlow(pageHost);
    }

    function parseConfiguration(): void {
        parseConfigurationFlow(pageHost);
    }

    async function finishInitialViewActivation(): Promise<void> {
        await finishInitialViewActivationFlow(pageHost);
    }

    function normalizeActiveState(): void {
        normalizeActiveStateFlow(pageHost);
    }

    function setActiveViewFromHash(): void {
        setActiveViewFromHashFlow(pageHost);
    }

    function updateHash(): void {
        updateHashFlow(pageHost);
    }

    async function onHashChange(): Promise<void> {
        await handleHashChangeFlow(pageHost);
    }

    function onMenuClick(index: number): void {
        handleMenuClickFlow(pageHost, index);
    }

    function onTabClick(index: number): void {
        handleTabClickFlow(pageHost, index);
    }

    async function refreshActiveViewAfterNavigation(): Promise<void> {
        await refreshActiveViewAfterNavigationFlow(pageHost);
    }

    async function prefetchWidgetsByNames(names: string[]): Promise<void> {
        await prefetchWidgetsByNamesFlow(pageHost, names);
    }

    async function prefetchActiveViewWidgets(): Promise<void> {
        await prefetchActiveViewWidgetsFlow(pageHost);
    }

    function getCurrentPageName(): string {
        return selectCurrentPageName(configState);
    }

    async function ensureAttrsLoaded(names: unknown): Promise<unknown> {
        try {
            return await ensureAttrsLoadedFlow(pageHost, names);
        } catch (error) {
            throw handleRecoverableError(error, {
                scope: FRONTEND_ERROR_SCOPES.attrs,
                message: 'Не удалось загрузить атрибуты'
            });
        }
    }

    async function fetchActiveViewAttrs(): Promise<void> {
        if (!activeMenu.value) {
            return;
        }

        try {
            await fetchActiveViewAttrsFlow(pageHost);
        } catch (error) {
            handleRecoverableError(error, {
                scope: FRONTEND_ERROR_SCOPES.attrs,
                message: 'Не удалось загрузить данные для активного раздела'
            });
        }
    }

    function setActiveWidgetLifecycle(handle: WidgetLifecycleHandle | null | undefined): WidgetLifecycleHandle | null {
        return setActiveWidgetLifecycleFlow(draftRuntimeState, handle);
    }

    function clearActiveWidgetLifecycle(handle?: WidgetLifecycleHandle | null): WidgetLifecycleHandle | null {
        return clearActiveWidgetLifecycleFlow(draftRuntimeState, handle);
    }

    async function runBoundaryAction<T>(
        kind: string,
        action: () => Promise<T> | T
    ): Promise<BoundaryActionResult<T>> {
        return runBoundaryActionFlow(draftRuntimeState, normalizeBoundaryActionKind(kind), action, {
            onFatalError: (error: unknown) => {
                reportFatalError(error, {
                    scope: FRONTEND_ERROR_SCOPES.page,
                    message: 'Критическая ошибка boundary commit',
                    asPageError: true
                });
            },
            onRecoverableError: (error: unknown) => {
                const message = error instanceof Error && error.message
                    ? error.message
                    : 'Не удалось зафиксировать изменения перед выполнением действия';
                handleRecoverableError(error, {
                    scope: FRONTEND_ERROR_SCOPES.page,
                    message
                });
            }
        });
    }

    function openUiModal(modalName: string): Promise<unknown> {
        return modalRuntimeController
            ? modalRuntimeController.openModal(modalName)
            : Promise.resolve(null);
    }

    async function closeUiModal(): Promise<BoundaryActionResult<null>> {
        return runBoundaryAction('modal-close', async () => {
            modalRuntimeController?.closeModal();
            return null;
        });
    }

    function getWidgetAttrs(widgetName: string): PageAttrConfig {
        return selectWidgetAttrs(allAttrs.value, widgetName);
    }

    function getWidgetRuntimeValue(widgetName: string): unknown {
        return selectWidgetRuntimeValue(sessionState, allAttrs.value, widgetName);
    }

    function getWidgetConfig(widgetName: string): PageAttrConfig {
        return selectWidgetConfig(allAttrs.value, widgetName);
    }

    function onWidgetInput(payload: unknown): void {
        const normalizedPayload = normalizeWidgetInputPayload(payload);
        if (!normalizedPayload) {
            return;
        }

        PageSessionStore.setWidgetValue(
            sessionState,
            allAttrs.value,
            normalizedPayload.name,
            normalizedPayload.value
        );
    }

    function getWidgetValue(widgetName: string): unknown {
        return selectWidgetValue(sessionState, allAttrs.value, widgetName);
    }

    function getActiveViewId(): string {
        return getActiveViewIdFlow(pageHost);
    }

    function getPageScrollRoot(): PageScrollRoot | null {
        return pageScrollRoot.value;
    }

    function rememberActiveViewScroll(): void {
        rememberActiveViewScrollFlow(pageHost);
    }

    function restoreActiveViewScroll(viewId = getActiveViewId()): void {
        restoreActiveViewScrollFlow(pageHost, viewId);
    }

    function getSectionCollapseId(sectionIndex: number): string {
        return getSectionCollapseIdFlow(pageHost, sectionIndex);
    }

    function isSectionCollapsed(sectionIndex: number): boolean {
        return isSectionCollapsedFlow(pageHost, sectionIndex);
    }

    function toggleSectionCollapse(sectionIndex: number): void {
        toggleSectionCollapseFlow(pageHost, sectionIndex);
    }

    async function executeCommand(commandData: unknown): Promise<void> {
        const normalizedCommand = normalizeExecuteCommandData(commandData);
        if (!normalizedCommand) {
            handleRecoverableError(new Error('Некорректный payload команды'), {
                scope: FRONTEND_ERROR_SCOPES.execute,
                message: 'Не удалось выполнить команду'
            });
            return;
        }

        try {
            await executeCommandFlow(pageHost, normalizedCommand);
        } catch (error) {
            const message = error instanceof Error && error.message
                ? error.message
                : 'Не удалось выполнить команду';
            handleRecoverableError(error, {
                scope: FRONTEND_ERROR_SCOPES.execute,
                message
            });
        }
    }

    function onTabsFocusOut(event: FocusEvent): void {
        const relatedTarget = event.relatedTarget instanceof Node
            ? event.relatedTarget
            : null;

        if (!pageTabs.value || pageTabs.value.contains(relatedTarget)) {
            return;
        }
        tabsFocused.value = false;
    }

    function clearSnackbarTimer(): void {
        clearNotificationTimerFlow(notificationState);
    }

    function closeNotification(): void {
        closeNotificationFlow(notificationState);
    }

    function showNotification(message: string, type = 'info'): void {
        showNotificationFlow(notificationState, message, type);
    }

    const pageHost: PageAppRuntimeHost = {
        $nextTick(callback?: () => void) {
            return callback ? nextTick(callback) : nextTick();
        },
        get activeMenu() {
            return activeMenu.value;
        },
        get activeMenuIndex() {
            return activeMenuIndex.value;
        },
        set activeMenuIndex(value: number) {
            activeMenuIndex.value = value;
        },
        get activeTabIndex() {
            return activeTabIndex.value;
        },
        set activeTabIndex(value: number) {
            activeTabIndex.value = value;
        },
        get activeTabs() {
            return activeTabs.value;
        },
        get allAttrs() {
            return allAttrs.value;
        },
        get collapsedSections() {
            return collapsedSections.value;
        },
        set collapsedSections(value: Record<string, boolean>) {
            collapsedSections.value = value;
        },
        configState,
        get diagnostics() {
            return diagnostics.value;
        },
        fetchActiveViewAttrs,
        getCurrentPageName,
        getPageScrollRoot,
        getWidgetConfig,
        get menus() {
            return menus.value;
        },
        get loadedAttrNames() {
            return loadedAttrNames.value;
        },
        normalizeActiveState,
        onHashChange,
        get pageConfig() {
            return pageConfig.value;
        },
        runBoundaryAction,
        sessionState,
        uiState,
        get viewScrollTopById() {
            return viewScrollTopById.value;
        },
        set viewScrollTopById(value: Record<string, number>) {
            viewScrollTopById.value = value;
        },
        waitForViewUpdate,
        clearActiveWidgetLifecycle,
        closeUiModal,
        getWidgetAttrs,
        getWidgetRuntimeValue,
        getWidgetValue,
        handleRecoverableError,
        get modalRuntimeController() {
            return modalRuntimeController;
        },
        modalRuntimeState,
        openUiModal,
        prefetchWidgetsByNames,
        reportDiagnosticError,
        setActiveWidgetLifecycle,
        showNotification
    };

    modalRuntimeController = createModalRuntimeController(pageHost, modalRuntimeState);
    provide(PAGE_HOST_RUNTIME_SERVICES_KEY, createPageHostRuntimeServices(pageHost, confirmModal));

    onMounted(async () => {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        try {
            await bootstrapPage();
        } catch (error) {
            reportFatalError(error, {
                scope: FRONTEND_ERROR_SCOPES.page,
                message: 'Ошибка загрузки конфигурации страницы',
                asPageError: true
            });
        } finally {
            loading.value = false;
        }
    });

    onBeforeUnmount(() => {
        unregisterHashListener();
        resetNotificationsFlow(notificationState);
        resetDraftRuntime(draftRuntimeState);
        resetModalRuntimeState(modalRuntimeState);
    });

    const publicSurface: PageAppPublicSurface = {
        bootstrapPage,
        closeUiModal,
        executeCommand,
        getCurrentPageName,
        getWidgetAttrs,
        getWidgetRuntimeValue,
        getWidgetValue,
        openUiModal,
        showNotification
    };

    return {
        ...publicSurface,
        activeMenu,
        activeMenuIndex,
        activeSections,
        activeTabIndex,
        activeTabs,
        blockingPageError,
        closeNotification,
        confirmModal,
        dismissPageError,
        getSectionCollapseId,
        isSectionCollapsed,
        loading,
        menus,
        onMenuClick,
        onTabClick,
        onTabsFocusOut,
        onWidgetInput,
        pageError,
        pageScrollRoot,
        pageTabs,
        publicSurface,
        rootContentOnly,
        snackbar,
        tabsFocused,
        toggleSectionCollapse
    };
}

export type {
    PageAppBindings,
    PageAppPublicSurface
};

export {
    usePageApp
};

export default usePageApp;
