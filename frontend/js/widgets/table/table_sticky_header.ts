import type { TableHeaderCell, TableStickyRuntimeSurface } from './table_contract.ts';
import {
    buildHeaderCellWidthsFromLeafWidths,
    readRenderedLeafWidths,
    readStickyTopPx
} from './table_measurement.ts';
import { findVerticalScrollRoot, scheduleUpdate } from './table_scroll.ts';

type StickyRuntimeVm = TableStickyRuntimeSurface & {
    _stickyBindRetryCount?: number;
    _stickyCloneClickHandler?: ((event: MouseEvent) => void) | null;
    _stickyCloneContextMenuHandler?: ((event: MouseEvent) => void) | null;
    _stickyCloneKeydownHandler?: ((event: KeyboardEvent) => void) | null;
    _stickyCloneSignature?: string;
    _stickyCloneTableEl?: HTMLTableElement | null;
    _virtualScrollRoot?: Element | null;
};

function restoreSourceTheadVisibility(vm: StickyRuntimeVm): void {
    const thead = vm.$refs?.tableThead as HTMLTableSectionElement | null | undefined;
    if (!thead) return;
    thead.classList.remove('widget-table__thead--js-source-hidden');
    thead.style.visibility = '';
    thead.style.pointerEvents = '';
}

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
    removeStickyClone(vm);
    restoreSourceTheadVisibility(vm);
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

function runtimeColIndexFromStickySortTrigger(
    event: Event,
    overlay: HTMLTableElement
): number | null {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest('.widget-table__th-inner');
    if (!trigger || !overlay.contains(trigger)) return null;
    return parseRuntimeColIndex(trigger.closest('th'));
}

function activateStickyHeaderSort(
    vm: StickyRuntimeVm,
    overlay: HTMLTableElement,
    event: MouseEvent | KeyboardEvent
): void {
    const runtimeColIndex = runtimeColIndexFromStickySortTrigger(event, overlay);
    if (runtimeColIndex == null) return;
    event.preventDefault();
    event.stopPropagation();
    vm.onHeaderSortClick(runtimeColIndex, event);
}

function bindStickyCloneEvents(vm: StickyRuntimeVm, overlay: HTMLTableElement): void {
    if (overlay === vm._stickyCloneTableEl) return;

    vm._stickyCloneClickHandler = (event: MouseEvent) => {
        activateStickyHeaderSort(vm, overlay, event);
    };

    vm._stickyCloneKeydownHandler = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        activateStickyHeaderSort(vm, overlay, event);
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
    } else if (overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
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

function stickyCloneReady(
    overlay: HTMLTableElement,
    cloneThead: Element | null | undefined,
    tableRect: DOMRect,
    widthsByRow: number[][]
): boolean {
    if (!cloneThead) return false;
    if (!(overlay.offsetHeight > 0) || !(overlay.offsetWidth > 0)) return false;
    if (Math.abs(overlay.getBoundingClientRect().width - tableRect.width) > 1) return false;
    const cloneRows = Array.from((cloneThead as HTMLTableSectionElement).rows || []);
    for (let rowIndex = 0; rowIndex < widthsByRow.length; rowIndex += 1) {
        const sourceWidths = widthsByRow[rowIndex] || [];
        const cloneCells = Array.from(cloneRows[rowIndex]?.cells || []);
        for (let cellIndex = 0; cellIndex < sourceWidths.length; cellIndex += 1) {
            const width = sourceWidths[cellIndex];
            if (!(width > 0.25)) continue;
            const cloneWidth = cloneCells[cellIndex]?.getBoundingClientRect().width || 0;
            if (!(cloneWidth > 0.25)) return false;
        }
    }
    return true;
}

function stickyToolbarBottom(vm: StickyRuntimeVm, pinY: number): number {
    const toolbar = vm.$refs?.tableToolbarHost as HTMLElement | null | undefined;
    if (!toolbar) return pinY;
    const rect = toolbar.getBoundingClientRect();
    const height = rect.height;
    if (!Number.isFinite(height) || height <= 0) return pinY;
    return Math.max(pinY + height, rect.bottom);
}

function syncStickyToolbarHorizontalOffset(
    vm: StickyRuntimeVm,
    root: Element | null | undefined
): void {
    void root;
    const toolbar = vm.$refs?.tableToolbarHost as HTMLElement | null | undefined;
    if (!toolbar) return;
    const rect = toolbar.getBoundingClientRect();
    const storedAnchor = Number(toolbar.dataset.stickyToolbarAnchorLeft);
    const anchorLeft = Number.isFinite(storedAnchor) ? storedAnchor : rect.left;
    if (!Number.isFinite(storedAnchor)) {
        toolbar.dataset.stickyToolbarAnchorLeft = String(anchorLeft);
    }
    toolbar.style.setProperty('--widget-table-toolbar-scroll-x', `${anchorLeft - rect.left}px`);
}

function updateStickyThead(vm: StickyRuntimeVm): void {
    if (!vm.stickyHeaderEnabled || !vm._stickyScrollRoot) return;
    const root = vm._stickyScrollRoot;
    syncStickyToolbarHorizontalOffset(vm, root);
    const table = vm.$refs?.tableRoot as HTMLTableElement | null | undefined;
    const thead = vm.$refs?.tableThead as HTMLTableSectionElement | null | undefined;
    if (!table || !thead) return;

    const pinTop = readStickyTopPx(root, table);
    const rootRect = root.getBoundingClientRect();
    const pinY = rootRect.top + pinTop;
    const toolbarBottom = stickyToolbarBottom(vm, pinY);
    const headerPinY = toolbarBottom;
    const tableRect = table.getBoundingClientRect();
    const tableStyle = getComputedStyle(table);
    const borderTop = Number.parseFloat(tableStyle.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(tableStyle.borderBottomWidth) || 0;
    const naturalTableTop = tableRect.top + borderTop;
    const naturalTableBottom = tableRect.bottom - borderBottom;
    const theadHeight = thead.offsetHeight;
    const shouldPin =
        naturalTableTop <= headerPinY + 0.5 &&
        naturalTableBottom > headerPinY + theadHeight + 0.5;

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

    restoreSourceTheadVisibility(vm);
    const widthsByRow = canReusePinnedWidths && vm._stickyPinnedWidthsByRow
        ? vm._stickyPinnedWidthsByRow
        : buildHeaderCellWidthsFromLeafWidths(vm, leafWidths, thead);

    const overlay = ensureStickyClone(vm, table, thead);
    const cloneThead = overlay.querySelector('thead');
    applyLeafWidthsToCloneCols(overlay, leafWidths);
    if (cloneThead) {
        applyHeaderCellWidths(cloneThead as HTMLTableSectionElement, widthsByRow || []);
    }

    overlay.style.position = 'fixed';
    overlay.style.top = `${headerPinY}px`;
    overlay.style.left = `${tableRect.left}px`;
    overlay.style.width = `${tableRect.width}px`;
    overlay.style.zIndex = '9';
    overlay.style.margin = '0';
    overlay.style.boxSizing = 'border-box';
    applyOverlayHorizontalClip(overlay, tableRect, rootRect);

    if (!stickyCloneReady(overlay, cloneThead, tableRect, widthsByRow || [])) {
        restoreSourceTheadVisibility(vm);
        vm._stickyTheadPinned = false;
        vm._stickyPinnedTableWidth = 0;
        vm._stickyPinnedWidthsByRow = null;
        vm._stickyPinnedRowCount = 0;
        removeStickyClone(vm);
        return;
    }

    vm._stickyTheadPinned = true;
    vm._stickyPinnedTableWidth = tableRect.width;
    vm._stickyPinnedWidthsByRow = widthsByRow;
    vm._stickyPinnedRowCount = currentRowCount;
    thead.classList.add('widget-table__thead--js-source-hidden');
    thead.style.visibility = 'hidden';
    thead.style.pointerEvents = 'none';
}

function scheduleStickyBindRetry(vm: StickyRuntimeVm): void {
    const attempt = vm._stickyBindRetryCount || 0;
    if (attempt >= 3) return;
    vm._stickyBindRetryCount = attempt + 1;
    vm.$nextTick?.(() => {
        bindStickyThead(vm);
    });
}

function bindStickyThead(vm: StickyRuntimeVm): void {
    const previousToolbar = vm.$refs?.tableToolbarHost as HTMLElement | null | undefined;
    const previousToolbarAnchor = previousToolbar?.dataset.stickyToolbarAnchorLeft || '';
    const retryCount = vm._stickyBindRetryCount || 0;
    unbindStickyThead(vm);
    vm._stickyBindRetryCount = retryCount;
    if (typeof window === 'undefined') return;
    const table = vm.$refs?.tableRoot as HTMLTableElement | null | undefined;
    const thead = vm.$refs?.tableThead as HTMLTableSectionElement | null | undefined;
    const toolbar = vm.$refs?.tableToolbarHost as HTMLElement | null | undefined;
    if (toolbar && previousToolbarAnchor) {
        toolbar.dataset.stickyToolbarAnchorLeft = previousToolbarAnchor;
    }
    if (!vm.stickyHeaderEnabled && !toolbar) return;
    if (!table || !thead) {
        scheduleStickyBindRetry(vm);
        return;
    }

    const root = vm._virtualScrollRoot || findVerticalScrollRoot(table);
    if (!root) {
        scheduleStickyBindRetry(vm);
        return;
    }

    vm._stickyBindRetryCount = 0;
    vm._stickyScrollRoot = root;
    vm._stickyOnScroll = () => {
        syncStickyToolbarHorizontalOffset(vm, root);
        scheduleUpdate(vm);
    };

    root.addEventListener('scroll', vm._stickyOnScroll, { passive: true });
    window.addEventListener('resize', vm._stickyOnScroll, { passive: true });
    window.addEventListener('scroll', vm._stickyOnScroll, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
        vm._stickyRo = new ResizeObserver(() => vm._stickyOnScroll?.());
        vm._stickyRo.observe(table);
        vm._stickyRo.observe(thead);
        if (toolbar) {
            vm._stickyRo.observe(toolbar);
        }
        if (root.nodeType === 1) {
            vm._stickyRo.observe(root);
        }
    }

    syncStickyToolbarHorizontalOffset(vm, root);
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

    const toolbar = vm.$refs?.tableToolbarHost as HTMLElement | null | undefined;
    if (toolbar) {
        toolbar.style.removeProperty('--widget-table-toolbar-scroll-x');
        delete toolbar.dataset.stickyToolbarAnchorLeft;
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
