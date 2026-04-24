import type { TableRuntimeColumn } from './table_contract.ts';

type TableColumnLike = TableRuntimeColumn | Record<string, unknown> | null | undefined;
type ListColumnIsMultiselect = ((column: Record<string, unknown>) => boolean) | undefined;

function isChoiceLikeColumn(column: TableColumnLike): boolean {
    return Boolean(column && (column.type === 'list' || column.type === 'voc'));
}

function isChoiceMultiselectColumn(
    column: TableColumnLike,
    listColumnIsMultiselect: ListColumnIsMultiselect
): boolean {
    const listMulti = listColumnIsMultiselect || (() => false);
    return isChoiceLikeColumn(column) && listMulti(column as Record<string, unknown>);
}

function isTableCellValueEmpty(
    value: unknown,
    column: TableColumnLike,
    listColumnIsMultiselect: ListColumnIsMultiselect
): boolean {
    if (isChoiceMultiselectColumn(column, listColumnIsMultiselect)) {
        return !Array.isArray(value) || value.length === 0;
    }
    if (value == null) {
        return true;
    }
    return String(value).trim() === '';
}

function tableChoiceSortKey(
    value: unknown,
    column: TableColumnLike,
    listColumnIsMultiselect: ListColumnIsMultiselect
): string {
    if (isChoiceMultiselectColumn(column, listColumnIsMultiselect)) {
        if (!Array.isArray(value)) {
            return '';
        }
        return [...value].map((item) => String(item)).sort().join('\u0001');
    }
    if (Array.isArray(value)) {
        return value.map((item) => String(item)).join('\u0001');
    }
    return String(value ?? '');
}

export {
    isChoiceLikeColumn,
    isChoiceMultiselectColumn,
    isTableCellValueEmpty,
    tableChoiceSortKey
};

export type {
    ListColumnIsMultiselect,
    TableColumnLike
};
