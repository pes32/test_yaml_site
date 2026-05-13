import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeTableQueryViewFingerprint } from '../../../frontend/js/widgets/table/table_query_fingerprint.ts';
import { DEMO_PAGE, openDemoTab, table, tableCellText } from '../../support/app';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function installWidgetInstanceDebugRegistry(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    type WidgetDebugEntry = { instance: unknown; type: string; widgetName: string };
    type WidgetDebugRegistry = {
      entries: Record<string, { instance: unknown; type: string }>;
      register(entry: WidgetDebugEntry): void;
      unregister(entry: WidgetDebugEntry): void;
    };
    type WidgetDebugWindow = Window & { __YAMLS_WIDGET_INSTANCE_DEBUG__?: WidgetDebugRegistry };
    const debugWindow = window as WidgetDebugWindow;
    debugWindow.__YAMLS_WIDGET_INSTANCE_DEBUG__ = {
      entries: {},
      register(entry) {
        this.entries[entry.widgetName] = { instance: entry.instance, type: entry.type };
      },
      unregister(entry) {
        if (this.entries[entry.widgetName]?.instance === entry.instance) {
          delete this.entries[entry.widgetName];
        }
      }
    };
  });
}

async function scrollTableToDisplayRow(
  page: import('@playwright/test').Page,
  widgetName: string,
  rowIndex: number,
  align: 'start' | 'center' | 'end' = 'start'
): Promise<void> {
  await page.evaluate(
    ({
      align: requestedAlign,
      row,
      name
    }: {
      align: 'start' | 'center' | 'end';
      row: number;
      name: string;
    }) => {
      type TableDebugEntry = {
        instance?: { scrollToDisplayRow?: (i: number, a?: 'start' | 'center' | 'end') => void };
      };
      type TableDebugWindow = Window & {
        __YAMLS_WIDGET_INSTANCE_DEBUG__?: { entries?: Record<string, TableDebugEntry> };
      };
      const entry = (window as TableDebugWindow).__YAMLS_WIDGET_INSTANCE_DEBUG__?.entries?.[name];
      if (typeof entry?.instance?.scrollToDisplayRow !== 'function') {
        throw new Error(`${name} scrollToDisplayRow missing`);
      }
      entry.instance.scrollToDisplayRow(row, requestedAlign);
    },
    { align, row: rowIndex, name: widgetName }
  );
}

test.describe('remote table synthetic million-row contract', () => {
  test.beforeEach(async ({ page }) => {
    await installWidgetInstanceDebugRegistry(page);

    await page.route('**/api/page/*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const demo = body?.data?.attrs?.demo_table_7;
      const rt = demo?.__tableRuntime;
      if (rt && typeof rt === 'object' && rt.initialWindow && typeof rt.initialWindow === 'object') {
        rt.initialWindow = { ...rt.initialWindow, total: 1_000_000, has_more: true };
      }
      await route.fulfill({
        status: response.status(),
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
    });

    await page.route('**/api/table-query', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') {
        await route.continue();
        return;
      }
      const raw = req.postData();
      const post = raw
        ? (JSON.parse(raw) as {
            attr?: string;
            page?: string;
            view?: Record<string, unknown>;
          })
        : {};
      const view = post.view || {};
      const off = Math.max(0, Math.floor(Number(view.offset) || 0));
      if (post.attr !== 'demo_table_7' || off < 999_000) {
        await route.continue();
        return;
      }
      const pageName = String(post.page || DEMO_PAGE.name);
      const attrName = String(post.attr || 'demo_table_7');
      const fp = await computeTableQueryViewFingerprint({
        attr: attrName,
        page: pageName,
        provider: 'inline',
        sourceKey: 'source',
        view: view as Record<string, unknown>
      });
      const limRaw = Number(view.limit);
      const lim = Math.min(
        5000,
        Math.max(1, Number.isFinite(limRaw) ? Math.floor(limRaw) : 1000)
      );
      const items = [];
      for (let i = 0; i < lim; i += 1) {
        const si = off + i;
        items.push({
          kind: 'row',
          rowId: `mega_${si}`,
          sourceIndex: si,
          values: [`${si}`, 'REC-MOCK', 'Мок', 'Активна', 'Z']
        });
      }
      await route.fulfill({
        body: JSON.stringify({
          data: {
            attr: attrName,
            has_more: off + lim < 1_000_000,
            items,
            limit: lim,
            offset: off,
            page: pageName,
            total: 1_000_000,
            view_fingerprint: fp,
            view_id: 'mega_mock'
          },
          diagnostics: [],
          ok: true,
          snapshot_created_at: null,
          snapshot_version: null
        }),
        contentType: 'application/json',
        status: 200
      });
    });
  });

  test('jump to display row 999999 loads tail window via table-query', async ({ page }) => {
    await openDemoTab(page, 'Таблицы', 'Демо-таблицы');
    const tbl = table(page, 'demo_table_7');
    await expect(tbl).toBeVisible();

    const dataRows = tbl.locator('tbody tr[data-display-row]');
    await expect.poll(async () => dataRows.count()).toBeLessThan(200);

    await scrollTableToDisplayRow(page, 'demo_table_7', 999_999, 'start');
    await expect
      .poll(async () => (await tableCellText(page, 'demo_table_7', 999_999, 1).textContent())?.trim())
      .toBe('REC-MOCK');
    await expect.poll(async () => dataRows.count()).toBeLessThan(200);
  });
});

test.describe('virtual template source guard', () => {
  test('TableWidget tbody iterates visibleCellGrid only', () => {
    const root = path.resolve(__dirname, '../../../frontend/js/widgets/table/TableWidget.vue');
    const src = readFileSync(root, 'utf8');
    expect(src).toContain('v-for="rowModel in visibleCellGrid"');
    expect(src).not.toMatch(/<tbody[^>]*>[\s\S]*v-for="[^"]*displayRows/);
  });
});
