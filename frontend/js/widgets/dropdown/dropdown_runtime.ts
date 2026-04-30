import numberUtils from '../../shared/number_utils.ts';

const { clampNumber } = numberUtils;

type DropdownRuntimeRefs = {
    dropdownMenu: HTMLElement | null;
    dropdownRoot: HTMLElement | null;
    dropdownToggle: HTMLElement | null;
    modalRoot: HTMLElement | null;
};

type DropdownRuntimeContext = {
    $nextTick(callback?: () => void): Promise<unknown>;
    $refs: DropdownRuntimeRefs;
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

type DropdownOutsideClickControllerOptions = {
    getElements(): readonly (HTMLElement | null | undefined)[];
    onOutsideClick(event: MouseEvent): void;
};

type DropdownViewportControllerOptions = {
    onResize?: EventListener;
    onScroll?: EventListener;
};

type DropdownTableCellTabOptions = {
    closeDropdown(): void;
    tableCellMode: boolean;
    tabHandler: unknown;
};

function isTargetInsideElements(
    target: EventTarget | null,
    elements: readonly (HTMLElement | null | undefined)[]
): boolean {
    const eventTarget = target instanceof Node ? target : null;
    if (!eventTarget) {
        return false;
    }
    return elements.some((element) => Boolean(element && element.contains(eventTarget)));
}

function createDropdownOutsideClickController(
    options: DropdownOutsideClickControllerOptions
) {
    let clickOutsideTimerId = 0;
    let clickOutsideHandler: ((event: MouseEvent) => void) | null = null;

    function remove(): void {
        if (clickOutsideTimerId) {
            window.clearTimeout(clickOutsideTimerId);
            clickOutsideTimerId = 0;
        }
        if (clickOutsideHandler) {
            document.removeEventListener('click', clickOutsideHandler);
            clickOutsideHandler = null;
        }
    }

    function add(): void {
        remove();
        clickOutsideHandler = (event: MouseEvent) => {
            if (!isTargetInsideElements(event.target, options.getElements())) {
                options.onOutsideClick(event);
            }
        };
        clickOutsideTimerId = window.setTimeout(() => {
            clickOutsideTimerId = 0;
            if (clickOutsideHandler) {
                document.addEventListener('click', clickOutsideHandler);
            }
        }, 0);
    }

    return {
        add,
        isEventInside(event: MouseEvent): boolean {
            return isTargetInsideElements(event.target, options.getElements());
        },
        remove
    };
}

function createDropdownViewportController(options: DropdownViewportControllerOptions) {
    let resizeHandler: EventListener | null = null;
    let scrollHandler: EventListener | null = null;

    function remove(): void {
        if (scrollHandler) {
            window.removeEventListener('scroll', scrollHandler, true);
            scrollHandler = null;
        }
        if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
            resizeHandler = null;
        }
    }

    function add(): void {
        remove();
        if (options.onScroll) {
            scrollHandler = options.onScroll;
            window.addEventListener('scroll', scrollHandler, true);
        }
        if (options.onResize) {
            resizeHandler = options.onResize;
            window.addEventListener('resize', resizeHandler);
        }
    }

    return {
        add,
        remove
    };
}

type DropdownOutsideClickController = ReturnType<typeof createDropdownOutsideClickController>;
type DropdownViewportController = ReturnType<typeof createDropdownViewportController>;

const outsideClickControllers = new WeakMap<DropdownRuntimeContext, DropdownOutsideClickController>();
const scrollControllers = new WeakMap<DropdownRuntimeContext, DropdownViewportController>();

function getOutsideClickController(vm: DropdownRuntimeContext): DropdownOutsideClickController {
    const existing = outsideClickControllers.get(vm);
    if (existing) {
        return existing;
    }
    const controller = createDropdownOutsideClickController({
        getElements: () => [
            vm.$refs.dropdownRoot,
            vm.$refs.dropdownMenu,
            vm.$refs.modalRoot
        ],
        onOutsideClick: () => {
            vm.onOutsideInteractionCommit();
        }
    });
    outsideClickControllers.set(vm, controller);
    return controller;
}

function getScrollController(vm: DropdownRuntimeContext): DropdownViewportController {
    const existing = scrollControllers.get(vm);
    if (existing) {
        return existing;
    }
    const controller = createDropdownViewportController({
        onScroll: () => {
            if (vm.shouldShowInlineDropdown) {
                updateMenuPosition(vm);
            }
        }
    });
    scrollControllers.set(vm, controller);
    return controller;
}

function listItemId(vm: DropdownRuntimeContext, index: number): string {
    return `voc-item-${vm.listId}-${index}`;
}

function getInputElement(vm: DropdownRuntimeContext): HTMLInputElement | null {
    return vm.$refs.dropdownToggle?.querySelector('.list-combobox-input') || null;
}

function updateMenuPosition(vm: DropdownRuntimeContext): void {
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

function addScrollListener(vm: DropdownRuntimeContext): void {
    removeScrollListener(vm);
    getScrollController(vm).add();
}

function removeScrollListener(vm: DropdownRuntimeContext): void {
    scrollControllers.get(vm)?.remove();
}

function addClickOutsideListener(vm: DropdownRuntimeContext): void {
    removeClickOutsideListener(vm);
    getOutsideClickController(vm).add();
}

function removeClickOutsideListener(vm: DropdownRuntimeContext): void {
    outsideClickControllers.get(vm)?.remove();
}

function isFocusInsideWidget(vm: DropdownRuntimeContext): boolean {
    const root = vm.$refs.dropdownRoot;
    const menu = vm.$refs.dropdownMenu;
    const modal = vm.$refs.modalRoot;
    return isTargetInsideElements(document.activeElement, [root, menu, modal]);
}

function scheduleOutsideInteractionCommit(
    vm: DropdownRuntimeContext,
    options: { delay?: number } = {}
): void {
    window.setTimeout(() => {
        if (!isFocusInsideWidget(vm)) {
            vm.onOutsideInteractionCommit();
        }
    }, options.delay ?? 0);
}

function handleDropdownTableCellTab(
    event: KeyboardEvent,
    options: DropdownTableCellTabOptions
): boolean {
    if (event.key !== 'Tab' || !options.tableCellMode || typeof options.tabHandler !== 'function') {
        return false;
    }

    event.preventDefault();
    options.closeDropdown();
    options.tabHandler(!!event.shiftKey);
    return true;
}

function scrollHighlightedItemIntoView(vm: DropdownRuntimeContext): void {
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

function resolveBoundedHighlightedIndex(index: number, itemCount: number): number {
    const maxIndex = Math.floor(Number(itemCount)) - 1;
    if (maxIndex < 0) {
        return -1;
    }
    const requestedIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
    return clampNumber(requestedIndex, 0, maxIndex);
}

function setDropdownHighlightedIndex(
    vm: DropdownRuntimeContext,
    index: number,
    itemCount: number,
    options: { scroll?: boolean } = {}
): void {
    const nextIndex = resolveBoundedHighlightedIndex(index, itemCount);
    vm.highlightedIndex = nextIndex;
    if (options.scroll !== false && nextIndex >= 0) {
        void vm.$nextTick(() => scrollHighlightedItemIntoView(vm));
    }
}

function moveDropdownHighlightedIndex(
    vm: DropdownRuntimeContext,
    itemCount: number,
    delta: number
): void {
    if (itemCount <= 0) {
        vm.highlightedIndex = -1;
        return;
    }
    const step = Number(delta) || 0;
    const nextIndex =
        vm.highlightedIndex < 0
            ? step > 0
                ? 0
                : itemCount - 1
            : (vm.highlightedIndex + step + itemCount) % itemCount;
    setDropdownHighlightedIndex(vm, nextIndex, itemCount);
}

function openDropdown(vm: DropdownRuntimeContext, options: { highlightFirst?: boolean } = {}): void {
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

function closeDropdown(vm: DropdownRuntimeContext): void {
    if (!vm.isDropdownOpen) {
        return;
    }
    vm.isDropdownOpen = false;
    vm.highlightedIndex = -1;
    removeClickOutsideListener(vm);
    removeScrollListener(vm);
}

function focusInput(vm: DropdownRuntimeContext): void {
    getInputElement(vm)?.focus?.();
}

export {
    addClickOutsideListener,
    addScrollListener,
    closeDropdown,
    createDropdownOutsideClickController,
    createDropdownViewportController,
    focusInput,
    getInputElement,
    isFocusInsideWidget,
    isTargetInsideElements,
    listItemId,
    handleDropdownTableCellTab,
    moveDropdownHighlightedIndex,
    openDropdown,
    removeClickOutsideListener,
    removeScrollListener,
    scheduleOutsideInteractionCommit,
    setDropdownHighlightedIndex,
    scrollHighlightedItemIntoView,
    updateMenuPosition
};

export type {
    DropdownRuntimeContext,
    DropdownRuntimeRefs
};
