import type { TableMeasurementState } from './table_contract.ts';

function createInitialMeasurementState(): TableMeasurementState {
    return {
        stickyTheadPinned: false,
        stickyPinnedTableWidth: 0,
        stickyPinnedWidthsByRow: null,
        stickyPinnedRowCount: 0
    };
}

export { createInitialMeasurementState };
