type VocModalRuntimeRefs = {
    modalRoot: HTMLElement | null;
    modalSearchInput: HTMLInputElement | null;
};

type VocModalRuntimeContext = {
    $nextTick(callback?: () => void): Promise<unknown>;
    $refs: VocModalRuntimeRefs;
    getInputElement(): HTMLElement | HTMLInputElement | null;
    isModalOpen: boolean;
    modalActiveRowId: string;
    widgetConfig: {
        table_cell_ui_lock_handler?: unknown;
    };
};

function setTableUiLocked(vm: VocModalRuntimeContext, locked: boolean): void {
    const lockHandler =
        vm.widgetConfig &&
        vm.widgetConfig.table_cell_ui_lock_handler;
    if (typeof lockHandler === 'function') {
        lockHandler(!!locked);
    }
}

function focusModalSearchInput(vm: VocModalRuntimeContext): void {
    vm.$refs.modalSearchInput?.focus?.();
}

function restoreInputFocus(vm: VocModalRuntimeContext): void {
    vm.getInputElement()?.focus?.();
}

function scrollModalActiveRowIntoView(vm: VocModalRuntimeContext): void {
    if (!vm.modalActiveRowId) {
        return;
    }
    const activeRow =
        vm.$refs.modalRoot?.querySelector('tr[data-modal-active="true"]') || null;
    if (activeRow && typeof activeRow.scrollIntoView === 'function') {
        activeRow.scrollIntoView({ block: 'nearest' });
    }
}

function closeModal(vm: VocModalRuntimeContext, options: { restoreFocus?: boolean } = {}): void {
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

export type {
    VocModalRuntimeContext,
    VocModalRuntimeRefs
};
