type TableDomVm = {
    $el?: Element | null;
};

type TableCellEventPayload = {
    col: number;
    row: number;
    td: HTMLElement;
};

function getCellFromEvent(vm: TableDomVm, event: Event | KeyboardEvent | MouseEvent): TableCellEventPayload | null {
    const target = event && event.target;
    const td = target instanceof Element ? target.closest('tbody td') : null;
    if (!(td instanceof HTMLElement) || !vm.$el || !vm.$el.contains(td)) return null;
    const row = parseInt(td.getAttribute('data-row') || '', 10);
    const col = parseInt(td.getAttribute('data-col') || '', 10);
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    return { td, row, col };
}

function focusIsInsideTableBody(vm: TableDomVm): boolean {
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    if (!(activeElement instanceof Element) || !vm.$el) return false;
    const td = activeElement.closest('tbody td');
    return !!(td && vm.$el.contains(td));
}

export { focusIsInsideTableBody, getCellFromEvent };
