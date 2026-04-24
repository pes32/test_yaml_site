import type { TableRuntimeVm } from './table_contract.ts';

function mountTableRuntime(runtime: Pick<TableRuntimeVm, 'initializeTable'>) {
    runtime.initializeTable?.();
}

function unmountTableRuntime(
    runtime: Pick<TableRuntimeVm, '_detachContextMenuGlobalListeners' | '_teardownLazyObserver' | '_unbindStickyThead'>
) {
    runtime._unbindStickyThead?.();
    runtime._detachContextMenuGlobalListeners?.();
    runtime._teardownLazyObserver?.();
}

export { mountTableRuntime, unmountTableRuntime };
