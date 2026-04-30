type LifecycleCommitContext = {
    kind?: string;
};

type LifecycleCommitResult =
    | { status: 'noop' | 'committed' }
    | { error: unknown; severity: 'recoverable' | 'fatal'; status: 'blocked' };

function createLifecycleCommitResult(status: 'noop' | 'committed'): LifecycleCommitResult {
    return { status };
}

function createLifecycleBlockedResult(
    error: unknown,
    severity: 'recoverable' | 'fatal' = 'fatal'
): LifecycleCommitResult {
    return {
        error,
        severity,
        status: 'blocked'
    };
}

function normalizeLifecycleCommitResult(result: unknown): LifecycleCommitResult {
    if (result && typeof result === 'object') {
        const candidate = result as Record<string, unknown>;
        if (candidate.status === 'noop' || candidate.status === 'committed') {
            return createLifecycleCommitResult(candidate.status);
        }
        if (
            candidate.status === 'blocked' &&
            (candidate.severity === 'recoverable' || candidate.severity === 'fatal')
        ) {
            return createLifecycleBlockedResult(candidate.error, candidate.severity);
        }
    }
    return createLifecycleCommitResult('committed');
}

export {
    createLifecycleBlockedResult,
    createLifecycleCommitResult,
    normalizeLifecycleCommitResult
};
export type { LifecycleCommitContext, LifecycleCommitResult };
