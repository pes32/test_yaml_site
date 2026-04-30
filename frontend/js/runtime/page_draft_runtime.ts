import { createLifecycleBlockedResult, createLifecycleCommitResult } from '../shared/lifecycle_commit.ts';
import type { LifecycleCommitContext, LifecycleCommitResult } from '../shared/lifecycle_commit.ts';
import type { WidgetLifecycleHandle } from '../widgets/factory.ts';

type BoundaryActionKind = 'execute' | 'modal-close' | 'navigation';

type PageDraftRuntimeState = {
  activeLifecycleHandle: WidgetLifecycleHandle | null;
  boundaryToken: number;
  pendingBoundaryPromise: Promise<BoundaryActionResult<unknown>> | null;
};

type BoundaryActionResult<T> =
  | {
      status: 'executed';
      commitStatus: 'noop' | 'committed';
      value: T;
    }
  | {
      status: 'blocked';
      severity: 'recoverable' | 'fatal';
      error: unknown;
    };

type RunBoundaryActionOptions = {
  onFatalError?: (error: unknown) => void;
  onRecoverableError?: (error: unknown) => void;
};

function createEmptyDraftRuntimeState(): PageDraftRuntimeState {
  return {
    activeLifecycleHandle: null,
    boundaryToken: 0,
    pendingBoundaryPromise: null
  };
}

function setActiveWidgetLifecycle(
  state: PageDraftRuntimeState,
  handle: WidgetLifecycleHandle | null | undefined
): WidgetLifecycleHandle | null {
  state.activeLifecycleHandle = handle ?? null;
  return state.activeLifecycleHandle;
}

function clearActiveWidgetLifecycle(
  state: PageDraftRuntimeState,
  handle?: WidgetLifecycleHandle | null
): WidgetLifecycleHandle | null {
  if (!handle || state.activeLifecycleHandle === handle) {
    state.activeLifecycleHandle = null;
  }

  return state.activeLifecycleHandle;
}

async function commitActiveWidgetLifecycle(
  state: PageDraftRuntimeState,
  context: LifecycleCommitContext = {}
): Promise<LifecycleCommitResult> {
  const handle = state.activeLifecycleHandle;
  if (!handle) {
    return createLifecycleCommitResult('noop');
  }

  try {
    return await handle.commitPendingState(context);
  } catch (error) {
    return createLifecycleBlockedResult(error, 'fatal');
  }
}

async function runBoundaryAction<T>(
  state: PageDraftRuntimeState,
  kind: BoundaryActionKind,
  action: () => Promise<T> | T,
  options: RunBoundaryActionOptions = {}
): Promise<BoundaryActionResult<T>> {
  if (state.pendingBoundaryPromise) {
    return state.pendingBoundaryPromise as Promise<BoundaryActionResult<T>>;
  }

  const boundaryToken = state.boundaryToken + 1;
  state.boundaryToken = boundaryToken;

  const pendingPromise = (async () => {
    const commitResult = await commitActiveWidgetLifecycle(state, { kind });

    if (commitResult.status === 'blocked') {
      if (commitResult.severity === 'recoverable') {
        options.onRecoverableError?.(commitResult.error);
      } else {
        options.onFatalError?.(commitResult.error);
      }

      return {
        status: 'blocked',
        severity: commitResult.severity,
        error: commitResult.error
      } satisfies BoundaryActionResult<T>;
    }

    const value = await action();
    return {
      status: 'executed',
      commitStatus: commitResult.status,
      value
    } satisfies BoundaryActionResult<T>;
  })().finally(() => {
    if (state.boundaryToken === boundaryToken) {
      state.pendingBoundaryPromise = null;
    }
  });

  state.pendingBoundaryPromise = pendingPromise as Promise<BoundaryActionResult<unknown>>;
  return pendingPromise;
}

function resetDraftRuntime(state: PageDraftRuntimeState): PageDraftRuntimeState {
  state.boundaryToken += 1;
  state.pendingBoundaryPromise = null;
  state.activeLifecycleHandle = null;
  return state;
}

export type {
  BoundaryActionKind,
  BoundaryActionResult,
  PageDraftRuntimeState,
  RunBoundaryActionOptions
};

export {
  clearActiveWidgetLifecycle,
  commitActiveWidgetLifecycle,
  createEmptyDraftRuntimeState,
  resetDraftRuntime,
  runBoundaryAction,
  setActiveWidgetLifecycle
};
