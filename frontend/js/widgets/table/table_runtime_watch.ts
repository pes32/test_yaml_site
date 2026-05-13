import type {
    TableRuntimeVm,
    TableRuntimeWatchHandlers
} from './table_contract.ts';
import { computeTableInitSignature } from './table_runtime_init_signature.ts';

function initializeWhenSignatureChanged(vm: TableRuntimeVm): void {
    const next = computeTableInitSignature(vm);
    if (next === vm.lastInitSignature) return;
    vm.lastInitSignature = next;
    vm.initializeTable?.();
}

const tableRuntimeWatch: TableRuntimeWatchHandlers = {
    widgetName(this: TableRuntimeVm) {
        initializeWhenSignatureChanged(this);
    },
    widgetConfig(this: TableRuntimeVm) {
        initializeWhenSignatureChanged(this);
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
