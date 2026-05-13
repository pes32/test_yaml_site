import { expect, test } from '@playwright/test';
import {
  TEST_ADMIN_LOGIN,
  TEST_ADMIN_PASSWORD,
  apiPost,
  cardByTitle,
  ensureTestAdmin,
  expectHeaderLoginError,
  expectApiData,
  fetchAdminUsers,
  fieldInputByLabel,
  fillFieldByLabel,
  loginApi,
  loginViaHeader,
  logoutApi,
  modalByTitle,
  nextAvailableLogin,
  type UserRecord,
} from '../../support/userSettings';

test.describe('admin auth and users', () => {
  test.beforeEach(async ({ page }) => {
    await ensureTestAdmin(page);
  });

  test('admin account saves sparse patches and can change own password', async ({ page }) => {
    test.setTimeout(90_000);

    await loginViaHeader(page, TEST_ADMIN_LOGIN, TEST_ADMIN_PASSWORD);
    await page.goto('/user_settings');
    const account = cardByTitle(page, /Аккаунт:/);
    await expect(account).toBeVisible();

    const oneFieldValue = `Автотест-${Date.now()}`;
    await fillFieldByLabel(account, 'Фамилия', oneFieldValue);
    const [singleRequest] = await Promise.all([
      page.waitForRequest((request) => request.method() === 'PUT' && new URL(request.url()).pathname === '/api/user-settings/account'),
      page.waitForResponse((response) => new URL(response.url()).pathname === '/api/user-settings/account'),
      account.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    expect(Object.keys(singleRequest.postDataJSON() as Record<string, unknown>)).toEqual(['user_surname']);
    await expect(fieldInputByLabel(account, 'Фамилия')).toHaveValue(oneFieldValue);

    const nameValue = `Имя-${Date.now()}`;
    const emailValue = `test-admin-${Date.now()}@example.test`;
    await fillFieldByLabel(account, 'Имя', nameValue);
    await fillFieldByLabel(account, 'Почта', emailValue);
    const [multiRequest] = await Promise.all([
      page.waitForRequest((request) => request.method() === 'PUT' && new URL(request.url()).pathname === '/api/user-settings/account'),
      page.waitForResponse((response) => new URL(response.url()).pathname === '/api/user-settings/account'),
      account.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    expect(Object.keys(multiRequest.postDataJSON() as Record<string, unknown>).sort()).toEqual(['user_email', 'user_name']);
    await expect(fieldInputByLabel(account, 'Имя')).toHaveValue(nameValue);
    await expect(fieldInputByLabel(account, 'Почта')).toHaveValue(emailValue);

    const temporaryPassword = `test_admin_${Date.now()}`;
    await account.getByRole('button', { name: 'Сменить пароль' }).click();
    const passwordModal = modalByTitle(page, 'Смена пароля');
    await fillFieldByLabel(passwordModal, 'Старый пароль', TEST_ADMIN_PASSWORD);
    await fillFieldByLabel(passwordModal, 'Новый пароль', temporaryPassword);
    await fillFieldByLabel(passwordModal, 'Проверка пароля', temporaryPassword);
    await fieldInputByLabel(passwordModal, 'Проверка пароля').blur();
    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === '/api/user-settings/password'),
      passwordModal.getByRole('button', { name: 'Изменить' }).click(),
    ]);
    await expect(passwordModal).toHaveCount(0);

    await logoutApi(page);
    await loginViaHeader(page, TEST_ADMIN_LOGIN, temporaryPassword);
    await apiPost<{ changed: boolean }>(page, '/api/user-settings/password', {
      old_password: temporaryPassword,
      new_password: TEST_ADMIN_PASSWORD,
    });
    await logoutApi(page);
    await loginViaHeader(page, TEST_ADMIN_LOGIN, TEST_ADMIN_PASSWORD);
  });

  test('admin creates, edits, resets and blocks a regular user', async ({ page }) => {
    test.setTimeout(120_000);

    await loginApi(page, TEST_ADMIN_LOGIN, TEST_ADMIN_PASSWORD);
    const createdLogin = await nextAvailableLogin(page, 'aaa_test_user_e2e');
    const createdPassword = `pwd_${Date.now()}`;
    const managedPassword = `managed_${Date.now()}`;
    let renamedLogin = `${createdLogin}_r`;

    await page.goto('/user_settings');
    await page.getByRole('button', { name: 'Пользователи' }).click();
    await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible();

    await page.getByRole('button', { name: /Создать/ }).click();
    const createModal = modalByTitle(page, 'Создание пользователя');
    await fillFieldByLabel(createModal, 'Логин', createdLogin);
    await fillFieldByLabel(createModal, 'Пароль', createdPassword);
    const [createResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/admin/users'),
      createModal.getByRole('button', { name: 'Создать' }).click(),
    ]);
    const created = (await expectApiData<{ user: UserRecord }>(createResponse, 'create user')).user;
    expect(created.user_login).toBe(createdLogin);
    expect(created.role_name).toBe('user');
    renamedLogin = await nextAvailableLogin(page, `${createdLogin}_r`);

    const createdRow = page.locator(`[data-row-id="${created.user_id}"]`).first();
    await expect(createdRow).toBeVisible();
    await createdRow.dblclick();
    let card = modalByTitle(page, new RegExp(createdLogin));
    await expect(card).toBeVisible();
    await fillFieldByLabel(card, 'Фамилия', 'Тестовый');
    const [singleUpdateRequest, singleUpdateResponse] = await Promise.all([
      page.waitForRequest((request) => request.method() === 'PUT' && new URL(request.url()).pathname === `/api/admin/users/${created.user_id}`),
      page.waitForResponse((response) => new URL(response.url()).pathname === `/api/admin/users/${created.user_id}`),
      card.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    expect(Object.keys(singleUpdateRequest.postDataJSON() as Record<string, unknown>)).toEqual(['user_surname']);
    expect((await expectApiData<{ user: UserRecord }>(singleUpdateResponse, 'single user update')).user.user_surname).toBe('Тестовый');

    await page.locator(`[data-row-id="${created.user_id}"]`).first().dblclick();
    card = modalByTitle(page, new RegExp(createdLogin));
    await fillFieldByLabel(card, 'Логин', renamedLogin);
    await fillFieldByLabel(card, 'Фамилия', 'Авто');
    await fillFieldByLabel(card, 'Имя', 'Пользователь');
    await fillFieldByLabel(card, 'Отчество', 'Проверочный');
    await fillFieldByLabel(card, 'Почта', `${renamedLogin}@example.test`);
    const [multiUpdateRequest, multiUpdateResponse] = await Promise.all([
      page.waitForRequest((request) => request.method() === 'PUT' && new URL(request.url()).pathname === `/api/admin/users/${created.user_id}`),
      page.waitForResponse((response) => new URL(response.url()).pathname === `/api/admin/users/${created.user_id}`),
      card.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    expect(Object.keys(multiUpdateRequest.postDataJSON() as Record<string, unknown>).sort()).toEqual([
      'user_email',
      'user_login',
      'user_name',
      'user_patronymic',
      'user_surname',
    ]);
    const updated = (await expectApiData<{ user: UserRecord }>(multiUpdateResponse, 'multi user update')).user;
    expect(updated).toMatchObject({
      user_login: renamedLogin,
      user_surname: 'Авто',
      user_name: 'Пользователь',
      user_patronymic: 'Проверочный',
      user_email: `${renamedLogin}@example.test`,
    });

    await page.locator(`[data-row-id="${created.user_id}"]`).first().dblclick();
    card = modalByTitle(page, new RegExp(renamedLogin));
    await card.getByRole('button', { name: 'Сменить пароль' }).click();
    const adminPasswordModal = modalByTitle(page, 'Смена пароля пользователя');
    await fillFieldByLabel(adminPasswordModal, 'Новый пароль', managedPassword);
    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === `/api/admin/users/${created.user_id}/password`),
      adminPasswordModal.getByRole('button', { name: 'Изменить' }).click(),
    ]);
    await expect(adminPasswordModal).toHaveCount(0);
    await modalByTitle(page, new RegExp(renamedLogin)).getByRole('button', { name: 'Отмена' }).click();

    await logoutApi(page);
    await loginViaHeader(page, renamedLogin, managedPassword);
    await page.goto('/user_settings');
    await expect(page.getByRole('button', { name: 'Аккаунт' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Пользователи' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Настройка БД' })).toHaveCount(0);

    await logoutApi(page);
    await loginViaHeader(page, TEST_ADMIN_LOGIN, TEST_ADMIN_PASSWORD);
    await page.goto('/user_settings');
    await page.getByRole('button', { name: 'Пользователи' }).click();
    await page.locator(`[data-row-id="${created.user_id}"]`).first().click();
    const [blockResponse] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === `/api/admin/users/${created.user_id}/toggle-block`),
      page.getByRole('button', { name: 'Заблокировать' }).click(),
    ]);
    const blocked = (await expectApiData<{ user: UserRecord }>(blockResponse, 'block user')).user;
    expect(blocked.user_status).toBe('blocked');
    const users = await fetchAdminUsers(page);
    expect(users.find((user) => user.user_id === created.user_id)?.user_status).toBe('blocked');

    await logoutApi(page);
    await expectHeaderLoginError(page, renamedLogin, managedPassword, /заблокирован/i);
  });
});
