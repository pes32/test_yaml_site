import GuiParser from '../gui_parser.js';
import widgetFactory from '../widgets/factory.ts';
import { ensureAttrsLoaded as ensureAttrsLoadedFlow } from './attrs_loader.js';
import { FRONTEND_ERROR_SCOPES } from './error_model.ts';
import { ensureModalDefinition as ensureModalDefinitionFlow } from './modal_flow.js';

type ModalConfigRecord = Record<string, unknown> & {
  id?: unknown;
  name?: unknown;
  tabs?: unknown;
};

type ModalRuntimeState = {
  showModal: boolean;
  modalConfig: ModalConfigRecord | null;
  activeTabIndex: number;
  collapsedSections: Record<string, boolean>;
  modalScrollTopByView: Record<string, number>;
  loading: boolean;
  error: unknown;
};

type ScrollRoot = {
  scrollTop?: number;
  scrollTo?: (options: { top: number; left: number; behavior: 'auto' }) => void;
};

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

type ScheduleCallback = () => void;
type ScheduleFn = (callback: ScheduleCallback) => void;

function createEmptyModalRuntimeState(): ModalRuntimeState {
  return {
    showModal: false,
    modalConfig: null,
    activeTabIndex: 0,
    collapsedSections: {},
    modalScrollTopByView: {},
    loading: false,
    error: null
  };
}

function asModalConfig(state: ModalRuntimeState | null | undefined): ModalConfigRecord | null {
  return state && state.modalConfig && typeof state.modalConfig === 'object'
    ? state.modalConfig
    : null;
}

function getModalConfig(state: ModalRuntimeState | null | undefined): ModalConfigRecord | null {
  return asModalConfig(state);
}

function getModalTabs(state: ModalRuntimeState | null | undefined): unknown[] {
  const modalConfig = asModalConfig(state);
  return modalConfig && Array.isArray(modalConfig.tabs)
    ? modalConfig.tabs
    : [];
}

function getModalTitle(state: ModalRuntimeState | null | undefined): string {
  const modalConfig = asModalConfig(state);
  if (!modalConfig) {
    return 'Модальное окно';
  }
  return typeof modalConfig.name === 'string' && modalConfig.name.trim()
    ? modalConfig.name
    : 'Модальное окно';
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
    .map((name) => typeof name === 'string' ? name.trim() : '')
    .filter(Boolean);
}

function getActiveModalViewId(state: ModalRuntimeState | null | undefined): string {
  const modalConfig = asModalConfig(state);
  if (!modalConfig) {
    return '';
  }

  const modalId = typeof modalConfig.id === 'string' && modalConfig.id.trim()
    ? modalConfig.id
    : typeof modalConfig.name === 'string' && modalConfig.name.trim()
      ? modalConfig.name
      : 'modal';
  const modalTabs = getModalTabs(state);
  const tabPart = modalTabs.length
    ? `tab-${Number(state && state.activeTabIndex) || 0}`
    : 'content';
  return `${modalId}-${tabPart}`;
}

function rememberActiveModalScroll(
  state: ModalRuntimeState,
  scrollRoot: ScrollRoot | null
): void {
  const viewId = getActiveModalViewId(state);
  if (!viewId || !scrollRoot) {
    return;
  }

  state.modalScrollTopByView = {
    ...(state.modalScrollTopByView || {}),
    [viewId]: scrollRoot.scrollTop || 0
  };
}

function restoreActiveModalScroll(
  state: ModalRuntimeState,
  schedule: ScheduleFn | null | undefined,
  resolveScrollRoot: (() => ScrollRoot | null) | null | undefined,
  viewId = getActiveModalViewId(state)
): void {
  if (typeof schedule !== 'function') {
    return;
  }

  schedule(() => {
    if (!state.showModal || !viewId || viewId !== getActiveModalViewId(state)) {
      return;
    }

    const scrollRoot = typeof resolveScrollRoot === 'function'
      ? resolveScrollRoot()
      : null;

    if (!scrollRoot) {
      return;
    }

    const top = Object.prototype.hasOwnProperty.call(state.modalScrollTopByView || {}, viewId)
      ? state.modalScrollTopByView[viewId]
      : 0;

    if (typeof scrollRoot.scrollTo === 'function') {
      scrollRoot.scrollTo({ top, left: 0, behavior: 'auto' });
    } else {
      scrollRoot.scrollTop = top;
    }
  });
}

function closeModal(state: ModalRuntimeState): void {
  state.showModal = false;
  state.activeTabIndex = 0;
}

function setActiveModalTab(state: ModalRuntimeState, index: number): void {
  const modalTabs = getModalTabs(state);
  if (index < 0 || index >= modalTabs.length) {
    return;
  }
  state.activeTabIndex = index;
}

function getModalSectionCollapseId(
  state: ModalRuntimeState,
  tabIndex: number,
  sectionIndex: number
): string {
  const modalTabs = getModalTabs(state);
  if (!modalTabs.length) {
    return `modal-section-content-${sectionIndex}`;
  }
  const idx = modalTabs.length === 1 ? 0 : tabIndex;
  return `modal-section-${idx}-${sectionIndex}`;
}

function isModalSectionCollapsed(
  state: ModalRuntimeState,
  tabIndex: number,
  sectionIndex: number
): boolean {
  return Boolean(
    (state.collapsedSections || {})[getModalSectionCollapseId(state, tabIndex, sectionIndex)]
  );
}

function toggleModalSectionCollapse(
  state: ModalRuntimeState,
  tabIndex: number,
  sectionIndex: number
): void {
  const sectionId = getModalSectionCollapseId(state, tabIndex, sectionIndex);
  state.collapsedSections = {
    ...(state.collapsedSections || {}),
    [sectionId]: !state.collapsedSections[sectionId]
  };
}

async function openModal(
  vm: ModalRuntimeVm,
  state: ModalRuntimeState,
  modalName: string
): Promise<unknown> {
  state.loading = true;
  state.error = null;

  try {
    const modal = await ensureModalDefinitionFlow(vm, modalName);
    if (!modal) {
      throw new Error(`Не удалось определить конфигурацию модального окна "${modalName}"`);
    }

    state.modalConfig = modal as ModalConfigRecord;
    state.activeTabIndex = 0;

    const required = collectModalWidgetNames(state);
    if (required.length) {
      await ensureAttrsLoadedFlow(vm, required);
      if (typeof vm.prefetchWidgetsByNames === 'function') {
        void vm.prefetchWidgetsByNames(required);
      } else {
        const widgetTypes = required
          .map((name) => typeof vm.getWidgetConfig === 'function' ? vm.getWidgetConfig(name) : null)
          .map((config) => config && typeof config.widget === 'string' ? config.widget : '')
          .filter(Boolean);
        void widgetFactory.prefetchWidgetTypes(widgetTypes);
      }
    }

    state.showModal = true;
    return modal;
  } catch (error) {
    const normalized = typeof vm.handleRecoverableError === 'function'
      ? vm.handleRecoverableError(error, {
        scope: FRONTEND_ERROR_SCOPES.modal,
        message: `Не удалось открыть модальное окно "${modalName}"`
      })
      : error;

    state.error = normalized;
    state.showModal = false;
    throw normalized;
  } finally {
    state.loading = false;
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
  closeModal,
  collectModalWidgetNames,
  createEmptyModalRuntimeState,
  createModalRuntimeController,
  getActiveModalViewId,
  getModalConfig,
  getModalSectionCollapseId,
  getModalTabs,
  getModalTitle,
  isModalSectionCollapsed,
  openModal,
  rememberActiveModalScroll,
  restoreActiveModalScroll,
  sectionsForTab,
  setActiveModalTab,
  toggleModalSectionCollapse
};

export default ModalRuntimeService;
