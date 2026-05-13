export const USER_SETTINGS_PAGE_SIZE = 100;

export const USER_SETTINGS_SETTINGS_TABS = [
  { id: 'connection', label: 'Подключение' },
  { id: 'schema', label: 'Схема БД' },
  { id: 'backup', label: 'Бэкап' },
] as const;

export const USER_SETTINGS_STATUS_OPTIONS = ['active', 'blocked'];
