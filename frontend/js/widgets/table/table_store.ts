import type {
    TableStore
} from './table_contract.ts';
import { createTableRuntimeState } from './table_runtime_state.ts';

type CreateTableStoreOptions = {
    lineNumbersEnabled?: boolean;
    stickyHeaderEnabled?: boolean;
};

function createTableStore(options: CreateTableStoreOptions = {}): TableStore {
    return createTableRuntimeState(
        !!options.stickyHeaderEnabled,
        !!options.lineNumbersEnabled
    );
}

export {
    createTableStore
};
