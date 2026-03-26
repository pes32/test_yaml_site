import GuiParser from '../gui_parser.js';

const EMPTY_PARSED_GUI = Object.freeze({
    menus: [],
    modals: {},
    rootContentOnly: false
});

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function getParsedGuiState(sessionState) {
    return asObject(sessionState && sessionState.parsedGui) || EMPTY_PARSED_GUI;
}

function getMenus(sessionState) {
    const parsedGui = getParsedGuiState(sessionState);
    return Array.isArray(parsedGui.menus) ? parsedGui.menus : [];
}

function getModalMap(sessionState) {
    const parsedGui = getParsedGuiState(sessionState);
    return asObject(parsedGui.modals);
}

function getRootContentOnly(sessionState) {
    const parsedGui = getParsedGuiState(sessionState);
    return Boolean(parsedGui.rootContentOnly);
}

function getActiveMenu(sessionState, activeMenuIndex) {
    const menus = getMenus(sessionState);
    return menus[Number(activeMenuIndex) || 0] || null;
}

function getActiveTabs(activeMenu) {
    return activeMenu && Array.isArray(activeMenu.tabs)
        ? activeMenu.tabs
        : [];
}

function getActiveSections(activeMenu, activeTabIndex, activeTabs) {
    return GuiParser
        ? GuiParser.getActiveSections(activeMenu, activeTabIndex, activeTabs)
        : [];
}

function collectActiveWidgetNames(activeMenu, activeTabIndex) {
    if (!GuiParser || !activeMenu) {
        return [];
    }

    return GuiParser.collectWidgetNamesFromMenu(activeMenu, activeTabIndex);
}

function getCurrentPageName(configState) {
    const fromRuntime = configState && configState.pageName
        ? String(configState.pageName).trim()
        : '';
    if (fromRuntime) {
        return fromRuntime;
    }

    const pageConfig = configState && configState.pageConfig;
    const fromConfig = pageConfig && pageConfig.name
        ? String(pageConfig.name).trim()
        : '';
    if (fromConfig) {
        return fromConfig;
    }

    const fromBody = typeof document !== 'undefined' && document.body
        ? String(document.body.dataset.pageName || '').trim()
        : '';
    return fromBody || '';
}

function getWidgetConfig(attrsByName, widgetName) {
    const attrs = asObject(attrsByName);
    return attrs[widgetName] || {
        widget: 'str',
        label: widgetName
    };
}

function getWidgetValue(sessionState, attrsByName, widgetName) {
    const widgetValues = asObject(sessionState && sessionState.widgetValues);
    if (Object.prototype.hasOwnProperty.call(widgetValues, widgetName)) {
        return widgetValues[widgetName];
    }

    const widgetConfig = getWidgetConfig(attrsByName, widgetName);
    return widgetConfig && widgetConfig.default !== undefined
        ? widgetConfig.default
        : null;
}

export {
    EMPTY_PARSED_GUI,
    collectActiveWidgetNames,
    getActiveMenu,
    getActiveSections,
    getActiveTabs,
    getCurrentPageName,
    getMenus,
    getModalMap,
    getParsedGuiState,
    getRootContentOnly,
    getWidgetConfig,
    getWidgetValue
};
