import { createTableRuntimeError, normalizeTableRuntimeError } from './table_errors.ts';

function notifyTableRuntimeError(
    message: string,
    options: {
        cause?: unknown;
        details?: Record<string, unknown>;
        notify?: ((text: string, type?: string) => void) | null;
        reportError?: ((error: unknown) => void) | null;
        code?: string;
    } = {}
) {
    const error = normalizeTableRuntimeError(
        createTableRuntimeError(
            options.code || 'table_runtime_error',
            message,
            {
                cause: options.cause,
                details: options.details
            }
        )
    );

    options.reportError?.(error);
    options.notify?.(message, 'danger');
    return error;
}

export { notifyTableRuntimeError };
