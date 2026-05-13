import type { TableRuntimeMethodSubset, TableRuntimeVm } from './table_contract.ts';
import { findVerticalScrollRoot } from './table_scroll.ts';
import {
    buildVirtualWindow,
    updateMeasuredRowHeight,
    virtualOffsetForRow,
    virtualRowHeight
} from './table_virtual_model.ts';

const globalScope = typeof window !== 'undefined' ? window : globalThis;

function isDocumentScrollRoot(root: Element | null | undefined): boolean {
    if (typeof document === 'undefined') return false;
    return root === document.scrollingElement || root === document.documentElement || root === document.body;
}

function scrollEventTarget(root: Element | null | undefined): Element | Window | null {
    if (!root) return null;
    return isDocumentScrollRoot(root) && typeof window !== 'undefined' ? window : root;
}

function rootViewportHeight(root: Element | null | undefined): number {
    if (!root) return 0;
    if (isDocumentScrollRoot(root)) {
        return typeof window !== 'undefined' ? window.innerHeight || 0 : 0;
    }
    return root.clientHeight || root.getBoundingClientRect().height || 0;
}

function bodyTopRect(vm: TableRuntimeVm): number {
    const thead = vm.$refs.tableThead;
    if (thead instanceof HTMLElement) {
        return thead.getBoundingClientRect().bottom;
    }
    const table = vm.getTableEl();
    return table ? table.getBoundingClientRect().top : 0;
}

function stickyHeaderOffsetPx(vm: TableRuntimeVm): number {
    if (!vm.stickyHeaderEnabled) return 0;
    const thead = vm.$refs.tableThead;
    if (!(thead instanceof HTMLElement)) return 0;
    const height = thead.getBoundingClientRect().height;
    return Number.isFinite(height) && height > 0 ? height : 0;
}

function readVirtualScrollTop(vm: TableRuntimeVm, root: Element | null | undefined): number {
    if (!root) return 0;
    const bodyTop = bodyTopRect(vm);
    let raw = 0;
    if (isDocumentScrollRoot(root)) {
        raw = Math.max(0, -bodyTop);
    } else {
        const rootTop = root.getBoundingClientRect().top;
        raw = Math.max(0, rootTop - bodyTop);
    }
    const scaleGeometry =
        vm.virtualState.geometryScale > 0 && vm.virtualState.geometryScale <= 1
            ? vm.virtualState.geometryScale
            : 1;
    return raw / scaleGeometry;
}

function writeVirtualScrollTop(vm: TableRuntimeVm, root: Element | null | undefined, offsetPx: number): void {
    if (!root) return;
    const scaleGeometry =
        vm.virtualState.geometryScale > 0 && vm.virtualState.geometryScale <= 1
            ? vm.virtualState.geometryScale
            : 1;
    const targetOffset = Math.max(0, offsetPx * scaleGeometry);
    const bodyTop = bodyTopRect(vm);
    if (isDocumentScrollRoot(root)) {
        const currentScroll = typeof window !== 'undefined'
            ? window.scrollY || document.documentElement.scrollTop || 0
            : 0;
        const bodyDocumentTop = currentScroll + bodyTop;
        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo({ left: window.scrollX || 0, top: bodyDocumentTop + targetOffset });
        }
        return;
    }
    const rootTop = root.getBoundingClientRect().top;
    const bodyTopAtScrollZero = root.scrollTop + bodyTop - rootTop;
    root.scrollTop = bodyTopAtScrollZero + targetOffset;
}

function virtualWindowChanged(
    left: TableRuntimeVm['virtualState'],
    right: ReturnType<typeof buildVirtualWindow>
): boolean {
    return (
        left.start !== right.start ||
        left.end !== right.end ||
        left.topSpacerPx !== right.topSpacerPx ||
        left.bottomSpacerPx !== right.bottomSpacerPx ||
        left.geometryScale !== right.geometryScale ||
        left.scrollTopPx !== right.scrollTopPx ||
        left.viewportHeightPx !== right.viewportHeightPx ||
        left.totalRows !== right.totalRows ||
        left.overscan !== right.overscan ||
        left.estimatedRowHeightPx !== right.estimatedRowHeightPx
    );
}

function logicalRowCount(vm: TableRuntimeVm): number {
    return vm.tableRemote?.mode === 'remote-paged'
        ? Math.max(0, Math.floor(Number(vm.tableRemote.totalRows) || 0))
        : vm.displayRows.length;
}

const VirtualRuntimeMethods = {
    _bindVirtualRows() {
        this._unbindVirtualRows();
        const table = this.getTableEl();
        const root = findVerticalScrollRoot(table || this.$el || null);
        this._virtualScrollRoot = root;
        this._virtualOnScroll = () => this._scheduleVirtualWindowUpdate();
        this._virtualOnResize = () => {
            this._resetVirtualMeasurements();
            this._scheduleVirtualWindowUpdate();
        };
        const target = scrollEventTarget(root);
        target?.addEventListener('scroll', this._virtualOnScroll, { passive: true });
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._virtualOnResize, { passive: true });
        }
        if (typeof ResizeObserver !== 'undefined' && table) {
            this._virtualRo = new ResizeObserver(() => {
                this._scheduleVirtualMeasurement();
                this._scheduleVirtualWindowUpdate();
            });
            this._virtualRo.observe(table);
            const wrapper = table.closest('.widget-table-wrapper');
            if (wrapper) this._virtualRo.observe(wrapper);
        }
        this._scheduleVirtualWindowUpdate();
    },

    _unbindVirtualRows() {
        const target = scrollEventTarget(this._virtualScrollRoot);
        if (target && this._virtualOnScroll) {
            target.removeEventListener('scroll', this._virtualOnScroll);
        }
        if (typeof window !== 'undefined' && this._virtualOnResize) {
            window.removeEventListener('resize', this._virtualOnResize);
        }
        this._virtualOnScroll = null;
        this._virtualOnResize = null;
        this._virtualScrollRoot = null;
        if (this._virtualRaf && typeof globalScope.cancelAnimationFrame === 'function') {
            globalScope.cancelAnimationFrame(this._virtualRaf);
        }
        if (this._virtualMeasureRaf && typeof globalScope.cancelAnimationFrame === 'function') {
            globalScope.cancelAnimationFrame(this._virtualMeasureRaf);
        }
        this._virtualRaf = 0;
        this._virtualMeasureRaf = 0;
        if (this._virtualRo) {
            try {
                this._virtualRo.disconnect();
            } catch (error) {}
            this._virtualRo = null;
        }
    },

    _resetVirtualMeasurements() {
        if (!Object.keys(this.virtualState.rowHeightsByDisplayIndex || {}).length) return;
        this.virtualState = {
            ...this.virtualState,
            rowHeightsByDisplayIndex: {}
        };
    },

    _scheduleVirtualWindowUpdate() {
        if (this._virtualRaf) return;
        if (typeof globalScope.requestAnimationFrame !== 'function') {
            this._updateVirtualWindow();
            return;
        }
        this._virtualRaf = globalScope.requestAnimationFrame(() => {
            this._virtualRaf = 0;
            this._updateVirtualWindow();
        });
    },

    _updateVirtualWindow() {
        const root = this._virtualScrollRoot || findVerticalScrollRoot(this.getTableEl() || this.$el || null);
        if (root && root !== this._virtualScrollRoot) {
            this._virtualScrollRoot = root;
        }
        const nextWindow = buildVirtualWindow({
            estimatedRowHeightPx: this.virtualState.estimatedRowHeightPx,
            overscan: this.virtualState.overscan,
            rowCount: logicalRowCount(this),
            rowHeightsByDisplayIndex: this.virtualState.rowHeightsByDisplayIndex,
            scrollTopPx: readVirtualScrollTop(this, root),
            viewportHeightPx: rootViewportHeight(root)
        });
        if (virtualWindowChanged(this.virtualState, nextWindow)) {
            this.virtualState = {
                ...this.virtualState,
                ...nextWindow,
                enabled: true
            };
        }
        if (this.tableRemote?.mode === 'remote-paged') {
            (this as unknown as { requestRemoteRangeForWindow?: (start: number, end: number) => void })
                .requestRemoteRangeForWindow?.(nextWindow.start, nextWindow.end);
        }
        this._scheduleVirtualMeasurement();
        this._scheduleStickyTheadUpdate?.();
    },

    _scheduleVirtualMeasurement() {
        if (this._virtualMeasureRaf) return;
        if (typeof globalScope.requestAnimationFrame !== 'function') {
            this._measureVirtualRows();
            return;
        }
        this._virtualMeasureRaf = globalScope.requestAnimationFrame(() => {
            this._virtualMeasureRaf = 0;
            this._measureVirtualRows();
        });
    },

    _measureVirtualRows() {
        const table = this.getTableEl();
        if (!table) return;
        let nextHeights = this.virtualState.rowHeightsByDisplayIndex;
        table.querySelectorAll('tbody tr[data-display-row]').forEach((row) => {
            if (!(row instanceof HTMLElement)) return;
            const displayIndex = Number.parseInt(row.getAttribute('data-display-row') || '', 10);
            if (!Number.isFinite(displayIndex)) return;
            const height = row.getBoundingClientRect().height;
            if (height <= 0) return;
            nextHeights = updateMeasuredRowHeight(nextHeights, displayIndex, height);
        });
        if (nextHeights === this.virtualState.rowHeightsByDisplayIndex) return;
        this.virtualState = {
            ...this.virtualState,
            rowHeightsByDisplayIndex: nextHeights
        };
        this._scheduleVirtualWindowUpdate();
    },

    scrollToDisplayRow(rowIndex: number, align: 'start' | 'center' | 'end' = 'start') {
        const rowCount = logicalRowCount(this);
        if (!rowCount) return;
        const row = Math.max(0, Math.min(rowCount - 1, Math.floor(Number(rowIndex) || 0)));
        const rowTop = virtualOffsetForRow(
            this.virtualState.rowHeightsByDisplayIndex,
            row,
            this.virtualState.estimatedRowHeightPx
        );
        const rowHeight = virtualRowHeight(
            this.virtualState.rowHeightsByDisplayIndex,
            row,
            this.virtualState.estimatedRowHeightPx
        );
        const viewport = Math.max(rowHeight, this.virtualState.viewportHeightPx || rowHeight);
        const stickyOffset = stickyHeaderOffsetPx(this);
        let target = rowTop;
        if (align === 'start') target = rowTop - stickyOffset;
        else if (align === 'center') target = rowTop - Math.max(rowHeight, viewport - stickyOffset) / 2 + rowHeight / 2;
        else if (align === 'end') target = rowTop - viewport + rowHeight;
        target = Math.max(0, target);
        const root = this._virtualScrollRoot || findVerticalScrollRoot(this.getTableEl() || this.$el || null);
        writeVirtualScrollTop(this, root, target);
        const nextWindow = buildVirtualWindow({
            estimatedRowHeightPx: this.virtualState.estimatedRowHeightPx,
            overscan: this.virtualState.overscan,
            rowCount,
            rowHeightsByDisplayIndex: this.virtualState.rowHeightsByDisplayIndex,
            scrollTopPx: target,
            viewportHeightPx: this.virtualState.viewportHeightPx
        });
        this.virtualState = {
            ...this.virtualState,
            ...nextWindow,
            enabled: true
        };
        if (this.tableRemote?.mode === 'remote-paged') {
            (this as unknown as { requestRemoteRangeForWindow?: (start: number, end: number) => void })
                .requestRemoteRangeForWindow?.(nextWindow.start, nextWindow.end);
        }
        this._scheduleVirtualWindowUpdate();
    },

    ensureDisplayRowVisible(rowIndex: number) {
        const rowCount = logicalRowCount(this);
        if (!rowCount) return;
        const row = Math.max(0, Math.min(rowCount - 1, Math.floor(Number(rowIndex) || 0)));
        const rowTop = virtualOffsetForRow(
            this.virtualState.rowHeightsByDisplayIndex,
            row,
            this.virtualState.estimatedRowHeightPx
        );
        const rowHeight = virtualRowHeight(
            this.virtualState.rowHeightsByDisplayIndex,
            row,
            this.virtualState.estimatedRowHeightPx
        );
        const scrollTop = this.virtualState.scrollTopPx;
        const scrollBottom = scrollTop + this.virtualState.viewportHeightPx;
        if (rowTop < scrollTop) {
            this.scrollToDisplayRow(row, 'start');
        } else if (rowTop + rowHeight > scrollBottom) {
            this.scrollToDisplayRow(row, 'end');
        } else if (row < this.virtualState.start || row >= this.virtualState.end) {
            this.scrollToDisplayRow(row, 'center');
        }
    }
} satisfies TableRuntimeMethodSubset<TableRuntimeVm>;

export { VirtualRuntimeMethods };
export default VirtualRuntimeMethods;
