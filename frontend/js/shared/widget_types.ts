const BUILTIN_WIDGET_TYPE_NAMES = Object.freeze([
    'str',
    'int',
    'float',
    'date',
    'time',
    'datetime',
    'list',
    'voc',
    'ip',
    'ip_mask'
] as const);

const STATEFUL_WIDGET_TYPE_NAMES = Object.freeze([
    'str',
    'text',
    ...BUILTIN_WIDGET_TYPE_NAMES.filter((type) => type !== 'str')
] as const);

const EMBEDDED_TABLE_WIDGET_TYPE_NAMES = BUILTIN_WIDGET_TYPE_NAMES;

const BUILTIN_WIDGET_TYPES = new Set<string>(BUILTIN_WIDGET_TYPE_NAMES);
const STATEFUL_WIDGET_TYPES = new Set<string>(STATEFUL_WIDGET_TYPE_NAMES);
const EMBEDDED_TABLE_WIDGET_TYPES = new Set<string>(EMBEDDED_TABLE_WIDGET_TYPE_NAMES);

type StatefulWidgetType = typeof STATEFUL_WIDGET_TYPE_NAMES[number];

export {
    BUILTIN_WIDGET_TYPE_NAMES,
    BUILTIN_WIDGET_TYPES,
    EMBEDDED_TABLE_WIDGET_TYPE_NAMES,
    EMBEDDED_TABLE_WIDGET_TYPES,
    STATEFUL_WIDGET_TYPE_NAMES,
    STATEFUL_WIDGET_TYPES
};

export type { StatefulWidgetType };
