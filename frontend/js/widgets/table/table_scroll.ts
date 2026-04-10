import type { TableRuntimeVm } from './table_contract.ts';

const globalScope = typeof window !== 'undefined' ? window : globalThis;

type ScrollRuntimeVm = TableRuntimeVm & {
    _updateStickyThead?: () => void;
};

function findVerticalScrollRoot(el: Element | null | undefined): Element | null {
    let current = el?.parentElement || null;

    while (current) {
        const style = getComputedStyle(current);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return current;
        }
        current = current.parentElement;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return document.scrollingElement || document.documentElement || null;
}

function scheduleUpdate(vm: ScrollRuntimeVm): void {
    if (!vm.stickyHeaderEnabled) return;
    if (vm._stickyRaf) return;

    if (typeof globalScope.requestAnimationFrame !== 'function') {
        vm._updateStickyThead?.();
        return;
    }

    vm._stickyRaf = globalScope.requestAnimationFrame(() => {
        vm._stickyRaf = 0;
        vm._updateStickyThead?.();
    });
}

export { findVerticalScrollRoot, scheduleUpdate };
