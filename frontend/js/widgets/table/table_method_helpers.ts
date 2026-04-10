import type { TableRuntimeVm } from './table_contract.ts';

type TableRuntimeMethod = (...args: any[]) => unknown;
type TableRuntimeMethodMap = Record<string, TableRuntimeMethod>;

function defineTableRuntimeModule<T extends TableRuntimeMethodMap>(
    module: T & ThisType<TableRuntimeVm & T>
): T {
    return module;
}

export { defineTableRuntimeModule };
export type { TableRuntimeMethod, TableRuntimeMethodMap };
