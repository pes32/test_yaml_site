import type { TableRuntimeColumn } from './table_contract.ts';

type UserColumnRuntime = {
    canMutateColumnIndex(colIndex: number): boolean;
    isLineNumberColumn(column: TableRuntimeColumn | null | undefined): boolean;
    normCol(colIndex: number): number;
    tableColumns: TableRuntimeColumn[];
};

function firstUserColumnIndex(
    vm: UserColumnRuntime,
    preferredCol?: number,
    options: { requireMutable?: boolean } = {}
): number {
    const columns = Array.isArray(vm.tableColumns) ? vm.tableColumns : [];
    if (!columns.length) return 0;
    const preferred = typeof preferredCol === 'number' ? vm.normCol(preferredCol) : -1;
    const accepts = (column: TableRuntimeColumn, index: number) =>
        !vm.isLineNumberColumn(column) &&
        (options.requireMutable !== true || vm.canMutateColumnIndex(index));
    if (preferred >= 0 && accepts(columns[preferred], preferred)) {
        return preferred;
    }
    const mutableIndex = columns.findIndex(
        (column, index) => !vm.isLineNumberColumn(column) && vm.canMutateColumnIndex(index)
    );
    if (mutableIndex >= 0) return mutableIndex;
    const userIndex = columns.findIndex((column) => !vm.isLineNumberColumn(column));
    return userIndex >= 0 ? userIndex : Math.max(0, preferred);
}

type RuntimeColumnPredicate = (column: TableRuntimeColumn, index: number) => boolean;

function columnLetter(index: number): string {
    let value = Math.max(0, Math.floor(index)) + 1;
    let label = '';
    while (value > 0) {
        value -= 1;
        label = String.fromCharCode(65 + (value % 26)) + label;
        value = Math.floor(value / 26);
    }
    return label || 'A';
}

function columnLettersForRuntimeColumns(
    columns: readonly TableRuntimeColumn[],
    isLetteredColumn?: RuntimeColumnPredicate
): string[] {
    let letterIndex = 0;
    return (Array.isArray(columns) ? columns : []).map((column, index) => {
        if (isLetteredColumn && !isLetteredColumn(column, index)) {
            return '';
        }
        const label = columnLetter(letterIndex);
        letterIndex += 1;
        return label;
    });
}

export { columnLetter, columnLettersForRuntimeColumns, firstUserColumnIndex };
export type { UserColumnRuntime };
