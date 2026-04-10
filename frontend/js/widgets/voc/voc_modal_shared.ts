import type { VocRow } from '../../runtime/voc_contract.ts';
import type {
    VocModalVm,
    WidgetComputedMap,
    WidgetMethodMap,
    WidgetWatchMap
} from '../widget_shared_contracts.ts';
import {
    applyModalSelection,
    modalSortControlClass,
    moveModalActiveState,
    resolveModalActiveState,
    resolveModalOpenState,
    resolveModalRows,
    toggleModalRowSelection,
    toggleModalSortState
} from './voc_value_core.js';
import {
    closeModal,
    focusModalSearchInput,
    scrollModalActiveRowIntoView,
    setTableUiLocked as runtimeSetTableUiLocked
} from './voc_modal_runtime.js';

type VocModalSharedVm = VocModalVm & {
    $nextTick(callback?: () => void): Promise<void>;
    applyModalSelection(): void;
    clearVocError(): void;
    closeDropdown(): void;
    closeModal(options?: { restoreFocus?: boolean }): void;
    closeModalFromCancel(): void;
    columns: string[];
    isModalRowActive(row: VocRow | null | undefined): boolean;
    isModalRowSelected(row: VocRow | null | undefined): boolean;
    isMultiselect: boolean;
    modalBodyInnerStyle: Record<string, string>;
    modalRows: VocRow[];
    modalSelectedRowIdSet: Set<string>;
    onModalRowClick(row: VocRow | null | undefined): void;
    rows: VocRow[];
    setMultiValue(value: unknown): void;
    setSingleValue(value: unknown, options?: { forceSyncInput?: boolean }): void;
    setTableUiLocked(locked: boolean): void;
    toggleModalRow(row: VocRow): void;
};

const vocModalComputed: WidgetComputedMap<VocModalSharedVm> = {
    modalTitle() {
        const label = String(this.widgetConfig.label || '').trim();
        return label || this.widgetName;
    },
    modalRows() {
        return resolveModalRows(
            this.rows,
            this.modalSearch,
            this.modalSortColumn,
            this.modalSortDirection
        );
    },
    modalSelectedRowIdSet() {
        return new Set(
            Array.isArray(this.modalSelectedRowIds) ? this.modalSelectedRowIds : []
        );
    },
    modalInlineStyle() {
        return {
            width: 'min(100%, 1100px)',
            maxWidth: 'min(1100px, 100%)',
            height: 'min(720px, calc(100vh - 2 * var(--space-md)))',
            maxHeight: 'min(720px, calc(100vh - 2 * var(--space-md)))'
        };
    },
    modalBodyInnerStyle() {
        return {
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
            minHeight: '0',
            padding: '0 20px 20px'
        };
    },
    modalSearchInputStyle() {
        return {
            display: 'block',
            width: '100%',
            boxSizing: 'border-box'
        };
    },
    modalTableWrapStyle() {
        return {
            minHeight: '0',
            width: '100%'
        };
    },
    checkboxCellStyle() {
        return {
            width: '52px',
            minWidth: '52px'
        };
    }
};

const vocModalMethods: WidgetMethodMap<VocModalSharedVm> = {
    modalRowStyle() {
        return {
            cursor: 'pointer'
        };
    },
    modalCellStyle(row, baseStyle = null) {
        const style = {
            ...((baseStyle && typeof baseStyle === 'object' ? baseStyle : {}) as Record<string, unknown>)
        };
        const isActive = this.isModalRowActive((row as VocRow) || null);
        const isSelected = this.isModalRowSelected((row as VocRow) || null);

        if (!isActive && !isSelected) {
            return style;
        }

        style.backgroundColor = isActive
            ? 'var(--color-dropdown-active)'
            : 'var(--color-table-hover)';

        if (isActive) {
            style.boxShadow = 'inset 0 2px 0 0 var(--color-text-main), inset 0 -2px 0 0 var(--color-text-main)';
        }

        return style;
    },
    setTableUiLocked(locked) {
        runtimeSetTableUiLocked(this, Boolean(locked));
    },
    openModal() {
        if (this.widgetConfig.readonly) {
            return;
        }
        this.skipNextOutsideCommit = false;
        this.closeDropdown();
        this.clearVocError();
        this.isModalOpen = true;
        runtimeSetTableUiLocked(this, true);
        this.modalSortColumn = -1;
        this.modalSortDirection = '';

        const nextState = resolveModalOpenState({
            isMultiselect: this.isMultiselect,
            rows: this.rows,
            value: this.value,
            inputValue: this.inputValue
        });
        this.modalSearch = nextState.modalSearch;
        this.modalSelectedRowIds = nextState.modalSelectedRowIds;
        this.modalSelectedRowId = nextState.modalSelectedRowId;

        void this.$nextTick(() => {
            this.syncModalActiveRow();
            focusModalSearchInput(this);
        });
    },
    closeModal(options = {}) {
        closeModal(this, (options || {}) as { restoreFocus?: boolean });
    },
    closeModalFromCancel() {
        closeModal(this, { restoreFocus: true });
    },
    applyModalSelection() {
        const selection = applyModalSelection({
            isMultiselect: this.isMultiselect,
            rows: this.rows,
            modalSelectedRowIds: this.modalSelectedRowIds,
            modalSelectedRowId: this.modalSelectedRowId,
            modalActiveRowId: this.modalActiveRowId
        });

        if (this.isMultiselect) {
            this.setMultiValue(selection.nextValue);
            this.skipNextOutsideCommit = true;
            this.clearVocError();
            closeModal(this, { restoreFocus: true });
            this.emitInput(selection.emittedValue);
            return;
        }

        if (selection.shouldEmit) {
            this.setSingleValue(selection.nextValue, { forceSyncInput: true });
            this.clearVocError();
            closeModal(this, { restoreFocus: true });
            this.emitInput(selection.emittedValue);
            return;
        }

        closeModal(this, { restoreFocus: true });
    },
    modalSortControlClass(columnIndex) {
        return modalSortControlClass(
            this.modalSortColumn,
            this.modalSortDirection,
            Number(columnIndex)
        );
    },
    toggleModalSort(columnIndex) {
        const nextState = toggleModalSortState(
            this.modalSortColumn,
            this.modalSortDirection,
            Number(columnIndex)
        );
        this.modalSortColumn = nextState.modalSortColumn;
        this.modalSortDirection = nextState.modalSortDirection;
        void this.$nextTick(() => this.syncModalActiveRow());
    },
    isModalRowSelected(row) {
        const nextRow = (row as VocRow | null) || null;
        if (!nextRow) {
            return false;
        }
        if (this.isMultiselect) {
            return this.modalSelectedRowIdSet.has(nextRow.id);
        }
        return this.modalSelectedRowId === nextRow.id;
    },
    isModalRowActive(row) {
        const nextRow = (row as VocRow | null) || null;
        return !!(nextRow && this.modalActiveRowId === nextRow.id);
    },
    toggleModalRow(row) {
        const nextState = toggleModalRowSelection({
            isMultiselect: this.isMultiselect,
            modalSelectedRowIds: this.modalSelectedRowIds,
            modalSelectedRowId: this.modalSelectedRowId,
            row: row as VocRow
        });
        this.modalSelectedRowIds = nextState.modalSelectedRowIds;
        this.modalSelectedRowId = nextState.modalSelectedRowId;
        this.modalActiveRowId = nextState.modalActiveRowId;
    },
    onModalRowClick(row) {
        const nextRow = (row as VocRow | null) || null;
        if (!nextRow) {
            return;
        }
        if (this.isMultiselect) {
            this.toggleModalRow(nextRow);
            return;
        }
        this.modalSelectedRowId = nextRow.id;
        this.modalActiveRowId = nextRow.id;
    },
    onModalRowDoubleClick(row) {
        this.onModalRowClick((row as VocRow | null) || null);
        if (!this.isMultiselect) {
            this.applyModalSelection();
        }
    },
    onModalSearchInput(event) {
        const target = event instanceof Event
            ? (event.target as HTMLInputElement | null)
            : null;
        this.modalSearch = target?.value == null ? '' : String(target.value);
    },
    syncModalActiveRow() {
        const nextState = resolveModalActiveState({
            visibleRows: this.modalRows,
            isMultiselect: this.isMultiselect,
            modalActiveRowId: this.modalActiveRowId,
            modalSelectedRowId: this.modalSelectedRowId,
            modalSelectedRowIds: this.modalSelectedRowIds
        });
        this.modalActiveRowId = nextState.modalActiveRowId;
        this.modalSelectedRowId = nextState.modalSelectedRowId;
        void this.$nextTick(() => scrollModalActiveRowIntoView(this));
    },
    moveModalActiveRow(delta) {
        const nextState = moveModalActiveState({
            visibleRows: this.modalRows,
            isMultiselect: this.isMultiselect,
            modalActiveRowId: this.modalActiveRowId,
            modalSelectedRowId: this.modalSelectedRowId,
            delta: Number(delta) || 0
        });
        this.modalActiveRowId = nextState.modalActiveRowId;
        this.modalSelectedRowId = nextState.modalSelectedRowId;
        void this.$nextTick(() => scrollModalActiveRowIntoView(this));
    },
    onModalKeydown(event) {
        if (!(event instanceof KeyboardEvent)) {
            return;
        }
        if (!this.isModalOpen) {
            return;
        }

        const targetTag = String((event.target as HTMLElement | null)?.tagName || '').toUpperCase();
        if (targetTag === 'BUTTON' && event.key === 'Enter') {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeModalFromCancel();
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.moveModalActiveRow(1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.moveModalActiveRow(-1);
            return;
        }
        if (event.key === 'Enter') {
            const activeRow =
                this.modalRows.find((row) => row.id === this.modalActiveRowId) || null;
            if (!activeRow) {
                return;
            }
            event.preventDefault();
            if (this.isMultiselect) {
                this.toggleModalRow(activeRow);
                return;
            }
            this.modalSelectedRowId = activeRow.id;
            this.modalActiveRowId = activeRow.id;
            this.applyModalSelection();
        }
    }
};

const vocModalWatch: WidgetWatchMap<VocModalSharedVm> = {
    modalRows() {
        if (!this.isModalOpen) {
            return;
        }
        this.syncModalActiveRow();
    }
};

export {
    vocModalComputed,
    vocModalMethods,
    vocModalWatch
};
