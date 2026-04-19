import type { TableRuntimeMethods, TableRuntimeVm } from './table_contract.ts';

type TableRuntimeMethod = TableRuntimeMethods[keyof TableRuntimeMethods];
type TableRuntimeMethodMap<T extends object> = {
    [K in keyof T]: K extends keyof TableRuntimeMethods
        ? TableRuntimeMethods[K]
        : never;
};

function defineTableRuntimeModule<
    TThis extends object = TableRuntimeVm,
    const T extends Partial<TableRuntimeMethods> = Partial<TableRuntimeMethods>
>(
    module: T & TableRuntimeMethodMap<T> & ThisType<TThis & Required<T> & TableRuntimeMethodMap<T>>
): Required<T> & TableRuntimeMethodMap<T> {
    return module as Required<T> & TableRuntimeMethodMap<T>;
}

function defineTableRuntimeModuleFor<TThis extends object>() {
    return function defineNarrowTableRuntimeModule<const T extends Partial<TableRuntimeMethods>>(
        module: T & TableRuntimeMethodMap<T> & ThisType<TThis & Required<T> & TableRuntimeMethodMap<T>>
    ): Required<T> & TableRuntimeMethodMap<T> {
        return module as Required<T> & TableRuntimeMethodMap<T>;
    };
}

export { defineTableRuntimeModule, defineTableRuntimeModuleFor };
export type { TableRuntimeMethod, TableRuntimeMethodMap };
