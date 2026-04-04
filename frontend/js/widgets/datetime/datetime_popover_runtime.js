function resolveRefElement(vm, refName) {
    const ref = vm && vm.$refs ? vm.$refs[refName] : null;
    return Array.isArray(ref) ? ref[0] || null : ref || null;
}

function setHiddenPopover(vm, styleKey) {
    vm[styleKey] = { visibility: 'hidden' };
}

function updateFloatingPopover(vm, anchorRefName, popoverRefName, styleKey, options = {}) {
    const anchor = resolveRefElement(vm, anchorRefName);
    const popover = resolveRefElement(vm, popoverRefName);
    if (!anchor || !popover) {
        return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const margin = 8;
    const align = options.align === 'end' ? 'end' : 'start';

    let left = align === 'end'
        ? anchorRect.right - popoverRect.width
        : anchorRect.left;
    let top = anchorRect.bottom + margin;

    const maxLeft = Math.max(margin, window.innerWidth - popoverRect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - popoverRect.height - margin);

    left = Math.min(Math.max(margin, left), maxLeft);
    if (top > maxTop) {
        top = Math.max(margin, anchorRect.top - popoverRect.height - margin);
    }

    vm[styleKey] = {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`
    };
}

function addFloatingListener(vm, handlerKey, update) {
    removeFloatingListener(vm, handlerKey);
    const handler = () => {
        if (typeof update === 'function') {
            update();
        }
    };
    vm[handlerKey] = handler;
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
}

function removeFloatingListener(vm, handlerKey) {
    const handler = vm[handlerKey];
    if (handler) {
        window.removeEventListener('resize', handler);
        window.removeEventListener('scroll', handler, true);
        vm[handlerKey] = null;
    }
}

function addOutsideListener(vm, handlerKey, refNames = []) {
    removeOutsideListener(vm, handlerKey);
    const handler = (event) => {
        const target = event.target;
        const inside = refNames.some((refName) => {
            const element = resolveRefElement(vm, refName);
            return Boolean(element && element.contains(target));
        });

        if (!inside && typeof vm.closePopovers === 'function') {
            vm.closePopovers();
        }
    };
    vm[handlerKey] = handler;
    document.addEventListener('click', handler);
}

function removeOutsideListener(vm, handlerKey) {
    const handler = vm[handlerKey];
    if (handler) {
        document.removeEventListener('click', handler);
        vm[handlerKey] = null;
    }
}

export {
    addFloatingListener,
    addOutsideListener,
    removeFloatingListener,
    removeOutsideListener,
    resolveRefElement,
    setHiddenPopover,
    updateFloatingPopover
};
