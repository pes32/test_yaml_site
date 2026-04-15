type VocWidgetState = {
    _clickOutside: ((event: MouseEvent) => void) | null;
    _clickOutsideTimerId: number;
    _scrollUpdate: (() => void) | null;
    highlightedIndex: number;
    inputValue: string;
    isDropdownOpen: boolean;
    isFocused: boolean;
    isModalOpen: boolean;
    listId: string;
    menuPosition: Record<string, string>;
    modalActiveRowId: string;
    modalSearch: string;
    modalSelectedRowId: string;
    modalSelectedRowIds: string[];
    modalSortColumn: number;
    modalSortDirection: string;
    singleDraftDirty: boolean;
    skipNextOutsideCommit: boolean;
    value: string | string[];
    vocError: string;
};

function createVocWidgetState(): VocWidgetState {
    return {
        value: '',
        inputValue: '',
        isDropdownOpen: false,
        isFocused: false,
        menuPosition: {},
        listId: 'voc-' + Math.random().toString(36).slice(2, 9),
        highlightedIndex: -1,
        vocError: '',
        singleDraftDirty: false,
        isModalOpen: false,
        skipNextOutsideCommit: false,
        modalSearch: '',
        modalSortColumn: -1,
        modalSortDirection: '',
        modalActiveRowId: '',
        modalSelectedRowId: '',
        modalSelectedRowIds: [],
        _scrollUpdate: null,
        _clickOutside: null,
        _clickOutsideTimerId: 0
    };
}

export type { VocWidgetState };

export { createVocWidgetState };
