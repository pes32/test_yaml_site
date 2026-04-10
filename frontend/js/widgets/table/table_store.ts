import type {
    TableStore
} from './table_contract.ts';
import { createTableRuntimeState } from './table_runtime_state.ts';

type CreateTableStoreOptions = {
    stickyHeaderEnabled?: boolean;
};

function createTableStore(options: CreateTableStoreOptions = {}): TableStore {
    return createTableRuntimeState(!!options.stickyHeaderEnabled);
}

export {
    createTableStore
};
