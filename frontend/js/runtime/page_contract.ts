type UnknownRecord = Record<string, unknown>;

type FrontendDiagnostic = UnknownRecord;

type PageAttrConfig = UnknownRecord & {
    default?: unknown;
    label?: unknown;
    name?: unknown;
    source?: unknown;
    widget?: unknown;
};

type AttrConfigMap = Record<string, PageAttrConfig>;

type PageConfigRecord = UnknownRecord & {
    gui?: unknown;
    name?: unknown;
};

type ParsedGuiSection = UnknownRecord & {
    icon?: string;
    name?: string;
    rows?: unknown[];
};

type ParsedGuiTab = UnknownRecord & {
    content?: ParsedGuiSection[];
    icon?: string;
    name?: string;
};

type ParsedGuiMenu = UnknownRecord & {
    content?: ParsedGuiSection[];
    icon?: string;
    name?: string;
    tabs?: ParsedGuiTab[];
};

type ParsedGuiModal = UnknownRecord;

type ParsedGuiState = {
    menus: ParsedGuiMenu[];
    modals: Record<string, ParsedGuiModal>;
    rootContentOnly: boolean;
};

type PageConfigState = {
    pageName: string;
    snapshotVersion: string;
    diagnostics: FrontendDiagnostic[];
    pageConfig: PageConfigRecord | null;
    attrsByName: AttrConfigMap;
};

type PageSessionState = {
    widgetValues: Record<string, unknown>;
    loadedAttrNames: string[];
    loadedModalIds: string[];
    parsedGui: ParsedGuiState | null;
};

type PagePayload = {
    page?: unknown;
    attrs?: unknown;
    diagnostics?: unknown;
    snapshotVersion?: unknown;
};

type AttrsPayload = {
    attrs?: unknown;
    diagnostics?: unknown;
    missingNames?: unknown;
    resolvedNames?: unknown;
    snapshotVersion?: unknown;
};

type ModalPayload = AttrsPayload & {
    dependencies?: unknown;
    modal?: unknown;
};

type PageRuntimeServices = {
    getAllAttrsMap(): AttrConfigMap;
    getCurrentPageNameFromRuntime(): string;
    getModalRuntimeController(): unknown;
    getModalRuntimeState(): unknown;
    getWidgetAttrsByName(widgetName: string): PageAttrConfig;
    getWidgetRuntimeValueByName(widgetName: string): unknown;
    handleRecoverableAppError(error: unknown, options?: UnknownRecord): unknown;
    reportAppError(error: unknown, options?: UnknownRecord): unknown;
    runBoundaryAction<T>(kind: string, action: () => Promise<T> | T): Promise<T>;
    showAppNotification(message: string, type?: string): unknown;
};

type PageRuntimeEventPayloads = {
    hashNavigation: {
        hash: string;
    };
    menuNavigation: {
        menuIndex: number;
        tabIndex: number;
    };
    sectionToggle: {
        collapsed: boolean;
        sectionId: string;
    };
};

type PageScrollRoot = {
    scrollTop: number;
    scrollTo?(options: ScrollToOptions): void;
};

type PageViewHost = {
    $nextTick(callback?: () => void): Promise<void>;
    activeMenu: ParsedGuiMenu | null;
    activeMenuIndex: number;
    activeTabIndex: number;
    activeTabs: ParsedGuiTab[];
    allAttrs: AttrConfigMap;
    collapsedSections: Record<string, boolean>;
    configState: PageConfigState;
    diagnostics: FrontendDiagnostic[];
    fetchActiveViewAttrs(): Promise<unknown>;
    getCurrentPageName(): string;
    getPageScrollRoot?(): PageScrollRoot | null;
    getWidgetConfig(widgetName: string): PageAttrConfig;
    menus: ParsedGuiMenu[];
    normalizeActiveState(): void;
    onHashChange(event?: Event): unknown;
    pageConfig: PageConfigRecord | null;
    runBoundaryAction<T>(kind: string, action: () => Promise<T> | T): Promise<T>;
    sessionState: PageSessionState;
    uiState: UnknownRecord & {
        hashListenerBound?: boolean;
    };
    viewScrollTopById: Record<string, number>;
    waitForViewUpdate(): Promise<void>;
};

export type {
    AttrConfigMap,
    AttrsPayload,
    FrontendDiagnostic,
    ModalPayload,
    PageAttrConfig,
    PageConfigRecord,
    PageConfigState,
    PagePayload,
    PageRuntimeEventPayloads,
    PageRuntimeServices,
    PageScrollRoot,
    PageSessionState,
    PageViewHost,
    ParsedGuiMenu,
    ParsedGuiModal,
    ParsedGuiSection,
    ParsedGuiState,
    ParsedGuiTab,
    UnknownRecord
};
