import GuiParser from '../gui_parser.ts';
import { asRecord } from '../shared/object_record.ts';
import frontendApiClient from './api_client.ts';
import PageRuntimeStore from './page_store.ts';
import PageSessionStore from './page_session_store.ts';
import type { PageViewHost, ParsedGuiState } from './page_contract.ts';
import { logDiagnosticsToConsole } from './diagnostics.ts';

const EMPTY_PARSED_GUI_STATE: ParsedGuiState = Object.freeze({
    menus: [],
    modals: {},
    rootContentOnly: false
});

function isParsedGuiState(value: unknown): value is ParsedGuiState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const candidate = value as Partial<ParsedGuiState>;
    return (
        Array.isArray(candidate.menus) &&
        !!candidate.modals &&
        typeof candidate.modals === 'object' &&
        !Array.isArray(candidate.modals) &&
        typeof candidate.rootContentOnly === 'boolean'
    );
}

function parsePageGuiState(rawConfig: unknown): ParsedGuiState {
    const parsed = GuiParser
        ? GuiParser.parsePageGui(rawConfig)
        : EMPTY_PARSED_GUI_STATE;

    if (!isParsedGuiState(parsed)) {
        throw new Error('GUI parser returned an invalid ParsedGuiState');
    }

    return parsed;
}

function applyPagePayload(vm: PageViewHost, payload: unknown) {
    PageRuntimeStore.bootstrap(vm.configState, asRecord(payload));
    PageSessionStore.bootstrap(vm.sessionState, vm.configState);
    logDiagnosticsToConsole('page', vm.diagnostics);
    return vm.configState;
}

function parseGuiConfig(vm: PageViewHost): ParsedGuiState {
    const parsed = parsePageGuiState(vm.pageConfig);

    PageSessionStore.setParsedGui(vm.sessionState, parsed);
    vm.normalizeActiveState();

    if (!vm.menus.length) {
        console.warn('No menus found in GUI config');
    }

    return parsed;
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
    parseGuiConfig,
    parsePageGuiState
};
