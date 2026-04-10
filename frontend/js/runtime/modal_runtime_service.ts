import GuiParser from '../gui_parser.js';
import widgetFactory from '../widgets/factory.ts';
import { ensureAttrsLoaded as ensureAttrsLoadedFlow } from './attrs_loader.js';
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
  setActiveModalTab,
  toggleModalSectionCollapse,
  type ModalConfigRecord,
  type ModalRuntimeState
} from './modal_runtime_store.ts';
import { ensureModalDefinition as ensureModalDefinitionFlow } from './modal_flow.js';

type ModalRuntimeVm = Record<string, unknown> & {
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

function asModalConfig(state: ModalRuntimeState | null | undefined): ModalConfigRecord | null {
  return state && state.modalConfig && typeof state.modalConfig === 'object'
    ? state.modalConfig
    : null;
}

function getModalConfig(state: ModalRuntimeState | null | undefined): ModalConfigRecord | null {
  return asModalConfig(state);
}

function sectionsForTab(state: ModalRuntimeState | null | undefined, tabIndex: number): unknown[] {
  const modalConfig = asModalConfig(state);
  if (!GuiParser || !modalConfig) {
    return [];
  }

  return GuiParser.getActiveSections(modalConfig, tabIndex, getModalTabs(state));
}

function collectModalWidgetNames(state: ModalRuntimeState | null | undefined): string[] {
  const modalConfig = asModalConfig(state);
  if (!GuiParser || !modalConfig) {
    return [];
  }

  return (Array.isArray(GuiParser.collectWidgetNamesFromModal(modalConfig))
    ? GuiParser.collectWidgetNamesFromModal(modalConfig)
    : []
  )
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter(Boolean);
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
    const modal = await ensureModalDefinitionFlow(vm, modalName);
    if (!modal) {
      throw new Error(`Не удалось определить конфигурацию модального окна "${modalName}"`);
    }

    const pendingState = {
      ...state,
      modalConfig: modal as ModalConfigRecord
    };
    const requiredWidgetNames = collectModalWidgetNames(pendingState);
    if (requiredWidgetNames.length) {
      await ensureAttrsLoadedFlow(vm, requiredWidgetNames);
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

const ModalRuntimeService = {
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

export type { ModalConfigRecord, ModalRuntimeController, ModalRuntimeState };

export {
  ModalRuntimeService,
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

export default ModalRuntimeService;
