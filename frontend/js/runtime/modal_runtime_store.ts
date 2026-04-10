type ModalConfigRecord = Record<string, unknown> & {
  id?: unknown;
  name?: unknown;
  tabs?: unknown;
};

type ModalRuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';

type ModalRuntimeState = {
  activeModalId: string;
  activeTabIndex: number;
  collapsedSections: Record<string, boolean>;
  error: unknown;
  modalConfig: ModalConfigRecord | null;
  requestToken: number;
  restoreTargetViewId: string;
  scrollTopByView: Record<string, number>;
  status: ModalRuntimeStatus;
};

type ScrollRoot = {
  scrollTop?: number;
  scrollTo?: (options: { top: number; left: number; behavior: 'auto' }) => void;
};

function createEmptyModalRuntimeState(): ModalRuntimeState {
  return {
    activeModalId: '',
    activeTabIndex: 0,
    collapsedSections: {},
    error: null,
    modalConfig: null,
    requestToken: 0,
    restoreTargetViewId: '',
    scrollTopByView: {},
    status: 'idle'
  };
}

function asModalConfig(state: ModalRuntimeState | null | undefined): ModalConfigRecord | null {
  return state && state.modalConfig && typeof state.modalConfig === 'object'
    ? state.modalConfig
    : null;
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

function isModalOpen(state: ModalRuntimeState | null | undefined): boolean {
  return Boolean(
    state &&
      state.status === 'ready' &&
      state.activeModalId &&
      state.modalConfig
  );
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
      : state?.activeModalId || 'modal';
  const modalTabs = getModalTabs(state);
  const tabPart = modalTabs.length
    ? `tab-${Number(state?.activeTabIndex) || 0}`
    : 'content';

  return `${modalId}-${tabPart}`;
}

function beginModalRequest(state: ModalRuntimeState, modalId: string): number {
  const requestToken = state.requestToken + 1;
  state.requestToken = requestToken;
  state.activeModalId = String(modalId || '').trim();
  state.status = 'loading';
  state.error = null;
  state.restoreTargetViewId = '';
  return requestToken;
}

function completeModalRequest(
  state: ModalRuntimeState,
  requestToken: number,
  modalId: string,
  modalConfig: ModalConfigRecord
): boolean {
  if (state.requestToken !== requestToken) {
    return false;
  }

  state.activeModalId = String(modalId || '').trim();
  state.modalConfig = modalConfig;
  state.activeTabIndex = 0;
  state.error = null;
  state.status = 'ready';
  state.restoreTargetViewId = getActiveModalViewId(state);
  return true;
}

function failModalRequest(
  state: ModalRuntimeState,
  requestToken: number,
  error: unknown
): boolean {
  if (state.requestToken !== requestToken) {
    return false;
  }

  state.error = error;
  state.modalConfig = null;
  state.activeTabIndex = 0;
  state.status = 'error';
  state.restoreTargetViewId = '';
  return true;
}

function invalidateModalRequest(state: ModalRuntimeState): number {
  state.requestToken += 1;
  return state.requestToken;
}

function closeModal(state: ModalRuntimeState): ModalRuntimeState {
  invalidateModalRequest(state);
  state.activeModalId = '';
  state.activeTabIndex = 0;
  state.error = null;
  state.modalConfig = null;
  state.restoreTargetViewId = '';
  state.status = 'idle';
  return state;
}

function setActiveModalTab(state: ModalRuntimeState, index: number): number {
  const modalTabs = getModalTabs(state);
  if (index < 0 || index >= modalTabs.length) {
    return state.activeTabIndex;
  }

  state.activeTabIndex = index;
  state.restoreTargetViewId = getActiveModalViewId(state);
  return state.activeTabIndex;
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

  const normalizedTabIndex = modalTabs.length === 1 ? 0 : tabIndex;
  return `modal-section-${normalizedTabIndex}-${sectionIndex}`;
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

function rememberActiveModalScroll(
  state: ModalRuntimeState,
  scrollRoot: ScrollRoot | null
): void {
  const viewId = getActiveModalViewId(state);
  if (!viewId || !scrollRoot) {
    return;
  }

  state.scrollTopByView = {
    ...(state.scrollTopByView || {}),
    [viewId]: scrollRoot.scrollTop || 0
  };
}

function consumeRestoreTargetViewId(state: ModalRuntimeState): string {
  const viewId = state.restoreTargetViewId || '';
  state.restoreTargetViewId = '';
  return viewId;
}

function peekRestoreTargetViewId(state: ModalRuntimeState): string {
  return state.restoreTargetViewId || '';
}

function restoreActiveModalScroll(
  state: ModalRuntimeState,
  scrollRoot: ScrollRoot | null,
  viewId: string
): void {
  if (!isModalOpen(state) || !viewId || viewId !== getActiveModalViewId(state) || !scrollRoot) {
    return;
  }

  const top = Object.prototype.hasOwnProperty.call(state.scrollTopByView || {}, viewId)
    ? state.scrollTopByView[viewId]
    : 0;

  if (typeof scrollRoot.scrollTo === 'function') {
    scrollRoot.scrollTo({ top, left: 0, behavior: 'auto' });
  } else {
    scrollRoot.scrollTop = top;
  }
}

function resetModalRuntimeState(state: ModalRuntimeState): ModalRuntimeState {
  invalidateModalRequest(state);
  state.activeModalId = '';
  state.activeTabIndex = 0;
  state.collapsedSections = {};
  state.error = null;
  state.modalConfig = null;
  state.restoreTargetViewId = '';
  state.scrollTopByView = {};
  state.status = 'idle';
  return state;
}

const ModalRuntimeStore = {
  beginModalRequest,
  closeModal,
  completeModalRequest,
  consumeRestoreTargetViewId,
  createEmptyModalRuntimeState,
  failModalRequest,
  getActiveModalViewId,
  getModalSectionCollapseId,
  getModalTabs,
  getModalTitle,
  invalidateModalRequest,
  isModalOpen,
  isModalSectionCollapsed,
  peekRestoreTargetViewId,
  rememberActiveModalScroll,
  resetModalRuntimeState,
  restoreActiveModalScroll,
  setActiveModalTab,
  toggleModalSectionCollapse
};

export type { ModalConfigRecord, ModalRuntimeState, ModalRuntimeStatus, ScrollRoot };

export {
  ModalRuntimeStore,
  beginModalRequest,
  closeModal,
  completeModalRequest,
  consumeRestoreTargetViewId,
  createEmptyModalRuntimeState,
  failModalRequest,
  getActiveModalViewId,
  getModalSectionCollapseId,
  getModalTabs,
  getModalTitle,
  invalidateModalRequest,
  isModalOpen,
  isModalSectionCollapsed,
  peekRestoreTargetViewId,
  rememberActiveModalScroll,
  resetModalRuntimeState,
  restoreActiveModalScroll,
  setActiveModalTab,
  toggleModalSectionCollapse
};

export default ModalRuntimeStore;
