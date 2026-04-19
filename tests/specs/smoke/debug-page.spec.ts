import { expect, test } from '@playwright/test';

test.describe('smoke: debug page', () => {
  test('loads API, logs, YAML pages and SQL shell states', async ({ page }) => {
    await page.goto('/debug');
    await expect(page.locator('.page-shell')).toBeVisible();

    await expect(page.getByRole('tab', { name: 'API' })).toHaveClass(/active/);
    await expect(page.getByText('Структура API')).toBeVisible();
    await expect(page.getByText('/api/pages')).toBeVisible();

    await page.getByRole('tab', { name: 'Yaml' }).click();
    await expect(page.getByText('Зарегистрированные страницы (YAML)')).toBeVisible();
    await expect(page.getByText('2_widget_demo')).toBeVisible();
    await expect(page.getByRole('link', { name: '/widget_demo' })).toHaveAttribute('href', '/widget_demo');

    await page.getByRole('tab', { name: 'Log' }).click();
    await expect(page.getByText('Лог (последние 1000 строк)')).toBeVisible();
    await expect.poll(async () => {
      const panelText = await page.locator('.tab-pane.active').textContent();
      return panelText?.includes('Загрузка...');
    }).toBe(false);

    await page.getByRole('tab', { name: 'SQL' }).click();
    await expect(page.getByText('SQL (только SELECT)')).toBeVisible();
    await expect(page.getByPlaceholder('SELECT * FROM your_table LIMIT 20')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выполнить' })).toBeDisabled();
  });
});
