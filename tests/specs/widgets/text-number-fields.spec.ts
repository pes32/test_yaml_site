import { expect, test } from '@playwright/test';
import {
  expectWidgetError,
  expectWidgetHasNoError,
  fillAndBlur,
  openDemoTab,
  widget,
  widgetInput
} from '../../support/app';

test.describe('behavior: string, text and number widgets', () => {
  test.beforeEach(async ({ page }) => {
    await openDemoTab(page, 'Строковые виджеты', 'Демонстрация строковых виджетов');
  });

  test('str widgets support input, defaults, readonly and regex validation', async ({ page }) => {
    await fillAndBlur(widgetInput(page, 'str_1'), 'abc123');
    await expect(widgetInput(page, 'str_1')).toHaveValue('abc123');

    const str2 = widgetInput(page, 'str_2');
    await str2.focus();
    await expect(str2).toHaveAttribute('placeholder', 'Плейсхолдер');
    await fillAndBlur(str2, 'abcdef');
    await expectWidgetError(page, 'str_2', 'Латинские буквы и цифры, макс. 5 символов');
    await fillAndBlur(str2, 'A1b2');
    await expectWidgetHasNoError(page, 'str_2');

    await expect(widgetInput(page, 'str_3')).toHaveValue('Пример текста');
    await expect(widgetInput(page, 'str_4')).toBeDisabled();
    await expect(widgetInput(page, 'str_4')).toHaveValue('Пример текста');
    await expect(widget(page, 'str_4')).toContainText('Это поле нельзя изменить');
  });

  test('textarea widgets support multiline values, rows, defaults and validation', async ({ page }) => {
    const text1 = widgetInput(page, 'text_1');
    await expect(text1).toHaveAttribute('rows', '1');
    await fillAndBlur(text1, 'line one');
    await expect(text1).toHaveValue('line one');

    const text2 = widgetInput(page, 'text_2');
    await text2.focus();
    await expect(text2).toHaveAttribute('placeholder', 'Введите многострочный текст...');
    await fillAndBlur(text2, 'abcdefghijk');
    await expectWidgetError(page, 'text_2', 'Латинские буквы и цифры, макс. 10 на строку');
    await fillAndBlur(text2, 'abc\n123');
    await expectWidgetHasNoError(page, 'text_2');

    await expect(widgetInput(page, 'text_3')).toHaveValue(/штатная высота/);
    await expect(widgetInput(page, 'text_4')).toBeDisabled();
    await expect(widgetInput(page, 'text_4')).toHaveValue(/четыре/);
  });

  test('int and float widgets enforce declared regex and readonly/default states', async ({ page }) => {
    await fillAndBlur(widgetInput(page, 'int_1'), '77');
    await expect(widgetInput(page, 'int_1')).toHaveValue('77');

    await fillAndBlur(widgetInput(page, 'int_2'), '41');
    await expectWidgetError(page, 'int_2', 'Введите число 42');
    await fillAndBlur(widgetInput(page, 'int_2'), '42');
    await expectWidgetHasNoError(page, 'int_2');
    await expect(widgetInput(page, 'int_3')).toHaveValue('42');
    await expect(widgetInput(page, 'int_4')).toBeDisabled();
    await expect(widgetInput(page, 'int_4')).toHaveValue('123456789');

    await fillAndBlur(widgetInput(page, 'float_1'), '1.25');
    await expect(widgetInput(page, 'float_1')).toHaveValue('1.25');
    await fillAndBlur(widgetInput(page, 'float_2'), '2.72');
    await expectWidgetError(page, 'float_2', 'Введите число 3,141592');
    await fillAndBlur(widgetInput(page, 'float_2'), '3.141592');
    await expectWidgetHasNoError(page, 'float_2');
    await expect(widgetInput(page, 'float_3')).toHaveValue('3.141592');
    await expect(widgetInput(page, 'float_4')).toBeDisabled();
    await expect(widgetInput(page, 'float_4')).toHaveValue('2.718281');
  });
});
