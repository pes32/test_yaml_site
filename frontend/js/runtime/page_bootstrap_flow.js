import GuiParser from '../gui_parser.js';
import frontendApiClient from './api_client.js';
import PageRuntimeStore from './page_store.js';
import PageSessionStore from './page_session_store.js';
import { logDiagnosticsToConsole } from './diagnostics.js';

function applyPagePayload(vm, payload) {
    PageRuntimeStore.bootstrap(vm.configState, payload || {});
    PageSessionStore.bootstrap(vm.sessionState, vm.configState);
    logDiagnosticsToConsole('page', vm.diagnostics);
    return vm.configState;
}

function parseGuiConfig(vm) {
    const parsed = GuiParser
        ? GuiParser.parsePageGui(vm.pageConfig)
        : { menus: [], modals: {}, rootContentOnly: false };

    PageSessionStore.setParsedGui(vm.sessionState, parsed);
    vm.normalizeActiveState();

    if (!vm.menus.length) {
        console.warn('No menus found in GUI config');
    }

    return parsed;
}

function parseAttrsConfig(vm) {
    return PageSessionStore.initializeWidgetValues(vm.sessionState, vm.allAttrs);
}

function parseConfiguration(vm) {
    parseGuiConfig(vm);
    parseAttrsConfig(vm);
}

async function loadPageConfig(vm) {
    const pageName = vm.getCurrentPageName();
    if (!pageName) {
        throw new Error('Не удалось определить имя страницы для загрузки bootstrap');
    }

    const data = await frontendApiClient.fetchPage(pageName);
    applyPagePayload(vm, data);
    parseConfiguration(vm);
    return data;
}

export {
    applyPagePayload,
    loadPageConfig,
    parseAttrsConfig,
    parseConfiguration,
    parseGuiConfig
};
