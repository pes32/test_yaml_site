import type { TableRuntimeVm } from './table_contract.ts';

type TableRuntimeMethod = (this: TableRuntimeVm, ...args: any[]) => unknown;
type TableRuntimeMethodMap<T extends object> = {
    [K in keyof T]: T[K] extends TableRuntimeMethod ? T[K] : never;
};

function defineTableRuntimeModule<T extends object>(
    module: T & TableRuntimeMethodMap<T> & ThisType<TableRuntimeVm & T>
): T & TableRuntimeMethodMap<T> {
    return module;
}

export { defineTableRuntimeModule };
export type { TableRuntimeMethod, TableRuntimeMethodMap };
