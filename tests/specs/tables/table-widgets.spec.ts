import { expect, test, type Page } from '@playwright/test';
import { openDemoTab, table, tableCell, widget } from '../../support/app';

async function editNativeTableCell(name: string, page: Page, row: number, col: number, value: string) {
  const cell = tableCell(page, name, row, col);
  await expect(cell).toBeVisible();
  await cell.dblclick();
  const input = cell.getByRole('textbox').first();
  await expect(input).toBeVisible();
  await input.fill(value);
  await input.blur();
  await expect(input).toHaveValue(value);
}

test.describe('behavior: demo table widgets', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoTab(page, 'Таблицы', 'Демо-таблицы');
  });

  test('renders every demo table and applies table-level YAML flags', async ({ page }) => {
    for (const name of [
      'demo_table_1',
      'demo_table_2',
      'demo_table_3',
      'demo_table_4',
      'demo_table_5',
      'demo_table_6',
      'demo_table_7'
    ]) {
      await expect(widget(page, name), name).toBeVisible();
      await expect(table(page, name), `${name} table`).toBeVisible();
    }

    await expect(table(page, 'demo_table_1')).not.toHaveClass(/widget-table--editable/);
    await expect(table(page, 'demo_table_2')).toHaveClass(/widget-table--editable/);
    await expect(table(page, 'demo_table_3')).toHaveClass(/widget-table--no-zebra/);
    await expect(table(page, 'demo_table_4')).toHaveClass(/widget-table--no-zebra/);
    await expect(table(page, 'demo_table_5')).not.toHaveClass(/widget-table--sortable/);
    await expect(table(page, 'demo_table_6')).not.toHaveClass(/widget-table--sortable/);
    await expect(table(page, 'demo_table_7')).toHaveClass(/widget-table--sticky-header/);
  });

  test('readonly table displays source rows and supports header sorting', async ({ page }) => {
    const demoTable = table(page, 'demo_table_1');
    await expect(demoTable.locator('tbody tr')).toHaveCount(3);
    await expect(demoTable.locator('tbody tr').first()).toContainText('Иван');
    await expect(demoTable.locator('tbody tr').first().locator('td').nth(1)).toContainText('25');

    await demoTable.getByRole('button', { name: /Возраст/ }).click();
    await demoTable.getByRole('button', { name: /Возраст/ }).click();

    await expect(demoTable.locator('tbody tr').first()).toContainText('Петр');
    await expect(demoTable.locator('tbody tr').first().locator('td').nth(1)).toContainText('35');
  });

  test('editable table cells accept text and preserve configured empty rows', async ({ page }) => {
    await editNativeTableCell('demo_table_2', page, 0, 0, 'Параметр А');
    await editNativeTableCell('demo_table_2', page, 0, 1, 'Значение 1');
    await editNativeTableCell('demo_table_2', page, 0, 2, 'Значение 2');

    await expect(table(page, 'demo_table_4').locator('tbody tr')).toHaveCount(3);
    await expect(table(page, 'demo_table_6').locator('tbody tr')).toHaveCount(3);
  });

  test('large lazy table renders the first chunk and keeps lazy sentinel instead of 1000 DOM rows', async ({ page }) => {
    const lazyTable = table(page, 'demo_table_7');
    await expect(lazyTable.locator('tbody tr').first()).toContainText('REC-0001');
    await expect(lazyTable.locator('tbody tr').nth(99)).toContainText('REC-0100');
    await expect(lazyTable.locator('tbody tr')).toHaveCount(101);
    await expect(lazyTable.locator('.widget-table__lazy-sentinel')).toHaveCount(1);
  });
});

test.describe('behavior: complex table widget', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoTab(page, 'Таблицы', 'Сложная таблица');
  });

  test('renders grouped headers, column numbers and embedded table widget columns', async ({ page }) => {
    const complexTable = table(page, 'big_table');
    await expect(complexTable).toBeVisible();
    await expect(complexTable).toHaveClass(/widget-table--editable/);
    await expect(complexTable).toHaveClass(/widget-table--sticky-header/);

    for (const header of [
      'Строка 1',
      'Узкая строка',
      'Числа',
      'Целое',
      'Float_2 c разделителем',
      'Дата и время',
      'Дата',
      'Время',
      'Списки',
      'Мультисписок',
      'Справочник',
      'Адреса',
      'ip_mask'
    ]) {
      await expect(complexTable.getByRole('columnheader', { name: new RegExp(header) }).first()).toBeVisible();
    }

    for (const columnNumber of ['1', '8', '14']) {
      await expect(complexTable.locator('thead').getByText(columnNumber, { exact: true }).first()).toBeVisible();
    }
  });

  test('complex table cells support native text editing and embedded list actions', async ({ page }) => {
    await editNativeTableCell('big_table', page, 0, 1, 'строка');
    await editNativeTableCell('big_table', page, 0, 3, '42');

    const listCell = tableCell(page, 'big_table', 0, 11);
    await expect(listCell).toBeVisible();
    await expect(listCell.getByRole('button', { name: 'Открыть список' })).toBeVisible();
  });
});
