function listItemId(vm, index) {
    return `voc-item-${vm.listId}-${index}`;
}

function getInputElement(vm) {
    return vm.$refs.dropdownToggle?.querySelector('.list-combobox-input') || null;
}

function updateMenuPosition(vm) {
    const toggle = vm.$refs.dropdownToggle;
    if (!toggle) {
        return;
    }
    const rect = toggle.getBoundingClientRect();
    vm.menuPosition = {
        position: 'fixed',
        top: `${rect.bottom}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        minWidth: `${rect.width}px`
    };
}

function addScrollListener(vm) {
    removeScrollListener(vm);
    vm._scrollUpdate = () => {
        if (vm.shouldShowInlineDropdown) {
            updateMenuPosition(vm);
        }
    };
    window.addEventListener('scroll', vm._scrollUpdate, true);
}

function removeScrollListener(vm) {
    if (vm._scrollUpdate) {
        window.removeEventListener('scroll', vm._scrollUpdate, true);
        vm._scrollUpdate = null;
    }
}

function addClickOutsideListener(vm) {
    removeClickOutsideListener(vm);
    vm._clickOutside = (event) => {
        const target = event.target;
        const root = vm.$refs.dropdownRoot;
        const menu = vm.$refs.dropdownMenu;
        const modal = vm.$refs.modalRoot;
        const inRoot = root && root.contains(target);
        const inMenu = menu && menu.contains(target);
        const inModal = modal && modal.contains(target);
        if (!inRoot && !inMenu && !inModal) {
            vm.onOutsideInteractionCommit();
        }
    };
    vm._clickOutsideTimerId = window.setTimeout(() => {
        vm._clickOutsideTimerId = 0;
        if (vm._clickOutside) {
            document.addEventListener('click', vm._clickOutside);
        }
    }, 0);
}

function removeClickOutsideListener(vm) {
    if (vm._clickOutsideTimerId) {
        clearTimeout(vm._clickOutsideTimerId);
        vm._clickOutsideTimerId = 0;
    }
    if (vm._clickOutside) {
        document.removeEventListener('click', vm._clickOutside);
        vm._clickOutside = null;
    }
}

function isFocusInsideWidget(vm) {
    const root = vm.$refs.dropdownRoot;
    const menu = vm.$refs.dropdownMenu;
    const modal = vm.$refs.modalRoot;
    const active = document.activeElement;
    if (root && active && root.contains(active)) {
        return true;
    }
    if (menu && active && menu.contains(active)) {
        return true;
    }
    return Boolean(modal && active && modal.contains(active));
}

function scrollHighlightedItemIntoView(vm) {
    const items = vm.$refs.dropdownMenu?.querySelectorAll('[role="option"]');
    if (!items || vm.highlightedIndex < 0 || vm.highlightedIndex >= items.length) {
        return;
    }
    const element =
        items[vm.highlightedIndex]?.querySelector('.dropdown-item') ||
        items[vm.highlightedIndex];
    if (element) {
        element.scrollIntoView({ block: 'nearest' });
    }
}

function openDropdown(vm, options = {}) {
    if (vm.widgetConfig.readonly) {
        return;
    }
    vm.isDropdownOpen = true;
    vm.highlightedIndex = options.highlightFirst === true
        ? (vm.inlineRows.length > 0 ? 0 : -1)
        : vm.resolveHighlightedIndex();
    vm.$nextTick(() => {
        updateMenuPosition(vm);
        addClickOutsideListener(vm);
        addScrollListener(vm);
        scrollHighlightedItemIntoView(vm);
    });
}

function closeDropdown(vm) {
    if (!vm.isDropdownOpen) {
        return;
    }
    vm.isDropdownOpen = false;
    vm.highlightedIndex = -1;
    removeClickOutsideListener(vm);
    removeScrollListener(vm);
}

function focusInput(vm) {
    getInputElement(vm)?.focus?.();
}

export {
    addClickOutsideListener,
    addScrollListener,
    closeDropdown,
    focusInput,
    getInputElement,
    isFocusInsideWidget,
    listItemId,
    openDropdown,
    removeClickOutsideListener,
    removeScrollListener,
    scrollHighlightedItemIntoView,
    updateMenuPosition
};
