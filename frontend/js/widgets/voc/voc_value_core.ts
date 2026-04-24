import {
    filterVocRows,
    findFirstVocRowByValue,
    parseVocDraft,
    resolveSingleVocDraftCommit,
    resolveVocManualTokens,
    restoreVocRowIdsByValues,
    rowsToSourceOrderValues,
    serializeVocValues
} from '../../runtime/voc_contract.ts';
import type { VocRow } from '../../runtime/voc_contract.ts';
export { formatVocRowLabel, replaceVocDraftActiveToken } from '../../runtime/voc_contract.ts';

type SortDirection = '' | 'asc' | 'desc' | string;

type InputDisplayOptions = {
    inputValue: string;
    isDraftEditing: boolean;
    isFocused: boolean;
    isMultiselect: boolean;
    value: unknown;
};

type InlineHighlightOptions = {
    inlineRows: VocRow[];
    isMultiselect: boolean;
    value: unknown;
};

type SingleDraftOptions = {
    draftDirty: boolean;
    inputValue: string;
    rows: VocRow[];
    value: unknown;
};

type MultiDraftOptions = {
    fromBlur?: boolean;
    includeActiveToken?: boolean;
    inputValue: string;
    rows: VocRow[];
    value: unknown;
};

type ModalOpenOptions = {
    inputValue: string;
    isMultiselect: boolean;
    rows: VocRow[];
    value: unknown;
};

type ModalActiveOptions = {
    isMultiselect: boolean;
    modalActiveRowId: string;
    modalSelectedRowId: string;
    modalSelectedRowIds: string[];
    visibleRows: VocRow[];
};

type ModalMoveOptions = {
    delta: number;
    isMultiselect: boolean;
    modalActiveRowId: string;
    modalSelectedRowId: string;
    visibleRows: VocRow[];
};

type ToggleModalRowOptions = {
    isMultiselect: boolean;
    modalSelectedRowId: string;
    modalSelectedRowIds: string[];
    row: VocRow | null | undefined;
};

type ApplyModalSelectionOptions = {
    isMultiselect: boolean;
    modalActiveRowId: string;
    modalSelectedRowId: string;
    modalSelectedRowIds: string[];
    rows: VocRow[];
};

function sortVocRows(rows: unknown, columnIndex: number, direction: SortDirection): VocRow[] {
    const list = Array.isArray(rows) ? rows.slice() : [];
    if (columnIndex < 0 || !direction) {
        return list;
    }

    const dir = direction === 'desc' ? -1 : 1;
    return list.sort((left, right) => {
        const leftValue = left && Array.isArray(left.cells) ? left.cells[columnIndex] || '' : '';
        const rightValue = right && Array.isArray(right.cells) ? right.cells[columnIndex] || '' : '';
        return dir * String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });
}

export function hasVocValue(value: unknown, isMultiselect: boolean): boolean {
    if (isMultiselect) {
        return Array.isArray(value) && value.length > 0;
    }
    return String(value || '').trim() !== '';
}

export function normalizeSingleVocValue(value: unknown): string {
    return value == null ? '' : String(value);
}

export function normalizeMultiVocValue(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map((item) => String(item ?? ''))
        : [];
}

export function resolveInlineQuery(inputValue: string, isMultiselect: boolean): string {
    if (isMultiselect) {
        return parseVocDraft(inputValue).activeToken;
    }
    return inputValue;
}

export function resolveInputDisplayValue({
    isMultiselect,
    isFocused,
    isDraftEditing,
    inputValue,
    value
}: InputDisplayOptions): string {
    if (isMultiselect) {
        if (isFocused || isDraftEditing) {
            return inputValue;
        }
        return serializeVocValues(value);
    }

    if (isFocused || isDraftEditing) {
        return inputValue;
    }

    return String(value || '');
}

export function resolveHighlightedInlineIndex({ isMultiselect, inlineRows, value }: InlineHighlightOptions): number {
    if (isMultiselect) {
        return inlineRows.length > 0 ? 0 : -1;
    }

    const selectedRow = findFirstVocRowByValue(inlineRows, value);
    return selectedRow
        ? inlineRows.findIndex((row) => row.id === selectedRow.id)
        : (inlineRows.length > 0 ? 0 : -1);
}

export function commitSingleVocDraft({ rows, inputValue, value, draftDirty }: SingleDraftOptions) {
    return resolveSingleVocDraftCommit(rows, inputValue, value, { draftDirty });
}

export function commitMultiselectVocDraft({
    rows,
    value,
    inputValue,
    includeActiveToken = false,
    fromBlur = false
}: MultiDraftOptions) {
    const draft = parseVocDraft(inputValue);
    const sourceTokens = draft.completedTokens.slice();
    if (includeActiveToken && draft.activeToken.trim()) {
        sourceTokens.push(draft.activeToken.trim());
    }

    const resolution = resolveVocManualTokens(rows, sourceTokens);
    const nextValue = resolution.resolvedValues.slice();
    const currentValue = Array.isArray(value) ? value : [];
    const shouldEmit =
        nextValue.length !== currentValue.length
        || nextValue.some((item, index) => item !== currentValue[index]);

    return {
        nextValue,
        nextInputValue: fromBlur ? serializeVocValues(nextValue) : inputValue,
        invalidMessage: resolution.invalidToken
            ? `Значение '${resolution.invalidToken}' отсутствует в справочнике`
            : '',
        shouldEmit
    };
}

export function resolveModalRows(
    rows: unknown,
    modalSearch: unknown,
    modalSortColumn: number,
    modalSortDirection: SortDirection
): VocRow[] {
    return sortVocRows(
        filterVocRows(rows, modalSearch),
        modalSortColumn,
        modalSortDirection
    );
}

export function toggleModalSortState(
    modalSortColumn: number,
    modalSortDirection: SortDirection,
    columnIndex: number
) {
    if (modalSortColumn !== columnIndex) {
        return {
            modalSortColumn: columnIndex,
            modalSortDirection: 'asc'
        };
    }
    if (modalSortDirection === 'asc') {
        return {
            modalSortColumn: columnIndex,
            modalSortDirection: 'desc'
        };
    }
    if (modalSortDirection === 'desc') {
        return {
            modalSortColumn: -1,
            modalSortDirection: ''
        };
    }
    return {
        modalSortColumn: columnIndex,
        modalSortDirection: 'asc'
    };
}

export function modalSortControlClass(
    modalSortColumn: number,
    modalSortDirection: SortDirection,
    columnIndex: number
): Record<string, boolean> {
    const active = modalSortColumn === columnIndex;
    if (!active || !modalSortDirection) {
        return {};
    }
    return {
        active: true,
        asc: modalSortDirection === 'asc',
        desc: modalSortDirection === 'desc'
    };
}

export function resolveModalOpenState({ isMultiselect, rows, value, inputValue }: ModalOpenOptions) {
    const modalSearch = isMultiselect
        ? parseVocDraft(inputValue).activeToken
        : String(inputValue || '').trim();

    if (isMultiselect) {
        return {
            modalSearch,
            modalSelectedRowIds: Array.from(restoreVocRowIdsByValues(rows, value)),
            modalSelectedRowId: ''
        };
    }

    const selectedRow = findFirstVocRowByValue(rows, value);
    return {
        modalSearch,
        modalSelectedRowIds: [],
        modalSelectedRowId: selectedRow ? selectedRow.id : ''
    };
}

export function resolveModalActiveState({
    visibleRows,
    isMultiselect,
    modalActiveRowId,
    modalSelectedRowId,
    modalSelectedRowIds
}: ModalActiveOptions) {
    if (!visibleRows.length) {
        return {
            modalActiveRowId: '',
            modalSelectedRowId: isMultiselect ? modalSelectedRowId : ''
        };
    }

    let nextActiveRowId = modalActiveRowId;
    let nextSelectedRowId = modalSelectedRowId;

    if (!visibleRows.some((row) => row.id === nextActiveRowId)) {
        const preferredId = isMultiselect
            ? (modalSelectedRowIds[0] || '')
            : modalSelectedRowId;
        const preferredRow = preferredId
            ? visibleRows.find((row) => row.id === preferredId)
            : null;
        nextActiveRowId = preferredRow ? preferredRow.id : visibleRows[0].id;
    }

    if (!isMultiselect) {
        nextSelectedRowId = nextActiveRowId || visibleRows[0].id;
    }

    return {
        modalActiveRowId: nextActiveRowId,
        modalSelectedRowId: nextSelectedRowId
    };
}

export function moveModalActiveState({
    visibleRows,
    isMultiselect,
    modalActiveRowId,
    modalSelectedRowId,
    delta
}: ModalMoveOptions) {
    if (!visibleRows.length) {
        return {
            modalActiveRowId: '',
            modalSelectedRowId
        };
    }

    const currentIndex = visibleRows.findIndex((row) => row.id === modalActiveRowId);
    const nextIndex =
        currentIndex < 0
            ? 0
            : (currentIndex + delta + visibleRows.length) % visibleRows.length;
    const nextActiveRowId = visibleRows[nextIndex].id;

    return {
        modalActiveRowId: nextActiveRowId,
        modalSelectedRowId: isMultiselect ? modalSelectedRowId : nextActiveRowId
    };
}

export function toggleModalRowSelection({
    isMultiselect,
    modalSelectedRowIds,
    modalSelectedRowId,
    row
}: ToggleModalRowOptions) {
    if (!row) {
        return {
            modalSelectedRowIds,
            modalSelectedRowId,
            modalActiveRowId: ''
        };
    }

    if (!isMultiselect) {
        return {
            modalSelectedRowIds,
            modalSelectedRowId: row.id,
            modalActiveRowId: row.id
        };
    }

    const selected = new Set(Array.isArray(modalSelectedRowIds) ? modalSelectedRowIds : []);
    if (selected.has(row.id)) {
        selected.delete(row.id);
    } else {
        selected.add(row.id);
    }

    return {
        modalSelectedRowIds: Array.from(selected),
        modalSelectedRowId,
        modalActiveRowId: row.id
    };
}

export function applyModalSelection({
    isMultiselect,
    rows,
    modalSelectedRowIds,
    modalSelectedRowId,
    modalActiveRowId
}: ApplyModalSelectionOptions) {
    if (isMultiselect) {
        const nextValue = rowsToSourceOrderValues(rows, new Set(modalSelectedRowIds));
        return {
            nextValue,
            emittedValue: nextValue.slice(),
            shouldEmit: true
        };
    }

    const selectedRowId = modalSelectedRowId || modalActiveRowId;
    const row = rows.find((item) => item.id === selectedRowId) || null;
    if (!row) {
        return {
            nextValue: '',
            emittedValue: '',
            shouldEmit: false
        };
    }

    return {
        nextValue: row.value,
        emittedValue: row.value,
        shouldEmit: true
    };
}
