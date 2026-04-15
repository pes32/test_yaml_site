import frontendApiClient from './api_client.ts';
import PageRuntimeStore from './page_store.ts';
import PageSessionStore from './page_session_store.ts';
import { logDiagnosticsToConsole } from './diagnostics.ts';
import { getModalMap, getParsedGuiState } from './page_selectors.ts';
import type {
    AttrConfigMap,
    ModalPayload,
    PageConfigState,
    PageSessionState,
    ParsedGuiModal
} from './page_contract.ts';

type ModalFlowHost = {
    allAttrs: AttrConfigMap;
    configState: PageConfigState;
    diagnostics: unknown[];
    getCurrentPageName(): string;
    sessionState: PageSessionState;
};

async function ensureModalDefinition(
    vm: ModalFlowHost,
    modalName: string
): Promise<ParsedGuiModal | null> {
    const parsedGui = getParsedGuiState(vm.sessionState);
    const modalMap = getModalMap(vm.sessionState);

    if (modalMap[modalName]) {
        PageSessionStore.markModalLoaded(vm.sessionState, modalName);
        return modalMap[modalName];
    }

    const payload = await frontendApiClient.fetchModal(vm.getCurrentPageName(), modalName) as ModalPayload;
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

export type { ModalFlowHost };

export { ensureModalDefinition };
