import { expect, test } from '@playwright/test';
import { LOCAL_FULL_MAX_ROWS } from '../../../frontend/js/widgets/table/table_row_provider.ts';
import { DEMO_PAGE, openDemoTab, waitForPageReady } from '../../support/app';

async function fetchPageEnvelope(page: import('@playwright/test').Page) {
  const pageSlug = DEMO_PAGE.name;
  return await page.evaluate(async (slug: string) => {
    const response = await fetch(`/api/page/${encodeURIComponent(slug)}`);
    return response.json();
  }, pageSlug);
}

test.describe('table remote payload gates', () => {
  test('page API keeps huge inline table source within LOCAL_FULL_MAX_ROWS window', async ({
    page
  }) => {
    await page.goto(DEMO_PAGE.url);
    await waitForPageReady(page);
    const envelope = (await fetchPageEnvelope(page)) as {
      data?: { attrs?: Record<string, unknown> };
    };
    const attrs = envelope.data?.attrs;
    expect(attrs).toBeTruthy();

    const demo = attrs?.demo_table_7 as Record<string, unknown> | undefined;
    expect(demo).toBeTruthy();
    const source = demo?.source;
    expect(Array.isArray(source)).toBeTruthy();

    const runtime = (demo as { __tableRuntime?: Record<string, unknown> }).__tableRuntime;
    expect((runtime as { mode?: string }).mode).toBe('remote-paged');

    expect((source as unknown[]).length).toBeGreaterThan(0);
    expect((source as unknown[]).length).toBeLessThanOrEqual(LOCAL_FULL_MAX_ROWS);
  });

  test('DOM row count for mega inline table stays bounded on initial paint', async ({ page }) => {
    await openDemoTab(page, 'Таблицы', 'Демо-таблицы');
    const tbodyRows = page.locator(
      '[data-widget-name="demo_table_7"] table.widget-table tbody tr'
    );
    const count = await tbodyRows.count();

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(200);
  });
});
