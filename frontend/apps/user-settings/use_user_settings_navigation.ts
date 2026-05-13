import { computed, ref, type Ref } from 'vue';
import type { UserRecord } from '@frontend/runtime/api_client.ts';
import { USER_SETTINGS_SETTINGS_TABS } from './user_settings_constants.ts';
import type { UserSettingsTabEnsurers } from './use_user_settings_tab_ensurers.ts';

export function useUserSettingsNavigation(deps: {
  user: Ref<UserRecord | null>;
  tabEnsurers: UserSettingsTabEnsurers;
}) {
  const activeMenu = ref('account');
  const activeSettingsTab = ref<(typeof USER_SETTINGS_SETTINGS_TABS)[number]['id']>('connection');

  const isAdmin = computed(() => deps.user.value?.role_name === 'admin');
  const visibleMenu = computed(() => [
    { id: 'account', label: 'Аккаунт', icon: 'account_circle.svg' },
    ...(isAdmin.value
      ? [
          { id: 'users', label: 'Пользователи', icon: 'groups.svg' },
          { id: 'settings', label: 'Настройка БД', icon: 'settings.svg' },
        ]
      : []),
  ]);

  function updateLocationHash(): void {
    if (typeof window === 'undefined' || typeof history === 'undefined') return;
    const menuIndex = visibleMenu.value.findIndex((item) => item.id === activeMenu.value);
    if (menuIndex < 0) return;
    let nextHash = `#menu-${menuIndex}`;
    if (activeMenu.value === 'settings') {
      const tabIndex = Math.max(
        0,
        USER_SETTINGS_SETTINGS_TABS.findIndex((item) => item.id === activeSettingsTab.value)
      );
      nextHash += `-tab-${tabIndex}`;
    }
    if (window.location.hash !== nextHash) history.replaceState(null, '', nextHash);
  }

  function applyLocationHash(): void {
    if (typeof window === 'undefined') return;
    const match = (window.location.hash || '').match(/^#menu-(\d+)(?:-tab-(\d+))?$/);
    if (!match) return;
    const menu = visibleMenu.value[Number(match[1])];
    if (!menu) return;
    activeMenu.value = menu.id;
    if (menu.id === 'settings') {
      activeSettingsTab.value =
        USER_SETTINGS_SETTINGS_TABS[Number(match[2] || 0)]?.id || 'connection';
    }
    if (menu.id === 'users') void deps.tabEnsurers.ensureUsersLoaded(false);
    if (menu.id === 'settings') void deps.tabEnsurers.ensureDbSettingsLoaded(false);
  }

  function onHashChange(): void {
    applyLocationHash();
  }

  function selectMenu(menuId: string): void {
    activeMenu.value = menuId;
    updateLocationHash();
    if (menuId === 'users') void deps.tabEnsurers.ensureUsersLoaded(false);
    if (menuId === 'settings') void deps.tabEnsurers.ensureDbSettingsLoaded(false);
  }

  function selectSettingsTab(tabId: string): void {
    const hit = USER_SETTINGS_SETTINGS_TABS.find((t) => t.id === tabId);
    if (!hit) return;
    activeSettingsTab.value = hit.id;
    updateLocationHash();
  }

  return {
    activeMenu,
    activeSettingsTab,
    visibleMenu,
    isAdmin,
    settingsTabs: USER_SETTINGS_SETTINGS_TABS,
    updateLocationHash,
    applyLocationHash,
    onHashChange,
    selectMenu,
    selectSettingsTab,
  };
}
