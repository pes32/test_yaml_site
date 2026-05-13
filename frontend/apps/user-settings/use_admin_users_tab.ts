import { computed, reactive, ref, type Ref } from 'vue';
import {
  FrontendApiError,
  frontendApiClient,
  type UserRecord,
} from '@frontend/runtime/api_client.ts';
import { USER_SETTINGS_PAGE_SIZE } from './user_settings_constants.ts';
import { statusLabel, type WidgetPayload } from './user_settings_field_helpers.ts';
import type { UserSettingsTabEnsurers } from './use_user_settings_tab_ensurers.ts';

function userName(user: Record<string, unknown>): string {
  return [user.user_surname, user.user_name, user.user_patronymic].map((v) => String(v || '').trim()).filter(Boolean).join(' ');
}

export function useAdminUsersTab(deps: {
  tabEnsurers: UserSettingsTabEnsurers;
  roles: Ref<{ role_name?: string }[]>;
  user: Ref<UserRecord | null>;
  run: (action: () => Promise<void>) => Promise<void>;
  loading: Ref<boolean>;
  error: Ref<string>;
  message: Ref<string>;
  applyUser: (next: UserRecord | null) => void;
  showTransientError: (text: string) => void;
  clearTransientError: () => void;
}) {
  const usersTabHydrated = ref(false);
  const selectedUserId = ref<number | null>(null);
  const usersHasMore = ref(false);
  const usersLoadingMore = ref(false);
  const users = ref<UserRecord[]>([]);
  const adminPasswordModalOpen = ref(false);
  const createUserModalOpen = ref(false);
  const userCardModalOpen = ref(false);
  const userCardBaseline = ref('');
  const createUserForm = reactive<Record<string, unknown>>({
    user_login: '',
    role_name: '',
    password: '',
  });
  const userCardForm = reactive<Record<string, unknown>>({});
  const adminPasswordForm = reactive<Record<string, unknown>>({ password: '' });

  const roleOptions = computed(() =>
    deps.roles.value.map((role) => role.role_name).filter(Boolean).length
      ? deps.roles.value.map((role) => role.role_name as string)
      : ['user', 'admin']
  );

  const selectedUser = computed(() => users.value.find((item) => item.user_id === selectedUserId.value) || null);
  const userCardTitle = computed(() => {
    const login = String(userCardForm.user_login || '').trim();
    const id = String(userCardForm.user_id ?? '').trim();
    if (login && id) return `Карточка пользователя: ${login} (ID ${id})`;
    if (login) return `Карточка пользователя: ${login}`;
    if (id) return `Карточка пользователя: ID ${id}`;
    return 'Карточка пользователя';
  });

  const blockToggleLabel = computed(() => {
    const item = selectedUser.value;
    if (!item) return '';
    return item.user_status === 'blocked' ? 'Разблокировать' : 'Заблокировать';
  });

  const usersTableConfig = computed(() => ({
    widget: 'table',
    readonly: true,
    toolbar: false,
    sort: true,
    readonly_row_selection: true,
    readonly_selected_row_id: selectedUserId.value == null ? null : String(selectedUserId.value),
    lazy_chunk_size: 100,
    auto_width: true,
    table_attrs: ['user_login /Логин', 'fio /ФИО', 'role_name /Роль', 'user_status /Статус'].join('\n'),
    value_class_map: { Заблокирован: 'widget-table__cell-value--danger' },
    value: users.value.map((item) => ({
      id: String(item.user_id || ''),
      cells: [item.user_login || '', userName(item), item.role_name || '', statusLabel(item.user_status)],
    })),
  }));

  function snapshotUserCardFields(source: Record<string, unknown>): string {
    return JSON.stringify({
      role_name: source.role_name,
      user_login: source.user_login,
      user_surname: source.user_surname,
      user_name: source.user_name,
      user_patronymic: source.user_patronymic,
      user_email: source.user_email,
    });
  }

  function changedUserCardFields(): Record<string, unknown> {
    const previous = JSON.parse(userCardBaseline.value || '{}') as Record<string, unknown>;
    return ['role_name', 'user_login', 'user_surname', 'user_name', 'user_patronymic', 'user_email'].reduce<Record<string, unknown>>(
      (patch, field) => {
        const currentValue = userCardForm[field] ?? '';
        const previousValue = previous[field] ?? '';
        if (String(currentValue) !== String(previousValue)) patch[field] = currentValue;
        return patch;
      },
      {}
    );
  }

  async function ensureUsersLoaded(force: boolean): Promise<void> {
    if (!force && usersTabHydrated.value) return;
    await loadUsers();
    usersTabHydrated.value = true;
  }

  deps.tabEnsurers.ensureUsersLoaded = ensureUsersLoaded;

  async function loadUsers(): Promise<void> {
    await deps.run(async () => {
      users.value = [];
      selectedUserId.value = null;
      usersHasMore.value = true;
      await loadUsersPage();
    });
  }

  async function loadUsersPage(): Promise<void> {
    if (usersLoadingMore.value || !usersHasMore.value) return;
    usersLoadingMore.value = true;
    try {
      const data = await frontendApiClient.fetchAdminUsers(USER_SETTINGS_PAGE_SIZE, users.value.length);
      const chunk = Array.isArray(data.users) ? data.users : [];
      users.value = [...users.value, ...chunk];
      usersHasMore.value = chunk.length >= USER_SETTINGS_PAGE_SIZE;
    } finally {
      usersLoadingMore.value = false;
    }
  }

  function onUsersSelectUser(userId: number): void {
    selectedUserId.value = userId;
  }

  function openUserCardFromId(userId: number): void {
    const item = users.value.find((candidate) => Number(candidate.user_id) === userId);
    if (item) {
      selectedUserId.value = Number(item.user_id);
      Object.assign(userCardForm, item);
      userCardBaseline.value = snapshotUserCardFields(userCardForm);
      userCardModalOpen.value = true;
    }
  }

  function openCreateUserModal(): void {
    const defaultRole = roleOptions.value.includes('user') ? 'user' : roleOptions.value[0] || '';
    Object.assign(createUserForm, { user_login: '', role_name: defaultRole, password: '' });
    createUserModalOpen.value = true;
  }

  async function createUserAction(): Promise<void> {
    deps.loading.value = true;
    deps.error.value = '';
    deps.message.value = '';
    deps.clearTransientError();
    try {
      await frontendApiClient.createAdminUser(createUserForm);
      createUserModalOpen.value = false;
      deps.message.value = `Пользователь ${createUserForm.user_login} создан`;
      usersTabHydrated.value = false;
      await ensureUsersLoaded(true);
    } catch (err) {
      if (err instanceof FrontendApiError) {
        deps.showTransientError(err.message);
      } else {
        deps.error.value = err instanceof Error ? err.message : String(err);
      }
    } finally {
      deps.loading.value = false;
    }
  }

  async function saveUserCard(): Promise<void> {
    await deps.run(async () => {
      const patch = changedUserCardFields();
      if (!Object.keys(patch).length) {
        userCardModalOpen.value = false;
        deps.message.value = 'Изменений нет';
        return;
      }
      const data = await frontendApiClient.updateAdminUser(userCardForm.user_id, patch);
      userCardModalOpen.value = false;
      deps.message.value = 'Пользователь сохранён';
      await loadUsers();
      if (data.user?.user_id === deps.user.value?.user_id) deps.applyUser(data.user);
    });
  }

  async function toggleSelectedUserBlock(): Promise<void> {
    if (!selectedUser.value) {
      deps.message.value = 'Выберите пользователя для блокировки';
      return;
    }
    await deps.run(async () => {
      const data = await frontendApiClient.toggleAdminUserBlock(selectedUser.value?.user_id);
      deps.message.value =
        data.user?.user_status === 'blocked'
          ? `Пользователь ${data.user?.user_login} заблокирован`
          : `Пользователь ${data.user?.user_login} разблокирован`;
      await loadUsers();
    });
  }

  function openAdminPasswordModal(): void {
    Object.assign(adminPasswordForm, { password: '' });
    adminPasswordModalOpen.value = true;
  }

  function generateTemporaryPassword(): void {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let password = '';
    for (let index = 0; index < 12; index += 1) {
      password += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    adminPasswordForm.password = password;
  }

  async function refreshUsersTab(): Promise<void> {
    usersTabHydrated.value = false;
    await ensureUsersLoaded(true);
  }

  async function changeAdminPassword(): Promise<void> {
    await deps.run(async () => {
      await frontendApiClient.setAdminUserPassword(userCardForm.user_id, adminPasswordForm);
      adminPasswordModalOpen.value = false;
      deps.message.value = 'Пароль изменён';
    });
  }

  function setCreateUserField(payload: WidgetPayload): void {
    if (!payload || typeof payload.name !== 'string') return;
    createUserForm[payload.name] = payload.value ?? '';
  }

  function setUserCardField(payload: WidgetPayload): void {
    if (!payload || typeof payload.name !== 'string') return;
    userCardForm[payload.name] = payload.value ?? '';
  }

  function setAdminPasswordField(payload: WidgetPayload): void {
    if (!payload || typeof payload.name !== 'string') return;
    adminPasswordForm[payload.name] = payload.value ?? '';
  }

  function resetListsOnLogout(): void {
    users.value = [];
    selectedUserId.value = null;
    usersTabHydrated.value = false;
  }

  return {
    usersTabHydrated,
    selectedUserId,
    usersHasMore,
    usersLoadingMore,
    users,
    adminPasswordModalOpen,
    createUserModalOpen,
    userCardModalOpen,
    createUserForm,
    userCardForm,
    adminPasswordForm,
    roleOptions,
    selectedUser,
    userCardTitle,
    blockToggleLabel,
    usersTableConfig,
    ensureUsersLoaded,
    loadUsersPage,
    onUsersSelectUser,
    openUserCardFromId,
    openCreateUserModal,
    createUserAction,
    saveUserCard,
    toggleSelectedUserBlock,
    openAdminPasswordModal,
    generateTemporaryPassword,
    refreshUsersTab,
    changeAdminPassword,
    setCreateUserField,
    setUserCardField,
    setAdminPasswordField,
    resetListsOnLogout,
  };
}
