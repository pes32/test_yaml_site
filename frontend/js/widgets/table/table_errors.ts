import type { TableRuntimeError, TableRuntimeErrorSeverity, UnknownRecord } from './table_contract.ts';

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

export {
    TABLE_RUNTIME_ERROR_CODES,
    createTableRuntimeError,
    normalizeTableRuntimeError
};
