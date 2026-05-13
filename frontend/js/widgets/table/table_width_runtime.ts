import type { TableRuntimeMethodSubset, TableRuntimeVm } from './table_contract.ts';
import {
    autoFitColumnWidth,
    captureInitialColumnWidths,
    type AutoFitCellSample
} from './table_internal.ts';
import { getRowCells } from './table_utils.ts';

function selectedColumns(vm: TableRuntimeVm): number[] {
    const rect = vm.getSelRect();
    const out: number[] = [];
    for (let col = rect.c0; col <= rect.c1; col += 1) {
        if (!vm.isLineNumberColumn(vm.tableColumns[col])) out.push(col);
    }
    return out.length ? out : vm.tableColumns.map((_column, index) => index);
}

function updateSelectedWidthOverrides<TContext = undefined>(
    vm: TableRuntimeVm,
    label: string,
    createContext: () => TContext,
    update: (overrides: Record<string, string | null>, colIndex: number, context: TContext) => void
): void {
    vm.runWithHistory(label, () => {
        const context = createContext();
        const next = { ...vm.tableStore.widths.overrideByColumnKey };
        selectedColumns(vm).forEach((colIndex) => update(next, colIndex, context));
        vm.tableStore.widths.overrideByColumnKey = next;
        vm.$nextTick(() => {
            vm._resetVirtualMeasurements?.();
            vm._scheduleVirtualWindowUpdate?.();
            vm._scheduleStickyTheadUpdate();
        });
    });
}

function updateColumnWidthOverrides<TContext = undefined>(
    vm: TableRuntimeVm,
    colIndexes: readonly number[],
    label: string,
    createContext: () => TContext,
    update: (overrides: Record<string, string | null>, colIndex: number, context: TContext) => void,
    withHistory = true
): void {
    const apply = () => {
        const context = createContext();
        const next = { ...vm.tableStore.widths.overrideByColumnKey };
        colIndexes.forEach((colIndex) => update(next, colIndex, context));
        vm.tableStore.widths.overrideByColumnKey = next;
        vm.$nextTick(() => {
            vm._resetVirtualMeasurements?.();
            vm._scheduleVirtualWindowUpdate?.();
            vm._scheduleStickyTheadUpdate();
        });
    };
    if (withHistory) vm.runWithHistory(label, apply);
    else apply();
}

function autoWidthColumnUpdater(vm: TableRuntimeVm) {
    return (
        next: Record<string, string | null>,
        colIndex: number,
        context: { tableEl: HTMLTableElement | null }
    ): void => {
        const key = vm.runtimeColumnKey(colIndex);
        if (!key) return;
        const column = vm.tableColumns[colIndex];
        const cellSamples: AutoFitCellSample[] = vm.tableData.map((row) => {
            const rowId = row?.id != null ? String(row.id) : '';
            const meta = rowId ? vm.cellMetaByIdentity(rowId, key) : null;
            const effectiveColumn =
                rowId && typeof vm.effectiveCellColumnByIdentity === 'function'
                    ? vm.effectiveCellColumnByIdentity(rowId, key, colIndex, column)
                    : column;
            const style = meta?.style || {};
            return {
                bold: style.bold === true,
                column: effectiveColumn || column,
                fontSize: style.fontSize || null,
                italic: style.italic === true,
                text: vm.formatCellValue(getRowCells(row)[colIndex], effectiveColumn || column)
            };
        });
        next[key] = autoFitColumnWidth({
            cellTexts: vm.tableData.map((row) =>
                vm.formatCellValue(getRowCells(row)[colIndex], column)
            ),
            cellSamples,
            column,
            columnIndex: colIndex,
            headerSortExtra: vm.widgetConfig && vm.widgetConfig.sort === false ? 0 : 26,
            headerText: column?.label || '',
            tableEl: context.tableEl
        });
    };
}

const WidthRuntimeMethods = {
    captureInitialTableWidths() {
        this.tableStore.widths.initialByColumnKey = captureInitialColumnWidths(this.tableColumns);
    },

    runtimeColumnWidth(columnIndex: number) {
        const key = this.runtimeColumnKey(columnIndex);
        if (key && Object.prototype.hasOwnProperty.call(this.tableStore.widths.overrideByColumnKey, key)) {
            return this.tableStore.widths.overrideByColumnKey[key];
        }
        return this.tableColumns[columnIndex]?.width || null;
    },

    applyTableAutoWidthToSelection() {
        updateSelectedWidthOverrides(
            this,
            'auto width',
            () => {
                this.flushLazyFullLoadOrWarn('Для автоподбора ширины нужно загрузить все строки таблицы.');
                return { tableEl: this.getTableEl() };
            },
            autoWidthColumnUpdater(this)
        );
    },

    applyTableAutoWidthToAll() {
        const columns = this.tableColumns
            .map((_column, index) => index)
            .filter((index) => !this.isLineNumberColumn(this.tableColumns[index]));
        if (!columns.length) return;
        if (!this.isFullyLoaded) {
            this.flushLazyFullLoadOrWarn('Для автоподбора ширины нужно загрузить все строки таблицы.');
        }
        updateColumnWidthOverrides(
            this,
            columns,
            'auto width all',
            () => ({ tableEl: this.getTableEl() }),
            autoWidthColumnUpdater(this),
            false
        );
    },

    resetTableWidthsForSelection() {
        updateSelectedWidthOverrides(this, 'reset width', () => undefined, (next, colIndex) => {
            const key = this.runtimeColumnKey(colIndex);
            if (key) delete next[key];
        });
    }
} satisfies TableRuntimeMethodSubset<TableRuntimeVm>;

export { WidthRuntimeMethods };
