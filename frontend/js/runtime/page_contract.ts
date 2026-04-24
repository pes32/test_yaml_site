import type { AttrConfigMap, AttrConfigRecord } from '../shared/attr_config.ts';
import type { UnknownRecord } from '../shared/object_record.ts';
export type { AttrConfigMap } from '../shared/attr_config.ts';
export type { UnknownRecord } from '../shared/object_record.ts';

export type FrontendDiagnostic = UnknownRecord;

export type PageAttrConfig = AttrConfigRecord;

export type PageConfigRecord = UnknownRecord & {
    gui?: unknown;
    name?: unknown;
    parsedGui?: unknown;
};

export type ParsedGuiSection = UnknownRecord & {
    icon?: string;
    name?: string;
    rows?: unknown[];
};

export type ParsedGuiTab = UnknownRecord & {
    content?: ParsedGuiSection[];
    icon?: string;
    name?: string;
};

export type ParsedGuiMenu = UnknownRecord & {
    content?: ParsedGuiSection[];
    icon?: string;
    name?: string;
    tabs?: ParsedGuiTab[];
};

export type ParsedGuiModal = UnknownRecord;

export type ParsedGuiState = { menus: ParsedGuiMenu[]; modals: Record<string, ParsedGuiModal>; rootContentOnly: boolean };

export type PageConfigState = {
    pageName: string;
    snapshotVersion: string;
    diagnostics: FrontendDiagnostic[];
    pageConfig: PageConfigRecord | null;
    attrsByName: AttrConfigMap;
};

export type PageSessionState = {
    widgetValues: Record<string, unknown>;
    loadedAttrNames: string[];
    loadedModalIds: string[];
    parsedGui: ParsedGuiState | null;
};

export type PagePayload = { page?: unknown; attrs?: unknown; diagnostics?: unknown; snapshotVersion?: unknown };

export type AttrsPayload = {
    attrs?: unknown;
    diagnostics?: unknown;
    missingNames?: unknown;
    page?: unknown;
    resolvedNames?: unknown;
    snapshotVersion?: unknown;
};

export type ModalPayload = AttrsPayload & {
    dependencies?: unknown;
    modal?: unknown;
};

export type PageRuntimeServices = {
    getAllAttrsMap(): AttrConfigMap;
    getCurrentPageNameFromRuntime(): string;
    getModalRuntimeController(): unknown;
    getModalRuntimeState(): unknown;
    getWidgetAttrsByName(widgetName: string): PageAttrConfig;
    getWidgetRuntimeValueByName(widgetName: string): unknown;
    handleRecoverableAppError(error: unknown, options?: UnknownRecord): unknown;
    reportAppError(error: unknown, options?: UnknownRecord): unknown;
    runBoundaryAction<T>(kind: string, action: () => Promise<T> | T): Promise<PageBoundaryActionResult<T>>;
    showAppNotification(message: string, type?: string): unknown;
};

export type PageRuntimeEventPayloads = {
    hashNavigation: { hash: string };
    menuNavigation: { menuIndex: number; tabIndex: number };
    sectionToggle: { collapsed: boolean; sectionId: string };
};

export type PageBoundaryActionResult<T> = { status: 'executed'; value: T } | { status: string; value?: T };

export type PageScrollRoot = { scrollTop: number; scrollTo?(options: ScrollToOptions): void };

export type PageViewHost = {
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
    runBoundaryAction<T>(kind: string, action: () => Promise<T> | T): Promise<PageBoundaryActionResult<T>>;
    sessionState: PageSessionState;
    uiState: UnknownRecord & { hashListenerBound?: boolean };
    viewScrollTopById: Record<string, number>;
    waitForViewUpdate(): Promise<void>;
};
