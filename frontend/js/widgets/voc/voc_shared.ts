import type { VocRow } from '../../runtime/voc_contract.ts';
import {
    normalizeVocColumns,
    normalizeVocRows,
    parseVocDraft,
    serializeVocValues
} from '../../runtime/voc_contract.ts';
import type {
    VocWidgetVm,
    WidgetComputedMap,
    WidgetMethodMap,
    WidgetWatchMap
} from '../widget_shared_contracts.ts';
import {
    commitMultiselectVocDraft,
    commitSingleVocDraft,
    formatVocRowLabel,
    hasVocValue,
    normalizeMultiVocValue,
    normalizeSingleVocValue,
    replaceVocDraftActiveToken,
    resolveHighlightedInlineIndex,
    resolveInlineQuery,
    resolveInputDisplayValue,
    resolveModalRows
} from './voc_value_core.js';
import {
    closeDropdown,
    focusInput,
    getInputElement,
    isFocusInsideWidget,
    listItemId,
    openDropdown,
    scrollHighlightedItemIntoView
} from './voc_dropdown_runtime.js';

type VocSharedVm = VocWidgetVm & {
    $nextTick(callback?: () => void): Promise<void>;
    clearVocError(): void;
    closeDropdown(): void;
    commitDraft(options?: { fromBlur?: boolean; includeActiveToken?: boolean }): void;
    columns: string[];
    combinedFieldError: string;
    deactivateDraftController(): void;
    emitInput(value: unknown): void;
    formatRowLabel(row: VocRow): string;
    getInputElement(): HTMLElement | HTMLInputElement | null;
    handleTableCellCommitValidation(message: string): boolean;
    hasValue: boolean;
    highlightedId: string | null;
    inlineQuery: string;
    inlineRows: VocRow[];
    inputDisplayValue: string;
    isMultiselect: boolean;
    labelFloats: boolean;
    listItemId(index: number): string;
    listMenuId: string;
    moveHighlightedIndex(delta: number): void;
    normalizeMultiselectDraftAndSync(options?: {
        fromBlur?: boolean;
        includeActiveToken?: boolean;
    }): unknown;
    onOutsideInteractionCommit(): void;
    openDropdown(options?: { highlightFirst?: boolean }): void;
    openModal(): void;
    resolveHighlightedIndex(): number;
    rows: VocRow[];
    setHighlightedIndex(index: number, options?: { scroll?: boolean }): void;
    setMultiValue(value: unknown): void;
    setSingleValue(value: unknown, options?: { forceSyncInput?: boolean }): void;
    setVocError(message: string): void;
    setValue(value: unknown): void;
    selectInlineRow(row: VocRow | null | undefined): void;
    shouldShowInlineDropdown: boolean;
    syncInputFromCommitted(): void;
};

function createVocWidgetState() {
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

const vocComputed: WidgetComputedMap<VocSharedVm> = {
    isMultiselect() {
        return this.widgetConfig.multiselect === true;
    },
    hasValue() {
        return hasVocValue(this.value, this.isMultiselect);
    },
    labelFloats() {
        return this.hasValue || this.isFocused;
    },
    showPlaceholder() {
        return !this.hasValue && this.isFocused && this.widgetConfig.placeholder;
    },
    columns() {
        return normalizeVocColumns(this.widgetConfig.columns);
    },
    rows() {
        return normalizeVocRows(this.columns, this.widgetConfig.source);
    },
    inlineQuery() {
        return resolveInlineQuery(this.inputValue, this.isMultiselect);
    },
    inlineRows() {
        return resolveModalRows(this.rows, this.inlineQuery, -1, '');
    },
    inputDisplayValue() {
        return resolveInputDisplayValue({
            isMultiselect: this.isMultiselect,
            isFocused: this.isFocused,
            isDraftEditing: this.isDraftEditing,
            inputValue: this.inputValue,
            value: this.value
        });
    },
    listMenuId() {
        return `voc-menu-${this.listId}`;
    },
    highlightedId() {
        return this.highlightedIndex >= 0 && this.highlightedIndex < this.inlineRows.length
            ? this.listItemId(this.highlightedIndex)
            : null;
    },
    shouldShowInlineDropdown() {
        return this.isDropdownOpen && this.inlineRows.length > 0;
    },
    combinedFieldError() {
        return this.vocError || this.fieldError || '';
    }
};

const vocMethods: WidgetMethodMap<VocSharedVm> = {
    listItemId(index) {
        return listItemId(this, Number(index));
    },
    formatRowLabel(row) {
        return formatVocRowLabel((row as VocRow) || null);
    },
    setSingleValue(value, options = {}) {
        const normalizedOptions = (options || {}) as { forceSyncInput?: boolean };
        this.value = normalizeSingleVocValue(value);
        this.singleDraftDirty = false;
        if (normalizedOptions.forceSyncInput === true || (!this.isFocused && !this.isDraftEditing)) {
            this.inputValue = String(this.value || '');
        }
    },
    setMultiValue(value) {
        this.value = normalizeMultiVocValue(value);
        if (!this.isFocused && !this.isDraftEditing) {
            this.inputValue = serializeVocValues(this.value);
        }
    },
    setValue(value) {
        if (this.isMultiselect) {
            this.setMultiValue(value);
            return;
        }

        const nextValue = Array.isArray(value)
            ? String(value[0] ?? '')
            : String(value ?? '');
        this.setSingleValue(nextValue, { forceSyncInput: true });
    },
    getValue() {
        return this.value;
    },
    clearVocError() {
        this.vocError = '';
        this.handleTableCellCommitValidation('');
    },
    setVocError(message) {
        const errorMessage = String(message || '').trim();
        this.vocError = errorMessage;
        this.handleTableCellCommitValidation(errorMessage);
    },
    syncInputFromCommitted() {
        if (this.isFocused || this.isDraftEditing) {
            return;
        }
        this.inputValue = this.isMultiselect
            ? serializeVocValues(this.value)
            : String(this.value || '');
        if (!this.isMultiselect) {
            this.singleDraftDirty = false;
        }
    },
    resolveHighlightedIndex() {
        return resolveHighlightedInlineIndex({
            isMultiselect: this.isMultiselect,
            inlineRows: this.inlineRows,
            value: this.value
        });
    },
    setHighlightedIndex(index, options = {}) {
        const normalizedOptions = (options || {}) as { scroll?: boolean };
        const scroll = normalizedOptions.scroll !== false;
        const maxIndex = this.inlineRows.length - 1;
        const nextIndex =
            maxIndex < 0
                ? -1
                : Math.min(Math.max(Number(index) || 0, 0), maxIndex);
        this.highlightedIndex = nextIndex;
        if (scroll && nextIndex >= 0) {
            void this.$nextTick(() => scrollHighlightedItemIntoView(this));
        }
    },
    moveHighlightedIndex(delta) {
        const length = this.inlineRows.length;
        if (!length) {
            this.highlightedIndex = -1;
            return;
        }
        const step = Number(delta) || 0;
        const nextIndex =
            this.highlightedIndex < 0
                ? step > 0
                    ? 0
                    : length - 1
                : (this.highlightedIndex + step + length) % length;
        this.setHighlightedIndex(nextIndex);
    },
    getInputElement() {
        return getInputElement(this);
    },
    onOutsideInteractionCommit() {
        if (this.isModalOpen) {
            return;
        }
        if (this.isMultiselect && this.skipNextOutsideCommit) {
            this.skipNextOutsideCommit = false;
            this.syncInputFromCommitted();
            closeDropdown(this);
            this.deactivateDraftController();
            return;
        }
        this.commitDraft({ includeActiveToken: true, fromBlur: true });
        closeDropdown(this);
        this.deactivateDraftController();
    },
    isFocusInsideWidget() {
        return isFocusInsideWidget(this);
    },
    openDropdown(options = {}) {
        openDropdown(this, (options || {}) as { highlightFirst?: boolean });
    },
    closeDropdown() {
        closeDropdown(this);
    },
    normalizeMultiselectDraftAndSync(options = {}) {
        const normalizedOptions = (options || {}) as {
            fromBlur?: boolean;
            includeActiveToken?: boolean;
        };
        const resolution = commitMultiselectVocDraft({
            rows: this.rows,
            value: this.value,
            inputValue: this.inputValue,
            includeActiveToken: normalizedOptions.includeActiveToken === true,
            fromBlur: normalizedOptions.fromBlur === true
        });

        this.value = resolution.nextValue;
        if (resolution.shouldEmit) {
            this.emitInput(resolution.nextValue.slice());
        }

        if (resolution.invalidMessage) {
            this.setVocError(resolution.invalidMessage);
        } else {
            this.clearVocError();
        }

        if (normalizedOptions.fromBlur === true) {
            this.inputValue = resolution.nextInputValue;
        }

        return resolution;
    },
    commitDraft(options = {}) {
        const normalizedOptions = (options || {}) as {
            fromBlur?: boolean;
            includeActiveToken?: boolean;
        };
        if (this.isMultiselect) {
            this.normalizeMultiselectDraftAndSync({
                includeActiveToken: normalizedOptions.includeActiveToken === true,
                fromBlur: normalizedOptions.fromBlur === true
            });
            return;
        }

        const resolution = commitSingleVocDraft({
            rows: this.rows,
            inputValue: this.inputValue,
            value: this.value,
            draftDirty: this.singleDraftDirty
        });

        this.value = resolution.nextValue;
        this.inputValue = resolution.nextInputValue;
        this.singleDraftDirty = false;
        this.clearVocError();
        if (resolution.emit) {
            this.emitInput(resolution.emittedValue);
        }
    },
    selectInlineRow(row) {
        const nextRow = (row as VocRow | null) || null;
        if (!nextRow) {
            return;
        }
        if (this.isMultiselect) {
            this.inputValue = replaceVocDraftActiveToken(this.inputValue, nextRow.value);
            this.normalizeMultiselectDraftAndSync({
                includeActiveToken: false,
                fromBlur: false
            });
            closeDropdown(this);
            focusInput(this);
            return;
        }

        this.setSingleValue(nextRow.value, { forceSyncInput: true });
        this.clearVocError();
        this.emitInput(nextRow.value);
        closeDropdown(this);
        this.deactivateDraftController();
    },
    onInputChange(event) {
        if (this.widgetConfig.readonly) {
            return;
        }
        this.activateDraftController();
        this.skipNextOutsideCommit = false;
        this.clearVocError();

        const target = event instanceof Event
            ? (event.target as HTMLInputElement | null)
            : null;

        if (this.isMultiselect) {
            const rawValue = target?.value == null ? '' : String(target.value);
            this.inputValue = parseVocDraft(rawValue).normalizedText;
            this.normalizeMultiselectDraftAndSync({
                includeActiveToken: false,
                fromBlur: false
            });
            const inlineQuery = resolveInlineQuery(this.inputValue, true);
            if (inlineQuery.trim()) {
                openDropdown(this, { highlightFirst: true });
            } else {
                closeDropdown(this);
            }
            return;
        }

        this.inputValue = target?.value == null ? '' : String(target.value);
        this.singleDraftDirty = true;
        if (!this.isDropdownOpen) {
            openDropdown(this, { highlightFirst: true });
            return;
        }
        this.setHighlightedIndex(this.inlineRows.length > 0 ? 0 : -1);
    },
    onInputFocus() {
        this.isFocused = true;
        this.activateDraftController();
        this.clearVocError();
        if (this.isMultiselect) {
            this.inputValue = this.inputValue !== ''
                ? this.inputValue
                : serializeVocValues(this.value);
            return;
        }
        this.inputValue = String(this.value || '');
    },
    onInputBlur() {
        this.isFocused = false;
        window.setTimeout(() => {
            if (this.isFocusInsideWidget()) {
                return;
            }
            this.onOutsideInteractionCommit();
        }, 150);
    },
    onWidgetFocusOut() {
        window.setTimeout(() => {
            if (this.isFocusInsideWidget()) {
                return;
            }
            this.onOutsideInteractionCommit();
        }, 0);
    },
    onInputKeydown(event) {
        if (!(event instanceof KeyboardEvent)) {
            return;
        }
        if (this.widgetConfig.readonly) {
            return;
        }

        if (event.key === 'Tab') {
            const tabHandler =
                this.widgetConfig &&
                this.widgetConfig.table_cell_tab_handler;
            if (
                this.tableCellMode &&
                typeof tabHandler === 'function'
            ) {
                event.preventDefault();
                closeDropdown(this);
                tabHandler(!!event.shiftKey);
                return;
            }
        }

        const shouldOpenModal =
            event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            event.key === 'ArrowDown';
        if (shouldOpenModal) {
            event.preventDefault();
            this.openModal();
            return;
        }

        if (event.key === 'Enter' && !this.isDropdownOpen) {
            event.preventDefault();
            openDropdown(this, { highlightFirst: true });
            return;
        }

        if (this.isDropdownOpen) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.moveHighlightedIndex(1);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.moveHighlightedIndex(-1);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                const row =
                    this.highlightedIndex >= 0 && this.highlightedIndex < this.inlineRows.length
                        ? this.inlineRows[this.highlightedIndex]
                        : null;
                if (row) {
                    this.selectInlineRow(row);
                }
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                closeDropdown(this);
                focusInput(this);
            }
        }
    },
    onMenuKeydown(event) {
        if (!(event instanceof KeyboardEvent)) {
            return;
        }
        if (!this.shouldShowInlineDropdown) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.moveHighlightedIndex(1);
            focusInput(this);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.moveHighlightedIndex(-1);
            focusInput(this);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const row =
                this.highlightedIndex >= 0 && this.highlightedIndex < this.inlineRows.length
                    ? this.inlineRows[this.highlightedIndex]
                    : null;
            if (row) {
                this.selectInlineRow(row);
            }
            focusInput(this);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDropdown(this);
            focusInput(this);
        }
    },
    onArrowClick() {
        if (this.widgetConfig.readonly) {
            return;
        }
        focusInput(this);
        this.openModal();
    }
};

const vocWatch: WidgetWatchMap<VocSharedVm> = {
    'widgetConfig.value': {
        immediate: true,
        handler(value) {
            if (value === undefined) {
                return;
            }
            this.syncCommittedValue(value, (nextValue) => this.setValue(nextValue));
        }
    },
    inlineRows() {
        if (this.inlineRows.length === 0) {
            this.highlightedIndex = -1;
            return;
        }
        if (this.highlightedIndex >= this.inlineRows.length) {
            this.setHighlightedIndex(0, { scroll: false });
        }
    }
};

function beforeUnmountVocWidget(this: VocSharedVm) {
    this.closeDropdown();
    if (this.isModalOpen) {
        this.setTableUiLocked(false);
    }
}

export {
    beforeUnmountVocWidget,
    createVocWidgetState,
    vocComputed,
    vocMethods,
    vocWatch
};
