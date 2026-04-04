import {
    applyModalSelection,
    modalSortControlClass,
    resolveModalActiveState,
    resolveModalOpenState,
    resolveModalRows,
    moveModalActiveState,
    toggleModalRowSelection,
    toggleModalSortState
} from './voc_value_core.js';
import {
    closeModal,
    focusModalSearchInput,
    scrollModalActiveRowIntoView,
    setTableUiLocked
} from './voc_modal_runtime.js';

const vocModalMixin = {
    computed: {
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
    },
    methods: {
        modalRowStyle() {
            return {
                cursor: 'pointer'
            };
        },
        modalCellStyle(row, baseStyle = null) {
            const style = {
                ...(baseStyle && typeof baseStyle === 'object' ? baseStyle : {})
            };
            const isActive = this.isModalRowActive(row);
            const isSelected = this.isModalRowSelected(row);

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
            setTableUiLocked(this, locked);
        },
        openModal() {
            if (this.widgetConfig.readonly) {
                return;
            }
            this.skipNextOutsideCommit = false;
            this.closeDropdown();
            this.clearVocError();
            this.isModalOpen = true;
            setTableUiLocked(this, true);
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

            this.$nextTick(() => {
                this.syncModalActiveRow();
                focusModalSearchInput(this);
            });
        },
        closeModal(options = {}) {
            closeModal(this, options);
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
            return modalSortControlClass(this.modalSortColumn, this.modalSortDirection, columnIndex);
        },
        toggleModalSort(columnIndex) {
            const nextState = toggleModalSortState(
                this.modalSortColumn,
                this.modalSortDirection,
                columnIndex
            );
            this.modalSortColumn = nextState.modalSortColumn;
            this.modalSortDirection = nextState.modalSortDirection;
            this.$nextTick(() => this.syncModalActiveRow());
        },
        isModalRowSelected(row) {
            if (!row) {
                return false;
            }
            if (this.isMultiselect) {
                return this.modalSelectedRowIdSet.has(row.id);
            }
            return this.modalSelectedRowId === row.id;
        },
        isModalRowActive(row) {
            return !!(row && this.modalActiveRowId === row.id);
        },
        toggleModalRow(row) {
            const nextState = toggleModalRowSelection({
                isMultiselect: this.isMultiselect,
                modalSelectedRowIds: this.modalSelectedRowIds,
                modalSelectedRowId: this.modalSelectedRowId,
                row
            });
            this.modalSelectedRowIds = nextState.modalSelectedRowIds;
            this.modalSelectedRowId = nextState.modalSelectedRowId;
            this.modalActiveRowId = nextState.modalActiveRowId;
        },
        onModalRowClick(row) {
            if (!row) {
                return;
            }
            if (this.isMultiselect) {
                this.toggleModalRow(row);
                return;
            }
            this.modalSelectedRowId = row.id;
            this.modalActiveRowId = row.id;
        },
        onModalRowDoubleClick(row) {
            this.onModalRowClick(row);
            if (!this.isMultiselect) {
                this.applyModalSelection();
            }
        },
        onModalSearchInput(event) {
            this.modalSearch = event?.target?.value == null ? '' : String(event.target.value);
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
            this.$nextTick(() => scrollModalActiveRowIntoView(this));
        },
        moveModalActiveRow(delta) {
            const nextState = moveModalActiveState({
                visibleRows: this.modalRows,
                isMultiselect: this.isMultiselect,
                modalActiveRowId: this.modalActiveRowId,
                modalSelectedRowId: this.modalSelectedRowId,
                delta
            });
            this.modalActiveRowId = nextState.modalActiveRowId;
            this.modalSelectedRowId = nextState.modalSelectedRowId;
            this.$nextTick(() => scrollModalActiveRowIntoView(this));
        },
        onModalKeydown(event) {
            if (!this.isModalOpen) {
                return;
            }

            const targetTag = String(event.target?.tagName || '').toUpperCase();
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
    },
    watch: {
        modalRows() {
            if (!this.isModalOpen) {
                return;
            }
            this.syncModalActiveRow();
        }
    }
};

export { vocModalMixin };
export default vocModalMixin;
