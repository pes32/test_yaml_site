import type { TableCellAddress, TableEditingSession } from './table_contract.ts';

function createInitialEditingSession(): TableEditingSession {
    return {
        activeCell: null,
        validationErrors: {}
    };
}

function activateEditingCell(
    session: TableEditingSession,
    cell: TableCellAddress | null
): TableEditingSession {
    return {
        ...session,
        activeCell: cell
    };
}

function clearEditingSession(): TableEditingSession {
    return createInitialEditingSession();
}

export { activateEditingCell, clearEditingSession, createInitialEditingSession };
