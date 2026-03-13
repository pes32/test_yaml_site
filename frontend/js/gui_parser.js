(function () {
    const META_KEYS = new Set(['url', 'title', 'description']);

    function parseDynamicKey(rawKey) {
        const key = String(rawKey || '').trim();
        const match = key.match(/^(.+?)(?:\s+"([^"]*)")?$/);

        if (!match) {
            return { type: key, name: '' };
        }

        return {
            type: String(match[1] || '').trim(),
            name: match[2] !== undefined ? match[2] : ''
        };
    }

    function splitNames(value) {
        if (Array.isArray(value)) {
            return value
                .flatMap(splitNames)
                .map((item) => String(item).trim())
                .filter(Boolean);
        }

        if (value === null || value === undefined) {
            return [];
        }

        return String(value)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function normalizeColumns(value) {
        if (!value) {
            return null;
        }

        const columns = {};

        if (Array.isArray(value)) {
            value.forEach((column, index) => {
                const widgets = splitNames(column);
                if (widgets.length) {
                    columns[index] = { widgets: widgets };
                }
            });
            return Object.keys(columns).length ? columns : null;
        }

        if (typeof value !== 'object') {
            return null;
        }

        Object.entries(value).forEach(([name, column]) => {
            if (column && typeof column === 'object' && Array.isArray(column.widgets)) {
                const widgets = splitNames(column.widgets);
                if (widgets.length) {
                    columns[name] = { widgets: widgets };
                }
                return;
            }

            const widgets = splitNames(column);
            if (widgets.length) {
                columns[name] = { widgets: widgets };
            }
        });

        return Object.keys(columns).length ? columns : null;
    }

    function normalizeRowEntry(entry) {
        if (entry === null || entry === undefined) {
            return [];
        }

        if (typeof entry === 'string') {
            return [entry];
        }

        if (Array.isArray(entry)) {
            return entry.flatMap(normalizeRowEntry);
        }

        if (typeof entry !== 'object') {
            return [];
        }

        const firstEntry = Object.entries(entry)[0];
        if (!firstEntry) {
            return [];
        }

        const [rawKey, rawValue] = firstEntry;
        const parsed = parseDynamicKey(rawKey);

        if (parsed.type === 'row' || parsed.type === 'widgets') {
            const widgets = splitNames(rawValue);
            return widgets.length ? [{ widgets: widgets }] : [];
        }

        if (parsed.type === 'rows') {
            return normalizeRows(rawValue);
        }

        if (parsed.type === 'columns') {
            const columns = normalizeColumns(rawValue);
            return columns ? [{ columns: columns }] : [];
        }

        return [];
    }

    function normalizeRows(value) {
        if (Array.isArray(value)) {
            return value.flatMap(normalizeRowEntry);
        }

        if (value === null || value === undefined) {
            return [];
        }

        return normalizeRowEntry({ row: value });
    }

    function createSection(type, name) {
        const sectionType = type === 'collapse' ? 'collapse' : 'box';

        return {
            type: sectionType,
            name: name || '',
            icon: '',
            rows: [],
            collapsible: sectionType === 'collapse',
            showHeader: Boolean(name)
        };
    }

    function addRowsToSection(section, entryType, value) {
        let rows = [];

        if (entryType === 'rows') {
            rows = normalizeRows(value);
        } else if (entryType === 'widgets') {
            rows = normalizeRowEntry({ widgets: value });
        } else {
            rows = normalizeRowEntry({ row: value });
        }

        rows.forEach((row) => section.rows.push(row));
    }

    function normalizeSection(type, name, body) {
        const section = createSection(type, name);

        if (Array.isArray(body)) {
            body.forEach((item) => {
                if (typeof item === 'string') {
                    section.rows.push(item);
                    return;
                }

                if (!item || typeof item !== 'object') {
                    return;
                }

                const firstEntry = Object.entries(item)[0];
                if (!firstEntry) {
                    return;
                }

                const [rawKey, rawValue] = firstEntry;
                const parsed = parseDynamicKey(rawKey);

                if (parsed.type === 'icon') {
                    section.icon = String(rawValue || '').trim();
                    return;
                }

                if (parsed.type === 'row' || parsed.type === 'rows' || parsed.type === 'widgets') {
                    addRowsToSection(section, parsed.type, rawValue);
                    return;
                }

                if (parsed.type === 'columns') {
                    const columns = normalizeColumns(rawValue);
                    if (columns) {
                        section.rows.push({ columns: columns });
                    }
                }
            });

            return section;
        }

        addRowsToSection(section, 'row', body);
        return section;
    }

    function normalizeContentItems(items) {
        const content = [];
        const tabs = [];
        const buttons = [];
        let icon = '';
        let looseSection = createSection('box', '');

        function flushLooseSection() {
            if (!looseSection.rows.length) {
                return;
            }

            content.push(looseSection);
            looseSection = createSection('box', '');
        }

        if (!Array.isArray(items)) {
            return {
                icon: icon,
                tabs: tabs,
                content: content,
                buttons: buttons
            };
        }

        items.forEach((item) => {
            if (typeof item === 'string') {
                looseSection.rows.push(item);
                return;
            }

            if (!item || typeof item !== 'object') {
                return;
            }

            const firstEntry = Object.entries(item)[0];
            if (!firstEntry) {
                return;
            }

            const [rawKey, rawValue] = firstEntry;
            const parsed = parseDynamicKey(rawKey);

            if (parsed.type === 'icon') {
                icon = String(rawValue || '').trim();
                return;
            }

            if (parsed.type === 'button') {
                buttons.push(...splitNames(rawValue));
                return;
            }

            if (parsed.type === 'tab') {
                flushLooseSection();
                tabs.push(normalizeTab(parsed.name, rawValue));
                return;
            }

            if (parsed.type === 'box' || parsed.type === 'collapse') {
                flushLooseSection();
                content.push(normalizeSection(parsed.type, parsed.name, rawValue));
                return;
            }

            if (parsed.type === 'row' || parsed.type === 'rows' || parsed.type === 'widgets') {
                addRowsToSection(looseSection, parsed.type, rawValue);
                return;
            }

            if (parsed.type === 'columns') {
                const columns = normalizeColumns(rawValue);
                if (columns) {
                    looseSection.rows.push({ columns: columns });
                }
            }
        });

        flushLooseSection();

        return {
            icon: icon,
            tabs: tabs,
            content: content,
            buttons: buttons
        };
    }

    function normalizeTab(name, items) {
        const normalized = normalizeContentItems(items);

        return {
            name: name || '',
            icon: normalized.icon,
            content: normalized.content
        };
    }

    function normalizeMenu(menuName, items) {
        const normalized = normalizeContentItems(items);

        return {
            name: menuName || '',
            icon: normalized.icon,
            tabs: normalized.tabs,
            content: normalized.content
        };
    }

    function normalizeModal(modalId, modalName, items) {
        const normalized = normalizeContentItems(items);

        return {
            id: modalId,
            name: modalName || modalId,
            icon: normalized.icon,
            tabs: normalized.tabs,
            content: normalized.content,
            buttons: normalized.buttons
        };
    }

    function parsePageGui(rawConfig) {
        const gui = rawConfig && rawConfig.gui ? rawConfig.gui : (rawConfig || {});
        const menus = [];
        const modals = {};

        Object.entries(gui).forEach(([key, value]) => {
            if (META_KEYS.has(key)) {
                return;
            }

            const parsed = parseDynamicKey(key);
            if (parsed.type === 'menu') {
                menus.push(normalizeMenu(parsed.name, value));
                return;
            }

            modals[parsed.type] = normalizeModal(parsed.type, parsed.name, value);
        });

        return {
            menus: menus,
            modals: modals
        };
    }

    function collectWidgetNamesFromRows(rows, names) {
        const target = names || new Set();

        if (!Array.isArray(rows)) {
            return target;
        }

        rows.forEach((row) => {
            if (!row || typeof row === 'string') {
                return;
            }

            if (row.widgets && Array.isArray(row.widgets)) {
                row.widgets.forEach((widgetName) => target.add(widgetName));
            }

            if (row.columns && typeof row.columns === 'object') {
                Object.values(row.columns).forEach((column) => {
                    if (column && Array.isArray(column.widgets)) {
                        column.widgets.forEach((widgetName) => target.add(widgetName));
                    }
                });
            }
        });

        return target;
    }

    function collectWidgetNamesFromSections(sections, buttons) {
        const names = new Set();

        if (Array.isArray(sections)) {
            sections.forEach((section) => {
                collectWidgetNamesFromRows(section.rows || [], names);
            });
        }

        if (Array.isArray(buttons)) {
            buttons.forEach((buttonName) => {
                if (buttonName && buttonName !== 'CLOSE') {
                    names.add(buttonName);
                }
            });
        }

        return Array.from(names);
    }

    function getMenuSections(menu, tabIndex) {
        if (!menu) {
            return [];
        }

        if (Array.isArray(menu.tabs) && menu.tabs.length) {
            const safeIndex = Math.max(0, Math.min(tabIndex || 0, menu.tabs.length - 1));
            const tab = menu.tabs[safeIndex];
            return tab && Array.isArray(tab.content) ? tab.content : [];
        }

        return Array.isArray(menu.content) ? menu.content : [];
    }

    function collectWidgetNamesFromMenu(menu, tabIndex) {
        return collectWidgetNamesFromSections(getMenuSections(menu, tabIndex));
    }

    function collectWidgetNamesFromModal(modal) {
        if (!modal) {
            return [];
        }

        const names = new Set();

        if (Array.isArray(modal.content)) {
            collectWidgetNamesFromRows(
                modal.content.flatMap((section) => section.rows || []),
                names
            );
        }

        if (Array.isArray(modal.tabs)) {
            modal.tabs.forEach((tab) => {
                if (!tab || !Array.isArray(tab.content)) {
                    return;
                }

                tab.content.forEach((section) => {
                    collectWidgetNamesFromRows(section.rows || [], names);
                });
            });
        }

        if (Array.isArray(modal.buttons)) {
            modal.buttons.forEach((buttonName) => {
                if (buttonName && buttonName !== 'CLOSE') {
                    names.add(buttonName);
                }
            });
        }

        return Array.from(names);
    }

    function isFontIcon(icon) {
        return Boolean(icon) && String(icon).trim().startsWith('fas');
    }

    function getIconSrc(icon) {
        const iconName = String(icon || '').trim();
        if (!iconName || isFontIcon(iconName)) {
            return null;
        }

        return '/templates/icons/' + iconName;
    }

    window.GuiParser = {
        parseDynamicKey: parseDynamicKey,
        parsePageGui: parsePageGui,
        getMenuSections: getMenuSections,
        collectWidgetNamesFromSections: collectWidgetNamesFromSections,
        collectWidgetNamesFromMenu: collectWidgetNamesFromMenu,
        collectWidgetNamesFromModal: collectWidgetNamesFromModal,
        isFontIcon: isFontIcon,
        getIconSrc: getIconSrc
    };
})();
