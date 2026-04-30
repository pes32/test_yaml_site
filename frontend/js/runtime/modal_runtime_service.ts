import widgetFactory from '../widgets/factory.ts';
import frontendApiClient from './api_client.ts';
import { ensureAttrsLoaded as ensureAttrsLoadedFlow } from './attrs_loader.ts';
import { logDiagnosticsToConsole } from './diagnostics.ts';
import { FRONTEND_ERROR_SCOPES } from './error_model.ts';
import {
  ModalRuntimeStore,
  beginModalRequest,
  closeModal,
  completeModalRequest,
  createEmptyModalRuntimeState,
  failModalRequest,
  getActiveModalViewId,
  getModalSectionCollapseId,
  getModalTabs,
  getModalTitle,
  isModalOpen,
  isModalSectionCollapsed,
  rememberActiveModalScroll,
  restoreActiveModalScroll,
  asModalConfig,
  setActiveModalTab,
  toggleModalSectionCollapse,
  type ModalConfigRecord,
  type ModalRuntimeState
} from './modal_runtime_store.ts';
import {
  collectWidgetNamesFromModalConfig,
  getModalMap,
  getParsedGuiState
} from './page_selectors.ts';
import PageRuntimeStore from './page_store.ts';
import PageSessionStore from './page_session_store.ts';
import type {
  AttrConfigMap,
  ModalPayload,
  PageConfigState,
  PageSessionState,
  ParsedGuiModal
} from './page_contract.ts';

type ModalDefinitionHost = {
  allAttrs: AttrConfigMap;
  configState: PageConfigState;
  diagnostics: unknown[];
  getCurrentPageName(): string;
  sessionState: PageSessionState;
};

type ModalRuntimeVm = Record<string, unknown> & ModalDefinitionHost & {
  getWidgetConfig?: (widgetName: string) => { widget?: unknown } | null;
  handleRecoverableError?: (error: unknown, options?: Record<string, unknown>) => unknown;
  prefetchWidgetsByNames?: (names: string[]) => Promise<unknown> | void;
};

type ModalRuntimeController = {
  closeModal: () => void;
  getModalSectionCollapseId: (tabIndex: number, sectionIndex: number) => string;
  isModalSectionCollapsed: (tabIndex: number, sectionIndex: number) => boolean;
  openModal: (modalName: string) => Promise<unknown>;
  setActiveTab: (index: number) => void;
  toggleModalSectionCollapse: (tabIndex: number, sectionIndex: number) => void;
};

async function ensureModalDefinition(
  vm: ModalDefinitionHost,
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
  const modal = normalized?.modal || null;
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
  logDiagnosticsToConsole('modal', vm.diagnostics || []);
  return modal;
}

function getModalConfig(state: ModalRuntimeState | null | undefined): ModalConfigRecord | null {
  return asModalConfig(state);
}

function sectionsForTab(state: ModalRuntimeState | null | undefined, tabIndex: number): unknown[] {
  const modalConfig = asModalConfig(state);
  if (!modalConfig) {
    return [];
  }

  const tabs = getModalTabs(state);
  if (tabs.length) {
    const safeIndex = Math.max(0, Math.min(Number(tabIndex) || 0, tabs.length - 1));
    const activeTab = tabs[safeIndex] as Record<string, unknown> | undefined;
    return Array.isArray(activeTab?.content) ? activeTab.content : [];
  }

  return Array.isArray(modalConfig.content) ? modalConfig.content : [];
}

function collectModalWidgetNames(state: ModalRuntimeState | null | undefined): string[] {
  return collectWidgetNamesFromModalConfig(asModalConfig(state));
}

async function prefetchModalWidgetTypes(
  vm: ModalRuntimeVm,
  widgetNames: string[]
): Promise<void> {
  if (!widgetNames.length) {
    return;
  }

  if (typeof vm.prefetchWidgetsByNames === 'function') {
    await vm.prefetchWidgetsByNames(widgetNames);
    return;
  }

  const widgetTypes = widgetNames
    .map((name) => (typeof vm.getWidgetConfig === 'function' ? vm.getWidgetConfig(name) : null))
    .map((config) => (config && typeof config.widget === 'string' ? config.widget : ''))
    .filter(Boolean);

  await widgetFactory.prefetchWidgetTypes(widgetTypes);
}

async function openModal(
  vm: ModalRuntimeVm,
  state: ModalRuntimeState,
  modalName: string
): Promise<unknown> {
  const requestToken = beginModalRequest(state, modalName);

  try {
    const modal = await ensureModalDefinition(vm, modalName);
    if (!modal) {
      throw new Error(`Не удалось определить конфигурацию модального окна "${modalName}"`);
    }

    const pendingState = {
      ...state,
      modalConfig: modal as ModalConfigRecord
    };
    const requiredWidgetNames = collectModalWidgetNames(pendingState);
    if (requiredWidgetNames.length) {
      await ensureAttrsLoadedFlow(vm as Parameters<typeof ensureAttrsLoadedFlow>[0], requiredWidgetNames);
      if (state.requestToken !== requestToken) {
        return modal;
      }

      void prefetchModalWidgetTypes(vm, requiredWidgetNames);
    }

    completeModalRequest(state, requestToken, modalName, modal as ModalConfigRecord);
    return modal;
  } catch (error) {
    const normalized = typeof vm.handleRecoverableError === 'function'
      ? vm.handleRecoverableError(error, {
        scope: FRONTEND_ERROR_SCOPES.modal,
        message: `Не удалось открыть модальное окно "${modalName}"`
      })
      : error;

    failModalRequest(state, requestToken, normalized);
    throw normalized;
  }
}

function createModalRuntimeController(
  vm: ModalRuntimeVm,
  state: ModalRuntimeState
): ModalRuntimeController {
  return {
    closeModal: () => closeModal(state),
    getModalSectionCollapseId: (tabIndex, sectionIndex) =>
      getModalSectionCollapseId(state, tabIndex, sectionIndex),
    isModalSectionCollapsed: (tabIndex, sectionIndex) =>
      isModalSectionCollapsed(state, tabIndex, sectionIndex),
    openModal: (modalName) => openModal(vm, state, modalName),
    setActiveTab: (index) => setActiveModalTab(state, index),
    toggleModalSectionCollapse: (tabIndex, sectionIndex) =>
      toggleModalSectionCollapse(state, tabIndex, sectionIndex)
  };
}

export type { ModalConfigRecord, ModalRuntimeController, ModalRuntimeState };

export {
  ModalRuntimeStore,
  closeModal,
  collectModalWidgetNames,
  createEmptyModalRuntimeState,
  createModalRuntimeController,
  getActiveModalViewId,
  getModalConfig,
  getModalSectionCollapseId,
  getModalTabs,
  getModalTitle,
  isModalOpen,
  isModalSectionCollapsed,
  openModal,
  rememberActiveModalScroll,
  restoreActiveModalScroll,
  sectionsForTab,
  setActiveModalTab,
  toggleModalSectionCollapse
};
