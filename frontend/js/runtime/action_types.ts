type ActionItemType = 'url' | 'source' | 'command';

type ActionItem = {
    label?: string;
    target: string;
    type: ActionItemType;
};

type ActionWidgetConfig = Record<string, unknown> & {
    command?: unknown;
    dialog?: Record<string, unknown> | null;
    output_attrs?: unknown;
    source?: unknown;
    url?: unknown;
};

type ActionMalformedFields = Partial<Record<ActionItemType, number[]>>;

type SplitButtonActionInspection = {
    items: ActionItem[];
    malformedByField: ActionMalformedFields;
};

type ActionExecutionContext = {
    $emit?: (event: 'execute', payload: unknown) => void;
    closeUiModal?: () => Promise<unknown> | unknown;
    getConfirmModal?: () => unknown | null;
    openUiModal?: (modalName: string) => Promise<unknown> | unknown;
};

type ActionExecutionOptions = {
    dialog?: unknown;
    outputAttrs?: unknown;
    widgetName?: unknown;
};

type ConfirmDialogConfig = {
    accept?: string;
    cancel?: string;
    text?: string;
    title?: string;
};

type ConfirmModalController = {
    _acceptHandler?: () => void;
    open?: (config: Required<ConfirmDialogConfig>) => void;
};

type ProbeableSourceDescriptor = {
    cacheKey: string;
    fallbackLabel: string;
    href: string;
    pathname: string;
};

type PageTitleRecord = {
    name?: unknown;
    title?: unknown;
    url?: unknown;
};

type PageTitlePayload = {
    pages?: PageTitleRecord[];
};

export type {
    ActionExecutionContext,
    ActionExecutionOptions,
    ActionItem,
    ActionItemType,
    ActionMalformedFields,
    ActionWidgetConfig,
    ConfirmDialogConfig,
    ConfirmModalController,
    PageTitlePayload,
    PageTitleRecord,
    ProbeableSourceDescriptor,
    SplitButtonActionInspection
};
