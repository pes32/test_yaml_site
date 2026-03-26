import { FrontendApiError } from './api_client.js';

/**
 * Normalized frontend runtime error.
 *
 * @typedef {Object} FrontendRuntimeError
 * @property {true} __frontendError
 * @property {string} kind
 * @property {string} scope
 * @property {boolean} recoverable
 * @property {string} message
 * @property {string} code
 * @property {number} status
 * @property {Array<object>} diagnostics
 * @property {string} snapshotVersion
 * @property {unknown} details
 * @property {unknown} cause
 */

const FRONTEND_ERROR_KINDS = Object.freeze({
    transport: 'transport',
    domain: 'domain',
    validation: 'validation',
    dependency: 'dependency',
    userAction: 'user-action',
    unknown: 'unknown'
});

const FRONTEND_ERROR_SCOPES = Object.freeze({
    page: 'page',
    attrs: 'attrs',
    modal: 'modal',
    execute: 'execute',
    widget: 'widget',
    table: 'table',
    debug: 'debug'
});

function createFrontendError(options = {}) {
    return {
        __frontendError: true,
        kind: options.kind || FRONTEND_ERROR_KINDS.unknown,
        scope: options.scope || FRONTEND_ERROR_SCOPES.page,
        recoverable: options.recoverable === true,
        message: String(options.message || 'Произошла ошибка'),
        code: typeof options.code === 'string' ? options.code : '',
        status: Number(options.status) || 0,
        diagnostics: Array.isArray(options.diagnostics) ? options.diagnostics : [],
        snapshotVersion: typeof options.snapshotVersion === 'string' ? options.snapshotVersion : '',
        details: options.details || null,
        cause: options.cause || null
    };
}

function detectErrorKind(error, fallbackKind) {
    if (!(error instanceof FrontendApiError)) {
        return fallbackKind || FRONTEND_ERROR_KINDS.unknown;
    }

    const code = String(error.code || '').trim();
    if (code.includes('invalid') || code.includes('validation')) {
        return FRONTEND_ERROR_KINDS.validation;
    }
    if (code.includes('missing') || code.includes('dependency')) {
        return FRONTEND_ERROR_KINDS.dependency;
    }
    if (error.status === 0 || error.status >= 500 || code === 'http_error') {
        return FRONTEND_ERROR_KINDS.transport;
    }
    if (error.status >= 400) {
        return FRONTEND_ERROR_KINDS.domain;
    }

    return fallbackKind || FRONTEND_ERROR_KINDS.unknown;
}

function normalizeFrontendError(error, options = {}) {
    if (error && error.__frontendError === true) {
        return createFrontendError({
            ...error,
            ...options,
            diagnostics: options.diagnostics || error.diagnostics,
            details: options.details || error.details,
            cause: error.cause || error
        });
    }

    return createFrontendError({
        kind: options.kind || detectErrorKind(error, FRONTEND_ERROR_KINDS.unknown),
        scope: options.scope || FRONTEND_ERROR_SCOPES.page,
        recoverable: options.recoverable === true,
        message: options.message || (error && error.message) || 'Произошла ошибка',
        code: error && typeof error.code === 'string' ? error.code : '',
        status: Number(error && error.status) || 0,
        diagnostics: Array.isArray(error && error.diagnostics) ? error.diagnostics : [],
        snapshotVersion: typeof error && error && typeof error.snapshotVersion === 'string'
            ? error.snapshotVersion
            : '',
        details: options.details || (error && error.payload) || null,
        cause: error || null
    });
}

function presentFrontendError(error) {
    const normalized = normalizeFrontendError(error);
    if (typeof console === 'undefined') {
        return normalized;
    }

    const header = `[frontend:${normalized.scope}:${normalized.kind}] ${normalized.message}`;
    if (typeof console.groupCollapsed === 'function') {
        console.groupCollapsed(header);
        if (normalized.code) {
            console.log('code:', normalized.code);
        }
        if (normalized.status) {
            console.log('status:', normalized.status);
        }
        if (normalized.snapshotVersion) {
            console.log('snapshotVersion:', normalized.snapshotVersion);
        }
        if (normalized.diagnostics && normalized.diagnostics.length) {
            console.log('diagnostics:', normalized.diagnostics);
        }
        if (normalized.details) {
            console.log('details:', normalized.details);
        }
        if (normalized.cause) {
            console.log('cause:', normalized.cause);
        }
        console.groupEnd();
    } else {
        console.error(header, normalized);
    }

    return normalized;
}

export {
    FRONTEND_ERROR_KINDS,
    FRONTEND_ERROR_SCOPES,
    createFrontendError,
    normalizeFrontendError,
    presentFrontendError
};
