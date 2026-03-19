(function () {
    const META_KEYS = new Set(['url', 'title']);
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--anim-ms');
    const COLLAPSE_ANIM_MS = raw ? parseInt(String(raw).trim(), 10) : 350;

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

    function createSection(type, name, options) {
        const sectionType = type === 'collapse' ? 'collapse' : 'box';

        return {
            type: sectionType,
            name: name || '',
            icon: '',
            rows: [],
            collapsible: sectionType === 'collapse',
            showHeader: Boolean(name),
            hasFrame: options && options.hasFrame !== undefined ? options.hasFrame : false
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
        const section = createSection(type, name, { hasFrame: true });

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

    var ROOT_CONTENT_TYPES = new Set(['row', 'rows', 'widgets', 'box', 'collapse', 'icon', 'tab', 'button']);

    function parsePageGui(rawConfig) {
        const gui = rawConfig && rawConfig.gui ? rawConfig.gui : (rawConfig || {});
        const menus = [];
        const modals = {};
        const rootItems = [];

        // Порядок: явный guiMenuKeys с бэкенда, иначе Object.entries (зависит от сериализатора)
        const keysToProcess = Array.isArray(rawConfig && rawConfig.guiMenuKeys)
            ? rawConfig.guiMenuKeys.filter(function (k) { return gui[k] !== undefined; })
            : Object.keys(gui).filter(function (k) { return !META_KEYS.has(k); });

        keysToProcess.forEach(function (key) {
            const value = gui[key];
            if (value === undefined) return;

            const parsed = parseDynamicKey(key);
            if (parsed.type === 'menu') {
                menus.push(normalizeMenu(parsed.name, value));
                return;
            }

            if (ROOT_CONTENT_TYPES.has(parsed.type)) {
                rootItems.push({ key: key, value: value });
                return;
            }

            modals[parsed.type] = normalizeModal(parsed.type, parsed.name, value);
        });

        var rootContentOnly = false;
        if (menus.length === 0 && rootItems.length > 0) {
            var rootContentItems = rootItems.map(function (item) {
                var obj = {};
                obj[item.key] = item.value;
                return obj;
            });
            menus.push(normalizeMenu('', rootContentItems));
            rootContentOnly = true;
        }

        return {
            menus: menus,
            modals: modals,
            rootContentOnly: rootContentOnly
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

    function onIconError(event) {
        const img = event && event.target;
        if (!img) return;
        img.style.display = 'none';
        if (img.parentElement) {
            img.parentElement.style.display = 'none';
        }
    }

    /** Возвращает активные секции из меню/модалки (по вкладке или напрямую). */
    function getActiveSections(menuOrModal, tabIndex, tabs) {
        if (!menuOrModal) return [];
        const tabArray = Array.isArray(tabs) ? tabs : [];
        if (tabArray.length) {
            const safeIndex = Math.max(0, Math.min(tabIndex, tabArray.length - 1));
            const activeTab = tabArray[safeIndex];
            return activeTab && Array.isArray(activeTab.content) ? activeTab.content : [];
        }
        return Array.isArray(menuOrModal.content) ? menuOrModal.content : [];
    }

    window.GuiParser = {
        parseDynamicKey: parseDynamicKey,
        parsePageGui: parsePageGui,
        getMenuSections: getMenuSections,
        collectWidgetNamesFromSections: collectWidgetNamesFromSections,
        collectWidgetNamesFromMenu: collectWidgetNamesFromMenu,
        collectWidgetNamesFromModal: collectWidgetNamesFromModal,
        isFontIcon: isFontIcon,
        getIconSrc: getIconSrc,
        onIconError: onIconError,
        getActiveSections: getActiveSections,
        COLLAPSE_ANIM_MS
    };
})();
