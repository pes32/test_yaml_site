import type { Ref } from 'vue';
import type { FrontendRuntimeError } from './error_model.ts';
import type { ModalRuntimeController, ModalRuntimeState } from './modal_runtime_service.ts';
import type { BoundaryActionResult } from './page_draft_runtime.ts';
import type { AttrConfigMap, PageAttrConfig, UnknownRecord } from './page_contract.ts';
import type { PageHostRuntimeServices } from './widget_runtime_bridge.ts';
import type { WidgetLifecycleHandle } from '../widgets/factory.ts';

type ConfirmModalPublicSurface = {
    open(config?: { accept?: string; cancel?: string; text?: string; title?: string } | null): void;
    hide(): void;
};

type PageHostRuntimeServiceHost = {
    allAttrs: AttrConfigMap;
    clearActiveWidgetLifecycle(handle?: WidgetLifecycleHandle | null): WidgetLifecycleHandle | null;
    closeUiModal(): Promise<BoundaryActionResult<null>>;
    getCurrentPageName(): string;
    getWidgetAttrs(widgetName: string): PageAttrConfig;
    getWidgetRuntimeValue(widgetName: string): unknown;
    handleRecoverableError(error: unknown, options?: UnknownRecord): FrontendRuntimeError;
    modalRuntimeController: ModalRuntimeController | null;
    modalRuntimeState: ModalRuntimeState;
    openUiModal(modalName: string): Promise<unknown>;
    reportDiagnosticError(error: unknown, options?: UnknownRecord): FrontendRuntimeError;
    runBoundaryAction<T>(kind: string, action: () => Promise<T> | T): Promise<BoundaryActionResult<T>>;
    setActiveWidgetLifecycle(handle: WidgetLifecycleHandle | null | undefined): WidgetLifecycleHandle | null;
    showNotification(message: string, type?: string): void;
};

function createPageHostRuntimeServices(
    host: PageHostRuntimeServiceHost,
    confirmModal: Ref<ConfirmModalPublicSurface | null>
): PageHostRuntimeServices {
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

export type {
    ConfirmModalPublicSurface
};

export {
    createPageHostRuntimeServices
};
