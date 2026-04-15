import GuiParser from '../gui_parser.ts';
import frontendApiClient from './api_client.ts';
import PageRuntimeStore from './page_store.ts';
import PageSessionStore from './page_session_store.ts';
import type { PageViewHost, ParsedGuiState } from './page_contract.ts';
import { logDiagnosticsToConsole } from './diagnostics.ts';

function applyPagePayload(vm: PageViewHost, payload: unknown) {
    PageRuntimeStore.bootstrap(vm.configState, (payload || {}) as Record<string, unknown>);
    PageSessionStore.bootstrap(vm.sessionState, vm.configState);
    logDiagnosticsToConsole('page', vm.diagnostics);
    return vm.configState;
}

function parseGuiConfig(vm: PageViewHost): ParsedGuiState {
    const parsed = GuiParser
        ? GuiParser.parsePageGui(vm.pageConfig)
        : ({ menus: [], modals: {}, rootContentOnly: false } as ParsedGuiState);

    PageSessionStore.setParsedGui(vm.sessionState, parsed);
    vm.normalizeActiveState();

    if (!vm.menus.length) {
        console.warn('No menus found in GUI config');
    }

    return parsed as unknown as ParsedGuiState;
}

function parseAttrsConfig(vm: PageViewHost) {
    return PageSessionStore.initializeWidgetValues(vm.sessionState, vm.allAttrs);
}

function parseConfiguration(vm: PageViewHost) {
    parseGuiConfig(vm);
    parseAttrsConfig(vm);
}

async function loadPageConfig(vm: PageViewHost) {
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
