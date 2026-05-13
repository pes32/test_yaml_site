import { expect, type APIResponse, type Locator, type Page } from '@playwright/test';

export const TEST_ADMIN_LOGIN = 'test_admin';
export const TEST_ADMIN_PASSWORD = 'test_admin';
export const DEFAULT_ADMIN_LOGIN = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'admin';

export type ApiPayload<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: string };
};

export type UserRecord = {
  user_id: number;
  user_login: string;
  user_surname?: string | null;
  user_name?: string | null;
  user_patronymic?: string | null;
  user_email?: string | null;
  user_status: 'active' | 'blocked';
  role_name: 'admin' | 'user' | string;
};

export type DbTableRecord = {
  table_schema: string;
  table_name: string;
  table_type: string;
};

export type DbColumnRecord = {
  column_name: string;
  column_default: string | null;
  data_type: string;
  character_maximum_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  datetime_precision?: number | null;
  interval_type?: string | null;
  interval_precision?: number | null;
  is_nullable: 'YES' | 'NO';
  is_unique?: 'YES' | 'NO';
};

export type DbConstraintsBundle = {
  primary_key: { constraint_name: string; columns: string[] } | null;
  foreign_keys: Array<{
    constraint_name: string;
    columns: string[];
    foreign_schema: string;
    foreign_table: string;
    foreign_columns: string[];
    update_rule: string;
    delete_rule: string;
  }>;
};

type LoginAttempt = {
  ok: boolean;
  status: number;
  data?: { user: UserRecord };
  errorMessage: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readPayload<T>(response: APIResponse): Promise<ApiPayload<T>> {
  return (await response.json().catch(() => ({ ok: false }))) as ApiPayload<T>;
}

export async function expectApiData<T>(response: APIResponse, label: string): Promise<T> {
  const payload = await readPayload<T>(response);
  expect(response.ok(), `${label} HTTP ${response.status()}: ${payload.error?.message || ''}`).toBeTruthy();
  expect(payload.ok, `${label} payload ok`).toBe(true);
  return payload.data as T;
}

export async function apiGet<T>(page: Page, path: string): Promise<T> {
  return expectApiData<T>(await page.request.get(path), `GET ${path}`);
}

export async function apiPost<T>(page: Page, path: string, data?: unknown): Promise<T> {
  return expectApiData<T>(await page.request.post(path, { data }), `POST ${path}`);
}

export async function apiPut<T>(page: Page, path: string, data?: unknown): Promise<T> {
  return expectApiData<T>(await page.request.put(path, { data }), `PUT ${path}`);
}

export async function loginAttemptApi(page: Page, login: string, password: string): Promise<LoginAttempt> {
  const response = await page.request.post('/api/auth/login', { data: { login, password } });
  const payload = await readPayload<{ user: UserRecord }>(response);
  return {
    ok: response.ok() && payload.ok === true,
    status: response.status(),
    data: payload.data,
    errorMessage: payload.error?.message || '',
  };
}

export async function loginApi(page: Page, login = TEST_ADMIN_LOGIN, password = TEST_ADMIN_PASSWORD): Promise<UserRecord> {
  const attempt = await loginAttemptApi(page, login, password);
  expect(attempt.ok, `login ${login}: ${attempt.status} ${attempt.errorMessage}`).toBe(true);
  return attempt.data!.user;
}

export async function logoutApi(page: Page): Promise<void> {
  await page.request.post('/api/auth/logout').catch(() => null);
}

export async function fetchAdminUsers(page: Page): Promise<UserRecord[]> {
  const data = await apiGet<{ users: UserRecord[] }>(page, '/api/admin/users?limit=500&offset=0');
  return data.users || [];
}

export async function fetchDbTables(page: Page): Promise<DbTableRecord[]> {
  const data = await apiGet<{ items: DbTableRecord[] }>(page, '/api/admin/db-schema/tables');
  return data.items || [];
}

export async function fetchDbColumns(page: Page, schema: string, table: string): Promise<DbColumnRecord[]> {
  const params = new URLSearchParams({ schema, table });
  const data = await apiGet<{ columns: DbColumnRecord[] }>(page, `/api/admin/db-schema/columns?${params.toString()}`);
  return data.columns || [];
}

export async function fetchDbConstraints(page: Page, schema: string, table: string): Promise<DbConstraintsBundle> {
  const params = new URLSearchParams({ schema, table });
  return apiGet<DbConstraintsBundle>(page, `/api/admin/db-schema/constraints?${params.toString()}`);
}

export async function nextAvailableLogin(page: Page, baseLogin: string): Promise<string> {
  const existing = new Set((await fetchAdminUsers(page)).map((user) => String(user.user_login || '')));
  if (!existing.has(baseLogin)) return baseLogin;
  for (let attempt = 1; attempt <= 200; attempt += 1) {
    const candidate = `${baseLogin}_${attempt}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${baseLogin}_${Date.now()}`;
}

export async function nextAvailableTableName(page: Page, schema: string, baseName: string): Promise<string> {
  const existing = new Set(
    (await fetchDbTables(page))
      .filter((item) => item.table_schema === schema)
      .map((item) => item.table_name)
  );
  if (!existing.has(baseName)) return baseName;
  for (let attempt = 1; attempt <= 200; attempt += 1) {
    const candidate = `${baseName}_${attempt}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${baseName}_${Date.now()}`;
}

async function normalizeTestAdminFromCurrentAdmin(page: Page): Promise<void> {
  const users = await fetchAdminUsers(page);
  const existing = users.find((user) => user.user_login === TEST_ADMIN_LOGIN);

  if (!existing) {
    await apiPost<{ user: UserRecord }>(page, '/api/admin/users', {
      user_login: TEST_ADMIN_LOGIN,
      role_name: 'admin',
      password: TEST_ADMIN_PASSWORD,
    });
    return;
  }

  await apiPut<{ user: UserRecord }>(page, `/api/admin/users/${existing.user_id}`, {
    role_name: 'admin',
    user_login: TEST_ADMIN_LOGIN,
    user_surname: '',
    user_name: '',
    user_patronymic: '',
    user_email: '',
  });
  await apiPost<{ changed: boolean }>(page, `/api/admin/users/${existing.user_id}/password`, {
    password: TEST_ADMIN_PASSWORD,
  });
  if (existing.user_status === 'blocked') {
    await apiPost<{ user: UserRecord }>(page, `/api/admin/users/${existing.user_id}/toggle-block`);
  }
}

export async function ensureTestAdmin(page: Page): Promise<void> {
  let attempt = await loginAttemptApi(page, TEST_ADMIN_LOGIN, TEST_ADMIN_PASSWORD);
  if (attempt.ok && attempt.data?.user.role_name === 'admin') {
    await normalizeTestAdminFromCurrentAdmin(page);
    await logoutApi(page);
    return;
  }

  await logoutApi(page);
  attempt = await loginAttemptApi(page, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD);
  expect(
    attempt.ok,
    `Не удалось подготовить ${TEST_ADMIN_LOGIN}: нужен существующий ${DEFAULT_ADMIN_LOGIN}/${DEFAULT_ADMIN_PASSWORD}. ${attempt.status} ${attempt.errorMessage}`
  ).toBe(true);
  await normalizeTestAdminFromCurrentAdmin(page);
  await logoutApi(page);

  const verify = await loginAttemptApi(page, TEST_ADMIN_LOGIN, TEST_ADMIN_PASSWORD);
  expect(verify.ok, `verify ${TEST_ADMIN_LOGIN}: ${verify.status} ${verify.errorMessage}`).toBe(true);
  expect(verify.data?.user.role_name).toBe('admin');
  await logoutApi(page);
}

export async function loginViaHeader(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/');
  await page.locator('#headerAuthButton').click();
  await expect(page.locator('#headerLoginModal')).toHaveClass(/header-login-modal--open/);
  await page.locator('#headerLoginInput').fill(login);
  await page.locator('#headerPasswordInput').fill(password);
  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/login'),
    page.locator('#headerLoginForm').getByRole('button', { name: 'Войти' }).click(),
  ]);
  await expect(page.locator('#headerLoginModal')).not.toHaveClass(/header-login-modal--open/);
  await expect(page.locator('#headerAuthText')).not.toHaveText('Вход');
  const data = await apiGet<{ user: UserRecord | null }>(page, '/api/auth/me');
  expect(data.user?.user_login).toBe(login);
}

export async function expectHeaderLoginError(page: Page, login: string, password: string, message: RegExp): Promise<void> {
  await page.goto('/');
  await page.locator('#headerAuthButton').click();
  await page.locator('#headerLoginInput').fill(login);
  await page.locator('#headerPasswordInput').fill(password);
  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/login'),
    page.locator('#headerLoginForm').getByRole('button', { name: 'Войти' }).click(),
  ]);
  await expect(page.locator('#headerLoginError')).toContainText(message);
}

export function cardByTitle(page: Page, title: string | RegExp): Locator {
  return page.locator('.page-section-card').filter({ hasText: title }).first();
}

export function modalByTitle(page: Page, title: string | RegExp): Locator {
  return page.locator('.modal-content').filter({ has: page.locator('.modal-title').filter({ hasText: title }) }).last();
}

export function fieldInputByLabel(scope: Locator, label: string): Locator {
  const field = scope.locator('.md3-field').filter({ hasText: label }).last();
  return field.locator('input, textarea').first();
}

export async function fillFieldByLabel(scope: Locator, label: string, value: string): Promise<void> {
  const input = fieldInputByLabel(scope, label);
  await expect(input, `field ${label}`).toBeVisible();
  await input.fill(value);
}

export async function selectListByLabel(page: Page, scope: Locator, label: string, option: string): Promise<void> {
  const input = fieldInputByLabel(scope, label);
  await expect(input, `list ${label}`).toBeVisible();
  await input.focus();
  await input.press('Enter');
  const controls = await input.getAttribute('aria-controls');
  expect(controls, `${label} aria-controls`).toBeTruthy();
  const listbox = page.locator(`#${controls}`);
  await expect(listbox).toBeVisible();
  await listbox.getByRole('option').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(option)}\\s*$`) }).click();
  await expect(input).toHaveValue(option);
}

export async function selectVocByLabel(
  page: Page,
  scope: Locator,
  label: string,
  search: string,
  rowText: string
): Promise<void> {
  const input = fieldInputByLabel(scope, label);
  await expect(input, `voc ${label}`).toBeVisible();
  await input.focus();
  await input.press('Alt+ArrowDown');
  const modal = modalByTitle(page, label);
  await expect(modal).toBeVisible();
  await modal.locator('.voc-modal-search-input').fill(search);
  const rows = modal.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  let matched: Locator | null = null;
  for (let index = 0; index < await rows.count(); index += 1) {
    const row = rows.nth(index);
    const firstCellText = (await row.locator('td').first().innerText()).trim();
    if (firstCellText === rowText) {
      matched = row;
      break;
    }
  }
  expect(matched, `voc row ${rowText}`).not.toBeNull();
  await matched!.click();
  await modal.getByRole('button', { name: 'Выбрать' }).click();
  await expect(modal).toHaveCount(0);
}

export async function pressTabUntilFocusedButton(page: Page, buttonName: string, maxTabs = 3): Promise<number> {
  const expected = new RegExp(`^\\s*${escapeRegExp(buttonName)}\\s*$`);
  for (let count = 0; count <= maxTabs; count += 1) {
    const active = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return {
        tag: element?.tagName || '',
        text: (element?.innerText || element?.textContent || '').trim(),
      };
    });
    if (active.tag === 'BUTTON' && expected.test(active.text)) {
      return count;
    }
    if (count < maxTabs) {
      await page.keyboard.press('Tab');
    }
  }
  const active = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return `${element?.tagName || ''} ${(element?.innerText || element?.textContent || '').trim()}`;
  });
  throw new Error(`Не удалось добраться Tab до кнопки "${buttonName}" за ${maxTabs} шага. Активный элемент: ${active}`);
}

export async function executeConfirmWithTab(page: Page, maxTabs = 3): Promise<void> {
  const confirm = modalByTitle(page, /Подтверждение|PRIMARY KEY|FOREIGN KEY|столбца/);
  await expect(confirm).toBeVisible();
  await pressTabUntilFocusedButton(page, 'Выполнить', maxTabs);
  await page.keyboard.press('Enter');
  await expect(confirm).toHaveCount(0);
}

export async function expectNoModalWithTitle(page: Page, title: string | RegExp): Promise<void> {
  await expect(modalByTitle(page, title)).toHaveCount(0);
}
