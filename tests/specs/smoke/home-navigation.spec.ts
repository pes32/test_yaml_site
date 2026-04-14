import { expect, test } from '@playwright/test';
import { gotoHome, waitForPageReady } from '../../support/app';

test.describe('smoke: home and demo navigation', () => {
  test('opens the home page', async ({ page }) => {
    await gotoHome(page);

    await expect(page).toHaveTitle(/YAML System - Дратути!/);
    await expect(page.getByText('Шалом, землянин!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Смотреть систему' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'YAML System' })).toHaveAttribute('href', '/');
  });

  test('follows the real UI path from home to 2_widget_demo', async ({ page }) => {
    await gotoHome(page);

    await page.getByRole('button', { name: 'Смотреть систему' }).click();
    await page.waitForURL(/\/ui_demo(#.*)?$/);
    await waitForPageReady(page);
    await expect(page.locator('body')).toHaveAttribute('data-page-name', '1_ui_demo');

    await page.locator('[data-menu-name="Второе меню"]').click();
    await page.locator('[data-tab-name="Вкладка 2. Без картинки ;("]').click();
    await page.getByRole('button', { name: 'Посмотреть виджеты' }).click();

    await page.waitForURL(/\/widget_demo(#.*)?$/);
    await waitForPageReady(page);
    await expect(page.locator('body')).toHaveAttribute('data-page-name', '2_widget_demo');
    await expect(page.locator('[data-menu-name="Строковые виджеты"]')).toBeVisible();
    await expect(page.locator('[data-menu-name="Таблицы"]')).toBeVisible();
  });
});
