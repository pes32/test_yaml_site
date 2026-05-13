<template>
  <confirm-modal ref="confirmModal"></confirm-modal>

  <div class="container-fluid mt-3">
    <div v-if="!isAuthorized" class="page-shell u-wide">
      <main class="page-content-column u-wide">
        <div class="card page-section-card">
          <div class="card-body">
            <div class="page-empty-placeholder">
              Страница доступна только авторизованным пользователям. Пройдите авторизацию
            </div>
          </div>
        </div>
      </main>
    </div>

    <div v-else class="page-shell u-wide">
      <aside class="page-sidebar">
        <div class="menu-list page-menu-rail">
          <button
            v-for="item in visibleMenu"
            :key="item.id"
            type="button"
            class="menu-card"
            :class="{ active: activeMenu === item.id }"
            @click="selectMenu(item.id)"
          >
            <span class="menu-card-icon-shell inline-flex-center">
              <item-icon :icon="item.icon"></item-icon>
            </span>
            <span class="menu-card-label">{{ item.label }}</span>
          </button>
        </div>
      </aside>

      <main class="page-content-column u-wide">
        <div v-if="error" class="feedback-panel error-panel">
          <div class="feedback-panel__summary">
            <span class="feedback-panel__title">Ошибка</span>
            <button type="button" class="ui-close-button feedback-panel__dismiss" aria-label="Скрыть ошибку" @click="error = ''"></button>
          </div>
          <div class="feedback-panel__body">
            <div class="feedback-panel__message">{{ error }}</div>
          </div>
        </div>

        <user-settings-account-panel
          v-if="activeMenu === 'account'"
          :account-title="accountTitle"
          :account-form="accountForm"
          :account-dirty="accountDirty"
          :loading="loading"
          @account-field="setAccountField"
          @save="saveAccount"
          @open-password="openPasswordModal"
        ></user-settings-account-panel>

        <user-settings-users-panel
          v-else-if="activeMenu === 'users' && isAdmin"
          :users-table-config="usersTableConfig"
          :users-has-more="usersHasMore"
          :users-loading-more="usersLoadingMore"
          :block-toggle-visible="Boolean(selectedUser)"
          :block-toggle-label="blockToggleLabel"
          @select-user="onUsersSelectUser"
          @open-user-card="openUserCardFromId"
          @create="openCreateUserModal"
          @refresh="refreshUsersTab"
          @block-toggle="toggleSelectedUserBlock"
          @need-more="loadUsersPage"
        ></user-settings-users-panel>

        <div v-else-if="activeMenu === 'settings' && isAdmin" class="page-main-stack">
          <ul class="nav nav-tabs page-tabs" role="tablist">
            <li v-for="tab in settingsTabs" :key="tab.id" class="nav-item">
              <a class="nav-link" :class="{ active: activeSettingsTab === tab.id }" href="#" role="tab" @click.prevent="selectSettingsTab(tab.id)">
                <span class="page-tab-label">{{ tab.label }}</span>
              </a>
            </li>
          </ul>
          <div class="tab-content page-tab-content page-tab-content--with-tabs u-wide">
            <div class="tab-pane active show u-wide user-settings-tab-pane">
              <user-settings-db-connection-tab
                v-if="activeSettingsTab === 'connection' && dbSettingsHydrated"
                v-model:sql-query="sqlQuery"
                v-model:sql-active-view="sqlActiveView"
                :db-form="dbForm"
                :db-password-placeholder="dbPasswordPlaceholder"
                :db-checked="dbChecked"
                :sql-result="sqlResult"
                :sql-table-widget-config="sqlTableWidgetConfig"
                @db-field="setDbField"
                @test-db="testDbSettings"
                @save-db="saveDbSettings"
                @reset-db="loadFallbackDbSettings"
                @run-sql="runSql"
              ></user-settings-db-connection-tab>
              <db-schema-explorer v-else-if="activeSettingsTab === 'schema'" :confirm-modal="confirmModal"></db-schema-explorer>
              <user-settings-db-backup-tab
                v-else-if="activeSettingsTab === 'backup'"
                @backup-success="onDbBackupSuccess"
                @backup-error="showTransientError"
              ></user-settings-db-backup-tab>
            </div>
          </div>
        </div>

        <div class="page-snackbar-host" aria-live="polite" aria-atomic="true">
          <transition name="page-snackbar">
            <div v-if="message" class="page-snackbar page-snackbar--success" role="status">
              <div class="page-snackbar__content">
                <div class="page-snackbar__message">{{ message }}</div>
                <button type="button" class="ui-close-button page-snackbar__close" aria-label="Закрыть" @click="message = ''"></button>
              </div>
              <div class="page-snackbar__timer">
                <span class="page-snackbar__timer-bar page-snackbar__timer-bar--success" :style="{ animationDuration: '5000ms' }"></span>
              </div>
            </div>
          </transition>
        </div>
        <div class="page-snackbar-host page-snackbar-host--elevated" aria-live="assertive" aria-atomic="true">
          <transition name="page-snackbar">
            <div v-if="transientError" class="page-snackbar page-snackbar--danger" role="alert">
              <div class="page-snackbar__content">
                <div class="page-snackbar__message">{{ transientError }}</div>
                <button type="button" class="ui-close-button page-snackbar__close" aria-label="Закрыть" @click="clearTransientError"></button>
              </div>
              <div class="page-snackbar__timer">
                <span class="page-snackbar__timer-bar page-snackbar__timer-bar--danger" :style="{ animationDuration: '5000ms' }"></span>
              </div>
            </div>
          </transition>
        </div>
      </main>
    </div>

    <user-settings-modals
      v-model:password-modal-open="passwordModalOpen"
      v-model:create-user-modal-open="createUserModalOpen"
      v-model:user-card-modal-open="userCardModalOpen"
      v-model:admin-password-modal-open="adminPasswordModalOpen"
      :password-form="passwordForm"
      :create-user-form="createUserForm"
      :user-card-form="userCardForm"
      :user-card-title="userCardTitle"
      :admin-password-form="adminPasswordForm"
      :confirm-pwd-field-config="confirmPwdFieldConfig"
      :password-change-blocked="passwordChangeBlocked"
      :loading="loading"
      :role-options="roleOptions"
      :current-user="currentUser"
      @password-field="setPasswordField"
      @password-confirm-blur="onPasswordConfirmBlur"
      @change-own-password="changePassword"
      @create-user-field="setCreateUserField"
      @create-user-submit="createUserAction"
      @user-card-field="setUserCardField"
      @save-user-card="saveUserCard"
      @open-admin-password="openAdminPasswordModal"
      @admin-password-field="setAdminPasswordField"
      @generate-admin-temp-password="generateTemporaryPassword"
      @save-admin-password="changeAdminPassword"
    ></user-settings-modals>
  </div>
</template>

<script setup lang="ts">
import ConfirmModal from '@frontend/widgets/common/ConfirmModal.vue';
import DbSchemaExplorer from './DbSchemaExplorer.vue';
import ItemIcon from '@frontend/widgets/common/ItemIcon.vue';
import UserSettingsAccountPanel from './UserSettingsAccountPanel.vue';
import UserSettingsDbBackupTab from './UserSettingsDbBackupTab.vue';
import UserSettingsDbConnectionTab from './UserSettingsDbConnectionTab.vue';
import UserSettingsModals from './UserSettingsModals.vue';
import UserSettingsUsersPanel from './UserSettingsUsersPanel.vue';
import { useUserSettingsApp } from './use_user_settings_app.ts';

defineOptions({
  name: 'UserSettingsApp',
});

const {
  confirmModal,
  loading,
  error,
  message,
  transientError,
  clearTransientError,
  onDbBackupSuccess,
  showTransientError,
  activeMenu,
  activeSettingsTab,
  visibleMenu,
  isAdmin,
  isAuthorized,
  settingsTabs,
  selectMenu,
  selectSettingsTab,
  accountTitle,
  accountForm,
  accountDirty,
  setAccountField,
  saveAccount,
  openPasswordModal,
  passwordModalOpen,
  passwordForm,
  setPasswordField,
  onPasswordConfirmBlur,
  changePassword,
  confirmPwdFieldConfig,
  passwordChangeBlocked,
  usersTableConfig,
  usersHasMore,
  usersLoadingMore,
  blockToggleLabel,
  selectedUser,
  onUsersSelectUser,
  openUserCardFromId,
  openCreateUserModal,
  createUserModalOpen,
  refreshUsersTab,
  toggleSelectedUserBlock,
  loadUsersPage,
  createUserForm,
  userCardForm,
  userCardTitle,
  adminPasswordForm,
  roleOptions,
  setCreateUserField,
  createUserAction,
  setUserCardField,
  saveUserCard,
  userCardModalOpen,
  openAdminPasswordModal,
  adminPasswordModalOpen,
  setAdminPasswordField,
  generateTemporaryPassword,
  changeAdminPassword,
  sqlQuery,
  sqlActiveView,
  dbSettingsHydrated,
  dbForm,
  dbPasswordPlaceholder,
  dbChecked,
  sqlResult,
  sqlTableWidgetConfig,
  setDbField,
  testDbSettings,
  saveDbSettings,
  loadFallbackDbSettings,
  runSql,
  currentUser,
} = useUserSettingsApp();
</script>
