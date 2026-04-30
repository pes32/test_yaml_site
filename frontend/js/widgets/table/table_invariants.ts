import type {
    TableCoreCellAddress,
    TableCoreState,
    TableViewModel
} from './table_contract.ts';

type TableInvariantIssue = {
    code: string;
    details?: Record<string, unknown>;
    message: string;
};

type TableInvariantCheckOptions = {
    phase?: string;
    throwOnError?: boolean;
};

function tableInvariantWarningsEnabled(): boolean {
    const meta = import.meta as ImportMeta & { env?: { VITE_TABLE_INVARIANTS?: string } };
    if (meta.env?.VITE_TABLE_INVARIANTS === '1') return true;
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem('yamls.tableInvariants') === '1';
    } catch (error) {
        return false;
    }
}

function cellLabel(cell: TableCoreCellAddress | null): string {
    if (!cell) return 'null';
    return `${cell.rowId}/${cell.colKey}`;
}

function collectTableInvariantIssues(
    state: TableCoreState,
    viewModel?: TableViewModel | null
): TableInvariantIssue[] {
    const issues: TableInvariantIssue[] = [];
    const rowIds = new Set<string>();
    const duplicateRowIds = new Set<string>();
    for (const row of state.rows) {
        const rowId = row?.id != null ? String(row.id) : '';
        if (!rowId) {
            issues.push({
                code: 'missing_row_id',
                message: 'Every table source row must have a stable rowId.'
            });
            continue;
        }
        if (rowIds.has(rowId)) duplicateRowIds.add(rowId);
        rowIds.add(rowId);
    }
    duplicateRowIds.forEach((rowId) => {
        issues.push({
            code: 'duplicate_row_id',
            details: { rowId },
            message: `Duplicate table rowId "${rowId}".`
        });
    });

    const columnKeys = new Set<string>();
    const duplicateColumnKeys = new Set<string>();
    for (const column of state.columns) {
        const colKey = column?.columnKey != null ? String(column.columnKey) : '';
        if (!colKey) {
            issues.push({
                code: 'missing_column_key',
                message: 'Every table runtime column must have a stable columnKey.'
            });
            continue;
        }
        if (columnKeys.has(colKey)) duplicateColumnKeys.add(colKey);
        columnKeys.add(colKey);
    }
    duplicateColumnKeys.forEach((colKey) => {
        issues.push({
            code: 'duplicate_column_key',
            details: { colKey },
            message: `Duplicate table columnKey "${colKey}".`
        });
    });

    const cellExists = (cell: TableCoreCellAddress | null) =>
        cell == null || (rowIds.has(cell.rowId) && columnKeys.has(cell.colKey));

    if (!cellExists(state.activeCell)) {
        issues.push({
            code: 'active_cell_missing',
            details: { cell: cellLabel(state.activeCell) },
            message: 'Active cell points outside the source rows or columns.'
        });
    }
    if (!cellExists(state.selection.anchor) || !cellExists(state.selection.focus)) {
        issues.push({
            code: 'selection_out_of_bounds',
            details: {
                anchor: cellLabel(state.selection.anchor),
                focus: cellLabel(state.selection.focus)
            },
            message: 'Selection must reference existing rowId and columnKey values.'
        });
    }
    if (state.selection.fullWidthRowIds) {
        const missing = state.selection.fullWidthRowIds.filter((rowId) => !rowIds.has(rowId));
        if (missing.length) {
            issues.push({
                code: 'row_block_selection_missing_rows',
                details: { rowIds: missing },
                message: 'Full-row selection contains rowIds not present in source rows.'
            });
        }
    }
    if (state.editing) {
        if (!state.editing.activeCell) {
            issues.push({
                code: 'editing_without_active_cell',
                message: 'Edit mode must always know editingRowId and editingColKey.'
            });
        } else if (!cellExists(state.editing.activeCell)) {
            issues.push({
                code: 'editing_cell_missing',
                details: { cell: cellLabel(state.editing.activeCell) },
                message: 'Editing cell points outside the source rows or columns.'
            });
        }
        if (!('draftValue' in state.editing)) {
            issues.push({
                code: 'editing_without_draft',
                message: 'Edit mode must carry a draftValue.'
            });
        }
    }
    if (state.contextMenu.open && !state.contextMenu.context) {
        issues.push({
            code: 'context_menu_without_snapshot',
            message: 'Open context menu must have a session snapshot.'
        });
    }
    if (
        state.contextMenu.open &&
        state.contextMenu.context &&
        state.contextMenu.context.sessionId !== state.contextMenu.sessionId
    ) {
        issues.push({
            code: 'context_menu_session_mismatch',
            details: {
                contextSessionId: state.contextMenu.context.sessionId,
                sessionId: state.contextMenu.sessionId
            },
            message: 'Context menu snapshot cannot outlive its session.'
        });
    }

    if (viewModel) {
        for (const rowId of viewModel.orderedRowIds) {
            if (!rowIds.has(rowId)) {
                issues.push({
                    code: 'view_order_missing_row',
                    details: { rowId },
                    message: 'View model orderedRowIds must point to source rows.'
                });
            }
        }
        viewModel.displayRows.forEach((displayRow) => {
            if (displayRow.kind === 'data' && !rowIds.has(displayRow.rowId)) {
                issues.push({
                    code: 'display_row_missing_source',
                    details: { rowId: displayRow.rowId },
                    message: 'Display data row must point to a source rowId.'
                });
            }
        });
    }

    return issues;
}

function formatTableInvariantIssues(
    issues: readonly TableInvariantIssue[],
    phase?: string
): string {
    const prefix = phase ? `Table invariant check failed after ${phase}` : 'Table invariant check failed';
    return `${prefix}:\n${issues.map((issue) => `- ${issue.code}: ${issue.message}`).join('\n')}`;
}

function assertTableInvariants(
    state: TableCoreState,
    viewModel?: TableViewModel | null,
    options: TableInvariantCheckOptions = {}
): void {
    const issues = collectTableInvariantIssues(state, viewModel);
    if (!issues.length) return;
    throw new Error(formatTableInvariantIssues(issues, options.phase));
}

function warnTableInvariants(
    state: TableCoreState,
    viewModel?: TableViewModel | null,
    options: TableInvariantCheckOptions = {}
): TableInvariantIssue[] {
    if (!options.throwOnError && !tableInvariantWarningsEnabled()) return [];
    const issues = collectTableInvariantIssues(state, viewModel);
    if (!issues.length) return issues;
    const message = formatTableInvariantIssues(issues, options.phase);
    if (options.throwOnError) {
        throw new Error(message);
    }
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(message, issues);
    }
    return issues;
}

export {
    assertTableInvariants,
    collectTableInvariantIssues,
    formatTableInvariantIssues,
    warnTableInvariants
};
export type { TableInvariantIssue, TableInvariantCheckOptions };
