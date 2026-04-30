import type {
    TableRuntimeVm,
    TableRuntimeWatchHandlers
} from './table_contract.ts';

const tableRuntimeWatch: TableRuntimeWatchHandlers = {
    widgetName(this: TableRuntimeVm) {
        this.initializeTable?.();
    },
    widgetConfig(this: TableRuntimeVm) {
        this.initializeTable?.();
    },
    tableLazyUiActive(this: TableRuntimeVm, value: boolean) {
        this.$nextTick?.(() => {
            if (value) this._setupLazyObserver?.();
            else this._teardownLazyObserver?.();
        });
    },
    stickyHeaderEnabled(this: TableRuntimeVm, value: boolean) {
        this.$nextTick?.(() => {
            this._unbindStickyThead?.();
            if (value || this.toolbarEnabled) this._bindStickyThead?.();
        });
    }
};

export { tableRuntimeWatch };
