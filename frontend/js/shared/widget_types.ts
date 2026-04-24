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

const KNOWN_WIDGET_TYPE_NAMES = Object.freeze([
    'button',
    'img',
    'split_button',
    'table',
    'text',
    ...BUILTIN_WIDGET_TYPE_NAMES
] as const);

const STATEFUL_WIDGET_TYPE_NAMES = Object.freeze(['text', ...BUILTIN_WIDGET_TYPE_NAMES] as const);

const EMBEDDED_TABLE_WIDGET_TYPE_NAMES = Object.freeze(['date', 'datetime', 'list', 'time', 'voc'] as const);

const BUILTIN_WIDGET_TYPES = new Set<string>(BUILTIN_WIDGET_TYPE_NAMES);
const STATEFUL_WIDGET_TYPES = new Set<string>(STATEFUL_WIDGET_TYPE_NAMES);
const EMBEDDED_TABLE_WIDGET_TYPES = new Set<string>(EMBEDDED_TABLE_WIDGET_TYPE_NAMES);

type KnownWidgetType = typeof KNOWN_WIDGET_TYPE_NAMES[number];
type StatefulWidgetType = typeof STATEFUL_WIDGET_TYPE_NAMES[number];
type WidgetType = KnownWidgetType | (string & {});

function isBuiltinWidgetType(token: unknown): boolean {
    return BUILTIN_WIDGET_TYPES.has(String(token || '').trim());
}

export {
    BUILTIN_WIDGET_TYPE_NAMES,
    BUILTIN_WIDGET_TYPES,
    EMBEDDED_TABLE_WIDGET_TYPE_NAMES,
    EMBEDDED_TABLE_WIDGET_TYPES,
    KNOWN_WIDGET_TYPE_NAMES,
    isBuiltinWidgetType,
    STATEFUL_WIDGET_TYPE_NAMES,
    STATEFUL_WIDGET_TYPES
};

export type { KnownWidgetType, StatefulWidgetType, WidgetType };
