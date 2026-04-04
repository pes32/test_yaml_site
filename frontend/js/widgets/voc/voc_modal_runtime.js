function setTableUiLocked(vm, locked) {
    const lockHandler =
        vm.widgetConfig &&
        vm.widgetConfig.table_cell_ui_lock_handler;
    if (typeof lockHandler === 'function') {
        lockHandler(!!locked);
    }
}

function focusModalSearchInput(vm) {
    vm.$refs.modalSearchInput?.focus?.();
}

function restoreInputFocus(vm) {
    vm.getInputElement()?.focus?.();
}

function scrollModalActiveRowIntoView(vm) {
    if (!vm.modalActiveRowId) {
        return;
    }
    const activeRow =
        vm.$refs.modalRoot?.querySelector('tr[data-modal-active="true"]') || null;
    if (activeRow && typeof activeRow.scrollIntoView === 'function') {
        activeRow.scrollIntoView({ block: 'nearest' });
    }
}

function closeModal(vm, options = {}) {
    vm.isModalOpen = false;
    setTableUiLocked(vm, false);
    vm.$nextTick(() => {
        if (options.restoreFocus !== false) {
            restoreInputFocus(vm);
        }
    });
}

export {
    closeModal,
    focusModalSearchInput,
    restoreInputFocus,
    scrollModalActiveRowIntoView,
    setTableUiLocked
};
