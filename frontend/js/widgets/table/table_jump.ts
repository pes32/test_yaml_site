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

function cellValue(tableData: TableDataRow[], row: number, col: number): unknown {
        const r = tableData[row];
        const cells = getRowCells(r);
        return cells[col];
    }

    function isEmpty(
        tableData: TableDataRow[],
        tableColumns: TableRuntimeColumn[],
        row: number,
        col: number,
        listMultiFn: JumpListMultiselect
    ): boolean {
        const column = tableColumns[col];
        const v = cellValue(tableData, row, col);
        if (column && (column.type === 'list' || column.type === 'voc') && listMultiFn(column)) {
            return !Array.isArray(v) || v.length === 0;
        }
        if (v == null) return true;
        return String(v).trim() === '';
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

        // Как в Excel (Ctrl/Cmd+стрелка) для заполненной ячейки:
        // 1) если не на краю блока непрерывных non-empty в этом направлении — прыжок к этому краю;
        // 2) если уже на краю — через пустые к ближайшей заполненной или к краю таблицы.
        // Для пустой — через пустые к первой заполненной (как раньше).
        if (dr === -1) {
            const filled = !empty(r0, c0);
            if (!filled) {
                let r = r0;
                while (r > 0 && empty(r - 1, c0)) r--;
                if (r > 0) return { r: r - 1, c: c0 };
                return { r: 0, c: c0 };
            }
            let rTop = r0;
            while (rTop > 0 && !empty(rTop - 1, c0)) rTop--;
            if (r0 > rTop) return { r: rTop, c: c0 };
            let r2 = r0;
            while (r2 > 0 && empty(r2 - 1, c0)) r2--;
            if (r2 > 0 && !empty(r2 - 1, c0)) return { r: r2 - 1, c: c0 };
            return { r: 0, c: c0 };
        }
        if (dr === 1) {
            const filled = !empty(r0, c0);
            if (!filled) {
                let r = r0;
                while (r < maxR && empty(r + 1, c0)) r++;
                if (r < maxR) return { r: r + 1, c: c0 };
                return { r: maxR, c: c0 };
            }
            let rBottom = r0;
            while (rBottom < maxR && !empty(rBottom + 1, c0)) rBottom++;
            if (r0 < rBottom) return { r: rBottom, c: c0 };
            let r2 = r0;
            while (r2 < maxR && empty(r2 + 1, c0)) r2++;
            if (r2 < maxR && !empty(r2 + 1, c0)) return { r: r2 + 1, c: c0 };
            return { r: maxR, c: c0 };
        }
        if (dc === -1) {
            const filled = !empty(r0, c0);
            if (!filled) {
                let c = c0;
                while (c > 0 && empty(r0, c - 1)) c--;
                if (c > 0) return { r: r0, c: c - 1 };
                return { r: r0, c: 0 };
            }
            let cLeft = c0;
            while (cLeft > 0 && !empty(r0, cLeft - 1)) cLeft--;
            if (c0 > cLeft) return { r: r0, c: cLeft };
            let c2 = c0;
            while (c2 > 0 && empty(r0, c2 - 1)) c2--;
            if (c2 > 0 && !empty(r0, c2 - 1)) return { r: r0, c: c2 - 1 };
            return { r: r0, c: 0 };
        }
        if (dc === 1) {
            const filled = !empty(r0, c0);
            if (!filled) {
                let c = c0;
                while (c < maxC && empty(r0, c + 1)) c++;
                if (c < maxC) return { r: r0, c: c + 1 };
                return { r: r0, c: maxC };
            }
            let cRight = c0;
            while (cRight < maxC && !empty(r0, cRight + 1)) cRight++;
            if (c0 < cRight) return { r: r0, c: cRight };
            let c2 = c0;
            while (c2 < maxC && empty(r0, c2 + 1)) c2++;
            if (c2 < maxC && !empty(r0, c2 + 1)) return { r: r0, c: c2 + 1 };
            return { r: r0, c: maxC };
        }
        return { r: r0, c: c0 };
    }

    /**
     * Чистые опции для jumpTarget из экземпляра виджета (граница VM ↔ логика).
     */
    function buildJumpOpts(
        vm: TableRuntimeVm,
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

const TableJump = { jumpTarget, isEmpty, buildJumpOpts };

export { buildJumpOpts, isEmpty, jumpTarget };
export default TableJump;
