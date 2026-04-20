import type {
    TableCellAddress,
    TableColumnKey,
    TableCoreCellAddress,
    TableCoreEditingSession,
    TableEditorHandle,
    TableRowId
} from './table_contract.ts';

type TableEditorCommitContext = {
    colKey: TableColumnKey;
    rowId: TableRowId;
};

type DomEditorElement = HTMLElement & {
    value?: unknown;
};

type TableEditingBoundaryKey = 'Escape' | 'Enter' | 'Tab' | 'blur' | 'click-outside';

type TableEditingBoundaryOptions = {
    addRowOnFinalEnter?: boolean;
    colCount: number;
    current: TableCellAddress;
    key: TableEditingBoundaryKey;
    rowCount: number;
    shiftKey?: boolean;
};

type TableEditingBoundaryResult =
    | { action: 'cancel' | 'commit' | 'none'; nextCell: null; shouldAddRow?: false }
    | { action: 'commit'; nextCell: TableCellAddress | null; shouldAddRow?: boolean };

function createEditingSession(
    activeCell: TableCoreCellAddress,
    draftValue: unknown,
    validationErrors: Record<string, string> = {}
): TableCoreEditingSession {
    return {
        activeCell,
        draftValue,
        validationErrors: { ...validationErrors }
    };
}

function isTableEditorHandle(value: unknown): value is TableEditorHandle {
    const candidate = value as Partial<TableEditorHandle> | null;
    return !!(
        candidate &&
        typeof candidate === 'object' &&
        typeof candidate.getValue === 'function' &&
        typeof candidate.setValue === 'function' &&
        typeof candidate.commitDraft === 'function' &&
        typeof candidate.commitPendingState === 'function' &&
        typeof candidate.focus === 'function'
    );
}

function commitEditorHandle(
    handle: TableEditorHandle | null | undefined,
    context: TableEditorCommitContext
): unknown {
    if (!handle) return undefined;
    const pending = handle.commitPendingState(context);
    return pending === undefined ? handle.commitDraft() : pending;
}

function createDomTableEditorHandle(
    element: DomEditorElement,
    options: { commitValue?: (value: unknown) => void } = {}
): TableEditorHandle {
    const readValue = () => ('value' in element ? element.value : element.textContent || '');
    const writeValue = (value: unknown) => {
        if ('value' in element) {
            element.value = value == null ? '' : String(value);
        } else {
            element.textContent = value == null ? '' : String(value);
        }
    };
    return {
        blur: () => element.blur(),
        commitDraft: () => {
            const value = readValue();
            options.commitValue?.(value);
            return value;
        },
        commitPendingState: () => {
            const value = readValue();
            options.commitValue?.(value);
            return value;
        },
        focus: () => element.focus(),
        getValue: readValue,
        setValue: writeValue
    };
}

function resolveTabCell(options: TableEditingBoundaryOptions): TableCellAddress | null {
    const lastRow = options.rowCount - 1;
    const lastCol = options.colCount - 1;
    const { r, c } = options.current;
    if (options.shiftKey) {
        if (c > 0) return { r, c: c - 1 };
        if (r > 0) return { r: r - 1, c: lastCol };
        return null;
    }
    if (c < lastCol) return { r, c: c + 1 };
    if (r < lastRow) return { r: r + 1, c: 0 };
    return null;
}

function resolveEnterCell(options: TableEditingBoundaryOptions): {
    nextCell: TableCellAddress | null;
    shouldAddRow: boolean;
} {
    const lastRow = options.rowCount - 1;
    const lastCol = options.colCount - 1;
    const { r, c } = options.current;
    if (r < lastRow) return { nextCell: { r: r + 1, c }, shouldAddRow: false };
    if (c < lastCol) return { nextCell: { r, c: c + 1 }, shouldAddRow: false };
    return {
        nextCell: null,
        shouldAddRow: Boolean(options.addRowOnFinalEnter)
    };
}

function resolveEditingBoundary(options: TableEditingBoundaryOptions): TableEditingBoundaryResult {
    if (options.key === 'Escape') {
        return { action: 'cancel', nextCell: null };
    }
    if (options.key === 'Tab') {
        return { action: 'commit', nextCell: resolveTabCell(options) };
    }
    if (options.key === 'Enter') {
        const resolved = resolveEnterCell(options);
        return {
            action: 'commit',
            nextCell: resolved.nextCell,
            shouldAddRow: resolved.shouldAddRow
        };
    }
    if (options.key === 'blur' || options.key === 'click-outside') {
        return { action: 'commit', nextCell: null };
    }
    return { action: 'none', nextCell: null };
}

export {
    commitEditorHandle,
    createDomTableEditorHandle,
    createEditingSession,
    isTableEditorHandle,
    resolveEditingBoundary
};
export type {
    TableEditingBoundaryKey,
    TableEditingBoundaryOptions,
    TableEditingBoundaryResult,
    TableEditorCommitContext
};
