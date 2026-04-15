import { FrontendApiError } from './api_client.ts';

type FrontendErrorKind = typeof FRONTEND_ERROR_KINDS[keyof typeof FRONTEND_ERROR_KINDS];
type FrontendErrorScope = typeof FRONTEND_ERROR_SCOPES[keyof typeof FRONTEND_ERROR_SCOPES];
type FrontendErrorPresentation =
  typeof FRONTEND_ERROR_PRESENTATIONS[keyof typeof FRONTEND_ERROR_PRESENTATIONS];

type FrontendDiagnostic = Record<string, unknown>;

type FrontendRuntimeError = {
  __frontendError: true;
  presentation: FrontendErrorPresentation;
  kind: FrontendErrorKind | string;
  scope: FrontendErrorScope | string;
  recoverable: boolean;
  message: string;
  code: string;
  status: number;
  diagnostics: FrontendDiagnostic[];
  snapshotVersion: string;
  details: unknown;
  cause: unknown;
};

type FrontendErrorOptions = {
  asPageError?: boolean;
  cause?: unknown;
  code?: unknown;
  details?: unknown;
  diagnostic?: boolean;
  diagnostics?: unknown;
  kind?: FrontendErrorKind | string;
  message?: unknown;
  presentation?: FrontendErrorPresentation | string;
  recoverable?: boolean;
  scope?: FrontendErrorScope | string;
  snapshotVersion?: unknown;
  status?: unknown;
};

type FrontendErrorLike = {
  __frontendError?: boolean;
  cause?: unknown;
  code?: unknown;
  details?: unknown;
  diagnostics?: unknown;
  kind?: unknown;
  message?: unknown;
  payload?: unknown;
  presentation?: unknown;
  recoverable?: unknown;
  scope?: unknown;
  snapshotVersion?: unknown;
  status?: unknown;
};

const FRONTEND_ERROR_KINDS = Object.freeze({
  transport: 'transport',
  domain: 'domain',
  validation: 'validation',
  dependency: 'dependency',
  userAction: 'user-action',
  unknown: 'unknown'
} as const);

const FRONTEND_ERROR_SCOPES = Object.freeze({
  page: 'page',
  attrs: 'attrs',
  modal: 'modal',
  execute: 'execute',
  widget: 'widget',
  table: 'table',
  debug: 'debug'
} as const);

const FRONTEND_ERROR_PRESENTATIONS = Object.freeze({
  fatal: 'fatal',
  recoverable: 'recoverable',
  diagnostic: 'diagnostic'
} as const);

function asFrontendErrorLike(error: unknown): FrontendErrorLike | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  return error as FrontendErrorLike;
}

function normalizeDiagnostics(value: unknown): FrontendDiagnostic[] {
  return Array.isArray(value) ? (value as FrontendDiagnostic[]) : [];
}

function normalizePresentation(value: unknown): FrontendErrorPresentation | '' {
  const key = typeof value === 'string' ? value.trim() : '';
  return Object.prototype.hasOwnProperty.call(FRONTEND_ERROR_PRESENTATIONS, key)
    ? FRONTEND_ERROR_PRESENTATIONS[key as keyof typeof FRONTEND_ERROR_PRESENTATIONS]
    : '';
}

function resolvePresentation(options: FrontendErrorOptions = {}): FrontendErrorPresentation {
  const explicit = normalizePresentation(options.presentation);
  if (explicit) {
    return explicit;
  }

  if (options.asPageError === true || options.recoverable === false) {
    return FRONTEND_ERROR_PRESENTATIONS.fatal;
  }

  if (options.diagnostic === true) {
    return FRONTEND_ERROR_PRESENTATIONS.diagnostic;
  }

  if (options.recoverable === true) {
    return FRONTEND_ERROR_PRESENTATIONS.recoverable;
  }

  return FRONTEND_ERROR_PRESENTATIONS.diagnostic;
}

function createFrontendError(options: FrontendErrorOptions = {}): FrontendRuntimeError {
  const presentation = resolvePresentation(options);
  return {
    __frontendError: true,
    presentation,
    kind: (options.kind as FrontendErrorKind | string) || FRONTEND_ERROR_KINDS.unknown,
    scope: (options.scope as FrontendErrorScope | string) || FRONTEND_ERROR_SCOPES.page,
    recoverable: presentation === FRONTEND_ERROR_PRESENTATIONS.recoverable,
    message: String(options.message || 'Произошла ошибка'),
    code: typeof options.code === 'string' ? options.code : '',
    status: Number(options.status) || 0,
    diagnostics: normalizeDiagnostics(options.diagnostics),
    snapshotVersion: typeof options.snapshotVersion === 'string' ? options.snapshotVersion : '',
    details: options.details || null,
    cause: options.cause || null
  };
}

function detectErrorKind(
  error: unknown,
  fallbackKind?: FrontendErrorKind | string
): FrontendErrorKind | string {
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

function normalizeFrontendError(
  error: unknown,
  options: FrontendErrorOptions = {}
): FrontendRuntimeError {
  const existingError = asFrontendErrorLike(error);
  if (existingError && existingError.__frontendError === true) {
    return createFrontendError({
      ...options,
      kind: typeof existingError.kind === 'string' ? existingError.kind : options.kind,
      scope: typeof existingError.scope === 'string' ? existingError.scope : options.scope,
      message: existingError.message ?? options.message,
      code: existingError.code,
      status: existingError.status,
      presentation:
        typeof existingError.presentation === 'string'
          ? existingError.presentation
          : options.presentation,
      recoverable:
        typeof existingError.recoverable === 'boolean'
          ? existingError.recoverable
          : options.recoverable,
      snapshotVersion: existingError.snapshotVersion,
      diagnostics: options.diagnostics ?? existingError.diagnostics,
      details: options.details ?? existingError.details,
      cause: existingError.cause || error
    });
  }

  return createFrontendError({
    kind: options.kind || detectErrorKind(error, FRONTEND_ERROR_KINDS.unknown),
    scope: options.scope || FRONTEND_ERROR_SCOPES.page,
    recoverable: options.recoverable === true,
    message: options.message || existingError?.message || 'Произошла ошибка',
    code: typeof existingError?.code === 'string' ? existingError.code : '',
    status: Number(existingError?.status) || 0,
    diagnostics: normalizeDiagnostics(existingError?.diagnostics),
    snapshotVersion: typeof existingError?.snapshotVersion === 'string'
      ? existingError.snapshotVersion
      : '',
    details: options.details || existingError?.payload || null,
    cause: error || null
  });
}

function presentFrontendError(error: unknown): FrontendRuntimeError {
  const normalized = normalizeFrontendError(error);
  if (typeof console === 'undefined') {
    return normalized;
  }

  const header =
    `[frontend:${normalized.scope}:${normalized.presentation}:${normalized.kind}] ${normalized.message}`;
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(header);
    console.log('presentation:', normalized.presentation);
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

export type {
  FrontendDiagnostic,
  FrontendErrorKind,
  FrontendErrorOptions,
  FrontendErrorPresentation,
  FrontendErrorScope,
  FrontendRuntimeError
};

export {
  FRONTEND_ERROR_KINDS,
  FRONTEND_ERROR_PRESENTATIONS,
  FRONTEND_ERROR_SCOPES,
  createFrontendError,
  normalizeFrontendError,
  presentFrontendError
};
