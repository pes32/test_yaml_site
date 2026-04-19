const BUILTIN_WIDGET_TYPES = new Set([
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
]);

function uniqPush(list: string[], value: unknown): void {
    const key = String(value || '').trim();
    if (!key || list.includes(key)) {
        return;
    }
    list.push(key);
}

function isBuiltinWidgetType(token: unknown): boolean {
    return BUILTIN_WIDGET_TYPES.has(String(token || '').trim());
}

function extractTableAttrDependencies(tableAttrs: unknown): string[] {
    if (!tableAttrs) {
        return [];
    }

    const deps: string[] = [];
    String(tableAttrs)
        .split('\n')
        .forEach((rawLine) => {
            const line = String(rawLine || '').trim();
            if (!line || line.startsWith('/')) {
                return;
            }
            const colonTokens = line.match(/:\S+/g) || [];
            colonTokens.forEach((token) => {
                const value = token.slice(1);
                if (/^\d+$/.test(value) || isBuiltinWidgetType(value)) {
                    return;
                }
                uniqPush(deps, value);
            });
        });

    return deps;
}

function resolveTableDependencies(tableAttrConfig: { table_attrs?: unknown } | null | undefined): string[] {
    const config = tableAttrConfig && typeof tableAttrConfig === 'object'
        ? tableAttrConfig
        : {};
    const tableAttrs = config.table_attrs != null ? String(config.table_attrs) : '';
    return tableAttrs ? extractTableAttrDependencies(tableAttrs) : [];
}

export {
    extractTableAttrDependencies,
    isBuiltinWidgetType,
    resolveTableDependencies
};
