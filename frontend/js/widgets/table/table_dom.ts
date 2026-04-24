type TableDomVm = {
    $el?: Element | null;
};

type TableCellEventPayload = {
    col: number;
    colKey: string;
    row: number;
    rowId: string;
    td: HTMLElement;
};

function getCellFromEvent(vm: TableDomVm, event: Event | KeyboardEvent | MouseEvent): TableCellEventPayload | null {
    const target = event && event.target;
    const td = target instanceof Element ? target.closest('tbody td') : null;
    if (!(td instanceof HTMLElement) || !vm.$el || !vm.$el.contains(td)) return null;
    const row = parseInt(td.getAttribute('data-row') || '', 10);
    const col = parseInt(td.getAttribute('data-col') || '', 10);
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    return {
        col,
        colKey: td.getAttribute('data-col-key') || '',
        row,
        rowId: td.getAttribute('data-row-id') || '',
        td
    };
}

function tableCellSelector(row: number, col: number): string {
    return `tbody td[data-row="${row}"][data-col="${col}"]`;
}

function getCellByDisplayAddress(vm: TableDomVm, row: number, col: number): HTMLElement | null {
    const cell = vm.$el?.querySelector(tableCellSelector(row, col));
    return cell instanceof HTMLElement ? cell : null;
}

function readCellDisplayAddress(cell: Element | null | undefined): { col: number; row: number } | null {
    if (!cell) return null;
    const row = Number.parseInt(cell.getAttribute('data-row') || '', 10);
    const col = Number.parseInt(cell.getAttribute('data-col') || '', 10);
    return Number.isNaN(row) || Number.isNaN(col) ? null : { row, col };
}

function focusIsInsideTableBody(vm: TableDomVm): boolean {
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    if (!(activeElement instanceof Element) || !vm.$el) return false;
    const td = activeElement.closest('tbody td');
    return !!(td && vm.$el.contains(td));
}

export {
    focusIsInsideTableBody,
    getCellByDisplayAddress,
    getCellFromEvent,
    readCellDisplayAddress,
    tableCellSelector
};
