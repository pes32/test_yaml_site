import type { TableHeaderCell, TableRuntimeVm } from './table_contract.ts';
import {
    buildHeaderCellWidthsFromLeafWidths,
    readRenderedLeafWidths,
    readStickyTopPx
} from './table_measurement.ts';
import { findVerticalScrollRoot, scheduleUpdate } from './table_scroll.ts';

type StickyRuntimeVm = TableRuntimeVm & {
    _stickyCloneClickHandler?: ((event: MouseEvent) => void) | null;
    _stickyCloneContextMenuHandler?: ((event: MouseEvent) => void) | null;
    _stickyCloneKeydownHandler?: ((event: KeyboardEvent) => void) | null;
    _stickyCloneSignature?: string;
    _stickyCloneTableEl?: HTMLTableElement | null;
};

function removeStickyClone(vm: StickyRuntimeVm | null | undefined): void {
    const overlay = vm?._stickyCloneTableEl;
    if (!overlay) return;

    if (vm._stickyCloneClickHandler) {
        overlay.removeEventListener('click', vm._stickyCloneClickHandler, true);
    }
    if (vm._stickyCloneKeydownHandler) {
        overlay.removeEventListener('keydown', vm._stickyCloneKeydownHandler, true);
    }
    if (vm._stickyCloneContextMenuHandler) {
        overlay.removeEventListener('contextmenu', vm._stickyCloneContextMenuHandler, true);
    }

    overlay.remove();
    vm._stickyCloneTableEl = null;
    vm._stickyCloneClickHandler = null;
    vm._stickyCloneKeydownHandler = null;
    vm._stickyCloneContextMenuHandler = null;
    vm._stickyCloneSignature = '';
}

function clearPinnedThead(vm: StickyRuntimeVm): void {
    const thead = vm.$refs?.tableThead as HTMLTableSectionElement | null | undefined;
    removeStickyClone(vm);
    if (thead) {
        thead.classList.remove('widget-table__thead--js-source-hidden');
        thead.style.visibility = '';
        thead.style.pointerEvents = '';
    }
    vm._stickyPinnedTableWidth = 0;
    vm._stickyPinnedWidthsByRow = null;
    vm._stickyPinnedRowCount = 0;
}

function buildStickyCloneSignature(
    table: HTMLTableElement | null | undefined,
    thead: HTMLTableSectionElement | null | undefined
): string {
    const colgroup = table?.querySelector('colgroup');
    return `${thead?.innerHTML || ''}||${colgroup?.innerHTML || ''}`;
}

function clearCloneCellWidths(root: ParentNode | null | undefined): void {
    const ths = root?.querySelectorAll('th') || [];
    for (const th of ths) {
        const element = th as HTMLElement;
        element.style.width = '';
        element.style.minWidth = '';
        element.style.maxWidth = '';
    }
}

function applyLeafWidthsToCloneCols(cloneTable: Element | null | undefined, leafWidths: number[]): void {
    const cols = Array.from(cloneTable?.querySelectorAll('colgroup col') || []);
    cols.forEach((col, index) => {
        const width = leafWidths[index];
        if (!(width > 0.25)) return;
        const element = col as HTMLElement;
        element.style.width = `${width}px`;
        element.style.minWidth = `${width}px`;
        element.style.maxWidth = `${width}px`;
    });
}

function findCloneHeaderCell(
    vm: StickyRuntimeVm | null | undefined,
    th: Element | null | undefined
): TableHeaderCell | null {
    if (!vm || !th) return null;
    const rowIdx = Number.parseInt(th.getAttribute('data-header-row') || '', 10);
    const cellIdx = Number.parseInt(th.getAttribute('data-header-cell') || '', 10);
    if (Number.isNaN(rowIdx) || Number.isNaN(cellIdx)) return null;
    const row = Array.isArray(vm.headerRows) ? vm.headerRows[rowIdx] : null;
    return Array.isArray(row) ? row[cellIdx] || null : null;
}

function parseRuntimeColIndex(th: Element | null | undefined): number | null {
    const raw = Number.parseInt(th?.getAttribute('data-runtime-col-index') || '', 10);
    return Number.isNaN(raw) || raw < 0 ? null : raw;
}

function bindStickyCloneEvents(vm: StickyRuntimeVm, overlay: HTMLTableElement): void {
    if (overlay === vm._stickyCloneTableEl) return;

    vm._stickyCloneClickHandler = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const trigger = target?.closest('.widget-table__th-inner');
        if (!trigger || !overlay.contains(trigger)) return;
        const runtimeColIndex = parseRuntimeColIndex(trigger.closest('th'));
        if (runtimeColIndex == null) return;
        event.preventDefault();
        event.stopPropagation();
        vm.onHeaderSortClick(runtimeColIndex, event);
    };

    vm._stickyCloneKeydownHandler = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target as HTMLElement | null;
        const trigger = target?.closest('.widget-table__th-inner');
        if (!trigger || !overlay.contains(trigger)) return;
        const runtimeColIndex = parseRuntimeColIndex(trigger.closest('th'));
        if (runtimeColIndex == null) return;
        event.preventDefault();
        event.stopPropagation();
        vm.onHeaderSortClick(runtimeColIndex, event);
    };

    vm._stickyCloneContextMenuHandler = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const th = target?.closest('th');
        if (!th || !overlay.contains(th)) return;
        const rowIdx = Number.parseInt(th.getAttribute('data-header-row') || '', 10);
        if (Number.isNaN(rowIdx)) return;
        vm.onTableHeaderContextMenu(event, rowIdx, findCloneHeaderCell(vm, th), parseRuntimeColIndex(th));
    };

    overlay.addEventListener('click', vm._stickyCloneClickHandler, true);
    overlay.addEventListener('keydown', vm._stickyCloneKeydownHandler, true);
    overlay.addEventListener('contextmenu', vm._stickyCloneContextMenuHandler, true);
}

function ensureStickyClone(
    vm: StickyRuntimeVm,
    table: HTMLTableElement,
    thead: HTMLTableSectionElement
): HTMLTableElement {
    let overlay = vm._stickyCloneTableEl;
    if (!overlay) {
        overlay = document.createElement('table');
        overlay.setAttribute('aria-label', 'sticky table header');
        overlay.className = `${table.className} widget-table__sticky-overlay`;
        document.body.appendChild(overlay);
        bindStickyCloneEvents(vm, overlay);
        vm._stickyCloneTableEl = overlay;
    }

    const nextSignature = buildStickyCloneSignature(table, thead);
    if (vm._stickyCloneSignature !== nextSignature) {
        overlay.replaceChildren();
        overlay.className = `${table.className} widget-table__sticky-overlay`;
        const colgroup = table.querySelector('colgroup');
        if (colgroup) {
            overlay.appendChild(colgroup.cloneNode(true));
        }
        const theadClone = thead.cloneNode(true) as HTMLTableSectionElement;
        theadClone.classList.remove('widget-table__thead--js-source-hidden');
        theadClone.style.cssText = '';
        theadClone.style.visibility = '';
        theadClone.style.pointerEvents = '';
        clearCloneCellWidths(theadClone);
        overlay.appendChild(theadClone);
        vm._stickyCloneSignature = nextSignature;
    }

    return overlay;
}

function applyHeaderCellWidths(
    thead: HTMLTableSectionElement | null | undefined,
    widthsByRow: number[][]
): void {
    const rows = Array.from(thead?.rows || []);
    rows.forEach((row, rowIdx) => {
        const rowWidths = widthsByRow[rowIdx] || [];
        Array.from(row.cells).forEach((cell, cellIdx) => {
            const width = rowWidths[cellIdx];
            if (!(width > 0.25)) return;
            const element = cell as HTMLElement;
            element.style.width = `${width}px`;
            element.style.minWidth = `${width}px`;
            element.style.maxWidth = `${width}px`;
        });
    });
}

function applyOverlayHorizontalClip(
    overlay: HTMLElement | null | undefined,
    tableRect: DOMRect,
    rootRect: DOMRect
): void {
    if (!overlay) return;
    const clipLeft = Math.max(0, rootRect.left - tableRect.left);
    const clipRight = Math.max(0, tableRect.right - rootRect.right);
    const clipPath = `inset(0px ${clipRight}px 0px ${clipLeft}px)`;
    overlay.style.clipPath = clipPath;
    (overlay.style as CSSStyleDeclaration & { webkitClipPath?: string }).webkitClipPath = clipPath;
}

function updateStickyThead(vm: StickyRuntimeVm): void {
    if (!vm.stickyHeaderEnabled || !vm._stickyScrollRoot) return;
    const root = vm._stickyScrollRoot;
    const table = vm.$refs?.tableRoot as HTMLTableElement | null | undefined;
    const thead = vm.$refs?.tableThead as HTMLTableSectionElement | null | undefined;
    if (!table || !thead) return;

    const pinTop = readStickyTopPx(root, table);
    const rootRect = root.getBoundingClientRect();
    const pinY = rootRect.top + pinTop;
    const tableRect = table.getBoundingClientRect();
    const tableStyle = getComputedStyle(table);
    const borderTop = Number.parseFloat(tableStyle.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(tableStyle.borderBottomWidth) || 0;
    const naturalTableTop = tableRect.top + borderTop;
    const naturalTableBottom = tableRect.bottom - borderBottom;
    const theadHeight = thead.offsetHeight;
    const shouldPin =
        naturalTableTop <= pinY + 0.5 &&
        naturalTableBottom > pinY + theadHeight + 0.5;

    if (!shouldPin) {
        if (vm._stickyTheadPinned) {
            clearPinnedThead(vm);
            vm._stickyTheadPinned = false;
        }
        return;
    }

    const leafWidths = readRenderedLeafWidths(vm, table, thead);
    const currentRowCount = thead.rows.length;
    const canReusePinnedWidths = Boolean(
        vm._stickyTheadPinned &&
            Array.isArray(vm._stickyPinnedWidthsByRow) &&
            vm._stickyPinnedRowCount === currentRowCount &&
            Math.abs((vm._stickyPinnedTableWidth || 0) - tableRect.width) < 0.5
    );

    let widthsByRow = vm._stickyPinnedWidthsByRow;
    if (!canReusePinnedWidths) {
        clearPinnedThead(vm);
        widthsByRow = buildHeaderCellWidthsFromLeafWidths(vm, leafWidths, thead);
    }

    vm._stickyTheadPinned = true;
    vm._stickyPinnedTableWidth = tableRect.width;
    vm._stickyPinnedWidthsByRow = widthsByRow;
    vm._stickyPinnedRowCount = currentRowCount;

    thead.classList.add('widget-table__thead--js-source-hidden');
    thead.style.visibility = 'hidden';
    thead.style.pointerEvents = 'none';

    const overlay = ensureStickyClone(vm, table, thead);
    const cloneThead = overlay.querySelector('thead');
    applyLeafWidthsToCloneCols(overlay, leafWidths);
    if (cloneThead) {
        applyHeaderCellWidths(cloneThead as HTMLTableSectionElement, widthsByRow || []);
    }

    overlay.style.position = 'fixed';
    overlay.style.top = `${pinY}px`;
    overlay.style.left = `${tableRect.left}px`;
    overlay.style.width = `${tableRect.width}px`;
    overlay.style.zIndex = '9';
    overlay.style.margin = '0';
    overlay.style.boxSizing = 'border-box';
    applyOverlayHorizontalClip(overlay, tableRect, rootRect);
}

function bindStickyThead(vm: StickyRuntimeVm): void {
    unbindStickyThead(vm);
    if (!vm.stickyHeaderEnabled || typeof window === 'undefined') return;
    const table = vm.$refs?.tableRoot as HTMLTableElement | null | undefined;
    const thead = vm.$refs?.tableThead as HTMLTableSectionElement | null | undefined;
    if (!table || !thead) return;

    const root = findVerticalScrollRoot(table);
    if (!root) return;

    vm._stickyScrollRoot = root;
    vm._stickyOnScroll = () => {
        scheduleUpdate(vm);
    };

    root.addEventListener('scroll', vm._stickyOnScroll, { passive: true });
    window.addEventListener('resize', vm._stickyOnScroll, { passive: true });
    window.addEventListener('scroll', vm._stickyOnScroll, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
        vm._stickyRo = new ResizeObserver(() => vm._stickyOnScroll?.());
        vm._stickyRo.observe(table);
        vm._stickyRo.observe(thead);
        if (root.nodeType === 1) {
            vm._stickyRo.observe(root);
        }
    }

    scheduleUpdate(vm);
}

function unbindStickyThead(vm: StickyRuntimeVm): void {
    clearPinnedThead(vm);
    if (vm._stickyRaf) {
        cancelAnimationFrame(vm._stickyRaf);
        vm._stickyRaf = 0;
    }

    if (vm._stickyScrollRoot && vm._stickyOnScroll) {
        vm._stickyScrollRoot.removeEventListener('scroll', vm._stickyOnScroll);
    }

    if (typeof window !== 'undefined' && vm._stickyOnScroll) {
        window.removeEventListener('resize', vm._stickyOnScroll);
        window.removeEventListener('scroll', vm._stickyOnScroll);
    }

    if (vm._stickyRo) {
        vm._stickyRo.disconnect();
        vm._stickyRo = null;
    }

    vm._stickyScrollRoot = null;
    vm._stickyOnScroll = null;
    vm._stickyTheadPinned = false;
}

export {
    bindStickyThead,
    clearPinnedThead,
    unbindStickyThead,
    updateStickyThead
};
