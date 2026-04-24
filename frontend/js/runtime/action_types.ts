export type ActionItemType = 'url' | 'source' | 'command';

export type ActionItem = {
    label?: string;
    target: string;
    type: ActionItemType;
};

export type ActionWidgetConfig = Record<string, unknown> & {
    command?: unknown;
    dialog?: Record<string, unknown> | null;
    output_attrs?: unknown;
    source?: unknown;
    url?: unknown;
};

export type ActionMalformedFields = Partial<Record<ActionItemType, number[]>>;

export type SplitButtonActionInspection = {
    items: ActionItem[];
    malformedByField: ActionMalformedFields;
};

export type ActionExecutionContext = {
    $emit?: (event: 'execute', payload: unknown) => void;
    closeUiModal?: () => Promise<unknown> | unknown;
    getConfirmModal?: () => unknown | null;
    openUiModal?: (modalName: string) => Promise<unknown> | unknown;
};

export type ActionExecutionOptions = {
    dialog?: unknown;
    outputAttrs?: unknown;
    widgetName?: unknown;
};

export type ConfirmDialogConfig = {
    accept?: string;
    cancel?: string;
    text?: string;
    title?: string;
};

export type ConfirmModalController = {
    _acceptHandler?: () => void;
    open?: (config: Required<ConfirmDialogConfig>) => void;
};

export type ProbeableSourceDescriptor = {
    cacheKey: string;
    fallbackLabel: string;
    href: string;
    pathname: string;
};

export type PageTitleRecord = {
    name?: unknown;
    title?: unknown;
    url?: unknown;
};

export type PageTitlePayload = {
    pages?: PageTitleRecord[];
};
