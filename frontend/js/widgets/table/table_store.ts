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
            }
        },
        selection: {
            anchor: { r: 0, c: 0 },
            focus: { r: 0, c: 0 },
            fullWidthRows: null
        },
        editing: {
            activeCell: null
        },
        menu: {
            open: false,
            position: { x: 0, y: 0 },
            target: null,
            context: null,
            sessionId: 0
        },
        sticky: {
            headerRuntimeEnabled: !!options.stickyHeaderEnabled,
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
        validation: {
            cellErrors: {}
        },
        view: {
            lineNumbersRuntimeEnabled: !!options.lineNumbersEnabled,
            wordWrapRuntimeEnabled: false
        }
    };
}

export {
    createTableStore
};
