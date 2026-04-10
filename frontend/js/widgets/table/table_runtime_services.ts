import type { TableRuntimeError, TableRuntimeServices } from './table_contract.ts';

type CreateTableRuntimeServicesOptions = Partial<TableRuntimeServices>;

function noop(): void {}

function createTableRuntimeServices(
    options: CreateTableRuntimeServicesOptions = {}
): TableRuntimeServices {
    return {
        getAllAttrsMap: options.getAllAttrsMap || (() => ({})),
        getListOptions: options.getListOptions || (() => []),
        notify: options.notify || noop,
        reportError: options.reportError || noop,
        handleRecoverableError:
            options.handleRecoverableError ||
            ((error: TableRuntimeError) => {
                if (options.reportError) {
                    options.reportError(error);
                }
            })
    };
}

export { createTableRuntimeServices };
