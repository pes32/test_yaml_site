type VocDropdownRuntimeRefs = {
    dropdownMenu: HTMLElement | null;
    dropdownRoot: HTMLElement | null;
    dropdownToggle: HTMLElement | null;
    modalRoot: HTMLElement | null;
};

type VocDropdownRuntimeContext = {
    $nextTick(callback?: () => void): Promise<unknown>;
    $refs: VocDropdownRuntimeRefs;
    _clickOutside: ((event: MouseEvent) => void) | null;
    _clickOutsideTimerId: number;
    _scrollUpdate: (() => void) | null;
    highlightedIndex: number;
    inlineRows: unknown[];
    isDropdownOpen: boolean;
    listId: string;
    menuPosition: Record<string, string>;
    onOutsideInteractionCommit(): void;
    resolveHighlightedIndex(): number;
    shouldShowInlineDropdown: boolean;
    widgetConfig: {
        readonly?: boolean;
    };
};

function listItemId(vm: VocDropdownRuntimeContext, index: number): string {
    return `voc-item-${vm.listId}-${index}`;
}

function getInputElement(vm: VocDropdownRuntimeContext): HTMLInputElement | null {
    return vm.$refs.dropdownToggle?.querySelector('.list-combobox-input') || null;
}

function updateMenuPosition(vm: VocDropdownRuntimeContext): void {
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

function addScrollListener(vm: VocDropdownRuntimeContext): void {
    removeScrollListener(vm);
    vm._scrollUpdate = () => {
        if (vm.shouldShowInlineDropdown) {
            updateMenuPosition(vm);
        }
    };
    window.addEventListener('scroll', vm._scrollUpdate, true);
}

function removeScrollListener(vm: VocDropdownRuntimeContext): void {
    if (vm._scrollUpdate) {
        window.removeEventListener('scroll', vm._scrollUpdate, true);
        vm._scrollUpdate = null;
    }
}

function addClickOutsideListener(vm: VocDropdownRuntimeContext): void {
    removeClickOutsideListener(vm);
    vm._clickOutside = (event: MouseEvent) => {
        const target = event.target;
        const root = vm.$refs.dropdownRoot;
        const menu = vm.$refs.dropdownMenu;
        const modal = vm.$refs.modalRoot;
        const eventTarget = target instanceof Node ? target : null;
        const inRoot = !!(root && eventTarget && root.contains(eventTarget));
        const inMenu = !!(menu && eventTarget && menu.contains(eventTarget));
        const inModal = !!(modal && eventTarget && modal.contains(eventTarget));
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

function removeClickOutsideListener(vm: VocDropdownRuntimeContext): void {
    if (vm._clickOutsideTimerId) {
        clearTimeout(vm._clickOutsideTimerId);
        vm._clickOutsideTimerId = 0;
    }
    if (vm._clickOutside) {
        document.removeEventListener('click', vm._clickOutside);
        vm._clickOutside = null;
    }
}

function isFocusInsideWidget(vm: VocDropdownRuntimeContext): boolean {
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

function scrollHighlightedItemIntoView(vm: VocDropdownRuntimeContext): void {
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

function openDropdown(vm: VocDropdownRuntimeContext, options: { highlightFirst?: boolean } = {}): void {
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

function closeDropdown(vm: VocDropdownRuntimeContext): void {
    if (!vm.isDropdownOpen) {
        return;
    }
    vm.isDropdownOpen = false;
    vm.highlightedIndex = -1;
    removeClickOutsideListener(vm);
    removeScrollListener(vm);
}

function focusInput(vm: VocDropdownRuntimeContext): void {
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

export type {
    VocDropdownRuntimeContext,
    VocDropdownRuntimeRefs
};
