/**
 * Canonical schema для table_attrs: runtimeColumns / leafColumns / headerRows / dependencies.
 */
import type {
    TableCellOptions,
    TableColumnAttrConfig,
    TableHeaderCell,
    TableLeafMeta,
    TableRuntimeColumn,
    TableRuntimeVm,
    TableSchema,
    WidgetAttrsMap
} from './table_contract.ts';
import { WidgetMeasure } from './table_widget_helpers.ts';
import { BUILTIN_WIDGET_TYPES } from '../../shared/widget_types.ts';

type TableParseVm = TableRuntimeVm;
type ParsedLeafColumn = TableRuntimeColumn & {
    label: string;
    type: string;
};
type ColonTokenMeta =
    | { kind: 'builtin'; value: string; widgetType: string }
    | { kind: 'widget_ref'; config: TableColumnAttrConfig | null; value: string; widgetType: string }
    | { kind: 'width'; value: string };
type HeaderNode = {
    children?: HeaderNode[];
    label: string;
    leafColIndex: number | null;
    runtimeColIndex?: number | null;
    type: 'group' | 'leaf';
    width?: string | null;
};

    const LINE_NUMBER_ATTR = '__line_numbers__';
    const LINE_NUMBER_LABEL = '№';
    const LINE_NUMBER_WIDTH = '64px';
    const TABLE_CELL_ALLOWED_OPTIONS = {
        str: ['placeholder', 'regex', 'err_text', 'default'],
        int: ['placeholder', 'regex', 'err_text', 'default'],
        float: ['placeholder', 'regex', 'err_text', 'default'],
        date: ['default'],
        time: ['default'],
        datetime: ['default'],
        list: ['source', 'editable', 'multiselect', 'default'],
        voc: ['source', 'columns', 'placeholder', 'multiselect', 'default'],
        ip: ['placeholder', 'regex', 'err_text', 'default'],
        ip_mask: ['placeholder', 'regex', 'err_text', 'default']
    } as const satisfies Record<string, ReadonlyArray<keyof TableCellOptions>>;

    function computeAutoWidthLabel(vm: TableParseVm, label: unknown): string {
        const tableEl =
            typeof vm.getTableEl === 'function' ? vm.getTableEl() : null;
        if (WidgetMeasure && typeof WidgetMeasure.computeAutoWidth === 'function') {
            return WidgetMeasure.computeAutoWidth(
                label,
                WidgetMeasure.headerSortAffordancePx(vm.widgetConfig),
                tableEl
            );
        }
        return `${Math.min(500, String(label || '').length * 10 + 50)}px`;
    }

    function uniqPush(list: string[], value: unknown): void {
        const key = String(value || '').trim();
        if (!key || list.indexOf(key) >= 0) return;
        list.push(key);
    }

    function isBuiltinWidgetType(token: unknown): boolean {
        return BUILTIN_WIDGET_TYPES.has(String(token || '').trim());
    }

    function normalizeWidgetType(token: unknown): string {
        const key = String(token || '').trim();
        return isBuiltinWidgetType(key) ? key : '';
    }

    function writeTableCellOption(
        target: TableCellOptions,
        key: keyof TableCellOptions,
        value: unknown
    ): void {
        if (key === 'columns') {
            target.columns = Array.isArray(value) ? value.slice() : undefined;
            return;
        }
        if (key === 'editable') {
            target.editable = typeof value === 'boolean' ? value : undefined;
            return;
        }
        if (key === 'multiselect') {
            target.multiselect = typeof value === 'boolean' ? value : undefined;
            return;
        }
        target[key] = value;
    }

    function sanitizeTableCellOptions(
        type: unknown,
        widgetConfig: TableColumnAttrConfig | null | undefined
    ): TableCellOptions {
        const widgetType = normalizeWidgetType(type);
        const cfg: TableColumnAttrConfig =
            widgetConfig && typeof widgetConfig === 'object' ? widgetConfig : {};
        const allowed =
            TABLE_CELL_ALLOWED_OPTIONS[
                widgetType as keyof typeof TABLE_CELL_ALLOWED_OPTIONS
            ] || [];
        const out: TableCellOptions = {};
        allowed.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(cfg, key)) return;
            const value = cfg[key];
            if (key === 'source' && Array.isArray(value)) {
                out.source = value.slice();
                return;
            }
            writeTableCellOption(out, key, value);
        });
        return out;
    }

    function getAllAttrs(vm: TableParseVm): WidgetAttrsMap {
        if (vm && typeof vm.getAllAttrsMap === 'function') {
            const attrs = vm.getAllAttrsMap();
            if (attrs && typeof attrs === 'object') {
                return attrs;
            }
        }
        return {};
    }

    function resolveColonToken(
        token: unknown,
        allAttrs: WidgetAttrsMap,
        dependencies: string[]
    ): ColonTokenMeta | null {
        const key = String(token || '').trim();
        if (!key) return null;
        if (/^\d+$/.test(key)) return { kind: 'width', value: `${key}px` };
        const attrCfg =
            Object.prototype.hasOwnProperty.call(allAttrs, key)
                ? allAttrs[key]
                : null;
        if (attrCfg) {
            uniqPush(dependencies, key);
            const widgetType = normalizeWidgetType(attrCfg.widget);
            return {
                kind: 'widget_ref',
                value: key,
                widgetType: widgetType || 'list',
                config: attrCfg
            };
        }
        if (isBuiltinWidgetType(key)) {
            return { kind: 'builtin', value: key, widgetType: key };
        }
        uniqPush(dependencies, key);
        return {
            kind: 'widget_ref',
            value: key,
            widgetType: 'list',
            config: null
        };
    }

    function parseLeafFromParts(
        vm: TableParseVm,
        attrName: string,
        remainder: string,
        allAttrs: WidgetAttrsMap,
        dependencies: string[]
    ): ParsedLeafColumn {
        let label = (remainder || attrName || '').trim();
        let width: string | null = null;
        let type = 'str';
        let format: string | null = null;
        let source: string | null = null;
        let number: number | null = null;
        let widgetRef: string | null = null;
        let widgetConfig: TableColumnAttrConfig | null = null;
        let readonly = false;

        const colonTokens = (remainder && remainder.match(/:\S+/g)) || [];
        const hashTokens = (remainder && remainder.match(/#[^\s]+/g)) || [];
        const numTokens = (remainder && remainder.match(/№\s*\d+/g)) || [];

        colonTokens.forEach((tok) => {
            const meta = resolveColonToken(tok.substring(1), allAttrs, dependencies);
            if (!meta) return;
            if (meta.kind === 'width') {
                width = meta.value;
                return;
            }
            if (meta.kind === 'builtin') {
                type = meta.widgetType;
                if (type === 'list') source = null;
                return;
            }
            if (meta.kind === 'widget_ref') {
                widgetRef = meta.value;
                widgetConfig = meta.config || widgetConfig;
                readonly =
                    readonly ||
                    !!(meta.config && meta.config.readonly === true);
                type = meta.widgetType || 'list';
                if (type === 'list') source = meta.value;
            }
        });

        if (hashTokens.length > 0) {
            format = hashTokens[0] || null;
            if (type === 'str') type = 'float';
        }

        if (numTokens.length > 0) {
            const mNum = numTokens[0]!.match(/\d+/);
            if (mNum) number = parseInt(mNum[0], 10);
        }

        let cleanLabel = label;
        [...colonTokens, ...hashTokens, ...numTokens].forEach((tok) => {
            cleanLabel = cleanLabel.replace(tok, '');
        });
        cleanLabel = cleanLabel
            .replace(/^\/+/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (!cleanLabel) cleanLabel = attrName;

        const resolvedType = normalizeWidgetType(type) || 'str';
        return {
            attr: attrName,
            label: cleanLabel,
            width,
            type: resolvedType,
            format,
            source,
            number,
            widgetRef,
            readonly,
            widgetConfig: widgetConfig || {},
            tableCellOptions: sanitizeTableCellOptions(resolvedType, widgetConfig),
            embeddedWidget: BUILTIN_WIDGET_TYPES.has(resolvedType)
        };
    }

    function buildHeaderRows(nodes: HeaderNode[], maxDepth: number): TableHeaderCell[][] {
        const headerRows = Array.from({ length: maxDepth }, () => [] as TableHeaderCell[]);

        function countLeaves(node: HeaderNode | null | undefined): number {
            if (!node) return 0;
            if (node.type === 'leaf') return 1;
            return (node.children || []).reduce(
                (acc: number, child: HeaderNode) => acc + countLeaves(child),
                0
            );
        }

        function walk(node: HeaderNode | null | undefined, level: number): void {
            if (!node) return;
            const rowCells = headerRows[level] || (headerRows[level] = []);
            if (node.type === 'leaf') {
                rowCells.push({
                    label: node.label,
                    colspan: 1,
                    rowspan: maxDepth - level,
                    width: node.width,
                    runtimeColIndex: node.runtimeColIndex ?? null,
                    leafColIndex: node.leafColIndex
                });
                return;
            }
            const colspan = (node.children || []).reduce(
                (acc: number, child: HeaderNode) => acc + countLeaves(child),
                0
            );
            rowCells.push({
                label: node.label,
                colspan,
                rowspan: 1,
                width: node.width,
                runtimeColIndex: null,
                leafColIndex: null
            });
            (node.children || []).forEach((child) => walk(child, level + 1));
        }

        nodes.forEach((node) => walk(node, 0));
        return headerRows;
    }

    function extractDependencies(tableAttrs: unknown): string[] {
        if (!tableAttrs) return [];
        const lines = String(tableAttrs).split('\n');
        const deps: string[] = [];
        lines.forEach((rawLine) => {
            const line = String(rawLine || '').trim();
            if (!line || line.startsWith('/')) return;
            const colonTokens = line.match(/:\S+/g) || [];
            colonTokens.forEach((tok) => {
                const token = tok.substring(1);
                if (/^\d+$/.test(token) || isBuiltinWidgetType(token)) return;
                uniqPush(deps, token);
            });
        });
        return deps;
    }

    function buildSchema(vm: TableParseVm, tableAttrs: unknown): TableSchema {
        const emptySchema: TableSchema = {
            runtimeColumns: [],
            leafColumns: [],
            headerRows: [],
            leafToRuntimeCol: [],
            runtimeToLeafMeta: [],
            dependencies: [],
            isLineNumbersEnabled: false
        };
        if (!tableAttrs) return emptySchema;

        const allAttrs = getAllAttrs(vm);
        const dependencies: string[] = [];
        const lines = String(tableAttrs).trim().split('\n');
        const leafColumns: ParsedLeafColumn[] = [];
        const nodes: HeaderNode[] = [];
        let currentGroup: (HeaderNode & { children: HeaderNode[]; type: 'group' }) | null = null;

        lines.forEach((rawLine) => {
            const line = String(rawLine || '').trim();
            if (!line) {
                currentGroup = null;
                return;
            }

            if (line.startsWith('/')) {
                const groupLabel = line.substring(1).trim();
                currentGroup = {
                    type: 'group',
                    label: groupLabel,
                    leafColIndex: null,
                    children: []
                };
                nodes.push(currentGroup);
                return;
            }

            const firstSlashIndex = line.indexOf('/');
            let attrName = '';
            let remainder = '';
            if (firstSlashIndex > 0) {
                attrName = line.substring(0, firstSlashIndex).trim();
                remainder = line.substring(firstSlashIndex + 1).trim();
            } else {
                const m = line.match(/^([^\s:#№]+)/);
                attrName = m?.[1] || line;
                remainder = line.slice(attrName.length).trim();
            }

            const leaf = parseLeafFromParts(
                vm,
                attrName,
                remainder,
                allAttrs,
                dependencies
            );
            leafColumns.push(leaf);
            const node: HeaderNode = {
                type: 'leaf',
                label: String(leaf.label || ''),
                width: leaf.width,
                leafColIndex: leafColumns.length - 1
            };
            if (currentGroup && currentGroup.type === 'group') {
                currentGroup.children.push(node);
            } else {
                nodes.push(node);
            }
        });

        const tableHasExplicitWidth =
            vm &&
            vm.widgetConfig &&
            vm.widgetConfig.width != null &&
            String(vm.widgetConfig.width).trim() !== '';

        leafColumns.forEach((col) => {
            if (!col.width && !tableHasExplicitWidth) {
                col.width = computeAutoWidthLabel(vm, col.label);
            }
        });

        if (tableHasExplicitWidth && leafColumns.length > 0) {
            const allExplicit = leafColumns.every(
                (c) => c.width != null && String(c.width).trim() !== ''
            );
            if (allExplicit) {
                leafColumns[leafColumns.length - 1].width = null;
            }
        }

        const isLineNumbersEnabled =
            vm && typeof vm.lineNumbersRuntimeEnabled === 'boolean'
                ? vm.lineNumbersRuntimeEnabled
                : !!(vm && vm.widgetConfig && vm.widgetConfig.line_numbers === true);
        const runtimeColumns: TableRuntimeColumn[] = [];
        const leafToRuntimeCol: number[] = [];
        const runtimeToLeafMeta: TableLeafMeta[] = [];

        if (isLineNumbersEnabled) {
            runtimeColumns.push({
                attr: LINE_NUMBER_ATTR,
                label: LINE_NUMBER_LABEL,
                width: LINE_NUMBER_WIDTH,
                type: 'line_number',
                format: null,
                source: null,
                number: null,
                widgetRef: null,
                readonly: true,
                widgetConfig: {},
                tableCellOptions: {},
                embeddedWidget: false,
                isLineNumber: true,
                runtimeColIndex: 0
            });
            runtimeToLeafMeta.push({
                leafColIndex: null,
                runtimeColIndex: 0,
                isLineNumber: true
            });
            nodes.unshift({
                type: 'leaf',
                label: LINE_NUMBER_LABEL,
                width: LINE_NUMBER_WIDTH,
                leafColIndex: null,
                runtimeColIndex: 0
            });
        }

        leafColumns.forEach((column, leafColIndex) => {
            const runtimeColIndex = runtimeColumns.length;
            const runtimeColumn = Object.assign({}, column, {
                isLineNumber: false,
                runtimeColIndex
            });
            runtimeColumns.push(runtimeColumn);
            leafToRuntimeCol.push(runtimeColIndex);
            runtimeToLeafMeta.push({
                leafColIndex,
                runtimeColIndex,
                isLineNumber: false
            });
        });

        let nodeLeafCursor = 0;
        function assignWidths(node: HeaderNode): void {
            if (node.type === 'leaf') {
                if (node.runtimeColIndex == null) {
                    const runtimeColIndex = isLineNumbersEnabled
                        ? nodeLeafCursor + 1
                        : nodeLeafCursor;
                    node.runtimeColIndex = runtimeColIndex;
                    node.leafColIndex = nodeLeafCursor;
                    const col = runtimeColumns[runtimeColIndex];
                    node.width =
                        tableHasExplicitWidth
                            ? col && col.width
                                ? col.width
                                : undefined
                            : col && col.width
                              ? col.width
                              : computeAutoWidthLabel(vm, node.label);
                    nodeLeafCursor += 1;
                    return;
                }
                const specialCol = runtimeColumns[node.runtimeColIndex];
                node.width = specialCol ? specialCol.width : node.width;
                return;
            }
            (node.children || []).forEach(assignWidths);
            if (tableHasExplicitWidth) {
                node.width = undefined;
                return;
            }
            const sumPx = (node.children || []).reduce((acc: number, child: HeaderNode) => {
                if (!child.width) return acc;
                const match = String(child.width).match(/\d+/);
                return acc + (match ? parseInt(match[0], 10) : 0);
            }, 0);
            node.width = sumPx ? `${sumPx}px` : undefined;
        }
        nodes.forEach(assignWidths);

        const maxDepth = Math.max(
            1,
            ...nodes.map((node) => (node.type === 'leaf' ? 1 : 2))
        );
        const headerRows = buildHeaderRows(nodes, maxDepth);

        return {
            runtimeColumns,
            leafColumns,
            headerRows,
            leafToRuntimeCol,
            runtimeToLeafMeta,
            dependencies,
            isLineNumbersEnabled
        };
    }

    function parseTableAttrs(vm: TableParseVm, tableAttrs: unknown): void {
        const schema = buildSchema(vm, tableAttrs);
        vm.tableSchema = schema;
        vm.tableColumns = schema.runtimeColumns;
        vm.headerRows = schema.headerRows;
    }

const TableSchema = {
    LINE_NUMBER_ATTR,
    LINE_NUMBER_LABEL,
    BUILTIN_WIDGET_TYPES,
    TABLE_CELL_ALLOWED_OPTIONS,
    buildSchema,
    buildHeaderRows,
    extractDependencies,
    isBuiltinWidgetType,
    sanitizeTableCellOptions
};

export {
    BUILTIN_WIDGET_TYPES,
    LINE_NUMBER_ATTR,
    LINE_NUMBER_LABEL,
    TABLE_CELL_ALLOWED_OPTIONS,
    buildSchema,
    buildHeaderRows,
    extractDependencies,
    isBuiltinWidgetType,
    parseTableAttrs,
    sanitizeTableCellOptions
};

export default TableSchema;
