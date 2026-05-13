import { computed, reactive, ref, type Ref } from 'vue';
import { frontendApiClient } from '@frontend/runtime/api_client.ts';
import type { WidgetPayload } from './user_settings_field_helpers.ts';
import type { UserSettingsTabEnsurers } from './use_user_settings_tab_ensurers.ts';

export function useDbSettingsTab(deps: {
  tabEnsurers: UserSettingsTabEnsurers;
  run: (action: () => Promise<void>) => Promise<void>;
  showTransientError: (text: string) => void;
  message: Ref<string>;
}) {
  const dbSettingsHydrated = ref(false);
  const dbChecked = ref(false);
  const dbPasswordChanged = ref(false);
  const dbPasswordSource = ref('');
  const dbPasswordSet = ref(false);
  const sqlActiveView = ref<'raw' | 'table'>('raw');
  const sqlRowsPayload = ref<Record<string, unknown> | null>(null);
  const sqlQuery = ref('SELECT * FROM users');
  const sqlResult = ref('');
  const dbForm = reactive<Record<string, unknown>>({
    address: '',
    port: '',
    db_name: '',
    user: '',
    password: '',
  });

  const dbPasswordPlaceholder = computed(() => (dbPasswordChanged.value ? '' : '********'));

  const sqlTableWidgetConfig = computed(() => {
    const payload = sqlRowsPayload.value;
    if (!payload || payload.success === false) {
      return {
        widget: 'table',
        auto_width: true,
        readonly: true,
        toolbar: false,
        table_attrs: ' ',
        value: [] as { id: string; cells: string[] }[],
      };
    }
    const cols = Array.isArray(payload.columns) ? (payload.columns as unknown[]).map(String) : [];
    const rows = Array.isArray(payload.data) ? (payload.data as Record<string, unknown>[]) : [];
    const header = cols.map((c) => `${c} /${c}`).join('\n');
    return {
      widget: 'table',
      auto_width: true,
      readonly: true,
      toolbar: false,
      table_attrs: header || ' ',
      value: rows.map((row, idx) => ({
        id: String(idx),
        cells: cols.map((col) => (row[col] == null ? '' : String(row[col]))),
      })),
    };
  });

  async function ensureDbSettingsLoaded(force: boolean): Promise<void> {
    if (!force && dbSettingsHydrated.value) return;
    await loadDbSettings();
    dbSettingsHydrated.value = true;
  }

  deps.tabEnsurers.ensureDbSettingsLoaded = ensureDbSettingsLoaded;

  function applyDbSettingsPayload(data: Record<string, unknown>): void {
    const settings = (data.settings || {}) as Record<string, unknown>;
    Object.assign(dbForm, {
      address: String(settings.address || ''),
      port: String(settings.port || ''),
      db_name: String(settings.db_name || ''),
      user: String(settings.user || ''),
      password: '',
    });
    dbPasswordChanged.value = false;
    dbPasswordSet.value = Boolean(settings.password_set);
    dbPasswordSource.value = String(data.source || '');
    dbChecked.value = false;
  }

  function dbSettingsRequestPayload(): Record<string, unknown> {
    return {
      ...dbForm,
      password_changed: dbPasswordChanged.value,
      password_source: dbPasswordSource.value,
    };
  }

  async function loadDbSettings(): Promise<void> {
    await deps.run(async () => {
      applyDbSettingsPayload(await frontendApiClient.fetchAdminDbSettings());
    });
  }

  async function loadFallbackDbSettings(): Promise<void> {
    await deps.run(async () => {
      applyDbSettingsPayload(await frontendApiClient.fetchFallbackDbSettings());
      deps.message.value = 'Настройки из файла проекта загружены в форму';
    });
  }

  async function testDbSettings(): Promise<void> {
    dbChecked.value = false;
    const pwdEmpty = !String(dbForm.password || '').trim();
    if (pwdEmpty && (dbPasswordChanged.value || !dbPasswordSet.value)) {
      dbChecked.value = false;
      deps.showTransientError('Пароль не указан. Проверка подключения не выполнялась.');
      return;
    }
    await deps.run(async () => {
      try {
        const data = await frontendApiClient.testDbSettings(dbSettingsRequestPayload());
        dbChecked.value = true;
        deps.message.value = String(data.message || 'Подключение к БД проверено: успешно');
      } catch (err) {
        dbChecked.value = false;
        deps.showTransientError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function saveDbSettings(): Promise<void> {
    await deps.run(async () => {
      const data = await frontendApiClient.saveDbSettings(dbSettingsRequestPayload());
      applyDbSettingsPayload(data);
      dbChecked.value = false;
      deps.message.value = 'Настройки подключения сохранены';
    });
  }

  async function runSql(): Promise<void> {
    await deps.run(async () => {
      sqlRowsPayload.value = null;
      const data = await frontendApiClient.runAdminSql(sqlQuery.value);
      sqlResult.value = JSON.stringify(data, null, 2);
      sqlRowsPayload.value = data as Record<string, unknown>;
      const cols = Array.isArray((data as Record<string, unknown>).columns)
        ? ((data as Record<string, unknown>).columns as unknown[])
        : [];
      sqlActiveView.value = cols.length ? 'table' : 'raw';
    });
  }

  function setDbField(payload: WidgetPayload): void {
    if (!payload || typeof payload.name !== 'string') return;
    dbForm[payload.name] = payload.value ?? '';
    if (payload.name === 'password') dbPasswordChanged.value = true;
    dbChecked.value = false;
  }

  return {
    dbSettingsHydrated,
    dbChecked,
    dbPasswordChanged,
    dbPasswordSource,
    dbPasswordSet,
    sqlActiveView,
    sqlRowsPayload,
    sqlQuery,
    sqlResult,
    dbForm,
    dbPasswordPlaceholder,
    sqlTableWidgetConfig,
    ensureDbSettingsLoaded,
    loadDbSettings,
    loadFallbackDbSettings,
    testDbSettings,
    saveDbSettings,
    runSql,
    setDbField,
  };
}
