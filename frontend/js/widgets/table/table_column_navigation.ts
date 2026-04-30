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

export { firstUserColumnIndex };
export type { UserColumnRuntime };
