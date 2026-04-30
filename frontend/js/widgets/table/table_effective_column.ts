import type {
    TableCellDataType,
    TableCellMeta,
    TableCellTypeMeta,
    TableRuntimeColumn
} from './table_contract.ts';

const YAML_PROTECTED_TYPES = new Set(['date', 'time', 'datetime', 'list', 'voc', 'ip', 'ip_mask', 'line_number']);
const COLUMN_TYPE_TO_DATA_TYPE: Record<string, TableCellDataType> = {
    date: 'date',
    datetime: 'datetime',
    float: 'float',
    int: 'int',
    ip: 'ip',
    ip_mask: 'ip_mask',
    str: 'text',
    text: 'text',
    time: 'time'
};

function columnTypeLockedByYaml(column: TableRuntimeColumn | null | undefined): boolean {
    if (!column) return true;
    if (column.readonly === true || column.isLineNumber === true) return true;
    if (column.format != null && String(column.format).trim() !== '') return true;
    return YAML_PROTECTED_TYPES.has(String(column.type || '').trim());
}

function tableCellDataTypeToColumnType(type: TableCellDataType | null | undefined): string | null {
    switch (type) {
        case 'text':
            return 'str';
        case 'int':
            return 'int';
        case 'float':
        case 'exponent':
            return 'float';
        case 'date':
        case 'time':
        case 'datetime':
        case 'ip':
        case 'ip_mask':
            return type;
        default:
            return null;
    }
}

function columnTypeToTableCellDataType(type: unknown): TableCellDataType {
    return COLUMN_TYPE_TO_DATA_TYPE[String(type || '').trim()] || 'general';
}

function precisionOrDefault(meta: TableCellTypeMeta, fallback = 2): number {
    const parsed = Number(meta.precision);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(12, Math.floor(parsed)));
}

function tableCellDataTypeToFormat(meta: TableCellTypeMeta | null | undefined): string | null {
    if (!meta) return null;
    if (meta.type !== 'float' && meta.type !== 'exponent') return null;
    const comma = meta.thousands === true ? ',' : '';
    const precision = precisionOrDefault(meta);
    const suffix = meta.type === 'exponent' ? 'e' : 'f';
    return `#${comma}.${precision}${suffix}`;
}

function resolveEffectiveCellColumn(
    baseColumn: TableRuntimeColumn | null | undefined,
    meta: TableCellMeta | null | undefined
): TableRuntimeColumn | null {
    if (!baseColumn) return null;
    if (columnTypeLockedByYaml(baseColumn)) return baseColumn;
    const typeMeta = meta && meta.dataType;
    if (!typeMeta || !typeMeta.type || typeMeta.type === 'general') return baseColumn;
    const nextType = tableCellDataTypeToColumnType(typeMeta.type);
    if (!nextType) return baseColumn;
    return {
        ...baseColumn,
        format: tableCellDataTypeToFormat(typeMeta),
        type: nextType
    };
}

export {
    columnTypeToTableCellDataType,
    columnTypeLockedByYaml,
    resolveEffectiveCellColumn,
    tableCellDataTypeToColumnType,
    tableCellDataTypeToFormat
};
