import type { TableLazyLoadState } from './table_contract.ts';

function createInitialLazyLoadState(): TableLazyLoadState {
    return {
        isFullyLoaded: true,
        lazySessionId: 0,
        isLoadingChunk: false,
        lazyEnabled: false,
        lazyPendingRows: []
    };
}

export { createInitialLazyLoadState };
