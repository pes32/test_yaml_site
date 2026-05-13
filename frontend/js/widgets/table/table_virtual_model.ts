import type { TableVirtualState } from './table_contract.ts';

const TABLE_VIRTUAL_MAX_SCROLL_SURFACE_PX = 10_000_000;

/** Default tbody row height: `line-height: var(--lh-md)` + vertical padding (`--table-cell-padding-y` ×2). */
const DEFAULT_TABLE_ROW_HEIGHT_PX = 40;
const DEFAULT_TABLE_OVERSCAN_ROWS = 48;
const DEFAULT_TABLE_VIEWPORT_HEIGHT_PX = 560;

type TableVirtualWindowInput = {
    estimatedRowHeightPx?: number;
    overscan?: number;
    rowCount: number;
    rowHeightsByDisplayIndex?: Record<number, number>;
    scrollTopPx?: number;
    viewportHeightPx?: number;
};

type TableVirtualWindow = Pick<
    TableVirtualState,
    | 'bottomSpacerPx'
    | 'end'
    | 'estimatedRowHeightPx'
    | 'geometryScale'
    | 'overscan'
    | 'scrollTopPx'
    | 'start'
    | 'topSpacerPx'
    | 'totalRows'
    | 'viewportHeightPx'
>;

function finiteNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRowCount(rowCount: unknown): number {
    return Math.max(0, Math.floor(finiteNumber(rowCount, 0)));
}

function normalizeRowHeight(value: unknown): number {
    return Math.max(12, finiteNumber(value, DEFAULT_TABLE_ROW_HEIGHT_PX));
}

function normalizeOverscan(value: unknown): number {
    return Math.max(0, Math.floor(finiteNumber(value, DEFAULT_TABLE_OVERSCAN_ROWS)));
}

function normalizeViewportHeight(value: unknown, estimatedRowHeightPx: number): number {
    const fallback = Math.max(DEFAULT_TABLE_VIEWPORT_HEIGHT_PX, estimatedRowHeightPx * 16);
    return Math.max(estimatedRowHeightPx, finiteNumber(value, fallback));
}

function virtualRowHeight(
    rowHeightsByDisplayIndex: Record<number, number> | null | undefined,
    displayIndex: number,
    estimatedRowHeightPx: number
): number {
    const measured = rowHeightsByDisplayIndex?.[displayIndex];
    return normalizeRowHeight(measured || estimatedRowHeightPx);
}

function virtualOffsetForRow(
    rowHeightsByDisplayIndex: Record<number, number> | null | undefined,
    rowIndex: number,
    estimatedRowHeightPx: number
): number {
    const end = Math.max(0, Math.floor(finiteNumber(rowIndex, 0)));
    const rowHeights = rowHeightsByDisplayIndex || {};
    const estimated = normalizeRowHeight(estimatedRowHeightPx);
    let offset = end * estimated;
    Object.entries(rowHeights).forEach(([rawIndex, rawHeight]) => {
        const index = Number(rawIndex);
        if (!Number.isFinite(index) || index < 0 || index >= end) return;
        offset += virtualRowHeight(rowHeights, index, estimated) - estimated;
    });
    return Math.max(0, offset);
}

function estimateVisibleStart(
    rowHeightsByDisplayIndex: Record<number, number> | null | undefined,
    rowCount: number,
    scrollTopPx: number,
    estimatedRowHeightPx: number
): { index: number; offset: number } {
    let index = Math.max(
        0,
        Math.min(rowCount - 1, Math.floor(scrollTopPx / estimatedRowHeightPx))
    );
    let offset = virtualOffsetForRow(rowHeightsByDisplayIndex, index, estimatedRowHeightPx);
    while (index > 0 && offset > scrollTopPx) {
        index -= 1;
        offset -= virtualRowHeight(rowHeightsByDisplayIndex, index, estimatedRowHeightPx);
    }
    while (index < rowCount - 1) {
        const height = virtualRowHeight(rowHeightsByDisplayIndex, index, estimatedRowHeightPx);
        if (offset + height > scrollTopPx) break;
        offset += height;
        index += 1;
    }
    return { index, offset };
}

function createInitialVirtualState(): TableVirtualState {
    const estimatedRowHeightPx = DEFAULT_TABLE_ROW_HEIGHT_PX;
    return {
        bottomSpacerPx: 0,
        enabled: true,
        end: 0,
        estimatedRowHeightPx,
        geometryScale: 1,
        overscan: DEFAULT_TABLE_OVERSCAN_ROWS,
        rowHeightsByDisplayIndex: {},
        scrollTopPx: 0,
        start: 0,
        topSpacerPx: 0,
        totalRows: 0,
        viewportHeightPx: DEFAULT_TABLE_VIEWPORT_HEIGHT_PX
    };
}

function buildVirtualWindow(input: TableVirtualWindowInput): TableVirtualWindow {
    const rowCount = normalizeRowCount(input.rowCount);
    const estimatedRowHeightPx = normalizeRowHeight(input.estimatedRowHeightPx);
    const overscan = normalizeOverscan(input.overscan);
    const viewportHeightPx = normalizeViewportHeight(input.viewportHeightPx, estimatedRowHeightPx);
    const scrollTopPx = Math.max(0, finiteNumber(input.scrollTopPx, 0));
    const rowHeights = input.rowHeightsByDisplayIndex || {};
    if (rowCount === 0) {
        return {
            bottomSpacerPx: 0,
            end: 0,
            estimatedRowHeightPx,
            geometryScale: 1,
            overscan,
            scrollTopPx,
            start: 0,
            topSpacerPx: 0,
            totalRows: 0,
            viewportHeightPx
        };
    }

    const estimatedStart = estimateVisibleStart(
        rowHeights,
        rowCount,
        scrollTopPx,
        estimatedRowHeightPx
    );
    const visibleStart = estimatedStart.index;
    let visibleEnd = visibleStart;
    let scanOffset = estimatedStart.offset;
    const bottom = scrollTopPx + viewportHeightPx;
    while (visibleEnd < rowCount && scanOffset < bottom) {
        scanOffset += virtualRowHeight(rowHeights, visibleEnd, estimatedRowHeightPx);
        visibleEnd += 1;
    }

    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(rowCount, Math.max(visibleEnd, visibleStart + 1) + overscan);
    const topSpacerPx = virtualOffsetForRow(rowHeights, start, estimatedRowHeightPx);
    const renderedHeightPx = virtualOffsetForRow(rowHeights, end, estimatedRowHeightPx);
    const totalHeightPx = virtualOffsetForRow(rowHeights, rowCount, estimatedRowHeightPx);
    let geometryScale = 1;
    if (
        totalHeightPx > TABLE_VIRTUAL_MAX_SCROLL_SURFACE_PX
        && totalHeightPx > 0
        && TABLE_VIRTUAL_MAX_SCROLL_SURFACE_PX > 0
    ) {
        geometryScale = TABLE_VIRTUAL_MAX_SCROLL_SURFACE_PX / totalHeightPx;
    }
    const scaledTopSpacer = topSpacerPx * geometryScale;
    const scaledBottomSpacer = Math.max(0, (totalHeightPx - renderedHeightPx) * geometryScale);
    return {
        bottomSpacerPx: scaledBottomSpacer,
        end,
        estimatedRowHeightPx,
        geometryScale,
        overscan,
        scrollTopPx,
        start,
        topSpacerPx: scaledTopSpacer,
        totalRows: rowCount,
        viewportHeightPx
    };
}

function updateMeasuredRowHeight(
    rowHeightsByDisplayIndex: Record<number, number>,
    displayIndex: number,
    heightPx: number
): Record<number, number> {
    const index = Math.max(0, Math.floor(finiteNumber(displayIndex, 0)));
    const nextHeight = normalizeRowHeight(heightPx);
    const current = rowHeightsByDisplayIndex[index];
    if (current != null && Math.abs(current - nextHeight) < 0.5) {
        return rowHeightsByDisplayIndex;
    }
    return {
        ...rowHeightsByDisplayIndex,
        [index]: nextHeight
    };
}

export {
    DEFAULT_TABLE_OVERSCAN_ROWS,
    DEFAULT_TABLE_ROW_HEIGHT_PX,
    buildVirtualWindow,
    createInitialVirtualState,
    updateMeasuredRowHeight,
    virtualOffsetForRow,
    virtualRowHeight
};
export type { TableVirtualWindowInput, TableVirtualWindow };
