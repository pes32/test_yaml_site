import frontendApiClient from './api_client.js';
import PageRuntimeStore from './page_store.js';
import PageSessionStore from './page_session_store.js';
import { logDiagnosticsToConsole } from './diagnostics.js';
import { getModalMap, getParsedGuiState } from './page_selectors.js';

async function ensureModalDefinition(vm, modalName) {
    const parsedGui = getParsedGuiState(vm.sessionState);
    const modalMap = getModalMap(vm.sessionState);

    if (modalMap[modalName]) {
        PageSessionStore.markModalLoaded(vm.sessionState, modalName);
        return modalMap[modalName];
    }

    const payload = await frontendApiClient.fetchModal(vm.getCurrentPageName(), modalName);
    const normalized = PageRuntimeStore.mergeModalPayload(vm.configState, payload);
    const modal = normalized && normalized.modal ? normalized.modal : null;
    if (!modal) {
        return null;
    }

    PageSessionStore.mergeLoadedAttrNames(vm.sessionState, normalized.resolvedNames || []);
    PageSessionStore.initializeWidgetValues(vm.sessionState, vm.allAttrs);
    PageSessionStore.setParsedGui(vm.sessionState, {
        ...parsedGui,
        modals: {
            ...modalMap,
            [modalName]: modal
        }
    });
    PageSessionStore.markModalLoaded(vm.sessionState, modalName);
    logDiagnosticsToConsole('modal', vm.diagnostics);
    return modal;
}

export { ensureModalDefinition };
