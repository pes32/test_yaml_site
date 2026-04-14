<template>
  <modal-manager @execute="executeCommand" @input="onWidgetInput"></modal-manager>
  <confirm-modal ref="confirmModal"></confirm-modal>

  <div class="container-fluid mt-3">
    <div class="page-shell u-wide">
      <aside v-if="menus.length && !rootContentOnly" class="page-sidebar">
        <div class="menu-list page-menu-rail">
          <button
            v-for="(menu, index) in menus"
            :key="index"
            type="button"
            class="menu-card"
            :class="{ active: index === activeMenuIndex }"
            :data-menu-index="index"
            :data-menu-name="menu.name || ('Меню ' + (Number(index) + 1))"
            @click="onMenuClick(index)"
          >
            <span class="menu-card-icon-shell inline-flex-center">
              <item-icon v-if="menu.icon" :icon="menu.icon"></item-icon>
            </span>
            <span class="menu-card-label" v-text="menu.name || ('Меню ' + (Number(index) + 1))"></span>
          </button>
        </div>
      </aside>

      <main class="page-content-column u-wide">
        <error-panel
          v-if="pageError"
          :error="pageError"
          @dismiss="dismissPageError"
        ></error-panel>

        <div v-if="blockingPageError" class="page-empty-placeholder">
          Не удалось подготовить страницу для отображения. Проверь логи приложения или debug-страницу.
        </div>

        <div v-else-if="activeMenu" class="page-main-stack">
          <ul
            v-if="activeTabs.length > 1"
            id="mainTabs"
            ref="pageTabs"
            class="nav nav-tabs page-tabs"
            :class="{ 'page-tabs--focused': tabsFocused }"
            role="tablist"
            @focusin="tabsFocused = true"
            @focusout="onTabsFocusOut"
          >
            <li v-for="(tab, index) in activeTabs" :key="index" class="nav-item">
              <a
                class="nav-link"
                :class="{ active: index === activeTabIndex }"
                href="#"
                role="tab"
                :data-tab-index="index"
                :data-tab-name="tab.name || ('Вкладка ' + (Number(index) + 1))"
                @click.prevent="onTabClick(index)"
              >
                <item-icon v-if="tab.icon" :icon="tab.icon"></item-icon>
                <span class="page-tab-label" v-text="tab.name || ('Вкладка ' + (Number(index) + 1))"></span>
              </a>
            </li>
          </ul>

          <div
            id="mainTabContent"
            ref="pageScrollRoot"
            class="tab-content page-tab-content u-wide"
            :class="{ 'page-tab-content--with-tabs': activeTabs.length > 1 }"
          >
            <div class="tab-pane active show u-wide">
              <section-card
                v-for="(section, sidx) in activeSections"
                :key="getSectionCollapseId(Number(sidx))"
                :section="section"
                :section-index="Number(sidx)"
                :collapse-id="getSectionCollapseId(Number(sidx))"
                :is-collapsed="isSectionCollapsed(Number(sidx))"
                :on-toggle="() => toggleSectionCollapse(Number(sidx))"
                :on-input="onWidgetInput"
                :get-widget-attrs="getWidgetAttrs"
                :get-widget-value="getWidgetRuntimeValue"
                :on-execute="executeCommand"
                :header-id="'heading-' + activeMenuIndex + '-' + sidx"
              >
              </section-card>
            </div>
          </div>
        </div>

        <div v-else class="page-empty-placeholder">
          Нет контента для отображения. Добавьте menu или row/box/collapse на верхнем уровне gui.yaml.
        </div>
      </main>
    </div>
  </div>

  <div class="page-snackbar-host" aria-live="polite" aria-atomic="true">
    <transition name="page-snackbar">
      <div
        v-if="snackbar"
        :key="snackbar.id"
        class="page-snackbar"
        :class="`page-snackbar--${snackbar.type}`"
        role="status"
      >
        <div class="page-snackbar__content">
          <div class="page-snackbar__message" v-text="snackbar.message"></div>
          <button
            type="button"
            class="ui-close-button page-snackbar__close"
            aria-label="Закрыть"
            @click="closeNotification"
          ></button>
        </div>
        <div class="page-snackbar__timer">
          <span
            class="page-snackbar__timer-bar"
            :class="`page-snackbar__timer-bar--${snackbar.type}`"
            :style="{ animationDuration: snackbar.duration + 'ms' }"
          ></span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import pageAppOptions from '../../../../../frontend/js/page.js';
import ConfirmModal from '../../../../../frontend/js/widgets/common/ConfirmModal.vue';
import ErrorPanel from '../../../../../frontend/js/widgets/common/ErrorPanel.vue';
import ItemIcon from '../../../../../frontend/js/widgets/common/ItemIcon.vue';
import ModalManager from '../../../../../frontend/js/widgets/common/ModalManager.vue';
import SectionCard from '../../../../../frontend/js/widgets/common/SectionCard.vue';

export default {
  name: 'PageApp',
  components: {
    ConfirmModal,
    ErrorPanel,
    ItemIcon,
    ModalManager,
    SectionCard
  },
  ...pageAppOptions
};
</script>
