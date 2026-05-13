import { expect, test, type Page } from '@playwright/test';
import {
  TEST_ADMIN_LOGIN,
  TEST_ADMIN_PASSWORD,
  ensureTestAdmin,
  expectNoModalWithTitle,
  executeConfirmWithTab,
  fetchDbColumns,
  fetchDbConstraints,
  fetchDbTables,
  fieldInputByLabel,
  fillFieldByLabel,
  loginApi,
  modalByTitle,
  nextAvailableTableName,
  pressTabUntilFocusedButton,
  selectListByLabel,
  selectVocByLabel,
} from '../../support/userSettings';

const SCHEMA = 'public';

function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

function detailBox(page: Page) {
  return page.locator('.db-schema-explorer__detail-box').first();
}

function schemaNode(page: Page, schema: string) {
  return page
    .locator('.db-schema-explorer__node--schema')
    .filter({ has: page.locator('.db-schema-explorer__row-label').filter({ hasText: exactText(schema) }) })
    .first();
}

function tableNode(page: Page, table: string) {
  return page
    .locator('.db-schema-explorer__node--table')
    .filter({ has: page.locator('.db-schema-explorer__row-label--nested').filter({ hasText: exactText(table) }) })
    .first();
}

async function openSchemaTab(page: Page): Promise<void> {
  await loginApi(page, TEST_ADMIN_LOGIN, TEST_ADMIN_PASSWORD);
  await page.goto('/user_settings');
  await page.getByRole('button', { name: 'Настройка БД' }).click();
  await page.getByRole('tab', { name: 'Схема БД' }).click();
  await expect(page.locator('.db-schema-explorer')).toBeVisible();
}

async function selectSchema(page: Page, schema: string): Promise<void> {
  const node = schemaNode(page, schema);
  await expect(node).toBeVisible();
  await node.locator('.db-schema-explorer__row-label').click();
  await expect(detailBox(page).getByRole('heading', { name: `Схема ${schema}` })).toBeVisible();
  await expect(detailBox(page).locator('[data-row-id]').first()).toBeVisible();
}

async function expandSchema(page: Page, schema: string): Promise<void> {
  const chevron = schemaNode(page, schema).locator('.db-schema-explorer__chevron-btn').first();
  await expect(chevron).toBeVisible();
  if ((await chevron.getAttribute('aria-expanded')) !== 'true') {
    await chevron.click();
  }
}

async function selectTable(page: Page, table: string): Promise<void> {
  await expandSchema(page, SCHEMA);
  const node = tableNode(page, table);
  await expect(node).toBeVisible();
  await node.locator('.db-schema-explorer__row-label--nested').click();
  await expect(detailBox(page).getByRole('heading', { name: `${SCHEMA}.${table}` })).toBeVisible();
}

async function expandTable(page: Page, table: string): Promise<void> {
  await expandSchema(page, SCHEMA);
  const node = tableNode(page, table);
  const chevron = node.locator('.db-schema-explorer__chevron-btn').first();
  await expect(chevron).toBeVisible();
  if ((await chevron.getAttribute('aria-expanded')) !== 'true') {
    await chevron.click();
  }
}

async function createTableViaUi(page: Page, table: string): Promise<void> {
  await detailBox(page).getByRole('button', { name: /^Добавить$/ }).click();
  const modal = modalByTitle(page, /Добавить таблицу/);
  await expect(modal).toBeVisible();
  await fillFieldByLabel(modal, 'Имя таблицы', table);
  await modal.getByRole('button', { name: 'Добавить' }).click();

  await expect(modalByTitle(page, 'Подтверждение DDL')).toBeVisible();
  await expectNoModalWithTitle(page, /Добавить таблицу/);
  await executeConfirmWithTab(page);

  await expect
    .poll(async () => (await fetchDbTables(page)).some((item) => item.table_schema === SCHEMA && item.table_name === table))
    .toBe(true);
}

async function closeOpenModals(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const modals = page.locator('.modal-content');
    const countBefore = await modals.count();
    if (countBefore === 0) return;
    await modals.last().getByRole('button', { name: 'Закрыть' }).click();
    await expect.poll(async () => await modals.count()).toBeLessThan(countBefore);
  }
}

async function dropTableViaUiIfExists(page: Page, table: string): Promise<void> {
  const tableExists = (await fetchDbTables(page)).some(
    (item) => item.table_schema === SCHEMA && item.table_name === table
  );
  if (!tableExists) return;

  await closeOpenModals(page);
  await openSchemaTab(page);
  await selectSchema(page, SCHEMA);

  const row = detailBox(page).locator(`[data-row-id="${table}"]`).first();
  await expect(row).toBeVisible();
  await row.click();
  await detailBox(page).getByRole('button', { name: 'Удалить' }).click();

  const dropModal = modalByTitle(page, `Удалить таблицу из ${SCHEMA}?`);
  await expect(dropModal).toBeVisible();
  await dropModal.getByRole('button', { name: 'Каскадное удаление' }).click();
  await expect(modalByTitle(page, 'Подтверждение DDL')).toBeVisible();
  await expectNoModalWithTitle(page, `Удалить таблицу из ${SCHEMA}?`);
  await executeConfirmWithTab(page);

  await expect
    .poll(async () => !(await fetchDbTables(page)).some((item) => item.table_schema === SCHEMA && item.table_name === table))
    .toBe(true);
}

async function cleanupCreatedTablesViaUi(page: Page, createdTables: string[]): Promise<void> {
  const uniqueTables = [...new Set(createdTables)].reverse();
  for (const table of uniqueTables) {
    await dropTableViaUiIfExists(page, table);
  }
}

async function addColumnViaUi(
  page: Page,
  table: string,
  column: string,
  dataType: string,
  options: {
    nullable?: 'YES' | 'NO';
    charLength?: string;
    numericPrecision?: string;
    numericScale?: string;
    datetimePrecision?: string;
    intervalType?: string;
    intervalPrecision?: string;
  } = {}
): Promise<void> {
  await selectTable(page, table);
  await detailBox(page).getByRole('button', { name: /^Добавить$/ }).click();
  let modal = modalByTitle(page, /Добавить столбец/);
  await expect(modal).toBeVisible();
  await fillFieldByLabel(modal, 'Имя столбца', column);
  await pressTabUntilFocusedButton(page, 'Далее', 3);
  await page.keyboard.press('Enter');

  modal = modalByTitle(page, new RegExp(`Тип столбца ${column}`));
  await expect(modal).toBeVisible();
  await selectVocByLabel(page, modal, 'data_type', dataType, dataType);
  if (options.charLength) await fillFieldByLabel(modal, 'character_maximum_length', options.charLength);
  if (options.numericPrecision) await fillFieldByLabel(modal, 'numeric_precision', options.numericPrecision);
  if (options.numericScale) await fillFieldByLabel(modal, 'numeric_scale', options.numericScale);
  if (options.datetimePrecision) await fillFieldByLabel(modal, 'datetime_precision', options.datetimePrecision);
  if (options.intervalType) await selectListByLabel(page, modal, 'interval_type', options.intervalType);
  if (options.intervalPrecision) await fillFieldByLabel(modal, 'interval_precision', options.intervalPrecision);
  if (options.nullable === 'NO') {
    await selectListByLabel(page, modal, 'is_nullable', 'NO');
  }

  await pressTabUntilFocusedButton(page, 'Добавить', 3);
  await page.keyboard.press('Enter');
  await expect(modalByTitle(page, 'Подтверждение DDL')).toBeVisible();
  await expectNoModalWithTitle(page, new RegExp(`Тип столбца ${column}`));
  await executeConfirmWithTab(page);

  await expect
    .poll(async () => (await fetchDbColumns(page, SCHEMA, table)).some((item) => item.column_name === column))
    .toBe(true);
}

async function addPrimaryKeyViaUi(page: Page, table: string, column: string, constraintName: string): Promise<void> {
  await selectTable(page, table);
  await detailBox(page).getByRole('button', { name: 'Добавить PK' }).click();
  const modal = modalByTitle(page, 'Добавление PRIMARY KEY');
  await expect(modal).toBeVisible();
  await fillFieldByLabel(modal, 'Столбцы PK', column);
  await fillFieldByLabel(modal, 'Имя ограничения (необязательно)', constraintName);
  await pressTabUntilFocusedButton(page, 'Дальше…', 3);
  await page.keyboard.press('Enter');

  await expect(modalByTitle(page, 'Добавление PRIMARY KEY')).toBeVisible();
  await expect(page.locator('.modal-content').filter({ hasText: 'Столбцы PK' })).toHaveCount(0);
  await executeConfirmWithTab(page);
  await expect(detailBox(page).getByText(`${constraintName} — (${column})`)).toBeVisible();

  const constraints = await fetchDbConstraints(page, SCHEMA, table);
  expect(constraints.primary_key).toEqual({ constraint_name: constraintName, columns: [column] });
}

async function addForeignKeyViaUi(
  page: Page,
  table: string,
  refTable: string,
  constraintName: string
): Promise<void> {
  await selectTable(page, table);
  await detailBox(page).getByRole('button', { name: 'Добавить FK' }).click();
  const modal = modalByTitle(page, 'Добавление FOREIGN KEY');
  await expect(modal).toBeVisible();
  await fillFieldByLabel(modal, 'Имя ограничения', constraintName);
  await fillFieldByLabel(modal, 'Локальные столбцы (через запятую)', 'test_fk');
  await fillFieldByLabel(modal, 'Схема ссылки', SCHEMA);
  await fillFieldByLabel(modal, 'Таблица ссылки', refTable);
  await fillFieldByLabel(modal, 'Столбцы ссылки (через запятую)', 'table_id');
  await selectListByLabel(page, modal, 'ON DELETE', 'CASCADE');
  await selectListByLabel(page, modal, 'ON UPDATE', 'SET DEFAULT');
  await pressTabUntilFocusedButton(page, 'Дальше…', 3);
  await page.keyboard.press('Enter');

  await expect(modalByTitle(page, 'Добавление FOREIGN KEY')).toBeVisible();
  await expect(page.locator('.modal-content').filter({ hasText: 'Локальные столбцы' })).toHaveCount(0);
  await executeConfirmWithTab(page);

  const constraints = await fetchDbConstraints(page, SCHEMA, table);
  expect(constraints.foreign_keys).toContainEqual(
    expect.objectContaining({
      constraint_name: constraintName,
      columns: ['test_fk'],
      foreign_schema: SCHEMA,
      foreign_table: refTable,
      foreign_columns: ['table_id'],
      delete_rule: 'CASCADE',
      update_rule: 'SET DEFAULT',
    })
  );
}

test.describe('admin DB schema UI', () => {
  test.beforeEach(async ({ page }) => {
    await ensureTestAdmin(page);
  });

  test('creates tables, columns, PK and FK through the schema editor', async ({ page }) => {
    test.setTimeout(180_000);

    const createdTables: string[] = [];

    try {
      await openSchemaTab(page);
      await selectSchema(page, SCHEMA);

      const table = await nextAvailableTableName(page, SCHEMA, 'test_table');
      createdTables.push(table);
      await createTableViaUi(page, table);
      await selectTable(page, table);

      await addColumnViaUi(page, table, 'table_id', 'integer', { nullable: 'NO' });
      await expandTable(page, table);
      await expect(tableNode(page, table).getByRole('button', { name: 'table_id' })).toBeVisible();
      const pkName = table === 'test_table' ? 'table_id_test_pk' : `${table}_table_id_test_pk`;
      await addPrimaryKeyViaUi(page, table, 'table_id', pkName);

      await addColumnViaUi(page, table, 'col_varchar', 'character varying', { charLength: '32' });
      await expandTable(page, table);
      await tableNode(page, table).getByRole('button', { name: 'col_varchar' }).click();
      await expect(detailBox(page).getByRole('heading', { name: `${SCHEMA}.${table}.col_varchar` })).toBeVisible();
      await expect(fieldInputByLabel(detailBox(page), 'column_name')).toBeDisabled();
      await detailBox(page).getByRole('button', { name: 'Разблокировать' }).click();
      await expect(fieldInputByLabel(detailBox(page), 'column_name')).toBeEnabled();
      await expect(detailBox(page).getByRole('button', { name: 'Заблокировать' })).toBeVisible();
      await fillFieldByLabel(detailBox(page), 'column_default', 'autotest');
      await fillFieldByLabel(detailBox(page), 'character_maximum_length', '64');
      await detailBox(page).getByRole('button', { name: 'Сохранить' }).click();
      await executeConfirmWithTab(page);
      await expect
        .poll(async () => {
          const col = (await fetchDbColumns(page, SCHEMA, table)).find((item) => item.column_name === 'col_varchar');
          return {
            default: col?.column_default || '',
            length: String(col?.character_maximum_length || ''),
          };
        })
        .toEqual({ default: "'autotest'::character varying", length: '64' });

      const fkTable = await nextAvailableTableName(page, SCHEMA, 'test_table_fk');
      createdTables.push(fkTable);
      await selectSchema(page, SCHEMA);
      await createTableViaUi(page, fkTable);
      await addColumnViaUi(page, fkTable, 'test_fk', 'integer');
      await addForeignKeyViaUi(page, fkTable, table, `${fkTable}_test_fk`);
    } finally {
      await cleanupCreatedTablesViaUi(page, createdTables);
    }
  });
});
