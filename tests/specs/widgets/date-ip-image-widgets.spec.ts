import { expect, test } from '@playwright/test';
import {
  expectWidgetError,
  fillAndBlur,
  openDemoTab,
  widget,
  widgetInput
} from '../../support/app';

test.describe('behavior: date, time, ip and image widgets', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoTab(page, 'Строковые виджеты', 'Демонстрация строковых виджетов');
  });

  test('date and time widgets normalize typed values and open popovers', async ({ page }) => {
    const dateInput = widgetInput(page, 'date_widget');
    await fillAndBlur(dateInput, '01012026');
    await expect(dateInput).toHaveValue('01.01.2026');

    await widget(page, 'date_widget').getByRole('button', { name: 'Выбрать дату' }).click();
    const calendar = page.locator('.widget-dt-popover--calendar');
    await expect(calendar).toBeVisible();
    await calendar.locator('.widget-dt-day:not(.is-outside)').nth(1).click();
    await expect(dateInput).toHaveValue('02.01.2026');

    await widget(page, 'date_widget').getByRole('button', { name: 'Выбрать дату' }).click();
    await expect(calendar).toBeVisible();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await expect(calendar).toBeHidden();

    const timeInput = widgetInput(page, 'time_widget');
    await fillAndBlur(timeInput, '123456');
    await expect(timeInput).toHaveValue('12:34:56');

    await widget(page, 'time_widget').getByRole('button', { name: 'Выбрать время' }).click();
    const timePopover = page.locator('.widget-dt-popover--time');
    await expect(timePopover).toBeVisible();
    await timePopover.locator('input').nth(2).fill('7');
    await timePopover.locator('input').nth(2).blur();
    await expect(timeInput).toHaveValue('12:34:07');

    const datetimeInputs = widget(page, 'demo_datetime').locator('input');
    await expect(datetimeInputs).toHaveCount(2);
    await expect(datetimeInputs.nth(0)).not.toHaveValue('');
    await expect(datetimeInputs.nth(1)).not.toHaveValue('');

    await widget(page, 'demo_datetime').getByRole('button', { name: 'Выбрать дату' }).click();
    await expect(calendar).toBeVisible();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await expect(calendar).toBeHidden();

    await widget(page, 'demo_datetime').getByRole('button', { name: 'Выбрать время' }).click();
    await expect(timePopover).toBeVisible();
    await timePopover.locator('input').first().fill('9');
    await timePopover.locator('input').first().blur();
    await expect(datetimeInputs.nth(1)).toHaveValue(/09:\d{2}/);
  });

  test('ip and ip_mask widgets normalize separators, validate ranges and respect readonly', async ({ page }) => {
    await fillAndBlur(widgetInput(page, 'ip_1'), '192 168 0 1');
    await expect(widgetInput(page, 'ip_1')).toHaveValue('192.168.0.1');

    await fillAndBlur(widgetInput(page, 'ip_2'), '999.1.1.1');
    await expectWidgetError(page, 'ip_2', 'Неверный формат');

    await fillAndBlur(widgetInput(page, 'ip_3'), '10,20,30,40/24');
    await expect(widgetInput(page, 'ip_3')).toHaveValue('10.20.30.40/24');

    await expect(widgetInput(page, 'ip_4')).toBeDisabled();
    await expect(widgetInput(page, 'ip_4')).toHaveValue('255.255.255.0/24');
  });

  test('image widgets render declared assets, captions and widths', async ({ page }) => {
    await page.locator('[data-tab-name="Картинки!"]').click();

    await expect(widget(page, 'img_1')).toContainText('Подпись сверху');
    await expect(widget(page, 'img_1').locator('img')).toHaveAttribute('src', '/templates/mems/mem_1.jpg');
    await expect(widget(page, 'img_2').locator('img')).toHaveAttribute('src', '/templates/mems/mem_2.png');
    await expect(widget(page, 'img_3')).toContainText('Подпись снизу');

    for (const name of ['img_1', 'img_2', 'img_3']) {
      const image = widget(page, name).locator('img');
      await expect(image).toBeVisible();
      await expect(image).toHaveJSProperty('complete', true);
      await expect(image).toHaveAttribute('style', /width:\s*600px/);
    }
  });
});
