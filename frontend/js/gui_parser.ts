import type {
    ParsedGuiMenu,
    ParsedGuiModal,
    ParsedGuiSection,
    ParsedGuiState,
    ParsedGuiTab,
    UnknownRecord
} from './runtime/page_contract.ts';

type DynamicKey = {
    name: string;
    type: string;
};

type ParsedGuiRow = string | { widgets: string[] };

type ParsedGuiSectionRecord = ParsedGuiSection & {
    collapsible: boolean;
    hasFrame: boolean;
    icon: string;
    name: string;
    rows: ParsedGuiRow[];
    showHeader: boolean;
    type: 'box' | 'collapse';
};

type ParsedGuiModalRecord = ParsedGuiModal & {
    buttons: string[];
    content: ParsedGuiSectionRecord[];
    icon: string;
    id: string;
    name: string;
    tabs: ParsedGuiTab[];
};

const META_KEYS = new Set(['url', 'title']);
const raw = getComputedStyle(document.documentElement).getPropertyValue('--anim-ms');
const COLLAPSE_ANIM_MS = raw ? parseInt(String(raw).trim(), 10) : 350;

    function asRecord(value: unknown): UnknownRecord {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? (value as UnknownRecord)
            : {};
    }

    function parseDynamicKey(rawKey: unknown): DynamicKey {
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

    function splitNames(value: unknown): string[] {
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

    function normalizeRowEntry(entry: unknown): ParsedGuiRow[] {
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

    function normalizeRows(value: unknown): ParsedGuiRow[] {
        if (Array.isArray(value)) {
            return value.flatMap(normalizeRowEntry);
        }

        if (value === null || value === undefined) {
            return [];
        }

        return normalizeRowEntry({ row: value });
    }

    function createSection(
        type: unknown,
        name: unknown,
        options: { hasFrame?: boolean } = {}
    ): ParsedGuiSectionRecord {
        const sectionType = type === 'collapse' ? 'collapse' : 'box';

        return {
            type: sectionType,
            name: String(name || ''),
            icon: '',
            rows: [],
            collapsible: sectionType === 'collapse',
            showHeader: Boolean(name),
            hasFrame: options.hasFrame !== undefined ? options.hasFrame : false
        };
    }

    function addRowsToSection(
        section: ParsedGuiSectionRecord,
        entryType: string,
        value: unknown
    ): void {
        let rows: ParsedGuiRow[] = [];

        if (entryType === 'rows') {
            rows = normalizeRows(value);
        } else if (entryType === 'widgets') {
            rows = normalizeRowEntry({ widgets: value });
        } else {
            rows = normalizeRowEntry({ row: value });
        }

        rows.forEach((row) => section.rows.push(row));
    }

    function normalizeSection(type: unknown, name: unknown, body: unknown): ParsedGuiSectionRecord {
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

    function normalizeContentItems(items: unknown): {
        buttons: string[];
        content: ParsedGuiSectionRecord[];
        icon: string;
        tabs: ParsedGuiTab[];
    } {
        const content: ParsedGuiSectionRecord[] = [];
        const tabs: ParsedGuiTab[] = [];
        const buttons: string[] = [];
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

    function normalizeTab(name: unknown, items: unknown): ParsedGuiTab {
        const normalized = normalizeContentItems(items);

        return {
            name: String(name || ''),
            icon: normalized.icon,
            content: normalized.content
        };
    }

    function normalizeMenu(menuName: unknown, items: unknown): ParsedGuiMenu {
        const normalized = normalizeContentItems(items);

        return {
            name: String(menuName || ''),
            icon: normalized.icon,
            tabs: normalized.tabs,
            content: normalized.content
        };
    }

    function normalizeModal(
        modalId: unknown,
        modalName: unknown,
        items: unknown
    ): ParsedGuiModalRecord {
        const normalized = normalizeContentItems(items);

        return {
            id: String(modalId || ''),
            name: String(modalName || modalId || ''),
            icon: normalized.icon,
            tabs: normalized.tabs,
            content: normalized.content,
            buttons: normalized.buttons
        };
    }

    var ROOT_CONTENT_TYPES = new Set(['row', 'rows', 'widgets', 'box', 'collapse', 'icon', 'tab', 'button']);

    function parsePageGui(rawConfig: unknown): ParsedGuiState {
        const rawConfigRecord = asRecord(rawConfig);
        const gui = rawConfigRecord.gui && typeof rawConfigRecord.gui === 'object'
            ? asRecord(rawConfigRecord.gui)
            : rawConfigRecord;
        const menus: ParsedGuiMenu[] = [];
        const modals: Record<string, ParsedGuiModal> = {};
        const rootItems: Array<{ key: string; value: unknown }> = [];

        // Порядок: явный guiMenuKeys с бэкенда, иначе Object.entries (зависит от сериализатора)
        const keysToProcess = Array.isArray(rawConfigRecord.guiMenuKeys)
            ? rawConfigRecord.guiMenuKeys
                .map((key) => String(key || ''))
                .filter(function (key) { return gui[key] !== undefined; })
            : Object.keys(gui).filter(function (key) { return !META_KEYS.has(key); });

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
                var obj: Record<string, unknown> = {};
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

    function collectWidgetNamesFromRows(rows: unknown, names?: Set<string>): Set<string> {
        const target = names || new Set();

        if (!Array.isArray(rows)) {
            return target;
        }

        rows.forEach((row) => {
            if (!row || typeof row === 'string') {
                return;
            }

            const rowRecord = asRecord(row);
            if (Array.isArray(rowRecord.widgets)) {
                rowRecord.widgets.forEach((widgetName) => target.add(String(widgetName || '')));
            }

        });

        return target;
    }

    function collectWidgetNamesFromSections(sections: unknown, buttons?: unknown): string[] {
        const names = new Set<string>();

        if (Array.isArray(sections)) {
            sections.forEach((section) => {
                const sectionRecord = asRecord(section);
                collectWidgetNamesFromRows(sectionRecord.rows || [], names);
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

    function getMenuSections(
        menu: ParsedGuiMenu | ParsedGuiModal | null | undefined,
        tabIndex = 0
    ): ParsedGuiSection[] {
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

    function collectWidgetNamesFromMenu(
        menu: ParsedGuiMenu | null | undefined,
        tabIndex = 0
    ): string[] {
        return collectWidgetNamesFromSections(getMenuSections(menu, tabIndex));
    }

    function collectWidgetNamesFromModal(modal: ParsedGuiModal | null | undefined): string[] {
        if (!modal) {
            return [];
        }

        const names = new Set<string>();
        const modalRecord = asRecord(modal);

        if (Array.isArray(modalRecord.content)) {
            collectWidgetNamesFromRows(
                modalRecord.content.flatMap((section) => asRecord(section).rows || []),
                names
            );
        }

        if (Array.isArray(modalRecord.tabs)) {
            modalRecord.tabs.forEach((tab) => {
                const tabRecord = asRecord(tab);
                if (!Array.isArray(tabRecord.content)) {
                    return;
                }

                tabRecord.content.forEach((section) => {
                    collectWidgetNamesFromRows(asRecord(section).rows || [], names);
                });
            });
        }

        if (Array.isArray(modalRecord.buttons)) {
            modalRecord.buttons.forEach((buttonName) => {
                if (buttonName && buttonName !== 'CLOSE') {
                    names.add(buttonName);
                }
            });
        }

        return Array.from(names);
    }

    function isFontIcon(icon: unknown): boolean {
        return Boolean(icon) && String(icon).trim().startsWith('fas');
    }

    function getIconSrc(icon: unknown): string | null {
        const iconName = String(icon || '').trim();
        if (!iconName || isFontIcon(iconName)) {
            return null;
        }

        return '/templates/icons/' + iconName;
    }

    function onIconError(event: Event): void {
        const img = event && event.target instanceof HTMLElement ? event.target : null;
        if (!img) return;
        img.style.display = 'none';
        if (img.parentElement) {
            img.parentElement.style.display = 'none';
        }
    }

    /** Возвращает активные секции из меню/модалки (по вкладке или напрямую). */
    function getActiveSections(
        menuOrModal: ParsedGuiMenu | ParsedGuiModal | null | undefined,
        tabIndex = 0,
        tabs?: unknown
    ): ParsedGuiSection[] {
        if (!menuOrModal) return [];
        const tabArray = Array.isArray(tabs) ? tabs : [];
        if (tabArray.length) {
            const safeIndex = Math.max(0, Math.min(tabIndex, tabArray.length - 1));
            const activeTab = tabArray[safeIndex];
            return activeTab && Array.isArray(activeTab.content) ? activeTab.content : [];
        }
        return Array.isArray(menuOrModal.content) ? menuOrModal.content : [];
    }

    /**
     * Собирает модалку из ответа GET /api/modal-gui (поля name, icon, items).
     */
    function parseModalPayload(modalId: string, payload: unknown): ParsedGuiModalRecord {
        const payloadRecord = asRecord(payload);
        const items = Array.isArray(payloadRecord.items) ? payloadRecord.items : [];
        const rawName = payloadRecord.name != null ? String(payloadRecord.name).trim() : '';
        const modal = normalizeModal(modalId, rawName || modalId, items);
        if (typeof payloadRecord.icon === 'string' && payloadRecord.icon.trim()) {
            modal.icon = payloadRecord.icon.trim();
        }
        return modal;
    }

const GuiParser = {
    parseDynamicKey,
    parsePageGui,
    parseModalPayload,
    getMenuSections,
    collectWidgetNamesFromSections,
    collectWidgetNamesFromMenu,
    collectWidgetNamesFromModal,
    isFontIcon,
    getIconSrc,
    onIconError,
    getActiveSections,
    COLLAPSE_ANIM_MS
};

export {
    COLLAPSE_ANIM_MS,
    GuiParser,
    collectWidgetNamesFromMenu,
    collectWidgetNamesFromModal,
    collectWidgetNamesFromSections,
    getActiveSections,
    getIconSrc,
    getMenuSections,
    isFontIcon,
    onIconError,
    parseDynamicKey,
    parseModalPayload,
    parsePageGui
};

export default GuiParser;
