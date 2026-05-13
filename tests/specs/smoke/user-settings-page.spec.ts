import { expect, test } from '@playwright/test';

test.describe('smoke: user settings page', () => {
  test('shows auth-required state for anonymous user', async ({ page }) => {
    await page.goto('/user_settings');

    await expect(page.locator('.page-shell')).toBeVisible();
    await expect(page.getByText('Страница доступна только авторизованным пользователям. Пройдите авторизацию')).toBeVisible();
  });
});
