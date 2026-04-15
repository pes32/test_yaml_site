import { expect, test } from '@playwright/test';
import {
  fillAndBlur,
  openChoiceDropdown,
  openDemoTab,
  selectChoiceOption,
  widget,
  widgetInput
} from '../../support/app';

test.describe('behavior: list and voc widgets', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoTab(page, 'Строковые виджеты', 'Демонстрация строковых виджетов');
  });

  test('list widgets cover searchable, default, non-editable and multiselect modes', async ({ page }) => {
    await selectChoiceOption(page, 'list_1', 'Опция 2');
    await expect(widgetInput(page, 'list_1')).toHaveValue('Опция 2');

    const list2 = widgetInput(page, 'list_2');
    await list2.focus();
    await expect(list2).toHaveAttribute('placeholder', 'Выбери опцию');
    await list2.fill('11');
    await expect(page.getByRole('option').filter({ hasText: 'Опция 11' })).toBeVisible();
    await page.getByRole('option').filter({ hasText: 'Опция 11' }).click();
    await expect(list2).toHaveValue('Опция 11');

    await expect(widgetInput(page, 'list_3')).toHaveValue('Опция 1');

    await expect(widgetInput(page, 'list_4')).toHaveAttribute('readonly', '');
    await selectChoiceOption(page, 'list_4', 'Опция 3');
    await expect(widgetInput(page, 'list_4')).toHaveValue('Опция 3');

    const multiselectList = await openChoiceDropdown(page, 'list_5');
    await multiselectList.locator('.dropdown-item[title="Опция 1"]').click();
    await multiselectList.locator('.dropdown-item[title="Опция 3"]').click();
    await expect(widgetInput(page, 'list_5')).toHaveValue(/Опция 1.*Опция 3|Опция 3.*Опция 1/);
    await widgetInput(page, 'list_5').press('Backspace');
    await expect(widgetInput(page, 'list_5')).toHaveValue(/Опция 1/);
  });

  test('voc supports manual codes, modal lookup and multiselect serialization', async ({ page }) => {
    const voc1 = widgetInput(page, 'voc_1');
    await fillAndBlur(voc1, '10');
    await expect(voc1).toHaveValue('10');

    await widget(page, 'voc_1').getByRole('button', { name: 'Открыть справочник' }).click();
    await expect(page.locator('.gui-modal')).toBeVisible();
    await expect(page.locator('.modal-title')).toContainText('Код операции');
    await page.locator('.voc-modal-search-input').fill('инвентаризация');
    await expect(page.locator('.gui-modal').getByText('Инвентаризация', { exact: true }).first()).toBeVisible();
    await page.locator('.gui-modal tbody tr').filter({ hasText: 'Инвентаризация' }).first().click();
    await page.locator('.gui-modal').getByRole('button', { name: 'Выбрать' }).click();
    await expect(page.locator('.gui-modal')).toHaveCount(0);
    await expect(voc1).toHaveValue('10');

    const voc3 = widgetInput(page, 'voc_3');
    await fillAndBlur(voc3, '1, 10');
    await expect(voc3).toHaveValue('1, 10');
  });

  test('voc modal supports keyboard search and selection', async ({ page }) => {
    const voc1 = widgetInput(page, 'voc_1');
    await voc1.focus();
    await page.keyboard.press('Alt+ArrowDown');

    const modal = page.locator('.gui-modal');
    await expect(modal).toBeVisible();

    const search = modal.locator('.voc-modal-search-input');
    await search.fill('инвентаризация');
    await expect(modal.getByText('Инвентаризация', { exact: true }).first()).toBeVisible();
    await search.press('Enter');

    await expect(modal).toHaveCount(0);
    await expect(voc1).toHaveValue('10');
  });

  test('choice dropdowns close on Escape and keep focus on keyboard selection', async ({ page }) => {
    const listbox = await openChoiceDropdown(page, 'list_1');
    await expect(listbox).toBeVisible();
    await widgetInput(page, 'list_1').press('Escape');
    await expect(listbox).not.toBeVisible();

    await widgetInput(page, 'list_1').press('Enter');
    await widgetInput(page, 'list_1').press('ArrowDown');
    await widgetInput(page, 'list_1').press('Enter');
    await expect(widgetInput(page, 'list_1')).toHaveValue(/Опция/);
  });
});
