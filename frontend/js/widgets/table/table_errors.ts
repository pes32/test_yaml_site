import type {
    TableCoreCellAddress,
    TableRuntimeError,
    TableRuntimeErrorSeverity,
    UnknownRecord
} from './table_contract.ts';

export type TableUserFacingErrorOptions = {
    cause?: unknown;
    details?: unknown;
};

type TableRuntimeErrorSink = {
    handleRecoverableAppErrorFromRuntime?: ((error: unknown, context?: UnknownRecord) => void) | null;
    showAppNotificationFromRuntime?: ((message: string, type?: string) => void) | null;
    /** Vue may type `$root` as nullable on component instances. */
    $root?:
        | { showNotification?: (message: string, type?: string) => void }
        | null
        | undefined;
};

function emitTableUserFacingError(
    surface: TableRuntimeErrorSink,
    message: unknown,
    options: TableUserFacingErrorOptions = {}
): void {
    const normalizedMessage = String(message || 'Ошибка таблицы').trim() || 'Ошибка таблицы';
    const sourceError = options.cause ? options.cause : new Error(normalizedMessage);
    if (typeof surface.handleRecoverableAppErrorFromRuntime === 'function') {
        surface.handleRecoverableAppErrorFromRuntime(sourceError, {
            scope: 'table',
            message: normalizedMessage,
            details: options.details != null ? options.details : null
        });
        return;
    }
    if (typeof surface.showAppNotificationFromRuntime === 'function') {
        surface.showAppNotificationFromRuntime(normalizedMessage, 'danger');
        return;
    }
    const root = surface.$root;
    if (root && typeof root.showNotification === 'function') {
        root.showNotification(normalizedMessage, 'danger');
    }
}

const TABLE_RUNTIME_ERROR_CODES = {
    clipboardReadUnavailable: 'clipboard_read_unavailable',
    clipboardWriteFailed: 'clipboard_write_failed',
    embeddedCommitFailed: 'embedded_commit_failed',
    invalidLazyPayload: 'invalid_lazy_payload',
    invalidProviderResult: 'invalid_provider_result',
    invalidSchema: 'invalid_schema',
    measurementFailed: 'measurement_failed',
    unknownColumnType: 'unknown_column_type'
} as const;

function createTableRuntimeError(
    code: string,
    message: string,
    options: {
        cause?: unknown;
        details?: UnknownRecord;
        severity?: TableRuntimeErrorSeverity;
    } = {}
): TableRuntimeError {
    return {
        code,
        message,
        severity: options.severity || 'recoverable',
        details: options.details,
        cause: options.cause
    };
}

function normalizeTableRuntimeError(
    error: unknown,
    fallbackCode = TABLE_RUNTIME_ERROR_CODES.invalidSchema,
    fallbackMessage = 'Ошибка table runtime'
): TableRuntimeError {
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        const candidate = error as Partial<TableRuntimeError>;
        return {
            code: typeof candidate.code === 'string' ? candidate.code : fallbackCode,
            message: typeof candidate.message === 'string' ? candidate.message : fallbackMessage,
            severity: candidate.severity === 'fatal' ? 'fatal' : 'recoverable',
            details: candidate.details,
            cause: candidate.cause
        };
    }

    return createTableRuntimeError(fallbackCode, fallbackMessage, {
        cause: error
    });
}

function tableValidationKey(cell: TableCoreCellAddress | null | undefined): string {
    return cell ? `${cell.rowId}::${cell.colKey}` : '';
}

function setTableValidationError(
    errors: Record<string, string>,
    cell: TableCoreCellAddress | null | undefined,
    message: unknown
): Record<string, string> {
    const key = tableValidationKey(cell);
    if (!key) return { ...(errors || {}) };
    const next = { ...(errors || {}) };
    const errorMessage = String(message || '').trim();
    if (errorMessage) next[key] = errorMessage;
    else delete next[key];
    return next;
}

export {
    emitTableUserFacingError,
    setTableValidationError,
    tableValidationKey,
    TABLE_RUNTIME_ERROR_CODES,
    createTableRuntimeError,
    normalizeTableRuntimeError
};
