import { expect, test, type Page, type Route } from '@playwright/test';
import {
  gotoBackendDemo,
  openChoiceDropdown,
  selectChoiceOption,
  tableCellText,
  widget,
  widgetInput
} from '../../support/app';

const DB_COMMAND_TOKEN = '__yaml_db_command__';

type JsonRecord = Record<string, unknown>;

function apiOk(data: JsonRecord): JsonRecord {
  return {
    ok: true,
    snapshot_version: 'test-snapshot',
    snapshot_created_at: '2026-05-14T00:00:00+00:00',
    data,
    diagnostics: []
  };
}

async function fulfillJson(route: Route, data: JsonRecord): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
}

function executeValues(widgetName: string): JsonRecord {
  if (widgetName === 'back_button_1') {
    return {
      back_str: 'mapped string',
      back_text: 'mapped text',
      back_int: 42,
      back_float: 12.75,
      back_ip: '10.20.30.40',
      back_ip_mask: '10.20.30.0/24',
      back_date: '2026-05-14',
      back_time: '12:34:56',
      back_datetime: '2026-05-14T12:34:56'
    };
  }
  if (widgetName === 'back_button_2') {
    return {
      col_1: 'raw string',
      col_2: 'raw text',
      col_3: 7,
      col_4: 9.5,
      col_5: '192.168.1.10',
      col_6: '192.168.1.0/24',
      col_7: '2026-05-15',
      col_8: '01:02:03',
      col_9: '2026-05-15T01:02:03'
    };
  }
  if (widgetName === 'back_button_3') {
    return {
      back_table: [
        [11, '2026-05-14T12:00:00+03:00', 'Browser A'],
        [12, '2026-05-14T13:30:00+03:00', 'Browser B']
      ]
    };
  }
  return {};
}

async function mockBackendDbExecute(page: Page): Promise<JsonRecord[]> {
  const requests: JsonRecord[] = [];
  await page.route('**/api/execute', async (route) => {
    const requestPayload = JSON.parse(route.request().postData() || '{}') as JsonRecord;
    requests.push(requestPayload);
    const widgetName = String(requestPayload.widget || '');
    await fulfillJson(route, apiOk({
      command: DB_COMMAND_TOKEN,
      data: null,
      message: 'Команда выполнена',
      page: '3_backend_demo',
      params: {},
      silent_success: true,
      updates: {
        values: executeValues(widgetName)
      },
      widget: widgetName
    }));
  });
  return requests;
}

function sourcePatch(widgetName: string): JsonRecord {
  if (widgetName === 'back_list') {
    return { source: ['A', 'B'] };
  }
  if (widgetName === 'back_list_2') {
    return { source: ['C', 'D'] };
  }
  if (widgetName === 'back_multilist') {
    return { source: ['Alpha', 'Beta'] };
  }
  if (widgetName === 'voc_1_db' || widgetName === 'voc_3_db') {
    return {
      columns: ['Code', 'Value'],
      source: [
        ['10', 'Inventory'],
        ['20', 'Sale']
      ],
      x_db_columns: ['code', 'description']
    };
  }
  return { source: [] };
}

async function mockWidgetSources(page: Page): Promise<JsonRecord[]> {
  const requests: JsonRecord[] = [];
  await page.route('**/api/widget-source', async (route) => {
    const requestPayload = JSON.parse(route.request().postData() || '{}') as JsonRecord;
    requests.push(requestPayload);
    const widgetName = String(requestPayload.widget || '');
    await fulfillJson(route, apiOk({
      page: '3_backend_demo',
      widget: widgetName,
      patch: sourcePatch(widgetName)
    }));
  });
  return requests;
}

test.describe('backend demo DB-backed YAML widgets', () => {
  test('button SQL updates fill mapped and same-name scalar fields', async ({ page }) => {
    const executeRequests = await mockBackendDbExecute(page);

    await gotoBackendDemo(page);
    await widget(page, 'back_button_1').getByRole('button', { name: 'Заполнить виджеты' }).click();

    await expect(widgetInput(page, 'back_str')).toHaveValue('mapped string');
    await expect(widgetInput(page, 'back_text')).toHaveValue('mapped text');
    await expect(widgetInput(page, 'back_int')).toHaveValue('42');
    await expect(widgetInput(page, 'back_float')).toHaveValue('12.75');
    await expect(widgetInput(page, 'back_ip')).toHaveValue('10.20.30.40');
    await expect(widgetInput(page, 'back_ip_mask')).toHaveValue('10.20.30.0/24');

    await widget(page, 'back_button_2').getByRole('button', { name: 'Заполнить виджеты' }).click();
    await expect(widgetInput(page, 'col_1')).toHaveValue('raw string');
    await expect(widgetInput(page, 'col_2')).toHaveValue('raw text');
    await expect(widgetInput(page, 'col_3')).toHaveValue('7');
    await expect(widgetInput(page, 'col_4')).toHaveValue('9.5');

    expect(executeRequests).toHaveLength(2);
    expect(executeRequests.every((item) => item.command === DB_COMMAND_TOKEN)).toBe(true);
    expect(JSON.stringify(executeRequests)).not.toContain('SELECT');
    await expect(page.locator('.page-snackbar')).toHaveCount(0);
  });

  test('button SQL table update replaces backend table rows', async ({ page }) => {
    const executeRequests = await mockBackendDbExecute(page);

    await gotoBackendDemo(page);
    await widget(page, 'back_button_3').getByRole('button', { name: 'Заполнить таблицу' }).click();

    await expect(tableCellText(page, 'back_table', 0, 0)).toHaveText('11');
    await expect(tableCellText(page, 'back_table', 0, 1)).toContainText('2026-05-14T12:00:00+03:00');
    await expect(tableCellText(page, 'back_table', 0, 2)).toHaveText('Browser A');
    await expect(tableCellText(page, 'back_table', 1, 0)).toHaveText('12');
    await expect(tableCellText(page, 'back_table', 1, 2)).toHaveText('Browser B');

    expect(executeRequests).toHaveLength(1);
    expect(executeRequests[0]).toMatchObject({
      command: DB_COMMAND_TOKEN,
      page: '3_backend_demo',
      widget: 'back_button_3'
    });
  });

  test('list and voc DB sources load lazily and patch existing widgets', async ({ page }) => {
    const sourceRequests = await mockWidgetSources(page);

    await gotoBackendDemo(page);

    await selectChoiceOption(page, 'back_list', 'A');
    await expect(widgetInput(page, 'back_list')).toHaveValue('A');

    await selectChoiceOption(page, 'back_list_2', 'D');
    await expect(widgetInput(page, 'back_list_2')).toHaveValue('D');

    const multilist = await openChoiceDropdown(page, 'back_multilist');
    await multilist.getByRole('option').filter({ hasText: 'Alpha' }).click();
    await multilist.getByRole('option').filter({ hasText: 'Beta' }).click();
    await expect(widgetInput(page, 'back_multilist')).toHaveValue(/Alpha.*Beta|Beta.*Alpha/);

    await widget(page, 'voc_1_db').getByRole('button', { name: 'Открыть справочник' }).click();
    const modal = page.locator('.gui-modal').first();
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Inventory', { exact: true }).first()).toBeVisible();
    await modal.locator('tbody tr').filter({ hasText: 'Inventory' }).first().click();
    await modal.getByRole('button', { name: 'Выбрать' }).click();
    await expect(modal).toHaveCount(0);
    await expect(widgetInput(page, 'voc_1_db')).toHaveValue('10');

    const requestedWidgets = sourceRequests.map((item) => String(item.widget || ''));
    expect(requestedWidgets).toEqual(expect.arrayContaining([
      'back_list',
      'back_list_2',
      'back_multilist',
      'voc_1_db'
    ]));
    expect(JSON.stringify(sourceRequests)).not.toContain('SELECT');
  });
});
