import { expect, test } from '@playwright/test';
import { openDemoTab, widget } from '../../support/app';

test.describe('behavior: buttons, split buttons and modals', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoTab(page, 'Строковые виджеты', 'Демонстрация кнопок');
  });

  test('button attrs render visual variants and safe titles', async ({ page }) => {
    await expect(widget(page, 'button_1').getByRole('button')).toHaveAttribute('title', 'Кнопка c фоном и иконкой');
    await expect(widget(page, 'button_2').getByRole('button')).toHaveAttribute('title', 'Кнопка без фона с иконкой');
    await expect(widget(page, 'button_3').getByRole('button', { name: 'Кнопка' })).toBeVisible();
    await expect(widget(page, 'button_4')).toContainText('Иконка + кнопка на 500px');
    await expect(widget(page, 'button_5').getByRole('button')).toHaveAttribute('title', 'ОГРОМНАЯ КНОПКА');
  });

  test('button command uses the shared execute pipeline', async ({ page }) => {
    await page.route('**/api/execute', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            command: 'test_command',
            data: null,
            message: 'Команда выполнена',
            page: '2_widget_demo',
            params: {},
            widget: 'func_1'
          }
        })
      });
    });

    const executeRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && request.url().endsWith('/api/execute')
    );

    await widget(page, 'func_1').getByRole('button', { name: 'Команда' }).click();

    const payload = JSON.parse((await executeRequest).postData() || '{}');
    expect(payload).toMatchObject({
      command: 'test_command',
      output_attrs: [],
      page: '2_widget_demo',
      widget: 'func_1'
    });
  });

  test('split buttons expose all configured actions without firing them on open', async ({ page }) => {
    await widget(page, 'button_6').getByRole('button', { name: 'Открыть список действий' }).click();
    await expect(page.getByRole('menuitem', { name: 'Первый пункт' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Второй пункт' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Третий пункт' })).toBeVisible();
    await page.keyboard.press('Escape');

    await widget(page, 'func_6').getByRole('button', { name: 'Открыть список действий' }).click();
    await expect(page.getByRole('menuitem', { name: 'Форма 1.1' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Дизайн MD3' })).toBeVisible();
    await page.keyboard.press('Escape');

    await widget(page, 'func_7').getByRole('button', { name: 'Открыть список действий' }).click();
    await expect(page.getByRole('menuitem', { name: 'Мем 1' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Мем 2' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Мем 3' })).toBeVisible();
  });

  test('split button supports keyboard navigation, tab escape and outside close', async ({ page }) => {
    const func6Toggle = widget(page, 'func_6').getByRole('button', { name: 'Открыть список действий' });
    await func6Toggle.focus();
    await page.keyboard.press('ArrowDown');

    const menuId = await func6Toggle.getAttribute('aria-controls');
    expect(menuId).toBeTruthy();
    const menu = page.locator(`#${menuId}`);
    await expect(menu).toBeVisible();
    await expect(menu).toHaveClass(/scrollable/);

    const firstItem = menu.getByRole('menuitem').first();
    const lastItem = menu.getByRole('menuitem').last();
    await expect(firstItem).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(lastItem).toBeFocused();

    const maxHeight = await menu.evaluate((element) =>
      Number.parseFloat(window.getComputedStyle(element).maxHeight)
    );
    expect(maxHeight).toBeGreaterThan(0);

    await page.keyboard.press('Tab');
    await expect(menu).toBeHidden();
    await expect(widget(page, 'func_7').getByRole('button', { name: 'Открыть список действий' })).toBeFocused();

    await func6Toggle.click();
    await expect(menu).toBeVisible();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await expect(menu).toBeHidden();
  });

  test('split button command item uses the shared execute pipeline', async ({ page }) => {
    await page.route('**/api/execute', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            command: 'fake_visual_action_2',
            data: null,
            message: 'Команда выполнена',
            page: '2_widget_demo',
            params: {},
            widget: 'button_6'
          }
        })
      });
    });

    const executeRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && request.url().endsWith('/api/execute')
    );

    await widget(page, 'button_6').getByRole('button', { name: 'Открыть список действий' }).click();
    await page.getByRole('menuitem', { name: 'Второй пункт' }).click();

    const payload = JSON.parse((await executeRequest).postData() || '{}');
    expect(payload).toMatchObject({
      command: 'fake_visual_action_2',
      output_attrs: [],
      page: '2_widget_demo',
      widget: 'button_6'
    });
  });

  test('confirm dialogs can be accepted or cancelled without accidental navigation', async ({ page }) => {
    await widget(page, 'func_3').getByRole('button', { name: 'Диалог (url)' }).click();
    await expect(page.locator('.confirm-modal-content')).toBeVisible();
    await expect(page.locator('.modal-title')).toContainText('Понравился рикрол?');
    await page.getByRole('button', { name: 'Нет, спасибо' }).click();
    await expect(page.locator('.confirm-modal-content')).toHaveCount(0);
    await expect(page).toHaveURL(/\/widget_demo(#.*)?$/);

    await widget(page, 'func_4').getByRole('button', { name: 'Диалог (command)' }).click();
    await expect(page.locator('.confirm-modal-content')).toBeVisible();
    await expect(page.locator('.confirm-modal-content')).toContainText('Очень длинный текст сообщения');
    await page.getByRole('button', { name: 'Отмена' }).click();
    await expect(page.locator('.confirm-modal-content')).toHaveCount(0);

    await page.route('**/api/execute', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            command: 'test_command',
            data: null,
            message: 'Команда выполнена',
            page: '2_widget_demo',
            params: {},
            widget: 'func_4'
          }
        })
      });
    });

    await widget(page, 'func_4').getByRole('button', { name: 'Диалог (command)' }).click();
    const executeRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && request.url().endsWith('/api/execute')
    );
    await page.locator('.confirm-modal-content').getByRole('button', { name: 'Да', exact: true }).click();
    const payload = JSON.parse((await executeRequest).postData() || '{}');
    expect(payload).toMatchObject({
      command: 'test_command',
      page: '2_widget_demo',
      widget: 'func_4'
    });
    await expect(page.locator('.confirm-modal-content')).toHaveCount(0);
  });

  test('ui modal opens from button and renders modal tabs and widgets', async ({ page }) => {
    await widget(page, 'modal_button').getByRole('button', { name: 'Модальное окно' }).click();

    const modal = page.locator('.gui-modal').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toContainText('Имя модального окна');
    await expect(modal.getByRole('tab', { name: 'Первый таб' })).toBeVisible();
    await expect(modal.getByRole('tab', { name: 'Второй таб' })).toBeVisible();
    await expect(modal.getByRole('tab', { name: 'Третий таб' })).toBeVisible();
    await expect(modal.locator('[data-widget-name="str_1"]').first()).toBeVisible();

    await modal.getByRole('tab', { name: 'Второй таб' }).click();
    await expect(modal.locator('[data-widget-name="int_1"]').first()).toBeVisible();

    await modal.locator('.modal-header .ui-close-button').click();
    await expect(page.locator('.gui-modal')).toHaveCount(0);
  });
});
