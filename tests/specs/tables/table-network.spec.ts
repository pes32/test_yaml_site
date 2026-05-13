import { expect, test } from '@playwright/test';
import { openDemoTab, table } from '../../support/app';

async function scrollTableToDisplayRow(
  page: import('@playwright/test').Page,
  widgetName: string,
  rowIndex: number,
  align: 'start' | 'center' | 'end' = 'start'
) {
  await page.evaluate(
    ({
      requestedAlign,
      row,
      name
    }: {
      requestedAlign: 'start' | 'center' | 'end';
      row: number;
      name: string;
    }) => {
      type TableDebugEntry = {
        instance?: {
          scrollToDisplayRow?: (rowIndex: number, align?: 'start' | 'center' | 'end') => void;
        };
      };
      type TableDebugWindow = Window & {
        __YAMLS_WIDGET_INSTANCE_DEBUG__?: {
          entries?: Record<string, TableDebugEntry>;
        };
      };
      const entry = (window as TableDebugWindow).__YAMLS_WIDGET_INSTANCE_DEBUG__?.entries?.[name];
      if (typeof entry?.instance?.scrollToDisplayRow !== 'function') {
        throw new Error(`${name} scrollToDisplayRow is not registered`);
      }
      entry.instance.scrollToDisplayRow(row, requestedAlign);
    },
    { requestedAlign: align, row: rowIndex, name: widgetName }
  );
}

test.describe('remote table network behavior', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoTab(page, 'Таблицы', 'Демо-таблицы');
    await expect(table(page, 'demo_table_7')).toBeVisible();
  });

  test('column header sort issues POST /api/table-query without navigation', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/table-query')) {
        urls.push(req.url());
      }
    });
    const tbl = table(page, 'demo_table_7');
    const before = urls.length;
    await tbl.getByRole('button', { name: /Код/i }).click();
    await expect.poll(() => urls.length).toBeGreaterThan(before);
  });

  test('jump via scrollToDisplayRow uses query window with offset not starting at zero', async ({ page }) => {
    const payloads: Array<{ offset: number | undefined; limit: number | undefined }> = [];

    page.on('requestfinished', async (request) => {
      if (request.method() !== 'POST' || !request.url().includes('/api/table-query')) {
        return;
      }
      try {
        const raw = request.postData();
        if (!raw) {
          return;
        }
        const body = JSON.parse(raw) as {
          view?: { limit?: unknown; offset?: unknown };
        };
        if (body.view && typeof body.view === 'object') {
          payloads.push({
            limit: typeof body.view.limit === 'number' ? body.view.limit : undefined,
            offset: typeof body.view.offset === 'number' ? body.view.offset : undefined
          });
        }
      } catch {
        /* ignore */
      }
    });

    await scrollTableToDisplayRow(page, 'demo_table_7', 850, 'start');
    await expect
      .poll(() => payloads.some((payload) => (payload.offset ?? 0) > 400))
      .toBe(true);
  });

  test('remote grouping, clear and expand use table-query view state', async ({ page }) => {
    const payloads: Array<{ expandedGroups?: unknown[]; group?: unknown[] }> = [];
    page.on('request', (request) => {
      if (request.method() !== 'POST' || !request.url().includes('/api/table-query')) return;
      const raw = request.postData();
      if (!raw) return;
      try {
        const body = JSON.parse(raw) as { view?: { expandedGroups?: unknown[]; group?: unknown[] } };
        payloads.push({
          expandedGroups: body.view?.expandedGroups,
          group: body.view?.group
        });
      } catch {
        /* ignore */
      }
    });

    const tbl = table(page, 'demo_table_7');
    await tbl.getByRole('columnheader', { name: /Регион/ }).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Группировка' }).click();

    await expect.poll(() => payloads.some((payload) => (payload.group || []).length > 0)).toBe(true);
    await expect(tbl.locator('.widget-table__group-row').first()).toBeVisible();

    await tbl.getByRole('columnheader', { name: /Статус/ }).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Группировка' }).click();
    await expect
      .poll(() => payloads.some((payload) => (payload.group || []).length === 2))
      .toBe(true);

    await tbl.locator('.widget-table__group-row').first().click();
    await expect
      .poll(() => payloads.some((payload) => (payload.expandedGroups || []).length > 0))
      .toBe(true);
    await expect(tbl.locator('.widget-table__group-row').filter({ hasText: /Статус:/ }).first()).toBeVisible();
    const groupedGap = await tbl.evaluate((tableElement) => {
      const thead = tableElement.querySelector('thead');
      const firstRealRow = tableElement.querySelector('tbody tr[data-display-row]');
      const spacer = tableElement.querySelector('.widget-table__virtual-spacer');
      const proxy = tableElement.querySelector('.widget-table__virtual-spacer-proxy-cell');
      const headBox = thead?.getBoundingClientRect();
      const rowBox = firstRealRow?.getBoundingClientRect();
      return {
        gap: headBox && rowBox ? rowBox.top - headBox.bottom : null,
        proxyHeight: proxy?.getBoundingClientRect().height ?? null,
        spacerHeight: spacer?.getBoundingClientRect().height ?? null
      };
    });
    expect(groupedGap.gap).not.toBeNull();
    expect(Math.abs(groupedGap.gap || 0)).toBeLessThanOrEqual(1);
    expect(groupedGap.proxyHeight || 0).toBeLessThanOrEqual(1);
    expect(groupedGap.spacerHeight || 0).toBeLessThanOrEqual(1);

    await tbl.getByRole('columnheader', { name: /Регион/ }).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Снять группировку' }).click();
    await expect
      .poll(() => payloads.some((payload) => Array.isArray(payload.group) && payload.group.length === 0))
      .toBe(true);
  });

  test('sticky header source stays visible until overlay is ready and overlay aligns', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    const tbl = table(page, 'demo_table_7');
    const thead = tbl.locator('thead');
    await expect(thead).toBeVisible();

    await scrollTableToDisplayRow(page, 'demo_table_7', 850, 'start');

    const overlay = page.locator('.widget-table__sticky-overlay').first();
    await expect(overlay).toBeVisible();
    const geometry = await page.evaluate(() => {
      const contentElement = document.querySelector('.page-tab-content--with-tabs');
      const tableElement = document.querySelector('[data-widget-name="demo_table_7"] table.widget-table');
      const overlayElement = document.querySelector('.widget-table__sticky-overlay');
      const bodyRows = Array.from(tableElement?.querySelectorAll('tbody tr:not(.widget-table__virtual-padding)') || []) as HTMLElement[];
      const contentBox = contentElement?.getBoundingClientRect();
      const tableBox = tableElement?.getBoundingClientRect();
      const overlayBox = overlayElement?.getBoundingClientRect();
      const firstRowBelowHeader = bodyRows
        .map((row) => row.getBoundingClientRect())
        .filter((box) => box.bottom > overlayBox!.bottom)
        .sort((left, right) => left.top - right.top)[0];
      return contentBox && tableBox && overlayBox && firstRowBelowHeader
        ? {
            leftDelta: Math.abs(tableBox.left - overlayBox.left),
            verticalGap: firstRowBelowHeader.top - overlayBox.bottom,
            topDelta: Math.abs(contentBox.top - overlayBox.top),
            widthDelta: Math.abs(tableBox.width - overlayBox.width)
          }
        : null;
    });
    expect(geometry).toBeTruthy();
    expect(geometry!.leftDelta).toBeLessThanOrEqual(1);
    expect(geometry!.topDelta).toBeLessThanOrEqual(1);
    expect(geometry!.verticalGap).toBeLessThanOrEqual(1);
    expect(geometry!.widthDelta).toBeLessThanOrEqual(1);

    await openDemoTab(page, 'Таблицы', 'Сложная таблица');
    await expect(page.locator('.widget-table__sticky-overlay')).toHaveCount(0);
  });
});
