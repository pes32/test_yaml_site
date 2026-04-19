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

async function addRowBelowFromCell(name: string, page: Page, row: number, col: number) {
  await tableCell(page, name, row, col).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Добавить строку ниже' }).click();
  await expect(page.locator('.context-menu')).toHaveCount(0);
}

type TableWidgetRuntimeInspection = {
  registeredType: string;
  contextMenuOpenValue: boolean;
  exposed: {
    contextMenuOpenBoolean: boolean;
    getValue: boolean;
    initializeTable: boolean;
    onTableEditableKeydown: boolean;
    setValue: boolean;
    stickyHeaderEnabledBoolean: boolean;
    tableDataArray: boolean;
  };
  refs: {
    contextMenuEl: boolean;
    lazySentinelRow: boolean;
    tableRootFromRuntime: boolean;
    tableRootFromRuntimeMatchesElement: boolean;
    tableThead: boolean;
  };
};

async function installWidgetInstanceDebugRegistry(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type WidgetDebugEntry = {
      instance: unknown;
      type: string;
      widgetName: string;
    };
    type WidgetDebugRegistry = {
      entries: Record<string, { instance: unknown; type: string }>;
      register(entry: WidgetDebugEntry): void;
      unregister(entry: WidgetDebugEntry): void;
    };
    type WidgetDebugWindow = Window & {
      __YAMLS_WIDGET_INSTANCE_DEBUG__?: WidgetDebugRegistry;
    };

    const debugWindow = window as WidgetDebugWindow;
    debugWindow.__YAMLS_WIDGET_INSTANCE_DEBUG__ = {
      entries: {},
      register(entry) {
        this.entries[entry.widgetName] = {
          instance: entry.instance,
          type: entry.type
        };
      },
      unregister(entry) {
        if (this.entries[entry.widgetName]?.instance === entry.instance) {
          delete this.entries[entry.widgetName];
        }
      }
    };
  });
}

async function inspectTableWidgetRuntime(page: Page, name: string): Promise<TableWidgetRuntimeInspection> {
  return await table(page, name).evaluate((element, widgetName): TableWidgetRuntimeInspection => {
    type WidgetDebugRegistry = {
      entries: Record<string, { instance: unknown; type: string }>;
    };
    type WidgetDebugWindow = Window & {
      __YAMLS_WIDGET_INSTANCE_DEBUG__?: WidgetDebugRegistry;
    };

    function isRecord(value: unknown): value is Record<string, unknown> {
      return !!value && typeof value === 'object';
    }

    const registry = (window as WidgetDebugWindow).__YAMLS_WIDGET_INSTANCE_DEBUG__;
    const entry = registry?.entries[widgetName];
    const publicInstance = isRecord(entry?.instance) ? entry.instance : {};
    const getTableEl = publicInstance.getTableEl;
    const tableRoot = typeof getTableEl === 'function' ? getTableEl() : null;

    return {
      registeredType: entry?.type || '',
      contextMenuOpenValue: publicInstance.contextMenuOpen === true,
      exposed: {
        contextMenuOpenBoolean: typeof publicInstance.contextMenuOpen === 'boolean',
        getValue: typeof publicInstance.getValue === 'function',
        initializeTable: typeof publicInstance.initializeTable === 'function',
        onTableEditableKeydown: typeof publicInstance.onTableEditableKeydown === 'function',
        setValue: typeof publicInstance.setValue === 'function',
        stickyHeaderEnabledBoolean: typeof publicInstance.stickyHeaderEnabled === 'boolean',
        tableDataArray: Array.isArray(publicInstance.tableData)
      },
      refs: {
        contextMenuEl: document.querySelector('.context-menu') instanceof HTMLElement,
        lazySentinelRow: element.querySelector('.widget-table__lazy-sentinel') instanceof HTMLTableRowElement,
        tableRootFromRuntime: tableRoot instanceof HTMLTableElement,
        tableRootFromRuntimeMatchesElement: tableRoot === element,
        tableThead: element.querySelector('thead') instanceof HTMLTableSectionElement
      }
    };
  }, name);
}

test.describe('behavior: demo table widgets', () => {
  test.beforeEach(async ({ page }) => {
    await installWidgetInstanceDebugRegistry(page);
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

  test('table public surface stays limited while runtime refs work', async ({ page }) => {
    const lazyTable = table(page, 'demo_table_7');
    await expect(lazyTable.locator('.widget-table__lazy-sentinel')).toHaveCount(1);

    const mountedRuntime = await inspectTableWidgetRuntime(page, 'demo_table_7');
    expect(mountedRuntime).toMatchObject({
      registeredType: 'table',
      contextMenuOpenValue: false,
      exposed: {
        contextMenuOpenBoolean: true,
        getValue: true,
        initializeTable: true,
        onTableEditableKeydown: true,
        setValue: true,
        stickyHeaderEnabledBoolean: true,
        tableDataArray: true
      },
      refs: {
        contextMenuEl: false,
        lazySentinelRow: true,
        tableRootFromRuntime: true,
        tableRootFromRuntimeMatchesElement: true,
        tableThead: true
      }
    });

    await tableCell(page, 'demo_table_2', 0, 0).click({ button: 'right' });
    await expect(page.locator('.context-menu')).toBeVisible();

    const menuRuntime = await inspectTableWidgetRuntime(page, 'demo_table_2');
    expect(menuRuntime.contextMenuOpenValue).toBe(true);
    expect(menuRuntime.refs.contextMenuEl).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('.context-menu')).toHaveCount(0);
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

    const dateCell = tableCell(page, 'big_table', 0, 9);
    await expect(dateCell.getByRole('button', { name: 'Выбрать дату' })).toBeVisible();
    await dateCell.getByRole('button', { name: 'Выбрать дату' }).click();
    await expect(page.locator('.widget-dt-popover--calendar')).toBeVisible();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await dateCell.dblclick();
    const dateEditor = dateCell.getByRole('textbox').first();
    await dateEditor.fill('32132026');
    await dateEditor.blur();
    await expect(dateCell).toHaveAttribute('style', /--widget-table-cell-outline-color/);

    const timeCell = tableCell(page, 'big_table', 0, 10);
    await expect(timeCell.getByRole('button', { name: 'Выбрать время' })).toBeVisible();
    await timeCell.getByRole('button', { name: 'Выбрать время' }).click();
    await expect(page.locator('.widget-dt-popover--time')).toBeVisible();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await timeCell.dblclick();
    const timeEditor = timeCell.getByRole('textbox').first();
    await timeEditor.fill('9999');
    await timeEditor.blur();
    await expect(timeCell).toHaveAttribute('style', /--widget-table-cell-outline-color/);

    const listCell = tableCell(page, 'big_table', 0, 11);
    await expect(listCell).toBeVisible();
    await expect(listCell.getByRole('button', { name: 'Открыть список' })).toBeVisible();
  });

  test('full-row keyboard selection keeps focus and Ctrl+Minus deletes the selected row block', async ({ page }) => {
    const complexTable = table(page, 'big_table');
    await addRowBelowFromCell('big_table', page, 0, 1);
    await addRowBelowFromCell('big_table', page, 0, 1);
    await expect(complexTable.locator('tbody tr')).toHaveCount(3);

    const origin = tableCell(page, 'big_table', 0, 1);
    await origin.click();
    await expect(origin).toBeFocused();

    await page.keyboard.press('Shift+Space');
    await expect(origin).toBeFocused();

    await page.keyboard.press('Shift+ArrowDown');
    await expect(tableCell(page, 'big_table', 1, 1)).toBeFocused();

    await page.keyboard.down('Control');
    await page.keyboard.press('-');
    await page.keyboard.up('Control');

    await expect(complexTable.locator('tbody tr')).toHaveCount(1);
  });

  test('copies one cell value into every cell of a selected range', async ({ page }) => {
    await page.evaluate(() => {
      const clipboardStore = { text: '' };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          readText: async () => clipboardStore.text,
          writeText: async (text: string) => {
            clipboardStore.text = String(text);
          }
        }
      });
    });
    await addRowBelowFromCell('big_table', page, 0, 1);
    await editNativeTableCell('big_table', page, 0, 1, 'seed');

    const source = tableCell(page, 'big_table', 0, 1);
    await source.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C');

    await source.click();
    await tableCell(page, 'big_table', 1, 2).click({ modifiers: ['Shift'] });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');

    await expect(tableCell(page, 'big_table', 0, 1)).toContainText('seed');
    await expect(tableCell(page, 'big_table', 0, 2)).toContainText('seed');
    await expect(tableCell(page, 'big_table', 1, 1)).toContainText('seed');
    await expect(tableCell(page, 'big_table', 1, 2)).toContainText('seed');
  });

  test('column number headers open the column context menu and line numbering toggles from any header', async ({ page }) => {
    const complexTable = table(page, 'big_table');
    const firstColumnNumber = complexTable.locator('thead tr').last().locator('th').nth(1);
    await firstColumnNumber.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Отключить нумерацию строк' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Открепить заголовки' })).toBeVisible();
    await page.keyboard.press('Escape');

    await complexTable.getByRole('columnheader', { name: /Строка 1/ }).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Отключить нумерацию строк' }).click();
    await expect(complexTable.locator('thead').getByText('№', { exact: true })).toHaveCount(0);

    await complexTable.getByRole('columnheader', { name: /Строка 1/ }).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Включить нумерацию строк' }).click();
    await expect(complexTable.locator('thead').getByText('№', { exact: true })).toBeVisible();
  });

  test('group rows use the shared column context menu instead of the browser menu', async ({ page }) => {
    const complexTable = table(page, 'big_table');
    await complexTable.getByRole('button', { name: /Строка 1/ }).click();
    await complexTable.getByRole('columnheader', { name: /Строка 1/ }).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Группировка' }).click();

    const groupRow = complexTable.locator('.widget-table__group-row').first();
    await expect(groupRow).toBeVisible();
    await groupRow.click({ button: 'right' });

    await expect(page.getByRole('menuitem', { name: 'Открепить заголовки' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Отключить нумерацию строк' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Перенос по словам' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Сбросить сортировку' })).toBeVisible();
  });
});
