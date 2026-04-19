import type {
    TableStore
} from './table_contract.ts';

type CreateTableStoreOptions = {
    lineNumbersEnabled?: boolean;
    stickyHeaderEnabled?: boolean;
};

function createTableStore(options: CreateTableStoreOptions = {}): TableStore {
    return {
        sorting: {
            sortKeys: []
        },
        grouping: {
            state: {
                levels: [],
                expanded: new Set()
            },
            viewCache: null
        },
        selection: {
            anchor: { r: 0, c: 0 },
            focus: { r: 0, c: 0 },
            fullWidthRows: null
        },
        editing: {
            activeCell: null,
            validationErrors: {}
        },
        contextMenu: {
            open: false,
            position: { x: 0, y: 0 },
            target: null,
            context: null,
            sessionId: 0
        },
        measurement: {
            stickyTheadPinned: false,
            stickyPinnedTableWidth: 0,
            stickyPinnedWidthsByRow: null,
            stickyPinnedRowCount: 0
        },
        loading: {
            isFullyLoaded: true,
            lazySessionId: 0,
            isLoadingChunk: false,
            lazyEnabled: false,
            lazyPendingRows: [],
            tableUiLocked: false
        },
        preferences: {
            lineNumbersRuntimeEnabled: !!options.lineNumbersEnabled,
            stickyHeaderRuntimeEnabled: !!options.stickyHeaderEnabled,
            wordWrapRuntimeEnabled: false
        }
    };
}

export {
    createTableStore
};
