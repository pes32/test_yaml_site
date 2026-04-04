import {
    filterVocRows,
    findFirstVocRowByValue,
    formatVocRowLabel,
    parseVocDraft,
    replaceVocDraftActiveToken,
    resolveSingleVocDraftCommit,
    resolveVocManualTokens,
    restoreVocRowIdsByValues,
    rowsToSourceOrderValues,
    serializeVocValues
} from '../../runtime/voc_contract.js';

function sortVocRows(rows, columnIndex, direction) {
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

function hasVocValue(value, isMultiselect) {
    if (isMultiselect) {
        return Array.isArray(value) && value.length > 0;
    }
    return String(value || '').trim() !== '';
}

function normalizeSingleVocValue(value) {
    return value == null ? '' : String(value);
}

function normalizeMultiVocValue(value) {
    return Array.isArray(value)
        ? value.map((item) => String(item ?? ''))
        : [];
}

function resolveInlineQuery(inputValue, isMultiselect) {
    if (isMultiselect) {
        return parseVocDraft(inputValue).activeToken;
    }
    return inputValue;
}

function resolveInputDisplayValue({
    isMultiselect,
    isFocused,
    isDraftEditing,
    inputValue,
    value
}) {
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

function resolveHighlightedInlineIndex({ isMultiselect, inlineRows, value }) {
    if (isMultiselect) {
        return inlineRows.length > 0 ? 0 : -1;
    }

    const selectedRow = findFirstVocRowByValue(inlineRows, value);
    return selectedRow
        ? inlineRows.findIndex((row) => row.id === selectedRow.id)
        : (inlineRows.length > 0 ? 0 : -1);
}

function commitSingleVocDraft({ rows, inputValue, value, draftDirty }) {
    return resolveSingleVocDraftCommit(rows, inputValue, value, { draftDirty });
}

function commitMultiselectVocDraft({
    rows,
    value,
    inputValue,
    includeActiveToken = false,
    fromBlur = false
}) {
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

function resolveModalRows(rows, modalSearch, modalSortColumn, modalSortDirection) {
    return sortVocRows(
        filterVocRows(rows, modalSearch),
        modalSortColumn,
        modalSortDirection
    );
}

function toggleModalSortState(modalSortColumn, modalSortDirection, columnIndex) {
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

function modalSortControlClass(modalSortColumn, modalSortDirection, columnIndex) {
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

function resolveModalOpenState({ isMultiselect, rows, value, inputValue }) {
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

function resolveModalActiveState({
    visibleRows,
    isMultiselect,
    modalActiveRowId,
    modalSelectedRowId,
    modalSelectedRowIds
}) {
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

function moveModalActiveState({
    visibleRows,
    isMultiselect,
    modalActiveRowId,
    modalSelectedRowId,
    delta
}) {
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

function toggleModalRowSelection({
    isMultiselect,
    modalSelectedRowIds,
    modalSelectedRowId,
    row
}) {
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

function applyModalSelection({
    isMultiselect,
    rows,
    modalSelectedRowIds,
    modalSelectedRowId,
    modalActiveRowId
}) {
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

export {
    applyModalSelection,
    commitMultiselectVocDraft,
    commitSingleVocDraft,
    formatVocRowLabel,
    hasVocValue,
    modalSortControlClass,
    normalizeMultiVocValue,
    normalizeSingleVocValue,
    replaceVocDraftActiveToken,
    resolveHighlightedInlineIndex,
    resolveInlineQuery,
    resolveInputDisplayValue,
    resolveModalActiveState,
    resolveModalOpenState,
    resolveModalRows,
    moveModalActiveState,
    toggleModalRowSelection,
    toggleModalSortState
};
