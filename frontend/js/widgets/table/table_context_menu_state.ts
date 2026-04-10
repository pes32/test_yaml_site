import type {
    TableContextMenuSnapshot,
    TableContextMenuState,
    TableContextMenuTarget
} from './table_contract.ts';

function createInitialContextMenuState(): TableContextMenuState {
    return {
        open: false,
        position: { x: 0, y: 0 },
        target: null,
        context: null,
        sessionId: 0
    };
}

function openContextMenuState(
    state: TableContextMenuState,
    target: TableContextMenuTarget,
    context: TableContextMenuSnapshot,
    position: { x: number; y: number }
): TableContextMenuState {
    return {
        ...state,
        open: true,
        target,
        context,
        position,
        sessionId: state.sessionId + 1
    };
}

function closeContextMenuState(state: TableContextMenuState): TableContextMenuState {
    return {
        ...state,
        open: false,
        target: null,
        context: null
    };
}

export { closeContextMenuState, createInitialContextMenuState, openContextMenuState };
