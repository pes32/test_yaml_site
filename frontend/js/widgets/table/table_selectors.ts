function isChoiceColumnType(type) {
    const key = String(type || '').trim();
    return key === 'list' || key === 'voc';
}

function getCellDisplayActions(column) {
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

function getCellDisplayKind(column) {
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

function getCellDisplayClass(column) {
    const kind = getCellDisplayKind(column);
    if (!kind) return {};
    const classMap = {
        [`widget-table__cell-display--${kind}`]: true
    };
    if (kind === 'list' || kind === 'date' || kind === 'time' || kind === 'datetime') {
        classMap['widget-table__cell-display--actionable'] = true;
    }
    return classMap;
}

function getCellDisplayTextClass(column) {
    const kind = getCellDisplayKind(column);
    return kind ? [`widget-table__cell-display-text--${kind}`] : [];
}

function getCellDisplayTextStyle(column) {
    const kind = getCellDisplayKind(column);
    if (kind === 'list') {
        return {
            paddingLeft: 'var(--space-md)',
            paddingRight: 'var(--dropdown-arrow-space)'
        };
    }
    if (kind === 'date') {
        return {
            paddingLeft: 'var(--space-md)',
            paddingRight:
                'calc(var(--widget-dt-gap) + var(--widget-dt-icon-slot-w))'
        };
    }
    if (kind === 'time') {
        return {
            paddingLeft: 'var(--space-xs)',
            paddingRight:
                'calc(var(--widget-dt-gap) + var(--widget-dt-icon-slot-w))'
        };
    }
    if (kind === 'datetime') {
        return {
            paddingLeft: 'var(--space-md)',
            paddingRight:
                'calc((var(--widget-dt-gap) * 2) + (var(--widget-dt-icon-slot-w) * 2) + var(--space-2xs, 4px))'
        };
    }
    return {};
}

function getCellDisplayActionsClass(column) {
    const kind = getCellDisplayKind(column);
    return kind ? [`widget-table__cell-actions--${kind}`] : [];
}

function getCellDisplayActionClass(action) {
    const kind = action && action.kind ? String(action.kind).trim() : '';
    return kind ? [`widget-table__cell-action--${kind}`] : [];
}

function resolveTableLazyEnabled(widgetConfig, rowCount, threshold = 100) {
    const flag = widgetConfig && widgetConfig.table_lazy;
    if (flag === true) return true;
    if (flag === false) return false;
    return rowCount > threshold;
}

function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function getColumnAttrConfig(attrsByName, column) {
    const attrs = attrsByName && typeof attrsByName === 'object' ? attrsByName : {};
    if (column && column.widgetRef && attrs[column.widgetRef]) {
        return attrs[column.widgetRef] || {};
    }
    if (column && column.source && attrs[column.source]) {
        return attrs[column.source] || {};
    }
    if (column && column.attr && attrs[column.attr]) {
        return attrs[column.attr] || {};
    }
    return (column && column.widgetConfig) || {};
}

function isListColumnMultiselect(attrsByName, column) {
    if (!column || !isChoiceColumnType(column.type)) {
        return false;
    }

    const attrCfg = getColumnAttrConfig(attrsByName, column);
    return !!(attrCfg.multiselect || column.multiselect);
}

function getColumnTableCellOptions(attrsByName, column, sanitizeTableCellOptions) {
    const sourceCfg = getColumnAttrConfig(attrsByName, column);
    if (typeof sanitizeTableCellOptions === 'function') {
        return sanitizeTableCellOptions(column && column.type, sourceCfg);
    }
    return (column && column.tableCellOptions) || {};
}

function normalizeCellWidgetValue(column, currentVal, isMulti) {
    if (!column) return currentVal;
    if (isChoiceColumnType(column.type)) {
        if (isMulti) {
            return Array.isArray(currentVal)
                ? currentVal.slice()
                : currentVal
                  ? [currentVal]
                  : [];
        }
        return Array.isArray(currentVal) ? currentVal[0] || '' : currentVal;
    }
    return currentVal == null ? '' : currentVal;
}

function tableCellConsumeKeys(column) {
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

function defaultCellValueFromColumn(column, options = {}) {
    if (!column) return '';
    if (typeof options.isLineNumberColumn === 'function' && options.isLineNumberColumn(column)) {
        return '';
    }

    const tableCellOptions = options.tableCellOptions && typeof options.tableCellOptions === 'object'
        ? options.tableCellOptions
        : {};

    if (!Object.prototype.hasOwnProperty.call(tableCellOptions, 'default')) {
        return options.isListColumnMultiselect === true ? [] : '';
    }

    if (isChoiceColumnType(column.type)) {
        if (options.isListColumnMultiselect === true) {
            if (Array.isArray(tableCellOptions.default)) return tableCellOptions.default.slice();
            return tableCellOptions.default ? [tableCellOptions.default] : [];
        }
        return Array.isArray(tableCellOptions.default)
            ? tableCellOptions.default[0] || ''
            : tableCellOptions.default;
    }

    if (
        (column.type === 'date' ||
            column.type === 'time' ||
            column.type === 'datetime') &&
        tableCellOptions.default === 'now'
    ) {
        const now = options.now instanceof Date ? options.now : new Date();
        const datePart = `${padDatePart(now.getDate())}.${padDatePart(now.getMonth() + 1)}.${now.getFullYear()}`;
        const timePart = `${padDatePart(now.getHours())}:${padDatePart(now.getMinutes())}`;
        if (column.type === 'date') return datePart;
        if (column.type === 'time') return timePart;
        return `${datePart} ${timePart}`;
    }

    return tableCellOptions.default;
}

function defaultCellValueForColumn(columns, colIndex, options = {}) {
    const list = Array.isArray(columns) ? columns : [];
    const column = list[colIndex];
    const value = defaultCellValueFromColumn(column, options);
    if (Array.isArray(value)) return value.slice();
    return value == null ? '' : value;
}

function blankCellValueForColumn(columns, colIndex, options = {}) {
    const list = Array.isArray(columns) ? columns : [];
    const column = list[colIndex];
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
    padDatePart,
    resolveTableLazyEnabled,
    tableCellConsumeKeys
};
