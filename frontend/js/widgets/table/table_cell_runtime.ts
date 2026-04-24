import { resolveAttrConfig } from '../../shared/attr_config.ts';
import { EMBEDDED_TABLE_WIDGET_TYPES } from '../../shared/widget_types.ts';
import * as tableSelectors from './table_selectors.ts';
import { tableLog } from './table_debug.ts';
import { sanitizeTableCellOptions } from './table_parse_attrs.ts';
import { displayCellToCore } from './table_selection_model.ts';
import { dispatchRuntimeCellPatches } from './table_runtime_commands.ts';
import { setTableValidationError, tableValidationKey } from './table_validation_model.ts';
import { widgetFactory } from '../factory.ts';
import type {
    TableCellDisplayAction,
    TableCellWidgetPayload,
    TableCellWidgetConfig,
    TableRuntimeColumn,
    TableRuntimeMethodSubset,
    TableRuntimeVm
} from './table_contract.ts';

function resolveEmbeddedWidgetType(type: unknown): string {
    const key = String(type || '').trim();
    return EMBEDDED_TABLE_WIDGET_TYPES.has(key) ? key : '';
}

function cellRefKey(rowId: string, colKey: string): string {
    return `${String(rowId || '').replace(/\W+/g, '_')}_${String(colKey || '').replace(/\W+/g, '_')}`;
}

type CellWidgetConfigRuntime = TableRuntimeVm;

type CellWidgetConfigContext = {
    cellIndex: number;
    column: TableRuntimeColumn;
    currentValue: unknown;
    isEditing: boolean;
    readonly: boolean;
    rowIndex: number;
};

function buildCellWidgetConfig(
    runtime: CellWidgetConfigRuntime,
    context: CellWidgetConfigContext
): TableCellWidgetConfig {
    const { cellIndex, column, currentValue, isEditing, readonly, rowIndex } = context;
    const attrConfig = runtime.getColumnAttrConfig(column);
    const options = Object.assign({}, runtime.getColumnTableCellOptions(column));
    const value = runtime.normalizeCellWidgetValue(column, currentValue);
    const isMulti = runtime.listColumnIsMultiselect(column);
    const config: TableCellWidgetConfig = {
        ...options,
        widget: column.type,
        value,
        default: undefined,
        label:
            attrConfig && attrConfig.label !== undefined
                ? attrConfig.label
                : String(column && column.label ? column.label : ''),
        sup_text: '',
        table_cell_mode: true,
        table_consume_keys: runtime.tableCellConsumeKeys(column),
        table_cell_validation_handler: (message: unknown) =>
            runtime.onCellWidgetValidation(rowIndex, cellIndex, message),
        table_cell_tab_handler: (shiftKey?: boolean) =>
            runtime.navigateTableByTabFromCell(rowIndex, cellIndex, !!shiftKey),
        table_cell_ui_lock_handler: (locked: boolean) => {
            runtime.tableUiLocked = !!locked;
        },
        readonly: readonly || !isEditing
    };
    if (column.type === 'list') {
        const listSource = runtime.getListOptions(column.source ? column.source : column.widgetRef);
        config.source = listSource;
        if (listSource.length === 0 && Array.isArray(options.source)) {
            config.source = options.source.slice();
        }
        config.multiselect = isMulti;
        if (attrConfig && attrConfig.editable !== undefined) {
            config.editable = attrConfig.editable;
        }
    } else if (column.type === 'voc') {
        config.source =
            attrConfig && Object.prototype.hasOwnProperty.call(attrConfig, 'source')
                ? attrConfig.source
                : options.source;
        config.columns =
            attrConfig && Array.isArray(attrConfig.columns)
                ? attrConfig.columns.slice()
                : Array.isArray(options.columns)
                  ? options.columns.slice()
                  : [];
        config.multiselect = isMulti;
        if (attrConfig && attrConfig.placeholder !== undefined) {
            config.placeholder = attrConfig.placeholder;
        }
    }
    return config;
}

const CellRuntimeMethods = {
    canMutateColumnIndex(colIndex: number) {
        const column = this.tableColumns[colIndex];
        if (!column) return false;
        if (!this.isEditable) return false;
        if (this.isLineNumberColumn(column)) return false;
        const attrConfig = this.getColumnAttrConfig(column);
        if (column.readonly === true || attrConfig.readonly === true) return false;
        return true;
    },

    cellAllowsEditing(rowIndex: number, colIndex: number) {
        void rowIndex;
        return this.canMutateColumnIndex(colIndex);
    },

    cellUsesNativeInput(column: TableRuntimeColumn | null | undefined) {
        if (!column) return false;
        return (
            !this.isLineNumberColumn(column) &&
            !this.getColumnAttrConfig(column).readonly &&
            !column.readonly &&
            !this.cellUsesEmbeddedWidget(column)
        );
    },

    columnWidgetComponentByType(type: unknown) {
        const widgetType = resolveEmbeddedWidgetType(type);
        return widgetType ? widgetFactory.getDefinition(widgetType).resolveComponent() : null;
    },

    cellWidgetComponent(column: TableRuntimeColumn | null | undefined) {
        return this.columnWidgetComponentByType(column && column.type);
    },

    cellUsesEmbeddedWidget(column: TableRuntimeColumn | null | undefined) {
        return !!(column && resolveEmbeddedWidgetType(column.type));
    },

    cellDisplayActions: tableSelectors.getCellDisplayActions,

    cellDisplayKind: tableSelectors.getCellDisplayKind,

    cellDisplayClass: tableSelectors.getCellDisplayClass,

    cellDisplayTextClass: tableSelectors.getCellDisplayTextClass,

    cellDisplayTextStyle: tableSelectors.getCellDisplayTextStyle,

    cellDisplayActionsClass: tableSelectors.getCellDisplayActionsClass,

    cellDisplayActionClass: tableSelectors.getCellDisplayActionClass,

    getColumnAttrConfig(column: TableRuntimeColumn | null | undefined) {
        return tableSelectors.getColumnAttrConfig(this.getAllAttrsMap(), column);
    },

    getColumnTableCellOptions(column: TableRuntimeColumn | null | undefined) {
        return tableSelectors.getColumnTableCellOptions(
            this.getAllAttrsMap(),
            column,
            sanitizeTableCellOptions
        );
    },

    normalizeCellWidgetValue(
        column: TableRuntimeColumn | null | undefined,
        currentValue: unknown
    ) {
        return tableSelectors.normalizeCellWidgetValue(
            column,
            currentValue,
            this.listColumnIsMultiselect(column)
        );
    },

    tableCellConsumeKeys: tableSelectors.tableCellConsumeKeys,

    cellWidgetConfig(rowIndex: number, cellIndex: number, column: TableRuntimeColumn) {
        const coreCell = this.coreCellFromDisplay(rowIndex, cellIndex);
        const sourceRow = coreCell ? this.dataRowByIdentity(coreCell.rowId) : null;
        const currentValue = this.safeCell(sourceRow || [], cellIndex);
        const isEditing = this.isCellEditing(rowIndex, cellIndex);
        const readonly = !this.cellAllowsEditing(rowIndex, cellIndex) || !isEditing;
        return buildCellWidgetConfig(this, {
            cellIndex,
            column,
            currentValue,
            isEditing,
            readonly,
            rowIndex
        });
    },

    cellWidgetConfigByIdentity(
        rowId: string,
        colKey: string,
        fallbackRow: number,
        fallbackCol: number,
        column: TableRuntimeColumn
    ) {
        const colIndex = this.runtimeColumnKeys().indexOf(String(colKey || ''));
        const safeCol = colIndex >= 0 ? colIndex : this.normCol(fallbackCol);
        const currentValue = this.safeCell(this.dataRowByIdentity(rowId), safeCol);
        const cell = this.displayCellFromIdentity(rowId, colKey, {
            r: fallbackRow,
            c: fallbackCol
        });
        const isEditing = this.isCellEditing(cell.r, cell.c);
        const readonly = !this.cellAllowsEditing(cell.r, cell.c) || !isEditing;
        return buildCellWidgetConfig(this, {
            cellIndex: safeCol,
            column,
            currentValue,
            isEditing,
            readonly,
            rowIndex: cell.r
        });
    },

    cellWidgetName(rowIndex: number, cellIndex: number) {
        const coreCell = this.coreCellFromDisplay(rowIndex, cellIndex);
        if (!coreCell) return `cell_v${rowIndex}_${cellIndex}`;
        return this.cellWidgetNameByIdentity(coreCell.rowId, coreCell.colKey, rowIndex, cellIndex);
    },

    cellWidgetNameByIdentity(rowId: string, colKey: string, fallbackRow: number, fallbackCol: number) {
        void fallbackRow;
        void fallbackCol;
        return `cell_${cellRefKey(rowId, colKey)}`;
    },

    cellWidgetRefName(rowIndex: number, cellIndex: number) {
        const coreCell = this.coreCellFromDisplay(rowIndex, cellIndex);
        if (!coreCell) return `cell_widget_v${rowIndex}_${cellIndex}`;
        return this.cellWidgetRefNameByIdentity(coreCell.rowId, coreCell.colKey, rowIndex, cellIndex);
    },

    cellWidgetRefNameByIdentity(rowId: string, colKey: string, fallbackRow: number, fallbackCol: number) {
        void fallbackRow;
        void fallbackCol;
        return `cell_widget_${cellRefKey(rowId, colKey)}`;
    },

    coreCellFromDisplay(rowIndex: number, colIndex: number) {
        return displayCellToCore(
            { r: this.normRow(rowIndex), c: this.normCol(colIndex) },
            this.tableColumns,
            this.tableViewModelSnapshot()
        );
    },

    setCellValidationError(rowIndex: number, colIndex: number, message: unknown) {
        this.cellValidationErrors = setTableValidationError(
            this.cellValidationErrors,
            this.coreCellFromDisplay(rowIndex, colIndex),
            message
        );
        this.tableStore.validation.cellErrors = { ...this.cellValidationErrors };
    },

    onCellWidgetValidation(rowIndex: number, cellIndex: number, message: unknown) {
        this.setCellValidationError(rowIndex, cellIndex, message);
    },

    cellHasCommitError(rowIndex: number, colIndex: number) {
        const key = tableValidationKey(this.coreCellFromDisplay(rowIndex, colIndex));
        return !!(key && this.cellValidationErrors[key]);
    },

    onCellWidgetPayload(rowIndex: number, cellIndex: number, payload: TableCellWidgetPayload | null | undefined) {
        if (!payload || typeof payload.value === 'undefined') return;
        const cell = this.coreCellFromDisplay(rowIndex, cellIndex);
        if (!cell) return;
        dispatchRuntimeCellPatches(this, [{ cell, value: payload.value }], 'cell widget input', {
            skipGroupingViewRefresh: true
        });
        tableLog('cell widget input', rowIndex, cellIndex);
    },

    onCellWidgetPayloadByIdentity(
        rowId: string,
        colKey: string,
        payload: TableCellWidgetPayload | null | undefined
    ) {
        if (!payload || typeof payload.value === 'undefined') return;
        const colIndex = this.runtimeColumnKeys().indexOf(String(colKey || ''));
        if (colIndex < 0 || !this.canMutateColumnIndex(colIndex)) return;
        dispatchRuntimeCellPatches(this, [{
            cell: { colKey: String(colKey || ''), rowId: String(rowId || '') },
            value: payload.value
        }], 'cell widget input', {
            skipGroupingViewRefresh: true
        });
        tableLog('cell widget input', rowId, colKey);
    },

    getListOptions(sourceName: unknown) {
        const key = String(sourceName || '').trim();
        if (!key) return [];
        try {
            const attr = resolveAttrConfig(this.getAllAttrsMap(), key);
            return Array.isArray(attr.source) ? attr.source : [];
        } catch (error) {}
        return [];
    },

    listColumnIsMultiselect(column: TableRuntimeColumn | null | undefined) {
        return tableSelectors.isListColumnMultiselect(this.getAllAttrsMap(), column);
    }
} satisfies TableRuntimeMethodSubset;

export { CellRuntimeMethods };
export default CellRuntimeMethods;
