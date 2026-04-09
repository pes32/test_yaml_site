<template>
  <div v-if="showModal" class="modal-overlay flex-center" @click="closeModal">
    <div class="modal-content w-100 gui-modal" @click.stop>
      <div class="modal-header">
        <div class="d-flex align-items-center gap-2">
          <ItemIcon v-if="modalConfig && modalConfig.icon" :icon="modalConfig.icon" />
          <h5 class="modal-title page-section-title" v-text="modalTitle"></h5>
        </div>
        <button type="button" class="ui-close-button" aria-label="Закрыть" @click="closeModal"></button>
      </div>

      <div class="modal-body">
        <div v-if="modalConfig" class="gui-modal-body-inner">
          <ul v-if="modalTabs.length > 1" class="nav nav-tabs page-tabs" role="tablist">
            <li v-for="(tab, index) in modalTabs" :key="index" class="nav-item">
              <a
                class="nav-link"
                :class="{ active: index === activeTabIndex }"
                href="#"
                role="tab"
                @click.prevent="setActiveTab(index)"
              >
                <ItemIcon v-if="tab.icon" :icon="tab.icon" />
                <span class="page-tab-label" v-text="tab.name || ('Вкладка ' + (index + 1))"></span>
              </a>
            </li>
          </ul>

          <div
            ref="modalScrollRoot"
            class="tab-content page-tab-content gui-modal-tab-pane-outer u-wide"
            :class="{ 'page-tab-content--with-tabs': modalTabs.length > 1 }"
          >
            <div v-if="modalTabs.length > 1" class="gui-modal-tab-stack">
              <div
                v-for="(tab, tidx) in modalTabs"
                :key="'mtab-' + tidx"
                class="gui-modal-tab-layer"
                :class="{ 'gui-modal-tab-layer--active': tidx === activeTabIndex }"
              >
                <SectionCard
                  v-for="(section, sidx) in getSectionsForTab(tidx)"
                  :key="'mt-' + tidx + '-' + sidx"
                  :section="section"
                  :section-index="sidx"
                  :collapse-id="getModalSectionCollapseId(tidx, sidx)"
                  :is-collapsed="isModalSectionCollapsed(tidx, sidx)"
                  :on-toggle="() => toggleModalSectionCollapse(tidx, sidx)"
                  :on-input="onWidgetInput"
                  :get-widget-attrs="getWidgetAttrs"
                  :get-widget-value="getWidgetValue"
                  :on-execute="onWidgetExecute"
                />
              </div>
            </div>
            <div v-else class="tab-pane active show u-wide gui-modal-tab-single">
              <SectionCard
                v-for="(section, sidx) in getSectionsForTab(0)"
                :key="sidx"
                :section="section"
                :section-index="sidx"
                :collapse-id="getModalSectionCollapseId(0, sidx)"
                :is-collapsed="isModalSectionCollapsed(0, sidx)"
                :on-toggle="() => toggleModalSectionCollapse(0, sidx)"
                :on-input="onWidgetInput"
                :get-widget-attrs="getWidgetAttrs"
                :get-widget-value="getWidgetValue"
                :on-execute="onWidgetExecute"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="modalConfig && modalConfig.buttons && modalConfig.buttons.length" class="modal-footer">
        <ModalButtons :buttons="modalConfig.buttons" @close="closeModal" @execute="onWidgetExecute" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, inject, nextTick, onUpdated, ref } from 'vue';
import {
  getModalTabs,
  getModalTitle,
  rememberActiveModalScroll,
  restoreActiveModalScroll,
  sectionsForTab
} from '../../runtime/modal_runtime_service.ts';
import ItemIcon from './ItemIcon.vue';
import ModalButtons from './ModalButtons.vue';
import SectionCard from './SectionCard.vue';

defineOptions({
  name: 'ModalManager'
});

const emit = defineEmits(['execute', 'input']);

const getModalRuntimeController = inject('getModalRuntimeController', null);
const getModalRuntimeState = inject('getModalRuntimeState', null);
const getWidgetAttrsByName = inject('getWidgetAttrsByName', null);
const getWidgetRuntimeValueByName = inject('getWidgetRuntimeValueByName', null);

const modalScrollRoot = ref(null);
const instance = getCurrentInstance();

const modalRuntimeState = computed(() => {
  if (typeof getModalRuntimeState !== 'function') {
    return {};
  }

  return getModalRuntimeState() || {};
});

const modalRuntimeController = computed(() => {
  if (typeof getModalRuntimeController !== 'function') {
    return null;
  }

  return getModalRuntimeController();
});

const showModal = computed(() => Boolean(modalRuntimeState.value.showModal));
const modalConfig = computed(() => modalRuntimeState.value.modalConfig || null);
const activeTabIndex = computed(() => Number(modalRuntimeState.value.activeTabIndex) || 0);
const modalTitle = computed(() => getModalTitle(modalRuntimeState.value));
const modalTabs = computed(() => getModalTabs(modalRuntimeState.value));

function commitActiveDraftWidget() {
  instance?.proxy?.$root?.commitActiveDraftWidget?.();
}

function getModalScrollRoot() {
  return modalScrollRoot.value || null;
}

function rememberCurrentModalScroll() {
  rememberActiveModalScroll(modalRuntimeState.value, getModalScrollRoot());
}

function restoreCurrentModalScroll() {
  restoreActiveModalScroll(
    modalRuntimeState.value,
    (callback) => nextTick(callback),
    () => getModalScrollRoot()
  );
}

function closeModal() {
  commitActiveDraftWidget();
  rememberCurrentModalScroll();

  if (modalRuntimeController.value && typeof modalRuntimeController.value.closeModal === 'function') {
    modalRuntimeController.value.closeModal();
  }
}

function setActiveTab(index) {
  if (!modalRuntimeController.value || typeof modalRuntimeController.value.setActiveTab !== 'function') {
    return;
  }

  commitActiveDraftWidget();
  rememberCurrentModalScroll();
  modalRuntimeController.value.setActiveTab(index);
  restoreCurrentModalScroll();
}

function getModalSectionCollapseId(tabIndex, sectionIndex) {
  if (
    !modalRuntimeController.value ||
    typeof modalRuntimeController.value.getModalSectionCollapseId !== 'function'
  ) {
    return `modal-section-${tabIndex}-${sectionIndex}`;
  }

  return modalRuntimeController.value.getModalSectionCollapseId(tabIndex, sectionIndex);
}

function isModalSectionCollapsed(tabIndex, sectionIndex) {
  return modalRuntimeController.value &&
    typeof modalRuntimeController.value.isModalSectionCollapsed === 'function'
    ? modalRuntimeController.value.isModalSectionCollapsed(tabIndex, sectionIndex)
    : false;
}

function toggleModalSectionCollapse(tabIndex, sectionIndex) {
  if (
    !modalRuntimeController.value ||
    typeof modalRuntimeController.value.toggleModalSectionCollapse !== 'function'
  ) {
    return;
  }

  modalRuntimeController.value.toggleModalSectionCollapse(tabIndex, sectionIndex);
}

function getSectionsForTab(tabIndex) {
  return sectionsForTab(modalRuntimeState.value, tabIndex);
}

function getWidgetAttrs(widgetName) {
  if (typeof getWidgetAttrsByName === 'function') {
    return getWidgetAttrsByName(widgetName);
  }

  return {
    widget: 'str',
    label: widgetName
  };
}

function getWidgetValue(widgetName) {
  return typeof getWidgetRuntimeValueByName === 'function'
    ? getWidgetRuntimeValueByName(widgetName)
    : undefined;
}

function onWidgetExecute(payload) {
  emit('execute', payload);
}

function onWidgetInput(payload) {
  emit('input', payload);
}

onUpdated(() => {
  if (showModal.value) {
    restoreCurrentModalScroll();
  }
});
</script>
