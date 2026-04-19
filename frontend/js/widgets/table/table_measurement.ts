import type { TableStickyRuntimeSurface } from './table_contract.ts';

type StickyMeasurementVm = TableStickyRuntimeSurface;

function readStickyTopPx(root: Element | null | undefined, table: Element | null | undefined): number {
    const tryReadPx = (node: Element | null | undefined) => {
        if (!node) return null;
        const value = getComputedStyle(node).getPropertyValue('--widget-table-sticky-top').trim();
        const match = /^([\d.-]+)px$/.exec(value);
        return match ? Number.parseFloat(match[1]) : null;
    };

    const px = tryReadPx(table) ?? tryReadPx(root);
    if (px == null || !Number.isFinite(px)) {
        return 0;
    }

    return Math.max(0, px);
}

function captureHeaderCellWidths(thead: HTMLTableSectionElement | null | undefined): number[][] {
    const rows = Array.from(thead?.rows || []);
    return rows.map((row) => Array.from(row.cells).map((cell) => cell.getBoundingClientRect().width));
}

function readRenderedLeafWidths(
    vm: StickyMeasurementVm,
    table: HTMLTableElement | null | undefined,
    thead: HTMLTableSectionElement | null | undefined
): number[] {
    const cols = Array.from(table?.querySelectorAll('colgroup col') || []);
    const colWidths = cols
        .map((col) => col.getBoundingClientRect().width)
        .filter((width) => width > 0.25);

    if (Array.isArray(vm.tableColumns) && colWidths.length === vm.tableColumns.length) {
        return colWidths;
    }

    const rows = Array.from(thead?.rows || []);
    const leafRow = rows.length ? rows[rows.length - 1] : null;
    return leafRow ? Array.from(leafRow.cells).map((cell) => cell.getBoundingClientRect().width) : [];
}

function buildHeaderCellWidthsFromLeafWidths(
    vm: StickyMeasurementVm,
    leafWidths: number[],
    thead: HTMLTableSectionElement | null | undefined
): number[][] {
    const schemaRows = Array.isArray(vm.headerRows) ? vm.headerRows : [];
    if (!schemaRows.length || !leafWidths.length) {
        return captureHeaderCellWidths(thead);
    }

    const widthsByRow = schemaRows.map((schemaRow) => {
        let cursor = 0;
        return schemaRow.map((cell) => {
            const span = Number.isFinite(cell?.colspan) && (cell?.colspan || 0) > 0
                ? Number(cell.colspan)
                : 1;
            let width = 0;
            for (let index = 0; index < span; index += 1) {
                width += leafWidths[cursor + index] || 0;
            }
            cursor += span;
            return width;
        });
    });

    const actualRows = Array.from(thead?.rows || []);
    while (widthsByRow.length < actualRows.length) {
        const row = actualRows[widthsByRow.length];
        widthsByRow.push(leafWidths.slice(0, row?.cells.length || 0));
    }

    return widthsByRow;
}

export {
    buildHeaderCellWidthsFromLeafWidths,
    readRenderedLeafWidths,
    readStickyTopPx
};
