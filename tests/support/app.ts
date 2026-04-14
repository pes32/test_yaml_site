import { expect, type Locator, type Page } from '@playwright/test';

export const DEMO_PAGE = {
  name: '2_widget_demo',
  url: '/widget_demo',
  title: 'Виджеты'
} as const;

function attrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function byDataAttr(attrName: string, value: string): string {
  return `[${attrName}="${attrValue(value)}"]`;
}

export function widget(page: Page, name: string): Locator {
  return page.locator(byDataAttr('data-widget-name', name)).first();
}

export function widgetInput(page: Page, name: string): Locator {
  return widget(page, name).locator('input, textarea').first();
}

export function widgetButton(page: Page, name: string): Locator {
  return widget(page, name).locator('button, .widget-split-button__toggle').first();
}

export function table(page: Page, name: string): Locator {
  return widget(page, name).locator('table.widget-table').first();
}

export function tableCell(page: Page, name: string, row: number, col: number): Locator {
  return table(page, name).locator(`tbody td[data-row="${row}"][data-col="${col}"]`).first();
}

export async function waitForPageReady(page: Page): Promise<void> {
  await expect(page.locator('.page-shell')).toBeVisible();
  await expect(page.locator('.page-empty-placeholder')).toHaveCount(0);
}

export async function gotoHome(page: Page): Promise<void> {
  await page.goto('/');
  await waitForPageReady(page);
  await expect(page.locator('body')).toHaveAttribute('data-page-name', 'main');
}

export async function gotoWidgetDemo(page: Page): Promise<void> {
  await page.goto(DEMO_PAGE.url);
  await waitForPageReady(page);
  await expect(page.locator('body')).toHaveAttribute('data-page-name', DEMO_PAGE.name);
  await expect(page).toHaveURL(new RegExp(`${DEMO_PAGE.url}(#.*)?$`));
}

export async function selectMenu(page: Page, menuName: string): Promise<void> {
  const menu = page.locator(byDataAttr('data-menu-name', menuName)).first();
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(menu).toHaveClass(/active/);
}

export async function selectTab(page: Page, tabName: string): Promise<void> {
  const tab = page.locator(byDataAttr('data-tab-name', tabName)).first();
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveClass(/active/);
}

export async function openDemoTab(page: Page, menuName: string, tabName?: string): Promise<void> {
  await gotoWidgetDemo(page);
  await selectMenu(page, menuName);
  if (tabName) {
    await selectTab(page, tabName);
  }
}

export async function expectWidgetVisible(page: Page, name: string): Promise<void> {
  await expect(widget(page, name), `widget ${name}`).toBeVisible();
}

export async function expectNoConsoleErrors(page: Page, action: () => Promise<void>): Promise<void> {
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      messages.push(message.text());
    }
  });

  await action();
  expect(messages, 'browser console errors').toEqual([]);
}

export async function openChoiceDropdown(page: Page, name: string): Promise<Locator> {
  const input = widgetInput(page, name);
  await expect(input).toBeVisible();
  await input.focus();
  await input.press('Enter');

  const controls = await input.getAttribute('aria-controls');
  expect(controls, `${name} aria-controls`).toBeTruthy();

  const listbox = page.locator(`#${controls}`);
  await expect(listbox).toBeVisible();
  return listbox;
}

export async function selectChoiceOption(page: Page, name: string, optionText: string): Promise<void> {
  const listbox = await openChoiceDropdown(page, name);
  const option = listbox.getByRole('option').filter({ hasText: optionText }).first();
  await expect(option).toBeVisible();
  await option.click();
}

export async function expectWidgetError(page: Page, name: string, text: string): Promise<void> {
  await expect(widget(page, name).locator('.md3-error')).toContainText(text);
}

export async function expectWidgetHasNoError(page: Page, name: string): Promise<void> {
  await expect(widget(page, name).locator('.md3-error')).toHaveCount(0);
}

export async function fillAndBlur(locator: Locator, value: string): Promise<void> {
  await locator.fill(value);
  await locator.blur();
}
