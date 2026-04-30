import type { TableRuntimeColumn } from './table_contract.ts';

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

export {
    columnLetter,
    columnLettersForRuntimeColumns
};
