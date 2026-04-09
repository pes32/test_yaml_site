/**
 * Sticky-header helpers for TableWidget.
 * Loaded after table_widget_helpers.js and before TableWidget.vue.
 */
import tableEngine from './table_core.js';

const globalScope = typeof window !== 'undefined' ? window : globalThis;
const Core = tableEngine;

    function removeStickyClone(vm) {
        if (!vm || !vm._stickyCloneTableEl) return;
        const overlay = vm._stickyCloneTableEl;
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

    function clearPinnedThead(vm) {
        const thead = vm && vm.$refs ? vm.$refs.tableThead : null;
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

    function findVerticalScrollRoot(el) {
        let p = el && el.parentElement;
        while (p) {
            const s = getComputedStyle(p);
            const oy = s.overflowY;
            if (oy === 'auto' || oy === 'scroll') {
                return p;
            }
            p = p.parentElement;
        }
        if (typeof document === 'undefined') return null;
        return document.scrollingElement || document.documentElement || null;
    }

    function readStickyTopPx(root, table) {
        const tryEl = (node) => {
            if (!node) return null;
            const v = getComputedStyle(node).getPropertyValue('--widget-table-sticky-top').trim();
            if (!v) return null;
            const m = /^([\d.-]+)px$/.exec(v);
            return m ? parseFloat(m[1]) : null;
        };
        const px = tryEl(table) ?? tryEl(root);
        if (px == null || !Number.isFinite(px)) return 0;
        return Math.max(0, px);
    }

    function captureHeaderCellWidths(thead) {
        const rows = Array.from(thead && thead.rows ? thead.rows : []);
        return rows.map((row) => Array.from(row.cells).map((cell) => cell.getBoundingClientRect().width));
    }

    function buildStickyCloneSignature(table, thead) {
        const colgroup = table && table.querySelector ? table.querySelector('colgroup') : null;
        return `${thead ? thead.innerHTML : ''}||${colgroup ? colgroup.innerHTML : ''}`;
    }

    function clearCloneCellWidths(thead) {
        const ths = thead ? thead.querySelectorAll('th') : [];
        for (let i = 0; i < ths.length; i++) {
            ths[i].style.width = '';
            ths[i].style.minWidth = '';
            ths[i].style.maxWidth = '';
        }
    }

    function applyLeafWidthsToCloneCols(cloneTable, leafWidths) {
        const cols = Array.from(
            cloneTable && cloneTable.querySelectorAll ? cloneTable.querySelectorAll('colgroup col') : []
        );
        cols.forEach((col, index) => {
            const width = leafWidths[index];
            if (!(width > 0.25)) return;
            col.style.width = `${width}px`;
            col.style.minWidth = `${width}px`;
            col.style.maxWidth = `${width}px`;
        });
    }

    function findCloneHeaderCell(vm, th) {
        if (!vm || !th) return null;
        const rowIdx = parseInt(th.getAttribute('data-header-row'), 10);
        const cellIdx = parseInt(th.getAttribute('data-header-cell'), 10);
        if (Number.isNaN(rowIdx) || Number.isNaN(cellIdx)) return null;
        const row = Array.isArray(vm.headerRows) ? vm.headerRows[rowIdx] : null;
        if (!Array.isArray(row)) return null;
        return row[cellIdx] || null;
    }

    function parseRuntimeColIndex(th) {
        if (!th) return null;
        const raw = parseInt(th.getAttribute('data-runtime-col-index'), 10);
        return Number.isNaN(raw) || raw < 0 ? null : raw;
    }

    function bindStickyCloneEvents(vm, overlay) {
        if (!vm || !overlay || overlay === vm._stickyCloneTableEl) return;
        vm._stickyCloneClickHandler = (event) => {
            const trigger = event.target && event.target.closest
                ? event.target.closest('.widget-table__th-inner')
                : null;
            if (!trigger || !overlay.contains(trigger)) return;
            const th = trigger.closest('th');
            const runtimeColIndex = parseRuntimeColIndex(th);
            if (runtimeColIndex == null) return;
            event.preventDefault();
            event.stopPropagation();
            vm.onHeaderSortClick(runtimeColIndex, event);
        };
        vm._stickyCloneKeydownHandler = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const trigger = event.target && event.target.closest
                ? event.target.closest('.widget-table__th-inner')
                : null;
            if (!trigger || !overlay.contains(trigger)) return;
            const th = trigger.closest('th');
            const runtimeColIndex = parseRuntimeColIndex(th);
            if (runtimeColIndex == null) return;
            event.preventDefault();
            event.stopPropagation();
            vm.onHeaderSortClick(runtimeColIndex, event);
        };
        vm._stickyCloneContextMenuHandler = (event) => {
            const th = event.target && event.target.closest ? event.target.closest('th') : null;
            if (!th || !overlay.contains(th)) return;
            const cell = findCloneHeaderCell(vm, th);
            const runtimeColIndex = parseRuntimeColIndex(th);
            const rowIdx = parseInt(th.getAttribute('data-header-row'), 10);
            if (Number.isNaN(rowIdx)) return;
            vm.onTableHeaderContextMenu(event, rowIdx, cell, runtimeColIndex);
        };
        overlay.addEventListener('click', vm._stickyCloneClickHandler, true);
        overlay.addEventListener('keydown', vm._stickyCloneKeydownHandler, true);
        overlay.addEventListener('contextmenu', vm._stickyCloneContextMenuHandler, true);
    }

    function ensureStickyClone(vm, table, thead) {
        let overlay = vm && vm._stickyCloneTableEl;
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
            const theadClone = thead.cloneNode(true);
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

    function readRenderedLeafWidths(vm, table, thead) {
        const cols = Array.from(
            table && table.querySelectorAll ? table.querySelectorAll('colgroup col') : []
        );
        const colWidths = cols
            .map((col) => col.getBoundingClientRect().width)
            .filter((width) => width > 0.25);
        if (
            Array.isArray(vm && vm.tableColumns) &&
            colWidths.length === vm.tableColumns.length
        ) {
            return colWidths;
        }

        const rows = Array.from(thead && thead.rows ? thead.rows : []);
        const leafRow = rows.length ? rows[rows.length - 1] : null;
        if (!leafRow) return [];
        return Array.from(leafRow.cells).map((cell) => cell.getBoundingClientRect().width);
    }

    function buildHeaderCellWidthsFromLeafWidths(vm, leafWidths, thead) {
        const schemaRows = Array.isArray(vm && vm.headerRows) ? vm.headerRows : [];
        if (!schemaRows.length || !leafWidths.length) {
            return captureHeaderCellWidths(thead);
        }

        const widthsByRow = schemaRows.map((schemaRow) => {
            let cursor = 0;
            return schemaRow.map((cell) => {
                const span =
                    cell && Number.isFinite(cell.colspan) && cell.colspan > 0
                        ? cell.colspan
                        : 1;
                let width = 0;
                for (let i = 0; i < span; i++) {
                    width += leafWidths[cursor + i] || 0;
                }
                cursor += span;
                return width;
            });
        });

        const actualRows = Array.from(thead && thead.rows ? thead.rows : []);
        while (widthsByRow.length < actualRows.length) {
            const row = actualRows[widthsByRow.length];
            widthsByRow.push(leafWidths.slice(0, row && row.cells ? row.cells.length : 0));
        }

        return widthsByRow;
    }

    function applyHeaderCellWidths(thead, widthsByRow) {
        const rows = Array.from(thead && thead.rows ? thead.rows : []);
        rows.forEach((row, rowIdx) => {
            const rowWidths = widthsByRow[rowIdx] || [];
            Array.from(row.cells).forEach((cell, cellIdx) => {
                const width = rowWidths[cellIdx];
                if (!(width > 0.25)) return;
                cell.style.width = `${width}px`;
                cell.style.minWidth = `${width}px`;
                cell.style.maxWidth = `${width}px`;
            });
        });
    }

    function applyOverlayHorizontalClip(overlay, tableRect, rootRect) {
        if (!overlay || !tableRect || !rootRect) return;
        const clipLeft = Math.max(0, rootRect.left - tableRect.left);
        const clipRight = Math.max(0, tableRect.right - rootRect.right);
        const clipPath = `inset(0px ${clipRight}px 0px ${clipLeft}px)`;
        overlay.style.clipPath = clipPath;
        overlay.style.webkitClipPath = clipPath;
    }

    function scheduleUpdate(vm) {
        if (!vm || !vm.stickyHeaderEnabled) return;
        if (vm._stickyRaf) return;
        if (typeof globalScope.requestAnimationFrame !== 'function') {
            Core.Sticky.updateStickyThead(vm);
            return;
        }
        vm._stickyRaf = globalScope.requestAnimationFrame(() => {
            vm._stickyRaf = 0;
            Core.Sticky.updateStickyThead(vm);
        });
    }

    function updateStickyThead(vm) {
        if (!vm || !vm.stickyHeaderEnabled || !vm._stickyScrollRoot) return;
        const root = vm._stickyScrollRoot;
        const table = vm.$refs && vm.$refs.tableRoot;
        const thead = vm.$refs && vm.$refs.tableThead;
        if (!table || !thead) return;

        const pinTop = readStickyTopPx(root, table);
        const rootRect = root.getBoundingClientRect();
        const pinY = rootRect.top + pinTop;
        const tableRect = table.getBoundingClientRect();
        const tableStyle = getComputedStyle(table);
        const borderTop = parseFloat(tableStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(tableStyle.borderBottomWidth) || 0;
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
        const currentRowCount = thead && thead.rows ? thead.rows.length : 0;
        const canReusePinnedWidths =
            vm._stickyTheadPinned &&
            Array.isArray(vm._stickyPinnedWidthsByRow) &&
            vm._stickyPinnedRowCount === currentRowCount &&
            Math.abs((vm._stickyPinnedTableWidth || 0) - tableRect.width) < 0.5;
        let widthsByRow = vm._stickyPinnedWidthsByRow;
        if (!canReusePinnedWidths) {
            clearPinnedThead(vm);
            widthsByRow = buildHeaderCellWidthsFromLeafWidths(
                vm,
                leafWidths,
                thead
            );
        }

        vm._stickyTheadPinned = true;
        vm._stickyPinnedTableWidth = tableRect.width;
        vm._stickyPinnedWidthsByRow = widthsByRow;
        vm._stickyPinnedRowCount = currentRowCount;

        thead.classList.add('widget-table__thead--js-source-hidden');
        Object.assign(thead.style, {
            visibility: 'hidden',
            pointerEvents: 'none'
        });
        const overlay = ensureStickyClone(vm, table, thead);
        const cloneThead =
            overlay && overlay.querySelector ? overlay.querySelector('thead') : null;
        applyLeafWidthsToCloneCols(overlay, leafWidths);
        if (cloneThead) {
            applyHeaderCellWidths(cloneThead, widthsByRow);
        }
        Object.assign(overlay.style, {
            position: 'fixed',
            top: `${pinY}px`,
            left: `${tableRect.left}px`,
            width: `${tableRect.width}px`,
            zIndex: '9',
            margin: '0',
            boxSizing: 'border-box'
        });
        applyOverlayHorizontalClip(overlay, tableRect, rootRect);
    }

    function bindStickyThead(vm) {
        unbindStickyThead(vm);
        if (!vm || !vm.stickyHeaderEnabled || typeof window === 'undefined') return;
        const table = vm.$refs && vm.$refs.tableRoot;
        const thead = vm.$refs && vm.$refs.tableThead;
        if (!table || !thead) return;
        const root = findVerticalScrollRoot(table);
        if (!root) return;

        vm._stickyScrollRoot = root;
        vm._stickyOnScroll = () => {
            Core.Sticky.scheduleUpdate(vm);
        };

        root.addEventListener('scroll', vm._stickyOnScroll, { passive: true });
        window.addEventListener('resize', vm._stickyOnScroll, { passive: true });
        window.addEventListener('scroll', vm._stickyOnScroll, { passive: true });

        if (typeof ResizeObserver !== 'undefined') {
            vm._stickyRo = new ResizeObserver(() => vm._stickyOnScroll());
            vm._stickyRo.observe(table);
            vm._stickyRo.observe(thead);
            if (root.nodeType === 1) {
                vm._stickyRo.observe(root);
            }
        }

        Core.Sticky.scheduleUpdate(vm);
    }

    function unbindStickyThead(vm) {
        clearPinnedThead(vm);
        if (!vm) return;
        if (vm._stickyRaf) {
            globalScope.cancelAnimationFrame(vm._stickyRaf);
            vm._stickyRaf = 0;
        }
        const root = vm._stickyScrollRoot;
        if (root && vm._stickyOnScroll) {
            root.removeEventListener('scroll', vm._stickyOnScroll);
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

    Core.Sticky = {
        clearPinnedThead,
        findVerticalScrollRoot,
        readStickyTopPx,
        readRenderedLeafWidths,
        buildHeaderCellWidthsFromLeafWidths,
        scheduleUpdate,
        updateStickyThead,
        bindStickyThead,
        unbindStickyThead
    };

export {
    bindStickyThead,
    buildHeaderCellWidthsFromLeafWidths,
    clearPinnedThead,
    findVerticalScrollRoot,
    readRenderedLeafWidths,
    readStickyTopPx,
    scheduleUpdate,
    unbindStickyThead,
    updateStickyThead
};

export default Core.Sticky;
