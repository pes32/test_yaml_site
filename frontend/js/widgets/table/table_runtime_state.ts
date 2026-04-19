import type {
    TableGroupingState,
    TableSelectionState,
    TableStore
} from './table_contract.ts';
import { createInitialContextMenuState } from './table_context_menu_state.ts';
import { createInitialEditingSession } from './table_editing_state.ts';
import { createInitialLazyLoadState } from './table_lazy_load_state.ts';
import { createInitialMeasurementState } from './table_measurement_state.ts';

function createInitialGroupingState(): TableGroupingState {
    return {
        levels: [],
        expanded: new Set()
    };
}

function createInitialSelectionState(): TableSelectionState {
    return {
        anchor: { r: 0, c: 0 },
        focus: { r: 0, c: 0 },
        fullWidthRows: null
    };
}

function createInitialSortingState(): TableStore['sorting'] {
    return {
        sortKeys: []
    };
}

function createInitialPreferencesState(
    stickyHeaderEnabled = false,
    lineNumbersEnabled = false
): TableStore['preferences'] {
    return {
        lineNumbersRuntimeEnabled: !!lineNumbersEnabled,
        stickyHeaderRuntimeEnabled: !!stickyHeaderEnabled,
        wordWrapRuntimeEnabled: false
    };
}

function createTableRuntimeState(
    stickyHeaderEnabled = false,
    lineNumbersEnabled = false
): TableStore {
    return {
        sorting: createInitialSortingState(),
        grouping: {
            state: createInitialGroupingState(),
            viewCache: null
        },
        selection: createInitialSelectionState(),
        editing: createInitialEditingSession(),
        contextMenu: createInitialContextMenuState(),
        measurement: createInitialMeasurementState(),
        loading: {
            ...createInitialLazyLoadState(),
            tableUiLocked: false
        },
        preferences: createInitialPreferencesState(stickyHeaderEnabled, lineNumbersEnabled)
    };
}

export {
    createInitialGroupingState,
    createInitialPreferencesState,
    createInitialSelectionState,
    createInitialSortingState,
    createTableRuntimeState
};
