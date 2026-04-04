import { getListOptions as resolveListOptions } from './table_api.js';
import {
    defaultCellValueFromColumn as selectDefaultCellValueFromColumn,
    getCellDisplayActionClass,
    getCellDisplayActions,
    getCellDisplayActionsClass,
    getCellDisplayClass,
    getCellDisplayTextClass,
    getCellDisplayTextStyle,
    getColumnAttrConfig as selectColumnAttrConfig,
    getColumnTableCellOptions as selectColumnTableCellOptions,
    isListColumnMultiselect,
    normalizeCellWidgetValue as selectNormalizeCellWidgetValue,
    tableCellConsumeKeys as selectTableCellConsumeKeys
} from './table_selectors.js';
import tableEngine from './table_core.js';

const Core = tableEngine;

const CellRuntimeMethods = {
    canMutateColumnIndex(colIndex) {
        const column = this.tableColumns[colIndex];
        if (!column) return false;
        if (!this.isEditable) return false;
        if (this.isLineNumberColumn(column)) return false;
        const attrConfig = this.getColumnAttrConfig(column);
        if (column.readonly === true || attrConfig.readonly === true) return false;
        return true;
    },

    cellAllowsEditing(rowIndex, colIndex) {
        void rowIndex;
        return this.canMutateColumnIndex(colIndex);
    },

    cellUsesNativeInput(column) {
        if (!column) return false;
        return (
            !this.isLineNumberColumn(column) &&
            !this.getColumnAttrConfig(column).readonly &&
            !column.readonly &&
            !this.cellUsesEmbeddedWidget(column)
        );
    },

    columnWidgetComponentByType(type) {
        const key = String(type || '').trim();
        if (key === 'str') return this.stringCellWidget;
        if (key === 'int') return this.intCellWidget;
        if (key === 'float') return this.floatCellWidget;
        if (key === 'date') return this.dateCellWidget;
        if (key === 'time') return this.timeCellWidget;
        if (key === 'datetime') return this.datetimeCellWidget;
        if (key === 'list') return this.listCellWidget;
        if (key === 'voc') return this.vocCellWidget;
        if (key === 'ip') return this.ipCellWidget;
        if (key === 'ip_mask') return this.ipMaskCellWidget;
        return null;
    },

    cellWidgetComponent(column) {
        return this.columnWidgetComponentByType(column && column.type);
    },

    cellUsesEmbeddedWidget(column) {
        return !!(column && this.cellWidgetComponent(column));
    },

    cellDisplayActions(column) {
        return getCellDisplayActions(column);
    },

    cellDisplayKind(column) {
        if (!column) return '';
        const type = String(column.type || '').trim();
        if (
            type === 'ip' ||
            type === 'ip_mask' ||
            type === 'list' ||
            type === 'voc' ||
            type === 'date' ||
            type === 'time' ||
            type === 'datetime'
        ) {
            return type === 'voc' ? 'list' : type;
        }
        return '';
    },

    cellDisplayClass(column) {
        return getCellDisplayClass(column);
    },

    cellDisplayTextClass(column) {
        return getCellDisplayTextClass(column);
    },

    cellDisplayTextStyle(column) {
        return getCellDisplayTextStyle(column);
    },

    cellDisplayActionsClass(column) {
        return getCellDisplayActionsClass(column);
    },

    cellDisplayActionClass(action) {
        return getCellDisplayActionClass(action);
    },

    getColumnAttrConfig(column) {
        return selectColumnAttrConfig(this.getAllAttrsMap(), column);
    },

    getColumnTableCellOptions(column) {
        const Schema = tableEngine.TableSchema;
        const sanitize = Schema && Schema.sanitizeTableCellOptions;
        return selectColumnTableCellOptions(
            this.getAllAttrsMap(),
            column,
            sanitize
        );
    },

    normalizeCellWidgetValue(column, currentValue) {
        return selectNormalizeCellWidgetValue(
            column,
            currentValue,
            this.listColumnIsMultiselect(column)
        );
    },

    tableCellConsumeKeys(column) {
        return selectTableCellConsumeKeys(column);
    },

    cellWidgetConfig(rowIndex, cellIndex, column) {
        const dataIndex = this.resolveDataRowIndex(rowIndex);
        const sourceRow = dataIndex >= 0 ? this.tableData[dataIndex] : null;
        const currentValue = this.safeCell(sourceRow || [], cellIndex);
        const attrConfig = this.getColumnAttrConfig(column);
        const options = Object.assign({}, this.getColumnTableCellOptions(column));
        const isEditing = this.isCellEditing(rowIndex, cellIndex);
        const value = this.normalizeCellWidgetValue(column, currentValue);
        const isMulti = this.listColumnIsMultiselect(column);
        const readonly = !this.cellAllowsEditing(rowIndex, cellIndex) || !isEditing;
        const config = {
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
            table_consume_keys: this.tableCellConsumeKeys(column),
            table_cell_validation_handler: (message) =>
                this.onCellWidgetValidation(rowIndex, cellIndex, message),
            table_cell_tab_handler: (shiftKey) =>
                this.navigateTableByTabFromCell(rowIndex, cellIndex, !!shiftKey),
            table_cell_ui_lock_handler: (locked) => {
                this.tableUiLocked = !!locked;
            },
            readonly
        };
        if (column && column.type === 'list') {
            config.source = this.getListOptions(
                column && column.source ? column.source : column && column.widgetRef
            );
            if ((!config.source || !config.source.length) && Array.isArray(options.source)) {
                config.source = options.source.slice();
            }
            config.multiselect = isMulti;
            if (attrConfig && attrConfig.editable !== undefined) {
                config.editable = attrConfig.editable;
            }
        } else if (column && column.type === 'voc') {
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
    },

    cellWidgetName(rowIndex, cellIndex) {
        const dataIndex = this.resolveDataRowIndex(rowIndex);
        const key = dataIndex >= 0 ? dataIndex : `v${rowIndex}`;
        return `cell_${key}_${cellIndex}`;
    },

    cellWidgetRefName(rowIndex, cellIndex) {
        const dataIndex = this.resolveDataRowIndex(rowIndex);
        const key = dataIndex >= 0 ? dataIndex : `v${rowIndex}`;
        return `cell_widget_${key}_${cellIndex}`;
    },

    cellValidationKeyByDataIndex(dataIndex, colIndex) {
        if (dataIndex == null || dataIndex < 0) return '';
        const row = this.tableData[dataIndex];
        if (!row || row.id == null) return '';
        return `${String(row.id)}::${this.normCol(colIndex)}`;
    },

    setCellValidationError(rowIndex, colIndex, message) {
        const dataIndex = this.resolveDataRowIndex(rowIndex);
        const key = this.cellValidationKeyByDataIndex(dataIndex, colIndex);
        if (!key) return;
        const next = Object.assign({}, this.cellValidationErrors);
        const errorMessage = String(message || '').trim();
        if (errorMessage) next[key] = errorMessage;
        else delete next[key];
        this.cellValidationErrors = next;
    },

    onCellWidgetValidation(rowIndex, cellIndex, message) {
        this.setCellValidationError(rowIndex, cellIndex, message);
    },

    cellHasCommitError(rowIndex, colIndex) {
        const dataIndex = this.resolveDataRowIndex(rowIndex);
        const key = this.cellValidationKeyByDataIndex(dataIndex, colIndex);
        return !!(key && this.cellValidationErrors[key]);
    },

    onCellWidgetPayload(rowIndex, cellIndex, payload) {
        if (!payload || typeof payload.value === 'undefined') return;
        if (!this.canMutateColumnIndex(cellIndex)) return;
        const dataIndex = this.resolveDataRowIndex(rowIndex);
        if (dataIndex < 0) return;
        const Utils = tableEngine.Utils;
        const rowObject = this.tableData[dataIndex];
        this.applyTableMutation(
            () => {
                const nextRow =
                    Utils && typeof Utils.replaceRowCellValue === 'function'
                        ? Utils.replaceRowCellValue(rowObject, cellIndex, payload.value)
                        : {
                            id: rowObject.id,
                            cells: [...(Utils && Utils.getRowCells ? Utils.getRowCells(rowObject) : [])]
                        };
                if (!(Utils && typeof Utils.replaceRowCellValue === 'function')) {
                    nextRow.cells[cellIndex] = payload.value;
                }
                this.tableData.splice(dataIndex, 1, nextRow);
            },
            { skipSort: true, skipGroupingViewRefresh: true }
        );
        tableEngine.log('cell widget input', dataIndex, cellIndex);
    },

    getListOptions(sourceName) {
        if (!sourceName) return [];
        try {
            const attrs = this.getAllAttrsMap();
            return resolveListOptions(attrs, sourceName);
        } catch (error) {}
        return [];
    },

    listColumnIsMultiselect(column) {
        return isListColumnMultiselect(this.getAllAttrsMap(), column);
    }
};

Core.CellRuntimeMethods = CellRuntimeMethods;

export { CellRuntimeMethods };
export default CellRuntimeMethods;
