/**
 * Прыжок по стрелкам с Cmd/Ctrl как в Excel: вдоль строки/столбца
 * по непрерывному блоку заполненных или пустых ячеек.
 */
import type {
    TableCellAddress,
    TableDataRow,
    TableRuntimeColumn,
    TableRuntimeVm
} from './table_contract.ts';
import { isTableCellValueEmpty } from './table_choice_value.ts';
import { clamp, getRowCells } from './table_utils.ts';

type JumpListMultiselect = (column: TableRuntimeColumn | null | undefined) => boolean;

type JumpOptions = {
    col: number;
    dc: number;
    dr: number;
    listColumnIsMultiselect?: JumpListMultiselect;
    row: number;
    tableColumns: TableRuntimeColumn[];
    tableData: TableDataRow[];
};

type JumpRuntimeSurface = TableRuntimeVm;

function cellValue(tableData: TableDataRow[], row: number, col: number): unknown {
    return getRowCells(tableData[row])[col];
}

function isEmpty(
    tableData: TableDataRow[],
    tableColumns: TableRuntimeColumn[],
    row: number,
    col: number,
    listMultiFn: JumpListMultiselect
): boolean {
    return isTableCellValueEmpty(cellValue(tableData, row, col), tableColumns[col], listMultiFn);
}

function jumpTarget(opts: JumpOptions): TableCellAddress | null {
    const {
        tableData,
        tableColumns,
        row,
        col,
        dr,
        dc,
        listColumnIsMultiselect
    } = opts;
    const maxR = tableData.length - 1;
    const maxC = tableColumns.length - 1;
    if (maxR < 0 || maxC < 0) return null;

    const r0 = clamp(row, 0, maxR);
    const c0 = clamp(col, 0, maxC);
    const lm = listColumnIsMultiselect || (() => false);
    const empty = (r: number, c: number) => isEmpty(tableData, tableColumns, r, c, lm);

    if (dr === -1) {
        const filled = !empty(r0, c0);
        if (!filled) {
            let r = r0;
            while (r > 0 && empty(r - 1, c0)) r--;
            return r > 0 ? { r: r - 1, c: c0 } : { r: 0, c: c0 };
        }
        let rTop = r0;
        while (rTop > 0 && !empty(rTop - 1, c0)) rTop--;
        if (r0 > rTop) return { r: rTop, c: c0 };
        let r2 = r0;
        while (r2 > 0 && empty(r2 - 1, c0)) r2--;
        return r2 > 0 && !empty(r2 - 1, c0) ? { r: r2 - 1, c: c0 } : { r: 0, c: c0 };
    }
    if (dr === 1) {
        const filled = !empty(r0, c0);
        if (!filled) {
            let r = r0;
            while (r < maxR && empty(r + 1, c0)) r++;
            return r < maxR ? { r: r + 1, c: c0 } : { r: maxR, c: c0 };
        }
        let rBottom = r0;
        while (rBottom < maxR && !empty(rBottom + 1, c0)) rBottom++;
        if (r0 < rBottom) return { r: rBottom, c: c0 };
        let r2 = r0;
        while (r2 < maxR && empty(r2 + 1, c0)) r2++;
        return r2 < maxR && !empty(r2 + 1, c0) ? { r: r2 + 1, c: c0 } : { r: maxR, c: c0 };
    }
    if (dc === -1) {
        const filled = !empty(r0, c0);
        if (!filled) {
            let c = c0;
            while (c > 0 && empty(r0, c - 1)) c--;
            return c > 0 ? { r: r0, c: c - 1 } : { r: r0, c: 0 };
        }
        let cLeft = c0;
        while (cLeft > 0 && !empty(r0, cLeft - 1)) cLeft--;
        if (c0 > cLeft) return { r: r0, c: cLeft };
        let c2 = c0;
        while (c2 > 0 && empty(r0, c2 - 1)) c2--;
        return c2 > 0 && !empty(r0, c2 - 1) ? { r: r0, c: c2 - 1 } : { r: r0, c: 0 };
    }
    if (dc === 1) {
        const filled = !empty(r0, c0);
        if (!filled) {
            let c = c0;
            while (c < maxC && empty(r0, c + 1)) c++;
            return c < maxC ? { r: r0, c: c + 1 } : { r: r0, c: maxC };
        }
        let cRight = c0;
        while (cRight < maxC && !empty(r0, cRight + 1)) cRight++;
        if (c0 < cRight) return { r: r0, c: cRight };
        let c2 = c0;
        while (c2 < maxC && empty(r0, c2 + 1)) c2++;
        return c2 < maxC && !empty(r0, c2 + 1) ? { r: r0, c: c2 + 1 } : { r: r0, c: maxC };
    }
    return { r: r0, c: c0 };
}

function buildJumpOpts(
    vm: JumpRuntimeSurface,
    row: number,
    col: number,
    dr: number,
    dc: number
): JumpOptions {
    return {
        tableData: vm.tableData,
        tableColumns: vm.tableColumns,
        row,
        col,
        dr,
        dc,
        listColumnIsMultiselect: (column: TableRuntimeColumn | null | undefined) =>
            vm.listColumnIsMultiselect(column)
    };
}

export { buildJumpOpts, isEmpty, jumpTarget };
