import type { TableRuntimeServices } from './table_contract.ts';
import type { WidgetAttrsMap } from './table_contract.ts';
import { createTableRuntimeServices } from './table_runtime_services.ts';
import { normalizeTableRuntimeError } from './table_errors.ts';
import { notifyTableRuntimeError } from './table_notifications.ts';

type CreateTablePageBridgeOptions = {
    getAllAttrsMap?: (() => WidgetAttrsMap) | null;
    handleRecoverableAppError?: ((error: unknown, context?: Record<string, unknown>) => void) | null;
    showAppNotification?: ((message: string, type?: string) => void) | null;
};

function createTablePageBridge(
    options: CreateTablePageBridgeOptions = {}
): TableRuntimeServices {
    return createTableRuntimeServices({
        getAllAttrsMap: options.getAllAttrsMap || (() => ({})),
        notify: (message, type) => {
            options.showAppNotification?.(message, type);
        },
        reportError: (error) => {
            options.handleRecoverableAppError?.(normalizeTableRuntimeError(error), {
                scope: 'table'
            });
        },
        handleRecoverableError: (error) => {
            const normalized = normalizeTableRuntimeError(error);
            notifyTableRuntimeError(normalized.message, {
                code: normalized.code,
                cause: normalized.cause,
                details: normalized.details || undefined,
                notify: options.showAppNotification,
                reportError: (payload) => {
                    options.handleRecoverableAppError?.(payload, {
                        scope: 'table'
                    });
                }
            });
        }
    });
}

export { createTablePageBridge };
