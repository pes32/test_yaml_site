import type { TableRuntimeMethodSubset, TableRuntimeVm } from './table_contract.ts';
import { captureInitialColumnWidths, autoFitColumnWidth, type AutoFitCellSample } from './table_width_model.ts';
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
        vm.$nextTick(() => vm._scheduleStickyTheadUpdate());
    });
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
            (next, colIndex, context) => {
                const key = this.runtimeColumnKey(colIndex);
                if (!key) return;
                const column = this.tableColumns[colIndex];
                const cellSamples: AutoFitCellSample[] = this.tableData.map((row) => {
                    const rowId = row?.id != null ? String(row.id) : '';
                    const meta = rowId ? this.cellMetaByIdentity(rowId, key) : null;
                    const effectiveColumn =
                        rowId && typeof this.effectiveCellColumnByIdentity === 'function'
                            ? this.effectiveCellColumnByIdentity(rowId, key, colIndex, column)
                            : column;
                    const style = meta?.style || {};
                    return {
                        bold: style.bold === true,
                        column: effectiveColumn || column,
                        fontSize: style.fontSize || null,
                        italic: style.italic === true,
                        text: this.formatCellValue(getRowCells(row)[colIndex], effectiveColumn || column)
                    };
                });
                next[key] = autoFitColumnWidth({
                    cellTexts: this.tableData.map((row) =>
                        this.formatCellValue(getRowCells(row)[colIndex], column)
                    ),
                    cellSamples,
                    column,
                    columnIndex: colIndex,
                    headerSortExtra: this.widgetConfig && this.widgetConfig.sort === false ? 0 : 26,
                    headerText: column?.label || '',
                    tableEl: context.tableEl
                });
            }
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
