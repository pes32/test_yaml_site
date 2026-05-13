import { computed, reactive, ref, watch, type Ref } from 'vue';
import { frontendApiClient, type RoleRecord, type UserRecord } from '@frontend/runtime/api_client.ts';
import { fieldConfig, type WidgetPayload } from './user_settings_field_helpers.ts';

export function useUserSettingsBootstrap(deps: {
  user: Ref<UserRecord | null>;
  roles: Ref<RoleRecord[]>;
  run: (action: () => Promise<void>) => Promise<void>;
  applyLocationHash: () => void;
  updateLocationHash: () => void;
  message: Ref<string>;
}) {
  const confirmPwdTouched = ref(false);
  const confirmPwdInvalid = ref(false);

  const accountForm = reactive<Record<string, unknown>>({});
  const accountBaseline = ref('');
  const passwordForm = reactive<Record<string, unknown>>({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const passwordModalOpen = ref(false);

  const isAuthorized = computed(() => Boolean(deps.user.value));

  function snapshotAccountFields(): string {
    return JSON.stringify({
      user_surname: accountForm.user_surname,
      user_name: accountForm.user_name,
      user_patronymic: accountForm.user_patronymic,
      user_email: accountForm.user_email,
    });
  }

  function changedAccountFields(): Record<string, unknown> {
    const previous = JSON.parse(accountBaseline.value || '{}') as Record<string, unknown>;
    return ['user_surname', 'user_name', 'user_patronymic', 'user_email'].reduce<Record<string, unknown>>((patch, field) => {
      const currentValue = accountForm[field] ?? '';
      const previousValue = previous[field] ?? '';
      if (String(currentValue) !== String(previousValue)) patch[field] = currentValue;
      return patch;
    }, {});
  }

  const accountDirty = computed(() => snapshotAccountFields() !== accountBaseline.value);

  const confirmPwdFieldConfig = computed(() =>
    fieldConfig('Проверка пароля', passwordForm.confirm_password, false, 'password', {
      ...(confirmPwdTouched.value && confirmPwdInvalid.value
        ? { err_text: 'Пароль не совпадает с новым' }
        : {}),
    })
  );

  const passwordChangeBlocked = computed(() => {
    if (!String(passwordForm.old_password || '').trim()) return true;
    if (!String(passwordForm.new_password || '').trim()) return true;
    if (!String(passwordForm.confirm_password || '').trim()) return true;
    if (!confirmPwdTouched.value) return true;
    return confirmPwdInvalid.value;
  });

  const accountTitle = computed(() => {
    const u = deps.user.value;
    if (!u) return 'Аккаунт';
    return `Аккаунт: ${String(u.user_login || '')} - ${String(u.user_id ?? '')}`;
  });

  function applyUser(nextUser: UserRecord | null): void {
    deps.user.value = nextUser;
    Object.keys(accountForm).forEach((key) => delete accountForm[key]);
    Object.assign(accountForm, nextUser || {});
    accountBaseline.value = snapshotAccountFields();
  }

  async function loadBootstrap(): Promise<void> {
    await deps.run(async () => {
      const data = await frontendApiClient.fetchUserSettingsBootstrap();
      applyUser(data.user || null);
      if (data.is_admin) {
        const rolesData = await frontendApiClient.fetchAdminRoles();
        deps.roles.value = Array.isArray(rolesData.roles) ? rolesData.roles : [];
      }
      deps.applyLocationHash();
      if (typeof window !== 'undefined' && !window.location.hash) {
        deps.updateLocationHash();
      }
    });
  }

  async function saveAccount(): Promise<void> {
    await deps.run(async () => {
      const data = await frontendApiClient.saveOwnProfile(changedAccountFields());
      applyUser(data.user || null);
      deps.message.value = 'Аккаунт сохранён';
    });
  }

  function openPasswordModal(): void {
    confirmPwdTouched.value = false;
    confirmPwdInvalid.value = false;
    Object.assign(passwordForm, { old_password: '', new_password: '', confirm_password: '' });
    passwordModalOpen.value = true;
  }

  function onPasswordConfirmBlur(): void {
    confirmPwdTouched.value = true;
    confirmPwdInvalid.value =
      String(passwordForm.new_password || '') !== String(passwordForm.confirm_password || '');
  }

  async function changePassword(pwDeps: {
    isAdmin: Ref<boolean>;
    applyLocationHash: () => void;
    error: Ref<string>;
    message: Ref<string>;
  }): Promise<void> {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      pwDeps.error.value = 'Новый пароль и проверка пароля не совпадают';
      return;
    }
    await deps.run(async () => {
      await frontendApiClient.changeOwnPassword(passwordForm);
      passwordModalOpen.value = false;
      Object.assign(accountForm, deps.user.value || {});
      if (pwDeps.isAdmin.value && !deps.roles.value.length) {
        const rolesData = await frontendApiClient.fetchAdminRoles();
        deps.roles.value = Array.isArray(rolesData.roles) ? rolesData.roles : [];
      }
      pwDeps.message.value = 'Пароль изменён';
      pwDeps.applyLocationHash();
    });
  }

  watch(
    () => [passwordForm.new_password, passwordForm.confirm_password],
    () => {
      if (!confirmPwdTouched.value) return;
      confirmPwdInvalid.value =
        String(passwordForm.new_password || '') !== String(passwordForm.confirm_password || '');
    }
  );

  function setAccountField(payload: WidgetPayload): void {
    if (!payload || typeof payload.name !== 'string') return;
    accountForm[payload.name] = payload.value ?? '';
  }

  function setPasswordField(payload: WidgetPayload): void {
    if (!payload || typeof payload.name !== 'string') return;
    passwordForm[payload.name] = payload.value ?? '';
  }

  return {
    isAuthorized,
    accountForm,
    accountBaseline,
    accountDirty,
    accountTitle,
    applyUser,
    loadBootstrap,
    saveAccount,
    passwordModalOpen,
    passwordForm,
    openPasswordModal,
    onPasswordConfirmBlur,
    changePassword,
    confirmPwdTouched,
    confirmPwdInvalid,
    confirmPwdFieldConfig,
    passwordChangeBlocked,
    setAccountField,
    setPasswordField,
  };
}
