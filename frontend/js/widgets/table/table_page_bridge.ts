import type { TableRuntimeServices } from './table_contract.ts';
import type { WidgetAttrsMap } from './table_contract.ts';
import { createTableRuntimeError, normalizeTableRuntimeError } from './table_errors.ts';

type CreateTablePageBridgeOptions = {
    getAllAttrsMap?: (() => WidgetAttrsMap) | null;
    handleRecoverableAppError?: ((error: unknown, context?: Record<string, unknown>) => void) | null;
    showAppNotification?: ((message: string, type?: string) => void) | null;
};

function createTablePageBridge(
    options: CreateTablePageBridgeOptions = {}
): TableRuntimeServices {
    const reportError = (error: unknown) => {
        options.handleRecoverableAppError?.(normalizeTableRuntimeError(error), {
            scope: 'table'
        });
    };

    return {
        getAllAttrsMap: options.getAllAttrsMap || (() => ({})),
        getListOptions: () => [],
        notify: (message, type) => {
            options.showAppNotification?.(message, type);
        },
        reportError,
        handleRecoverableError: (error) => {
            const normalized = normalizeTableRuntimeError(error);
            const runtimeError = normalizeTableRuntimeError(
                createTableRuntimeError(
                    normalized.code || 'table_runtime_error',
                    normalized.message,
                    {
                        cause: normalized.cause,
                        details: normalized.details || undefined
                    }
                )
            );
            reportError(runtimeError);
            options.showAppNotification?.(runtimeError.message, 'danger');
        }
    };
}

export { createTablePageBridge };
