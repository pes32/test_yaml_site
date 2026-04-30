import { expect, test, type Locator, type Page } from '@playwright/test';
import { openDemoTab, table, tableCell, waitForPageReady, widget } from '../../support/app';

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

async function rect(locator: Locator) {
  return await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      bottom: box.bottom,
      left: box.left,
      right: box.right,
      top: box.top
    };
  });
}

function tableCellText(page: Page, name: string, row: number, col: number): Locator {
  return tableCell(page, name, row, col).locator('.widget-table__cell-value').first();
}

async function cellTextLeftInset(page: Page, name: string, row: number, col: number): Promise<number> {
  return await tableCell(page, name, row, col).evaluate((cell) => {
    const text = cell.querySelector('.widget-table__cell-value');
    const cellBox = cell.getBoundingClientRect();
    const textBox = text?.getBoundingClientRect();
    return textBox ? textBox.left - cellBox.left : 0;
  });
}

async function cellContentFitMetrics(page: Page, name: string, row: number, col: number) {
  return await tableCell(page, name, row, col).evaluate((cell) => {
    const content = cell.querySelector('.widget-table__cell-value') as HTMLElement | null;
    const cellBox = cell.getBoundingClientRect();
    return {
      cellWidth: cellBox.width,
      clientWidth: content?.clientWidth || 0,
      scrollWidth: content?.scrollWidth || 0
    };
  });
}

async function leafHeaderWrapStates(page: Page, name: string) {
  return await table(page, name).locator('thead th[data-runtime-col-index] .widget-table__th-text').evaluateAll((labels) => {
    return labels.map((label) => {
      const element = label as HTMLElement;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5 || 24;
      return {
        height: box.height,
        lineHeight,
        text: String(element.textContent || '').trim()
      };
    });
  });
}

type TableWidgetRuntimeInspection = {
  registeredType: string;
  contextMenuOpenValue: boolean;
  exposed: {
    contextMenuOpenBoolean: boolean;
    dispatchTableCommand: boolean;
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

async function ensureTableV2MarkupRows(page: Page, targetCount: number): Promise<void> {
  await page.evaluate((count) => {
    type TableDebugEntry = {
      instance?: {
        dispatchTableCommand?: (command: string, payload?: Record<string, unknown>) => unknown;
        tableData?: Array<{ id?: string; cells?: unknown[] }>;
      };
    };
    type TableDebugWindow = Window & {
      __YAMLS_WIDGET_INSTANCE_DEBUG__?: {
        entries?: Record<string, TableDebugEntry>;
      };
    };

    const entry = (window as TableDebugWindow).__YAMLS_WIDGET_INSTANCE_DEBUG__?.entries?.table_v2_markup;
    const instance = entry?.instance;
    if (typeof instance?.dispatchTableCommand !== 'function') {
      throw new Error('table_v2_markup debug instance is not registered');
    }

    const existingRows = Array.isArray(instance.tableData) ? instance.tableData : [];
    const rowsToAdd = Math.max(0, count - existingRows.length);
    if (!rowsToAdd) return;

    const rows = Array.from({ length: rowsToAdd }, (_, index) => {
      const rowNumber = existingRows.length + index + 1;
      const source = existingRows[index % Math.max(1, existingRows.length)]?.cells || [];
      return {
        id: `toolbar-test-row-${rowNumber}`,
        cells: [
          `Проверка строки ${rowNumber}`,
          source[1] || 'Вера',
          source[2] || 'bad-number',
          source[3] || 'x',
          source[4] || '31.12.2026',
          source[5] || '25:99',
          source[6] || '222/222/222222',
          source[7] || '10.10.10.10/33',
          source[8] || 'Риск',
          source[9] || 'C3',
          source[10] || 'Строка для проверки скролла'
        ]
      };
    });

    instance.dispatchTableCommand('INSERT_ROWS', {
      afterRowId: existingRows[existingRows.length - 1]?.id || null,
      rows
    });
  }, targetCount);

  await expect(table(page, 'table_v2_markup').locator('tbody tr')).toHaveCount(targetCount);
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
        dispatchTableCommand: typeof publicInstance.dispatchTableCommand === 'function',
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

  test('preloads and mounts table widgets on initial table tab', async ({ page }) => {
    await page.goto('/widget_demo#menu-1-tab-0');
    const modulePreloads = await page.locator('link[rel="modulepreload"]').evaluateAll((links) =>
      links.map((link) => (link as HTMLLinkElement).href)
    );
    expect(modulePreloads.some((href) => href.includes('/widget-table-'))).toBe(true);
    await waitForPageReady(page);
    expect(await table(page, 'demo_table_2').count()).toBe(1);
    await expect(table(page, 'demo_table_2')).toBeVisible();
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
        dispatchTableCommand: true,
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

    const ipCell = tableCell(page, 'big_table', 0, 15);
    await ipCell.dblclick();
    const ipEditor = ipCell.getByRole('textbox').first();
    await ipEditor.fill('10,20/30 40');
    await expect(ipEditor).toHaveValue('10.20.30.40');
    await ipEditor.blur();
    await expect(tableCellText(page, 'big_table', 0, 15)).toHaveText('10.20.30.40');

    const listCell = tableCell(page, 'big_table', 0, 11);
    await expect(listCell).toBeVisible();
    await expect(listCell.getByRole('button', { name: 'Открыть список' })).toBeVisible();

    const dateTextInset = await cellTextLeftInset(page, 'big_table', 0, 9);
    const timeTextInset = await cellTextLeftInset(page, 'big_table', 0, 10);
    const plainTextInset = await cellTextLeftInset(page, 'big_table', 0, 1);
    expect(Math.abs(dateTextInset - plainTextInset)).toBeLessThanOrEqual(1);
    expect(Math.abs(timeTextInset - plainTextInset)).toBeLessThanOrEqual(1);
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

test.describe('behavior: table v2 toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await installWidgetInstanceDebugRegistry(page);
    await openDemoTab(page, 'Таблицы', 'Таблица с разметкой');
  });

  test('aligns with table content, separates width controls and keeps sticky headers below it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await openDemoTab(page, 'Таблицы', 'Таблица с разметкой');

    const content = page.locator('.page-tab-content--with-tabs').first();
    const toolbarHost = page.locator('.widget-table-toolbar-host').first();
    const toolbar = toolbarHost.locator('.widget-table-toolbar');
    const markupTable = table(page, 'table_v2_markup');
    const leadText = page.locator('.page-section-text').filter({ hasText: 'Рабочая таблица для Table v2' }).first();

    await expect(toolbarHost).toBeVisible();
    await expect(markupTable).toBeVisible();
    await ensureTableV2MarkupRows(page, 30);

    const toolbarBox = await rect(toolbarHost);
    const textBox = await rect(leadText);
    const tableBox = await rect(markupTable);
    expect(Math.abs(textBox.left - toolbarBox.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(tableBox.left - toolbarBox.left)).toBeLessThanOrEqual(1);

    const columns = page.locator('.widget-table-toolbar__column');
    await expect(columns).toHaveCount(7);
    await expect(columns.nth(5)).toHaveClass(/widget-table-toolbar__column--widths/);
    await expect(columns.nth(6)).toHaveClass(/widget-table-toolbar__column--tools/);
    await expect(tableCell(page, 'table_v2_markup', 0, 5).getByRole('button')).toHaveCount(0);
    await expect(tableCell(page, 'table_v2_markup', 0, 6).getByRole('button')).toHaveCount(0);

    const toolbarBeforeScroll = await rect(toolbar);
    await content.evaluate((element) => {
      element.scrollLeft = 360;
    });
    const toolbarAfterHorizontalScroll = await rect(toolbar);
    expect(Math.abs(toolbarAfterHorizontalScroll.left - toolbarBeforeScroll.left)).toBeLessThanOrEqual(1);

    await content.evaluate((element) => {
      element.scrollTop = 180;
    });
    await expect(page.locator('.widget-table__sticky-overlay')).toBeVisible();

    const contentBox = await rect(content);
    const stickyToolbarBox = await rect(toolbarHost);
    const stickyHeaderBox = await rect(page.locator('.widget-table__sticky-overlay').first());
    expect(Math.abs(stickyToolbarBox.top - contentBox.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(stickyHeaderBox.top - stickyToolbarBox.bottom)).toBeLessThanOrEqual(1);
  });

  test('applies current fill color from main button and changes strip color from palette', async ({ page }) => {
    const toolbar = page.locator('.widget-table-toolbar').first();
    const fillMain = toolbar.getByTitle('Цвет заливки', { exact: true });
    const fillArrow = toolbar.getByTitle('Цвет заливки: выбрать цвет', { exact: true });
    const fillStrip = fillMain.locator('.widget-table-toolbar__color-strip');
    const targetCell = tableCell(page, 'table_v2_markup', 0, 1);

    await expect(fillStrip).toHaveCSS('background-color', 'rgb(255, 242, 204)');

    await targetCell.click();
    await fillMain.click();
    await expect(targetCell).toHaveCSS('background-color', 'rgb(255, 242, 204)');

    await fillArrow.click();
    await expect(page.locator('.widget-table-toolbar__custom-color-input')).toHaveValue('#fff2cc');
    await expect(page.locator('.widget-table-toolbar__standard-colors .widget-table-toolbar__swatch').first()).toHaveCSS('border-radius', '0px');

    const firstPaletteSwatch = page.locator('.widget-table-toolbar__palette-columns .widget-table-toolbar__swatch').first();
    const secondPaletteSwatch = page.locator('.widget-table-toolbar__palette-columns .widget-table-toolbar__swatch').nth(1);
    const firstSwatchBox = await rect(firstPaletteSwatch);
    const secondSwatchBox = await rect(secondPaletteSwatch);
    expect(Math.abs(secondSwatchBox.top - firstSwatchBox.bottom)).toBeLessThanOrEqual(0.5);

    await firstPaletteSwatch.hover();
    await expect(firstPaletteSwatch).toHaveCSS('outline-style', 'none');

    await page.locator('.widget-table-toolbar__custom-color-input').evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = '#4d72c2';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(fillStrip).toHaveCSS('background-color', 'rgb(255, 242, 204)');
    await expect(targetCell).toHaveCSS('background-color', 'rgb(255, 242, 204)');

    await page.getByRole('button', { name: 'Цвет заливки: rgb(77,114,194)' }).click();
    await expect(fillStrip).toHaveCSS('background-color', 'rgb(77, 114, 194)');
    await expect(targetCell).toHaveCSS('background-color', 'rgb(77, 114, 194)');

    await fillArrow.click();
    await expect(page.locator('.widget-table-toolbar__custom-color-input')).toHaveValue('#4d72c2');
  });

  test('corner header selects all cells and Shift+Arrows extend whole-column selection', async ({ page }) => {
    await ensureTableV2MarkupRows(page, 30);
    const markupTable = table(page, 'table_v2_markup');
    const corner = markupTable.getByRole('columnheader', { name: 'Выбрать всю таблицу' }).first();
    await corner.click();

    await expect(tableCell(page, 'table_v2_markup', 0, 1)).toHaveAttribute('style', /--widget-table-cell-outline-color/);
    await expect(tableCell(page, 'table_v2_markup', 29, 11)).toHaveAttribute('style', /--widget-table-cell-outline-color/);

    await markupTable.locator('.widget-table__column-letter').filter({ hasText: 'A' }).click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(tableCell(page, 'table_v2_markup', 0, 1)).toHaveAttribute('style', /--widget-table-cell-outline-color/);
    await expect(tableCell(page, 'table_v2_markup', 0, 2)).toHaveAttribute('style', /--widget-table-cell-outline-color/);
    await expect(tableCell(page, 'table_v2_markup', 0, 3)).toHaveAttribute('style', /--widget-table-cell-outline-color/);
    await expect(tableCell(page, 'table_v2_markup', 0, 4)).not.toHaveAttribute('style', /--widget-table-cell-outline-color/);

    await page.keyboard.press('Shift+ArrowLeft');
    await expect(tableCell(page, 'table_v2_markup', 0, 2)).toHaveAttribute('style', /--widget-table-cell-outline-color/);
    await expect(tableCell(page, 'table_v2_markup', 0, 3)).not.toHaveAttribute('style', /--widget-table-cell-outline-color/);

    const rowNumber = tableCell(page, 'table_v2_markup', 0, 0);
    const rowNumberBg = await rowNumber.evaluate((element) => getComputedStyle(element).backgroundColor);
    await rowNumber.hover();
    await expect(rowNumber).not.toHaveCSS('background-color', rowNumberBg);
  });

  test('toolbar toggles table options from the filter tool group', async ({ page }) => {
    const toolbar = page.locator('.widget-table-toolbar').first();
    const markupTable = table(page, 'table_v2_markup');

    await expect(markupTable.locator('thead').getByText('№', { exact: true })).toBeVisible();
    await toolbar.getByTitle('Отключить нумерацию строк').click();
    await expect(markupTable.locator('thead').getByText('№', { exact: true })).toHaveCount(0);
    await toolbar.getByTitle('Включить нумерацию строк').click();
    await expect(markupTable.locator('thead').getByText('№', { exact: true })).toBeVisible();

    await expect(markupTable).toHaveClass(/widget-table--sticky-header/);
    await toolbar.getByTitle('Открепить заголовки таблицы').click();
    await expect(markupTable).not.toHaveClass(/widget-table--sticky-header/);
    await toolbar.getByTitle('Закрепить заголовки таблицы').click();
    await expect(markupTable).toHaveClass(/widget-table--sticky-header/);

    await expect(markupTable).not.toHaveClass(/widget-table--word-wrap/);
    await toolbar.getByTitle('Включить перенос по словам').click();
    await expect(markupTable).toHaveClass(/widget-table--word-wrap/);
    await toolbar.getByTitle('Выключить перенос по словам').click();
    await expect(markupTable).not.toHaveClass(/widget-table--word-wrap/);
  });

  test('toolbar formats text, font size and alignment through buttons, menus and hotkeys', async ({ page }) => {
    const toolbar = page.locator('.widget-table-toolbar').first();
    const targetCell = tableCell(page, 'table_v2_markup', 0, 1);
    const targetText = tableCellText(page, 'table_v2_markup', 0, 1);

    await targetCell.click();
    await toolbar.locator('.widget-table-toolbar__select--font-size').selectOption('18');
    await expect(targetText).toHaveCSS('font-size', '18px');

    const increase = toolbar.getByTitle('Увеличить размер шрифта');
    await increase.click();
    await increase.click();
    await increase.click();
    await expect(targetText).toHaveCSS('font-size', '21px');

    const decrease = toolbar.getByTitle('Уменьшить размер шрифта');
    await decrease.click();
    await decrease.click();
    await expect(targetText).toHaveCSS('font-size', '19px');

    await targetCell.click();
    await page.keyboard.press('Control+B');
    await expect(targetText).toHaveCSS('font-weight', '700');
    await page.keyboard.press('Control+I');
    await expect(targetText).toHaveCSS('font-style', 'italic');
    await page.keyboard.press('Control+U');
    await expect(targetText).toHaveCSS('text-decoration-line', /underline/);
    await page.keyboard.press('Control+Shift+X');
    await expect(targetText).toHaveCSS('text-decoration-line', /line-through/);

    await toolbar.getByTitle('По левому краю').click();
    await expect(targetText).toHaveCSS('text-align', 'left');
    await toolbar.getByRole('button', { name: 'По центру', exact: true }).click();
    await expect(targetText).toHaveCSS('text-align', 'center');
    await toolbar.getByTitle('По правому краю').click();
    await expect(targetText).toHaveCSS('text-align', 'right');

    await toolbar.getByTitle('Сверху').click();
    await expect(targetCell).toHaveCSS('vertical-align', 'top');
    await toolbar.getByTitle('По центру вертикально').click();
    await expect(targetCell).toHaveCSS('vertical-align', 'middle');
    await toolbar.getByTitle('Снизу').click();
    await expect(targetCell).toHaveCSS('vertical-align', 'bottom');
  });

  test('auto width measures formatted date and time cells with action icons', async ({ page }) => {
    const toolbar = page.locator('.widget-table-toolbar').first();
    const markupTable = table(page, 'table_v2_markup');
    const typeSelect = toolbar.locator('.widget-table-toolbar__select--type');
    const fontSizeSelect = toolbar.locator('.widget-table-toolbar__select--font-size');
    const autoWidth = toolbar.getByTitle('Автоподбор ширины');

    await markupTable.locator('.widget-table__column-letter--empty').click();
    await autoWidth.click();

    const wrappedHeaders = (await leafHeaderWrapStates(page, 'table_v2_markup'))
      .filter((header) => header.text && header.height > header.lineHeight * 1.25)
      .map((header) => header.text);
    expect(wrappedHeaders).toEqual([]);

    const lastColumnWidth = await tableCell(page, 'table_v2_markup', 0, 11).evaluate((cell) =>
      cell.getBoundingClientRect().width
    );
    expect(lastColumnWidth).toBeGreaterThanOrEqual(299);
    expect(lastColumnWidth).toBeLessThanOrEqual(301);

    await markupTable.locator('.widget-table__column-letter').filter({ hasText: 'E' }).click();
    await typeSelect.selectOption('date');
    await fontSizeSelect.selectOption('36');
    await autoWidth.click();

    await expect.poll(async () => {
      const metrics = await cellContentFitMetrics(page, 'table_v2_markup', 0, 5);
      return metrics.scrollWidth <= metrics.clientWidth + 1 && metrics.cellWidth <= 301;
    }).toBe(true);

    await tableCell(page, 'table_v2_markup', 0, 10).dblclick();
    const modeEditor = tableCell(page, 'table_v2_markup', 0, 10).getByRole('textbox').first();
    await modeEditor.fill('23:59');
    await modeEditor.blur();

    await markupTable.locator('.widget-table__column-letter').filter({ hasText: 'J' }).click();
    await typeSelect.selectOption('time');
    await fontSizeSelect.selectOption('36');
    await autoWidth.click();

    await expect.poll(async () => {
      const metrics = await cellContentFitMetrics(page, 'table_v2_markup', 0, 10);
      return metrics.scrollWidth <= metrics.clientWidth + 1 && metrics.cellWidth <= 301;
    }).toBe(true);
  });

  test('keyboard row duplication preserves cell formatting metadata', async ({ page }) => {
    const toolbar = page.locator('.widget-table-toolbar').first();
    const sourceCell = tableCell(page, 'table_v2_markup', 0, 1);
    const sourceText = tableCellText(page, 'table_v2_markup', 0, 1);

    await sourceCell.click();
    await toolbar.getByTitle('Цвет заливки', { exact: true }).click();
    await toolbar.getByTitle('Цвет текста', { exact: true }).click();
    await sourceCell.click();
    await page.keyboard.press('Control+B');
    await expect(sourceCell).toHaveCSS('background-color', 'rgb(255, 242, 204)');
    await expect(sourceText).toHaveCSS('color', 'rgb(192, 0, 0)');
    await expect(sourceText).toHaveCSS('font-weight', '700');

    await page.keyboard.press('Alt+Shift+ArrowDown');
    const duplicatedCell = tableCell(page, 'table_v2_markup', 1, 1);
    const duplicatedText = tableCellText(page, 'table_v2_markup', 1, 1);
    await expect(duplicatedText).toHaveText('Подготовить toolbar');
    await expect(duplicatedCell).toHaveCSS('background-color', 'rgb(255, 242, 204)');
    await expect(duplicatedText).toHaveCSS('color', 'rgb(192, 0, 0)');
    await expect(duplicatedText).toHaveCSS('font-weight', '700');
  });
});
