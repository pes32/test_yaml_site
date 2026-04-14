import { expect, test } from '@playwright/test';
import { DEMO_PAGE, expectWidgetVisible, gotoWidgetDemo, selectMenu, selectTab } from '../../support/app';
import { getApiData, getDemoPageConfig } from '../../support/api';
import { EXPECTED_ATTR_NAMES, EXPECTED_ATTRS_BY_TYPE } from '../../support/expectedAttrs';
import { collectWidgets, extractMenus, unique } from '../../support/guiModel';

test.describe('yaml consistency: API snapshot and rendered UI', () => {
  test('publishes the expected pages and demo page metadata', async ({ request }) => {
    const pagesPayload = await getApiData<{ pages: { name: string; title: string; url: string }[] }>(request, '/api/pages');
    const pages = new Map(pagesPayload.pages.map((page) => [page.name, page]));

    expect(pages.get('main')).toMatchObject({ title: 'Дратути!', url: '/' });
    expect(pages.get('1_ui_demo')).toMatchObject({ title: 'UI элементы', url: '/ui_demo' });
    expect(pages.get(DEMO_PAGE.name)).toMatchObject({ title: DEMO_PAGE.title, url: DEMO_PAGE.url });

    const demo = await getDemoPageConfig(request);
    expect(demo.page).toMatchObject(DEMO_PAGE);
    expect(demo.page.guiMenuKeys).toEqual(['menu "Строковые виджеты"', 'menu "Таблицы"']);
    expect(demo.page.modalGuiIds).toContain('modal_gui');
  });

  test('has a complete and typed attr catalog for 2_widget_demo', async ({ request }) => {
    const demo = await getDemoPageConfig(request);
    const actualNames = Object.keys(demo.attrs).sort();

    expect(actualNames).toEqual(EXPECTED_ATTR_NAMES);

    for (const [widgetType, names] of Object.entries(EXPECTED_ATTRS_BY_TYPE)) {
      for (const name of names) {
        const attr = demo.attrs[name];
        expect(attr, name).toBeTruthy();
        expect(String(attr.widget || 'str'), `${name} widget`).toBe(widgetType);
      }
    }
  });

  test('all widgets referenced from page gui have attrs and render in their tab', async ({ page, request }) => {
    const demo = await getDemoPageConfig(request);
    const menus = extractMenus(demo.page);
    const guiWidgetNames = unique(collectWidgets(demo.page.gui)).sort();

    for (const name of guiWidgetNames) {
      expect(demo.attrs[name], `${name} attr exists`).toBeTruthy();
    }

    await gotoWidgetDemo(page);

    for (const menu of menus) {
      await selectMenu(page, menu.name);

      if (!menu.tabs.length) {
        for (const name of unique(menu.widgets)) {
          await expectWidgetVisible(page, name);
        }
        continue;
      }

      for (const tab of menu.tabs) {
        await selectTab(page, tab.name);
        for (const name of unique(tab.widgets)) {
          await expectWidgetVisible(page, name);
        }
      }
    }
  });
});
