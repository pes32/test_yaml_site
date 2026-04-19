import { computed, reactive } from 'vue';
import {
    FRONTEND_ERROR_PRESENTATIONS,
    normalizeFrontendError,
    presentFrontendError,
    type FrontendErrorOptions,
    type FrontendRuntimeError
} from './error_model.ts';

type PageAsyncState = {
    loading: boolean;
    pageError: FrontendRuntimeError | null;
};

type PageErrorRuntimeOptions = {
    showNotification(message: string, type?: string): void;
};

function usePageErrorRuntime(options: PageErrorRuntimeOptions) {
    const asyncState: PageAsyncState = reactive({
        loading: true,
        pageError: null
    });

    const loading = computed({
        get: () => Boolean(asyncState.loading),
        set: (value: boolean) => {
            asyncState.loading = Boolean(value);
        }
    });
    const pageError = computed({
        get: () => asyncState.pageError,
        set: (value: FrontendRuntimeError | null) => {
            asyncState.pageError = value || null;
        }
    });
    const blockingPageError = computed(() =>
        pageError.value?.presentation === FRONTEND_ERROR_PRESENTATIONS.fatal
            ? pageError.value
            : null
    );

    function normalizeAppError(error: unknown, errorOptions: FrontendErrorOptions = {}): FrontendRuntimeError {
        return presentFrontendError(
            normalizeFrontendError(error, errorOptions)
        );
    }

    function reportError(error: unknown, errorOptions: FrontendErrorOptions = {}): FrontendRuntimeError {
        const normalized = normalizeAppError(error, errorOptions);
        if (normalized.presentation === FRONTEND_ERROR_PRESENTATIONS.fatal || errorOptions.asPageError === true) {
            pageError.value = normalized;
        }
        return normalized;
    }

    function reportFatalError(error: unknown, errorOptions: FrontendErrorOptions = {}): FrontendRuntimeError {
        return reportError(error, {
            presentation: FRONTEND_ERROR_PRESENTATIONS.fatal,
            recoverable: false,
            ...errorOptions
        });
    }

    function reportDiagnosticError(error: unknown, errorOptions: FrontendErrorOptions = {}): FrontendRuntimeError {
        return reportError(error, {
            presentation: FRONTEND_ERROR_PRESENTATIONS.diagnostic,
            recoverable: false,
            ...errorOptions
        });
    }

    function handleRecoverableError(error: unknown, errorOptions: FrontendErrorOptions = {}): FrontendRuntimeError {
        const normalized = reportError(error, {
            presentation: FRONTEND_ERROR_PRESENTATIONS.recoverable,
            recoverable: true,
            ...errorOptions
        });
        options.showNotification(normalized.message, 'danger');
        return normalized;
    }

    function dismissPageError(): void {
        pageError.value = null;
    }

    return {
        asyncState,
        blockingPageError,
        dismissPageError,
        handleRecoverableError,
        loading,
        pageError,
        reportDiagnosticError,
        reportFatalError
    };
}

export type {
    PageAsyncState
};

export {
    usePageErrorRuntime
};
