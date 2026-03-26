/**
 * Canonical schema для table_attrs: runtimeColumns / leafColumns / headerRows / dependencies.
 */
import tableEngine from './table_core.js';

const Core = tableEngine;
    const LINE_NUMBER_ATTR = '__line_numbers__';
    const LINE_NUMBER_LABEL = '№';
    const LINE_NUMBER_WIDTH = '64px';
    const BUILTIN_WIDGET_TYPES = new Set([
        'str',
        'int',
        'float',
        'date',
        'time',
        'datetime',
        'list',
        'ip',
        'ip_mask'
    ]);
    const TABLE_CELL_ALLOWED_OPTIONS = {
        str: ['placeholder', 'regex', 'err_text', 'default'],
        int: ['placeholder', 'regex', 'err_text', 'default'],
        float: ['placeholder', 'regex', 'err_text', 'default'],
        date: ['default'],
        time: ['default'],
        datetime: ['default'],
        list: ['source', 'editable', 'multiselect', 'default'],
        ip: ['placeholder', 'regex', 'err_text', 'default'],
        ip_mask: ['placeholder', 'regex', 'err_text', 'default']
    };

    function computeAutoWidthLabel(vm, label) {
        const M = Core.WidgetMeasure;
        const tableEl =
            typeof vm.getTableEl === 'function' ? vm.getTableEl() : null;
        if (M && typeof M.computeAutoWidth === 'function') {
            return M.computeAutoWidth(
                label,
                M.headerSortAffordancePx(vm.widgetConfig),
                tableEl
            );
        }
        return `${Math.min(500, String(label || '').length * 10 + 50)}px`;
    }

    function uniqPush(list, value) {
        const key = String(value || '').trim();
        if (!key || list.indexOf(key) >= 0) return;
        list.push(key);
    }

    function isBuiltinWidgetType(token) {
        return BUILTIN_WIDGET_TYPES.has(String(token || '').trim());
    }

    function normalizeWidgetType(token) {
        const key = String(token || '').trim();
        return isBuiltinWidgetType(key) ? key : '';
    }

    function sanitizeTableCellOptions(type, widgetConfig) {
        const widgetType = normalizeWidgetType(type);
        const cfg =
            widgetConfig && typeof widgetConfig === 'object' ? widgetConfig : {};
        const allowed = TABLE_CELL_ALLOWED_OPTIONS[widgetType] || [];
        const out = {};
        allowed.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(cfg, key)) return;
            const value = cfg[key];
            if (key === 'source' && Array.isArray(value)) {
                out.source = value.slice();
                return;
            }
            out[key] = value;
        });
        return out;
    }

    function getAllAttrs(vm) {
        if (vm && typeof vm.getAllAttrsMap === 'function') {
            const attrs = vm.getAllAttrsMap();
            if (attrs && typeof attrs === 'object') {
                return attrs;
            }
        }
        return {};
    }

    function resolveColonToken(token, allAttrs, dependencies) {
        const key = String(token || '').trim();
        if (!key) return null;
        if (/^\d+$/.test(key)) return { kind: 'width', value: `${key}px` };
        const attrCfg =
            allAttrs && allAttrs[key] && typeof allAttrs[key] === 'object'
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

    function parseLeafFromParts(vm, attrName, remainder, allAttrs, dependencies) {
        let label = (remainder || attrName || '').trim();
        let width = null;
        let type = 'str';
        let format = null;
        let source = null;
        let number = null;
        let widgetRef = null;
        let widgetConfig = null;
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
            format = hashTokens[0];
            if (type === 'str') type = 'float';
        }

        if (numTokens.length > 0) {
            const mNum = numTokens[0].match(/\d+/);
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

    function buildHeaderRows(nodes, maxDepth) {
        const headerRows = Array.from({ length: maxDepth }, () => []);

        function countLeaves(node) {
            if (!node) return 0;
            if (node.type === 'leaf') return 1;
            return node.children.reduce((acc, child) => acc + countLeaves(child), 0);
        }

        function walk(node, level) {
            if (!node) return;
            if (node.type === 'leaf') {
                headerRows[level].push({
                    label: node.label,
                    colspan: 1,
                    rowspan: maxDepth - level,
                    width: node.width,
                    runtimeColIndex: node.runtimeColIndex,
                    leafColIndex: node.leafColIndex
                });
                return;
            }
            const colspan = node.children.reduce(
                (acc, child) => acc + countLeaves(child),
                0
            );
            headerRows[level].push({
                label: node.label,
                colspan,
                rowspan: 1,
                width: node.width,
                runtimeColIndex: null,
                leafColIndex: null
            });
            node.children.forEach((child) => walk(child, level + 1));
        }

        nodes.forEach((node) => walk(node, 0));
        return headerRows;
    }

    function extractDependencies(tableAttrs) {
        if (!tableAttrs) return [];
        const lines = String(tableAttrs).split('\n');
        const deps = [];
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

    function buildSchema(vm, tableAttrs) {
        const emptySchema = {
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
        const dependencies = [];
        const lines = String(tableAttrs).trim().split('\n');
        const leafColumns = [];
        const nodes = [];
        let currentGroup = null;

        lines.forEach((rawLine) => {
            const line = String(rawLine || '').trim();
            if (!line) {
                currentGroup = null;
                return;
            }

            if (line.startsWith('/')) {
                const groupLabel = line.substring(1).trim();
                currentGroup = { type: 'group', label: groupLabel, children: [] };
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
                attrName = m ? m[1] : line;
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
            const node = {
                type: 'leaf',
                label: leaf.label,
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

        const isLineNumbersEnabled = !!(
            vm &&
            vm.widgetConfig &&
            vm.widgetConfig.line_numbers === true
        );
        const runtimeColumns = [];
        const leafToRuntimeCol = [];
        const runtimeToLeafMeta = [];

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
        function assignWidths(node) {
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
            node.children.forEach(assignWidths);
            if (tableHasExplicitWidth) {
                node.width = undefined;
                return;
            }
            const sumPx = node.children.reduce((acc, child) => {
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

    function parseTableAttrs(vm, tableAttrs) {
        const schema = buildSchema(vm, tableAttrs);
        vm.tableSchema = schema;
        vm.tableColumns = schema.runtimeColumns;
        vm.headerRows = schema.headerRows;
    }

    Core.parseTableAttrs = parseTableAttrs;
    Core.TableSchema.LINE_NUMBER_ATTR = LINE_NUMBER_ATTR;
    Core.TableSchema.LINE_NUMBER_LABEL = LINE_NUMBER_LABEL;
    Core.TableSchema.BUILTIN_WIDGET_TYPES = BUILTIN_WIDGET_TYPES;
    Core.TableSchema.TABLE_CELL_ALLOWED_OPTIONS = TABLE_CELL_ALLOWED_OPTIONS;
    Core.TableSchema.buildSchema = buildSchema;
    Core.TableSchema.extractDependencies = extractDependencies;
    Core.TableSchema.isBuiltinWidgetType = isBuiltinWidgetType;
    Core.TableSchema.sanitizeTableCellOptions = sanitizeTableCellOptions;

export {
    BUILTIN_WIDGET_TYPES,
    LINE_NUMBER_ATTR,
    LINE_NUMBER_LABEL,
    TABLE_CELL_ALLOWED_OPTIONS,
    buildSchema,
    extractDependencies,
    isBuiltinWidgetType,
    parseTableAttrs,
    sanitizeTableCellOptions
};

export default Core.TableSchema;
