/**
 * Парсинг table_attrs и построение tableColumns / headerRows на экземпляре виджета.
 */
(function (global) {
    'use strict';

    const Core = global.TableWidgetCore || (global.TableWidgetCore = {});

    function parseTableAttrs(vm, tableAttrs) {
        if (!tableAttrs) {
            vm.tableColumns = [];
            return;
        }

        const lines = tableAttrs.trim().split('\n');
        const columns = [];
        const nodes = [];
        let currentGroup = null;

        const parseLeafFromParts = (attrName, remainder) => {
            let label = '';
            let width = null;
            let type = 'str';
            let format = null;
            let source = null;
            let number = null;

            label = (remainder || attrName || '').trim();

            const colonTokens = (remainder && remainder.match(/:\S+/g)) || [];
            const hashTokens = (remainder && remainder.match(/#[^\s]+/g)) || [];
            const numTokens = (remainder && remainder.match(/№\s*\d+/g)) || [];

            colonTokens.forEach(tok => {
                const value = tok.substring(1);
                if (/^\d+$/.test(value)) {
                    width = value + 'px';
                } else if (value === 'ip' || value === 'ip_mask' || value === 'int' || value === 'float') {
                    type = value;
                } else {
                    source = value;
                    type = 'list';
                }
            });

            if (hashTokens && hashTokens.length > 0) {
                format = hashTokens[0];
                type = 'float';
            }

            if (numTokens && numTokens.length > 0) {
                const mNum = numTokens[0].match(/\d+/);
                if (mNum) number = parseInt(mNum[0], 10);
            }

            let cleanLabel = label;
            [...colonTokens, ...hashTokens, ...numTokens].forEach(tok => {
                cleanLabel = cleanLabel.replace(tok, '');
            });
            cleanLabel = cleanLabel.replace(/^\/+/, '').replace(/\s{2,}/g, ' ').trim();
            if (!cleanLabel) cleanLabel = attrName;

            const leaf = { type: 'leaf', label: cleanLabel, attr: attrName, width, dataType: type, format, source, number };
            return leaf;
        };

        const tableHasExplicitWidth =
            vm.widgetConfig &&
            vm.widgetConfig.width != null &&
            String(vm.widgetConfig.width).trim() !== '';

        lines.forEach(line => {
            line = line.trim();
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

            const leaf = parseLeafFromParts(attrName, remainder);
            const flatColumn = { attr: leaf.attr, label: leaf.label, type: leaf.dataType, width: leaf.width, format: leaf.format, source: leaf.source, number: leaf.number };
            columns.push(flatColumn);

            if (currentGroup && currentGroup.type === 'group') {
                currentGroup.children.push({ type: 'leaf', label: leaf.label, width: leaf.width });
            } else {
                nodes.push({ type: 'leaf', label: leaf.label, width: leaf.width });
            }
        });

        columns.forEach(col => {
            if (!col.width && !tableHasExplicitWidth) {
                col.width = vm.computeAutoWidth(col.label);
            }
        });

        if (tableHasExplicitWidth && columns.length > 0) {
            const allExplicit = columns.every(
                (c) => c.width != null && String(c.width).trim() !== ''
            );
            if (allExplicit) {
                columns[columns.length - 1].width = null;
            }
        }

        let leafIdx = 0;
        const assignWidths = (node) => {
            if (node.type === 'leaf') {
                const col = columns[leafIdx++];
                if (tableHasExplicitWidth) {
                    node.width = col && col.width ? col.width : undefined;
                } else {
                    node.width =
                        col && col.width ? col.width : vm.computeAutoWidth(node.label);
                }
            } else if (node.type === 'group') {
                node.children.forEach(assignWidths);
                if (tableHasExplicitWidth) {
                    node.width = undefined;
                } else {
                    const sumPx = node.children.reduce((acc, ch) => {
                        if (!ch.width) return acc;
                        const m = String(ch.width).match(/\d+/);
                        return acc + (m ? parseInt(m[0], 10) : 0);
                    }, 0);
                    node.width = sumPx ? `${sumPx}px` : undefined;
                }
            }
        };
        nodes.forEach(assignWidths);

        const countLeaves = (n) => n.type === 'leaf' ? 1 : n.children.reduce((acc, ch) => acc + countLeaves(ch), 0);
        const maxDepth = Math.max(1, ...nodes.map(n => n.type === 'leaf' ? 1 : 2));
        const headerRows = Array.from({ length: maxDepth }, () => []);

        const walk = (node, level) => {
            if (node.type === 'leaf') {
                headerRows[level].push({ label: node.label, colspan: 1, rowspan: maxDepth - level, width: node.width });
            } else if (node.type === 'group') {
                const colspan = node.children.reduce((acc, ch) => acc + countLeaves(ch), 0);
                headerRows[level].push({ label: node.label, colspan, rowspan: 1, width: node.width });
                node.children.forEach(ch => walk(ch, level + 1));
            }
        };
        nodes.forEach(n => walk(n, 0));

        vm.tableColumns = columns;
        vm.headerRows = headerRows;
    }

    Core.parseTableAttrs = parseTableAttrs;
})(typeof window !== 'undefined' ? window : this);
