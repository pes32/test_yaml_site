import type { TableCoreCellAddress } from './table_contract.ts';

function tableValidationKey(cell: TableCoreCellAddress | null | undefined): string {
    return cell ? `${cell.rowId}::${cell.colKey}` : '';
}

function setTableValidationError(
    errors: Record<string, string>,
    cell: TableCoreCellAddress | null | undefined,
    message: unknown
): Record<string, string> {
    const key = tableValidationKey(cell);
    if (!key) return { ...(errors || {}) };
    const next = { ...(errors || {}) };
    const errorMessage = String(message || '').trim();
    if (errorMessage) next[key] = errorMessage;
    else delete next[key];
    return next;
}

export {
    setTableValidationError,
    tableValidationKey
};
