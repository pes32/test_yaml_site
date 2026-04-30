import type {
    TableCellDisplayAction,
    TableCellOptions,
    TableColumnAttrConfig,
    TableRuntimeColumn,
    TableWidgetConfig,
    WidgetAttrsMap
} from './table_contract.ts';
import { isRecord } from '../../shared/object_record.ts';
import { formatNowValueForWidgetType } from '../../shared/date_time_format.ts';
import { normalizeChoiceValue } from '../../shared/choice_value.ts';

type ClassMap = Record<string, boolean>;
type CssStyleMap = Record<string, string>;

type DefaultCellValueOptions = {
    isLineNumberColumn?: (column: TableRuntimeColumn) => boolean;
    isListColumnMultiselect?: boolean;
    now?: Date;
    tableCellOptions?: TableCellOptions | null;
};

type SanitizeTableCellOptions = (
    type: unknown,
    widgetConfig: TableColumnAttrConfig | null | undefined
) => TableCellOptions;

function isChoiceColumnType(type: unknown): boolean {
    const key = String(type || '').trim();
    return key === 'list' || key === 'voc';
}

function tableColumnAt(
    columns: TableRuntimeColumn[] | null | undefined,
    colIndex: number
): TableRuntimeColumn | undefined {
    const list = Array.isArray(columns) ? columns : [];
    return list[colIndex];
}

function getCellDisplayActions(
    column: TableRuntimeColumn | null | undefined
): TableCellDisplayAction[] {
    if (!column) return [];
    if (String(column.type || '').trim() === 'voc') {
        return [{ kind: 'list', label: 'Открыть справочник', icon: '' }];
    }
    if (isChoiceColumnType(column.type)) {
        return [{ kind: 'list', label: 'Открыть список', icon: '' }];
    }
    if (column.type === 'date') {
        return [{ kind: 'date', label: 'Выбрать дату', icon: 'calendar.svg' }];
    }
    if (column.type === 'time') {
        return [{ kind: 'time', label: 'Выбрать время', icon: 'clock.svg' }];
    }
    if (column.type === 'datetime') {
        return [
            { kind: 'date', label: 'Выбрать дату', icon: 'calendar.svg' },
            { kind: 'time', label: 'Выбрать время', icon: 'clock.svg' }
        ];
    }
    return [];
}

function getCellDisplayKind(column: TableRuntimeColumn | null | undefined): string {
    if (!column) return '';
    const type = String(column.type || '').trim();
    if (
        type === 'ip' ||
        type === 'ip_mask' ||
        isChoiceColumnType(type) ||
        type === 'date' ||
        type === 'time' ||
        type === 'datetime'
    ) {
        return isChoiceColumnType(type) ? 'list' : type;
    }
    return '';
}

function getCellDisplayClass(column: TableRuntimeColumn | null | undefined): ClassMap {
    const kind = getCellDisplayKind(column);
    if (!kind) return {};
    const classMap: ClassMap = {
        [`widget-table__cell-display--${kind}`]: true
    };
    if (kind === 'list' || kind === 'date' || kind === 'time' || kind === 'datetime') {
        classMap['widget-table__cell-display--actionable'] = true;
    }
    return classMap;
}

function getCellDisplayTextClass(column: TableRuntimeColumn | null | undefined): string[] {
    const kind = getCellDisplayKind(column);
    return kind ? [`widget-table__cell-display-text--${kind}`] : [];
}

function getCellDisplayTextStyle(column: TableRuntimeColumn | null | undefined): CssStyleMap {
    const kind = getCellDisplayKind(column);
    if (kind === 'list') {
        return {
            paddingLeft: '0',
            paddingRight: 'var(--dropdown-arrow-space)'
        };
    }
    if (kind === 'date') {
        return {
            paddingLeft: '0',
            paddingRight:
                'calc(var(--widget-dt-gap) + var(--widget-dt-icon-slot-w))'
        };
    }
    if (kind === 'time') {
        return {
            paddingLeft: '0',
            paddingRight:
                'calc(var(--widget-dt-gap) + var(--widget-dt-icon-slot-w))'
        };
    }
    if (kind === 'datetime') {
        return {
            paddingLeft: '0',
            paddingRight:
                'calc((var(--widget-dt-gap) * 2) + (var(--widget-dt-icon-slot-w) * 2) + var(--space-2xs, 4px))'
        };
    }
    return {};
}

function getCellDisplayActionsClass(column: TableRuntimeColumn | null | undefined): string[] {
    const kind = getCellDisplayKind(column);
    return kind ? [`widget-table__cell-actions--${kind}`] : [];
}

function getCellDisplayActionClass(action: TableCellDisplayAction | null | undefined): string[] {
    const kind = action && action.kind ? String(action.kind).trim() : '';
    return kind ? [`widget-table__cell-action--${kind}`] : [];
}

function resolveTableLazyEnabled(
    widgetConfig: TableWidgetConfig | null | undefined,
    rowCount: number,
    threshold = 100
): boolean {
    void widgetConfig;
    return rowCount > threshold;
}

function getColumnAttrConfig(
    attrsByName: WidgetAttrsMap | null | undefined,
    column: TableRuntimeColumn | null | undefined
): TableColumnAttrConfig {
    const attrs = isRecord(attrsByName) ? attrsByName : {};
    const keys = [column?.widgetRef, column?.source, column?.attr];

    for (const rawKey of keys) {
        const key = typeof rawKey === 'string' ? rawKey.trim() : '';
        if (key && attrs[key]) {
            return attrs[key];
        }
    }

    return isRecord(column?.widgetConfig)
        ? column.widgetConfig
        : {};
}

function isListColumnMultiselect(
    attrsByName: WidgetAttrsMap | null | undefined,
    column: TableRuntimeColumn | null | undefined
): boolean {
    if (!column || !isChoiceColumnType(column.type)) {
        return false;
    }

    const attrCfg = getColumnAttrConfig(attrsByName, column);
    return !!(attrCfg.multiselect || column.multiselect);
}

function getColumnTableCellOptions(
    attrsByName: WidgetAttrsMap | null | undefined,
    column: TableRuntimeColumn | null | undefined,
    sanitizeTableCellOptions?: SanitizeTableCellOptions
): TableCellOptions {
    const sourceCfg = getColumnAttrConfig(attrsByName, column);
    if (typeof sanitizeTableCellOptions === 'function') {
        return sanitizeTableCellOptions(column && column.type, sourceCfg);
    }
    return column && column.tableCellOptions ? column.tableCellOptions : {};
}

function normalizeCellWidgetValue(
    column: TableRuntimeColumn | null | undefined,
    currentVal: unknown,
    isMulti: boolean
): unknown {
    if (!column) return currentVal;
    if (isChoiceColumnType(column.type)) {
        return normalizeChoiceValue(currentVal, isMulti);
    }
    return currentVal == null ? '' : currentVal;
}

function tableCellConsumeKeys(column: TableRuntimeColumn | null | undefined): string {
    if (!column) return '';
    if (
        isChoiceColumnType(column.type) ||
        column.type === 'date' ||
        column.type === 'time' ||
        column.type === 'datetime'
    ) {
        return 'enter,tab,arrows';
    }
    return '';
}

function defaultCellValueFromColumn(
    column: TableRuntimeColumn | null | undefined,
    options: DefaultCellValueOptions = {}
): unknown {
    if (!column) return '';
    if (typeof options.isLineNumberColumn === 'function' && options.isLineNumberColumn(column)) {
        return '';
    }

    const tableCellOptions = options.tableCellOptions && isRecord(options.tableCellOptions)
        ? options.tableCellOptions
        : {};

    if (!Object.prototype.hasOwnProperty.call(tableCellOptions, 'default')) {
        return options.isListColumnMultiselect === true ? [] : '';
    }

    if (isChoiceColumnType(column.type)) {
        return normalizeChoiceValue(
            tableCellOptions.default,
            options.isListColumnMultiselect === true
        );
    }

    if (
        (column.type === 'date' ||
            column.type === 'time' ||
            column.type === 'datetime') &&
        tableCellOptions.default === 'now'
    ) {
        const now = options.now instanceof Date ? options.now : new Date();
        return formatNowValueForWidgetType(String(column.type || ''), now);
    }

    return tableCellOptions.default;
}

function defaultCellValueForColumn(
    columns: TableRuntimeColumn[],
    colIndex: number,
    options: DefaultCellValueOptions = {}
): unknown {
    const column = tableColumnAt(columns, colIndex);
    const value = defaultCellValueFromColumn(column, options);
    if (Array.isArray(value)) return value.slice();
    return value == null ? '' : value;
}

function blankCellValueForColumn(columns: TableRuntimeColumn[], colIndex: number, options: DefaultCellValueOptions = {}): unknown {
    const column = tableColumnAt(columns, colIndex);
    return options.isListColumnMultiselect === true && column && isChoiceColumnType(column.type)
        ? []
        : '';
}

export {
    blankCellValueForColumn,
    defaultCellValueForColumn,
    defaultCellValueFromColumn,
    getCellDisplayActionClass,
    getCellDisplayActions,
    getCellDisplayActionsClass,
    getCellDisplayClass,
    getCellDisplayKind,
    getCellDisplayTextClass,
    getCellDisplayTextStyle,
    getColumnAttrConfig,
    getColumnTableCellOptions,
    isListColumnMultiselect,
    normalizeCellWidgetValue,
    resolveTableLazyEnabled,
    tableCellConsumeKeys
};
