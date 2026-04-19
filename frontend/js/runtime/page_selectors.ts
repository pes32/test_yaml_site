import GuiParser from '../gui_parser.ts';
import { resolveAttrConfig } from '../shared/attr_config.ts';
import { asRecord, isRecord } from '../shared/object_record.ts';
import type {
    AttrConfigMap,
    PageAttrConfig,
    PageConfigState,
    PageSessionState,
    ParsedGuiMenu,
    ParsedGuiModal,
    ParsedGuiState,
    ParsedGuiSection,
    ParsedGuiTab
} from './page_contract.ts';
import {
    isStatefulWidgetConfig,
    resolveInitialWidgetValue
} from './widget_contract.ts';

const EMPTY_PARSED_GUI: ParsedGuiState = Object.freeze({
    menus: [],
    modals: {},
    rootContentOnly: false
});

function getParsedGuiState(sessionState: PageSessionState | null | undefined): ParsedGuiState {
    const parsedGui = sessionState?.parsedGui;
    return isRecord(parsedGui)
        ? (parsedGui as ParsedGuiState)
        : EMPTY_PARSED_GUI;
}

function getMenus(sessionState: PageSessionState | null | undefined): ParsedGuiMenu[] {
    const parsedGui = getParsedGuiState(sessionState);
    return Array.isArray(parsedGui.menus) ? parsedGui.menus : [];
}

function getModalMap(sessionState: PageSessionState | null | undefined): Record<string, ParsedGuiModal> {
    const parsedGui = getParsedGuiState(sessionState);
    return asRecord<Record<string, ParsedGuiModal>>(parsedGui.modals);
}

function getRootContentOnly(sessionState: PageSessionState | null | undefined): boolean {
    const parsedGui = getParsedGuiState(sessionState);
    return Boolean(parsedGui.rootContentOnly);
}

function getActiveMenu(
    sessionState: PageSessionState | null | undefined,
    activeMenuIndex: number
): ParsedGuiMenu | null {
    const menus = getMenus(sessionState);
    return menus[Number(activeMenuIndex) || 0] || null;
}

function getActiveTabs(activeMenu: ParsedGuiMenu | null | undefined): ParsedGuiTab[] {
    return activeMenu && Array.isArray(activeMenu.tabs)
        ? activeMenu.tabs
        : [];
}

function getActiveSections(
    activeMenu: ParsedGuiMenu | null | undefined,
    activeTabIndex: number,
    activeTabs: ParsedGuiTab[]
): ParsedGuiSection[] {
    const sections = GuiParser
        ? GuiParser.getActiveSections(activeMenu, activeTabIndex, activeTabs)
        : [];
    return Array.isArray(sections) ? sections : [];
}

function collectActiveWidgetNames(
    activeMenu: ParsedGuiMenu | null | undefined,
    activeTabIndex: number
): string[] {
    if (!GuiParser || !activeMenu) {
        return [];
    }

    const names = GuiParser.collectWidgetNamesFromMenu(activeMenu, activeTabIndex);
    return Array.isArray(names) ? names.map((name) => String(name || '').trim()).filter(Boolean) : [];
}

function getCurrentPageName(configState: PageConfigState | null | undefined): string {
    const fromRuntime = configState?.pageName
        ? String(configState.pageName).trim()
        : '';
    if (fromRuntime) {
        return fromRuntime;
    }

    const pageConfig = configState?.pageConfig;
    const fromConfig = pageConfig?.name
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

function selectWidgetAttrs(attrsByName: AttrConfigMap | unknown, widgetName: string): PageAttrConfig {
    return resolveAttrConfig(attrsByName, widgetName);
}

function selectWidgetRuntimeValue(
    sessionState: PageSessionState | null | undefined,
    attrsByName: AttrConfigMap | unknown,
    widgetName: string
): unknown {
    const widgetConfig = selectWidgetAttrs(attrsByName, widgetName);
    if (!isStatefulWidgetConfig(widgetConfig)) {
        return undefined;
    }

    const widgetValues = asRecord(sessionState?.widgetValues);
    if (Object.prototype.hasOwnProperty.call(widgetValues, widgetName)) {
        return widgetValues[widgetName];
    }

    return resolveInitialWidgetValue(widgetConfig);
}

function getWidgetConfig(attrsByName: AttrConfigMap | unknown, widgetName: string): PageAttrConfig {
    return selectWidgetAttrs(attrsByName, widgetName);
}

function getWidgetValue(
    sessionState: PageSessionState | null | undefined,
    attrsByName: AttrConfigMap | unknown,
    widgetName: string
): unknown {
    const widgetValues = asRecord(sessionState?.widgetValues);
    if (Object.prototype.hasOwnProperty.call(widgetValues, widgetName)) {
        return widgetValues[widgetName];
    }

    const widgetConfig = selectWidgetAttrs(attrsByName, widgetName);
    if (isStatefulWidgetConfig(widgetConfig)) {
        return resolveInitialWidgetValue(widgetConfig);
    }

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
    selectWidgetAttrs,
    selectWidgetRuntimeValue,
    getWidgetConfig,
    getWidgetValue
};
