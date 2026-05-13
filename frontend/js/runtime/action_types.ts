import type { PagesIndexState } from './api_contract.ts';

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

export type ConfirmModalOpenConfig = ConfirmDialogConfig & {
    onAccept?: () => void | Promise<void>;
    onCancel?: () => void;
};

export type ConfirmModalController = {
    open?: (config: ConfirmModalOpenConfig) => void;
};

export type ProbeableSourceDescriptor = {
    cacheKey: string;
    fallbackLabel: string;
    href: string;
    pathname: string;
};

/** Ответ `fetchPages`: тот же shape, что и `PagesIndexState`. */
export type PageTitlePayload = PagesIndexState;
