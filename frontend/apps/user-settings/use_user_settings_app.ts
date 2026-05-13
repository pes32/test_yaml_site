import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { RoleRecord, UserRecord } from '@frontend/runtime/api_client.ts';
import type { ConfirmModalSurface } from '@frontend/widgets/common/confirm_modal_contract.ts';
import { useAdminUsersTab } from './use_admin_users_tab.ts';
import { createUserSettingsTabEnsurers } from './use_user_settings_tab_ensurers.ts';
import { useDbSettingsTab } from './use_db_settings_tab.ts';
import { useUserSettingsBootstrap } from './use_user_settings_bootstrap.ts';
import { useUserSettingsNavigation } from './use_user_settings_navigation.ts';
import { useUserSettingsRun } from './use_user_settings_run.ts';
import { useUserSettingsTransientError } from './use_user_settings_transient_error.ts';

export function useUserSettingsApp() {
  const confirmModal = ref<ConfirmModalSurface | null>(null);
  const sessionUser = ref<UserRecord | null>(null);
  const roles = ref<RoleRecord[]>([]);

  const tabEnsurers = createUserSettingsTabEnsurers();
  const { loading, error, message, run } = useUserSettingsRun();
  const { transientError, showTransientError, clearTransientError } = useUserSettingsTransientError();

  const navigation = useUserSettingsNavigation({ user: sessionUser, tabEnsurers });

  const bootstrap = useUserSettingsBootstrap({
    user: sessionUser,
    roles,
    run,
    applyLocationHash: navigation.applyLocationHash,
    updateLocationHash: navigation.updateLocationHash,
    message,
  });

  const adminUsers = useAdminUsersTab({
    tabEnsurers,
    roles,
    user: sessionUser,
    run,
    loading,
    error,
    message,
    applyUser: bootstrap.applyUser,
    showTransientError,
    clearTransientError,
  });

  const dbTab = useDbSettingsTab({
    tabEnsurers,
    run,
    showTransientError,
    message,
  });

  const {
    changePassword: bootstrapChangePassword,
    ...bootstrapRest
  } = bootstrap;

  async function changePassword(): Promise<void> {
    await bootstrapChangePassword({
      isAdmin: navigation.isAdmin,
      applyLocationHash: navigation.applyLocationHash,
      error,
      message,
    });
  }

  async function refreshAfterAuthChange(event: Event): Promise<void> {
    const nextUser = (event as CustomEvent<{ user?: UserRecord | null }>).detail?.user || null;
    bootstrap.applyUser(nextUser);
    if (!nextUser) {
      navigation.activeMenu.value = 'account';
      roles.value = [];
      adminUsers.resetListsOnLogout();
      return;
    }
    await bootstrap.loadBootstrap();
  }

  watch(navigation.activeMenu, () => {
    message.value = '';
    error.value = '';
    clearTransientError();
  });

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', navigation.onHashChange);
      window.addEventListener('yamls-auth-state-changed', refreshAfterAuthChange as EventListener);
    }
    void bootstrap.loadBootstrap();
  });

  onBeforeUnmount(() => {
    clearTransientError();
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', navigation.onHashChange);
      window.removeEventListener('yamls-auth-state-changed', refreshAfterAuthChange as EventListener);
    }
  });

  function onDbBackupSuccess(): void {
    message.value = 'Дамп подготовлен';
  }

  return {
    confirmModal,
    loading,
    error,
    message,
    transientError,
    showTransientError,
    clearTransientError,
    onDbBackupSuccess,
    changePassword,
    refreshAfterAuthChange,
    ...navigation,
    ...bootstrapRest,
    ...adminUsers,
    ...dbTab,
    currentUser: sessionUser,
  };
}
