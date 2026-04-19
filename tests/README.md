# Frontend Autotests

Этот каталог содержит отдельный Playwright-контур для проверки браузерного UI.
По умолчанию тестовый запуск всегда работает через штатный debug-сервер проекта:

1. `tests/run.sh` вызывает `./stop.sh`.
2. Затем вызывает `./start_debug.sh`.
3. Запускает Firefox-тесты против `https://localhost:8443`.
4. После прогона снова вызывает `./stop.sh`.

Если нужно прогнать тесты на уже запущенном сервере, можно временно отключить
управление сервером:

```bash
YAMLS_TEST_SKIP_STACK=1 tests/run.sh
```

Если нужно оставить сервер поднятым после тестов:

```bash
YAMLS_TEST_KEEP_SERVER=1 tests/run.sh
```

Firefox не ставится автоматически при каждом запуске. Первый сетап браузера:

```bash
cd tests
npm install
npm run install:browsers
```

## Frontend Gate Matrix

Для изменений в widget/table runtime минимальный порядок проверки:

```bash
npm --prefix tooling/vite run type-holes
npm --prefix tooling/vite run typecheck
npm --prefix tooling/vite run typecheck:table
npm --prefix tooling/vite run build
tests/run.sh
```

Затем запускается targeted Playwright suite:

- `tests/run.sh specs/widgets/buttons-modals.spec.ts` — `button`, `split_button`, action runtime и модалки.
- `tests/run.sh specs/widgets/date-ip-image-widgets.spec.ts` — `date`, `time`, `datetime`, `ip`, `ip_mask`, `img`.
- `tests/run.sh specs/widgets/choice-voc-widgets.spec.ts` — `list`, `voc`.
- `tests/run.sh specs/tables/table-widgets.spec.ts` — `table` и embedded cell widgets.

Финальный regression gate для frontend изменений — полный `tests/run.sh`.

## SH-Файлы

### `run.sh`

Основной headless-запуск.

Команда:

```bash
tests/run.sh
```

Что делает:

1. Переходит в `tests`.
2. Через `scripts/run_with_stack.sh` проверяет npm-зависимости.
3. Останавливает текущий штатный стек через корневой `./stop.sh`.
4. Запускает корневой `./start_debug.sh`.
5. Выставляет `YAMLS_TEST_BASE_URL`, обычно `https://localhost:8443`.
6. Выполняет `npm run test -- ...`, то есть `playwright test`.
7. После окончания тестов останавливает стек через `./stop.sh`, если не задан `YAMLS_TEST_KEEP_SERVER=1`.

Этот файл сам не содержит логики тестов. Он только запускает весь набор.

### `run_headed.sh`

То же самое, что `run.sh`, но Firefox открывается видимым окном.

Команда:

```bash
tests/run_headed.sh
```

Что делает:

1. Останавливает штатный стек.
2. Поднимает `start_debug.sh`.
3. Запускает `npm run test:headed -- ...`, то есть `playwright test --headed`.
4. После прогона останавливает стек.

Используется, когда нужно глазами увидеть клики, ввод, раскрытие списков и модалки.

### `open_report.sh`

Открывает последний HTML-отчёт Playwright.

Команда:

```bash
tests/open_report.sh
```

Что делает:

1. Переходит в `tests`.
2. Если нет npm-зависимостей, делает `npm install`.
3. Выполняет `npm run report -- ...`, то есть `playwright show-report playwright-report`.

## Общие Правила Действий В Тестах

Текущий набор тестов использует такие действия:

- ЛКМ: `.click()`.
- ПКМ: `.click({ button: 'right' })`.
- Двойной ЛКМ: `.dblclick()` для входа в режим редактирования ячеек таблицы.
- Ввод текста: `.fill(...)`.
- Потеря фокуса: `.blur()`.
- Клавиатура: `Enter`, `Escape`, `ArrowDown`, `ArrowUp`, `Backspace`, `Tab`.
- Clipboard: `Ctrl/Cmd+C`, `Ctrl/Cmd+V` в table specs.

Индексы ячеек таблиц в тестах нулевые: `row=0`, `col=0` означает первая строка и первая колонка DOM-таблицы. В `big_table` есть служебная колонка нумерации строк, поэтому пользовательская колонка `Строка 1` проверяется как `col=1`.

## Specs

### `specs/smoke/home-navigation.spec.ts`

Smoke-проверка главной страницы и реального пользовательского пути до `2_widget_demo`.

#### Тест: `opens the home page`

Действия:

1. Открывает `/` через `page.goto('/')`.
2. Ждёт `.page-shell`.

Проверяет:

1. Заголовок страницы содержит `YAML System - Дратути!`.
2. На странице виден текст `Шалом, землянин!`.
3. Видна кнопка `Смотреть систему`.
4. Ссылка `YAML System` ведёт на `/`.

Кликов нет. Ввода нет. Клавиатуры нет.

#### Тест: `follows the real UI path from home to 2_widget_demo`

Действия:

1. Открывает `/`.
2. ЛКМ по кнопке `Смотреть систему`.
3. Ждёт переход на `/ui_demo`.
4. ЛКМ по меню `Второе меню`.
5. ЛКМ по табу `Вкладка 2. Без картинки ;(`.
6. ЛКМ по кнопке `Посмотреть виджеты`.
7. Ждёт переход на `/widget_demo`.

Проверяет:

1. После первого перехода `body[data-page-name] = 1_ui_demo`.
2. После второго перехода `body[data-page-name] = 2_widget_demo`.
3. На странице видны меню `Строковые виджеты` и `Таблицы`.

Ввода нет. Клавиатуры нет. ПКМ нет.

### `specs/demo/yaml-consistency.spec.ts`

Проверяет согласованность backend API, YAML snapshot и реально отрисованного UI.

#### Тест: `publishes the expected pages and demo page metadata`

Действия:

1. Делает API-запрос `GET /api/pages`.
2. Делает API-запрос `GET /api/page/2_widget_demo`.

Проверяет:

1. В `/api/pages` есть:
   - `main`, title `Дратути!`, url `/`;
   - `1_ui_demo`, title `UI элементы`, url `/ui_demo`;
   - `2_widget_demo`, title `Виджеты`, url `/widget_demo`.
2. У `2_widget_demo`:
   - `name = 2_widget_demo`;
   - `url = /widget_demo`;
   - `title = Виджеты`;
   - `guiMenuKeys = ['menu "Строковые виджеты"', 'menu "Таблицы"']`;
   - `modalGuiIds` содержит `modal_gui`.

UI не открывает. Кликов нет. Ввода нет.

#### Тест: `has a complete and typed attr catalog for 2_widget_demo`

Действия:

1. Делает API-запрос `GET /api/page/2_widget_demo`.
2. Берёт `data.attrs`.

Проверяет:

1. Список имён attrs полностью совпадает с `tests/support/expectedAttrs.ts`.
2. Для каждого attr проверяет тип `widget`.
3. Если `widget` отсутствует, тип считается `str`.

UI не открывает. Кликов нет. Ввода нет.

#### Тест: `all widgets referenced from page gui have attrs and render in their tab`

Действия:

1. Делает API-запрос `GET /api/page/2_widget_demo`.
2. Собирает все виджеты, упомянутые в `gui`.
3. Открывает `/widget_demo`.
4. Для каждого меню делает ЛКМ по меню.
5. Для каждого таба делает ЛКМ по табу.

Проверяет:

1. Каждый виджет, упомянутый в `gui`, есть в `attrs`.
2. Каждый виджет из текущего меню/таба появляется в DOM как `[data-widget-name="..."]`.

Ввода нет. Клавиатуры нет. ПКМ нет.

### `specs/widgets/text-number-fields.spec.ts`

Перед каждым тестом:

1. Открывает `/widget_demo`.
2. ЛКМ по меню `Строковые виджеты`.
3. ЛКМ по табу `Демонстрация строковых виджетов`.

#### Тест: `str widgets support input, defaults, readonly and regex validation`

Действия и проверки:

1. В `str_1` вводит `abc123`.
2. Снимает фокус с `str_1`.
3. Проверяет, что `str_1 = abc123`.
4. Фокусирует `str_2`.
5. Проверяет placeholder `Плейсхолдер`.
6. В `str_2` вводит `abcdef`.
7. Снимает фокус.
8. Проверяет ошибку `Латинские буквы и цифры, макс. 5 символов`.
9. В `str_2` вводит `A1b2`.
10. Снимает фокус.
11. Проверяет, что ошибки больше нет.
12. Проверяет `str_3 = Пример текста`.
13. Проверяет, что `str_4` disabled.
14. Проверяет `str_4 = Пример текста`.
15. Проверяет supporting text `Это поле нельзя изменить`.

Клавиатурных кнопок нет. Только ввод и blur.

#### Тест: `textarea widgets support multiline values, rows, defaults and validation`

Действия и проверки:

1. Проверяет, что у `text_1` `rows=1`.
2. В `text_1` вводит `line one`.
3. Снимает фокус.
4. Проверяет `text_1 = line one`.
5. Фокусирует `text_2`.
6. Проверяет placeholder `Введите многострочный текст...`.
7. В `text_2` вводит `abcdefghijk`.
8. Снимает фокус.
9. Проверяет ошибку `Латинские буквы и цифры, макс. 10 на строку`.
10. В `text_2` вводит две строки: `abc` и `123`.
11. Снимает фокус.
12. Проверяет, что ошибки больше нет.
13. Проверяет, что `text_3` содержит текст `штатная высота`.
14. Проверяет, что `text_4` disabled.
15. Проверяет, что `text_4` содержит `четыре`.

Клавиатурных кнопок нет. Только ввод и blur.

#### Тест: `int and float widgets enforce declared regex and readonly/default states`

Действия и проверки:

1. В `int_1` вводит `77`, blur, проверяет `77`.
2. В `int_2` вводит `41`, blur, проверяет ошибку `Введите число 42`.
3. В `int_2` вводит `42`, blur, проверяет отсутствие ошибки.
4. Проверяет `int_3 = 42`.
5. Проверяет, что `int_4` disabled.
6. Проверяет `int_4 = 123456789`.
7. В `float_1` вводит `1.25`, blur, проверяет `1.25`.
8. В `float_2` вводит `2.72`, blur, проверяет ошибку `Введите число 3,141592`.
9. В `float_2` вводит `3.141592`, blur, проверяет отсутствие ошибки.
10. Проверяет `float_3 = 3.141592`.
11. Проверяет, что `float_4` disabled.
12. Проверяет `float_4 = 2.718281`.

Клавиатурных кнопок нет. Только ввод и blur.

### `specs/widgets/choice-voc-widgets.spec.ts`

Перед каждым тестом:

1. Открывает `/widget_demo`.
2. ЛКМ по меню `Строковые виджеты`.
3. ЛКМ по табу `Демонстрация строковых виджетов`.

#### Тест: `list widgets cover searchable, default, non-editable and multiselect modes`

Действия и проверки:

1. Для `list_1`:
   - фокусирует input;
   - нажимает `Enter`;
   - ЛКМ по option `Опция 2`;
   - проверяет `list_1 = Опция 2`.
2. Для `list_2`:
   - фокусирует input;
   - проверяет placeholder `Выбери опцию`;
   - вводит `11`;
   - проверяет, что появилась option `Опция 11`;
   - ЛКМ по option `Опция 11`;
   - проверяет `list_2 = Опция 11`.
3. Для `list_3`:
   - проверяет default `Опция 1`.
4. Для `list_4`:
   - проверяет атрибут `readonly`;
   - фокусирует input;
   - нажимает `Enter`;
   - ЛКМ по option `Опция 3`;
   - проверяет `list_4 = Опция 3`.
5. Для `list_5`:
   - фокусирует input;
   - нажимает `Enter`;
   - ЛКМ по item с `title="Опция 1"`;
   - ЛКМ по item с `title="Опция 3"`;
   - проверяет, что в поле есть `Опция 1` и `Опция 3`;
   - нажимает `Backspace`;
   - проверяет, что осталась `Опция 1`.

ПКМ нет. `Tab` нет.

#### Тест: `voc supports manual codes, modal lookup and multiselect serialization`

Действия и проверки:

1. В `voc_1` вводит `10`.
2. Снимает фокус.
3. Проверяет `voc_1 = 10`.
4. ЛКМ по кнопке `Открыть справочник` внутри `voc_1`.
5. Проверяет, что открылась `.gui-modal`.
6. Проверяет заголовок модалки `Код операции`.
7. В поле поиска модалки вводит `инвентаризация`.
8. Проверяет, что в модалке видна строка `Инвентаризация`.
9. ЛКМ по строке таблицы модалки, где есть `Инвентаризация`.
10. ЛКМ по кнопке `Выбрать`.
11. Проверяет, что модалка закрылась.
12. Проверяет, что `voc_1 = 10`.
13. В `voc_3` вводит `1, 10`.
14. Снимает фокус.
15. Проверяет `voc_3 = 1, 10`.

Клавиатурных кнопок нет. ПКМ нет.

#### Тест: `voc modal supports keyboard search and selection`

Действия и проверки:

1. Фокусирует `voc_1`.
2. Нажимает `Alt+ArrowDown`.
3. Проверяет, что открылась `.gui-modal`.
4. Вводит `инвентаризация` в поле поиска.
5. Проверяет строку `Инвентаризация`.
6. Нажимает `Enter`.
7. Проверяет, что модалка закрыта.
8. Проверяет `voc_1 = 10`.

ЛКМ нет. ПКМ нет.

#### Тест: `choice dropdowns close on Escape and keep focus on keyboard selection`

Действия и проверки:

1. Для `list_1`:
   - фокусирует input;
   - нажимает `Enter`;
   - проверяет, что listbox виден;
   - нажимает `Escape`;
   - проверяет, что listbox закрыт.
2. Снова для `list_1`:
   - нажимает `Enter`;
   - нажимает `ArrowDown`;
   - нажимает `Enter`;
   - проверяет, что в поле появилось значение, содержащее `Опция`.

ЛКМ по option в этом тесте нет. ПКМ нет. `Tab` нет.

### `specs/widgets/date-ip-image-widgets.spec.ts`

Перед каждым тестом:

1. Открывает `/widget_demo`.
2. ЛКМ по меню `Строковые виджеты`.
3. ЛКМ по табу `Демонстрация строковых виджетов`.

#### Тест: `date and time widgets normalize typed values and open popovers`

Действия и проверки:

1. В `date_widget` вводит `01012026`.
2. Снимает фокус.
3. Проверяет нормализацию в `01.01.2026`.
4. ЛКМ по кнопке `Выбрать дату`.
5. Проверяет, что виден `.widget-dt-popover--calendar`.
6. Нажимает `Escape`.
7. В `time_widget` вводит `1234`.
8. Снимает фокус.
9. Проверяет нормализацию в `12:34`.
10. ЛКМ по кнопке `Выбрать время`.
11. Проверяет, что виден `.widget-dt-popover--time`.
12. В `demo_datetime` проверяет, что есть два input.
13. Проверяет, что оба input в `demo_datetime` не пустые.

ПКМ нет. `Tab` нет.

#### Тест: `ip and ip_mask widgets normalize separators, validate ranges and respect readonly`

Действия и проверки:

1. В `ip_1` вводит `192 168 0 1`.
2. Снимает фокус.
3. Проверяет нормализацию в `192.168.0.1`.
4. В `ip_2` вводит `999.1.1.1`.
5. Снимает фокус.
6. Проверяет ошибку `Неверный формат`.
7. В `ip_3` вводит `10,20,30,40/24`.
8. Снимает фокус.
9. Проверяет нормализацию в `10.20.30.40/24`.
10. Проверяет, что `ip_4` disabled.
11. Проверяет `ip_4 = 255.255.255.0/24`.

Клавиатурных кнопок нет. ПКМ нет.

#### Тест: `image widgets render declared assets, captions and widths`

Действия:

1. ЛКМ по табу `Картинки!`.

Проверяет:

1. `img_1` содержит подпись `Подпись сверху`.
2. `img_1 img[src] = /templates/mems/mem_1.jpg`.
3. `img_2 img[src] = /templates/mems/mem_2.png`.
4. `img_3` содержит подпись `Подпись снизу`.
5. Для `img_1`, `img_2`, `img_3`:
   - image видим;
   - JS-свойство `complete = true`;
   - inline style содержит `width: 600px`.

Ввода нет. Клавиатуры нет. ПКМ нет.

### `specs/widgets/buttons-modals.spec.ts`

Перед каждым тестом:

1. Открывает `/widget_demo`.
2. ЛКМ по меню `Строковые виджеты`.
3. ЛКМ по табу `Демонстрация кнопок`.

#### Тест: `button attrs render visual variants and safe titles`

Проверяет:

1. У `button_1` title `Кнопка c фоном и иконкой`.
2. У `button_2` title `Кнопка без фона с иконкой`.
3. Кнопка `button_3` с текстом `Кнопка` видна.
4. `button_4` содержит текст `Иконка + кнопка на 500px`.
5. У `button_5` title `ОГРОМНАЯ КНОПКА`.

Кликов нет. Ввода нет. Клавиатуры нет.

#### Тест: `split buttons expose all configured actions without firing them on open`

Действия и проверки:

1. ЛКМ по toggle `Открыть список действий` у `button_6`.
2. Проверяет menuitem `Первый пункт`.
3. Проверяет menuitem `Второй пункт`.
4. Проверяет menuitem `Третий пункт`.
5. Нажимает `Escape`.
6. ЛКМ по toggle `Открыть список действий` у `func_6`.
7. Проверяет menuitem `Форма 1.1`.
8. Проверяет menuitem `Дизайн MD3`.
9. Нажимает `Escape`.
10. ЛКМ по toggle `Открыть список действий` у `func_7`.
11. Проверяет menuitem `Мем 1`.
12. Проверяет menuitem `Мем 2`.
13. Проверяет menuitem `Мем 3`.

Важно: тест не кликает по пунктам меню, чтобы не открыть URL и не скачать файлы. Проверяется только раскрытие и состав меню.

ПКМ нет. `Tab` нет.

#### Тест: `split button supports keyboard navigation, tab escape and outside close`

Действия и проверки:

1. Фокусирует toggle `Открыть список действий` у `func_6`.
2. Нажимает `ArrowDown`.
3. Проверяет, что dropdown menu виден и имеет scrollable state.
4. Проверяет фокус на первом пункте.
5. Нажимает `ArrowUp`.
6. Проверяет фокус на последнем пункте.
7. Проверяет, что у menu есть рассчитанный `max-height`.
8. Нажимает `Tab`.
9. Проверяет закрытие menu и фокус на следующем split-button toggle.
10. Открывает menu повторно.
11. ЛКМ по `body` вне dropdown.
12. Проверяет закрытие menu.

ПКМ нет. Ввода нет.

#### Тест: `split button command item uses the shared execute pipeline`

Действия и проверки:

1. Ставит mock на `/api/execute`.
2. ЛКМ по toggle `Открыть список действий` у `button_6`.
3. ЛКМ по пункту `Второй пункт`.
4. Проверяет execute payload: `command = fake_visual_action_2`, `page = 2_widget_demo`, `widget = button_6`.

Клавиатуры нет. ПКМ нет.

#### Тест: `split button missing command overwrites the active error snackbar`

Действия и проверки:

1. ЛКМ по toggle `Открыть список действий` у `button_6`.
2. ЛКМ по пункту `Первый пункт`, который ведёт к незарегистрированной backend-команде.
3. Проверяет один `.page-snackbar` с текстом `не зарегистрирована`.
4. Снова открывает `button_6`.
5. ЛКМ по пункту `Второй пункт`.
6. Проверяет, что snackbar перезаписан в том же контейнере, без второго временного snackbar и без изменения ширины.

Клавиатуры нет. ПКМ нет.

#### Тест: `confirm dialogs can be accepted or cancelled without accidental navigation`

Действия и проверки:

1. ЛКМ по кнопке `Диалог (url)` у `func_3`.
2. Проверяет, что `.confirm-modal-content` виден.
3. Проверяет заголовок `Понравился рикрол?`.
4. ЛКМ по кнопке `Нет, спасибо`.
5. Проверяет, что confirm modal закрыт.
6. Проверяет, что URL всё ещё `/widget_demo`.
7. ЛКМ по кнопке `Диалог (command)` у `func_4`.
8. Проверяет, что `.confirm-modal-content` виден.
9. Проверяет текст `Очень длинный текст сообщения`.
10. ЛКМ по кнопке `Отмена`.
11. Проверяет, что confirm modal закрыт.
12. Ставит mock на `/api/execute`.
13. Снова открывает `func_4`.
14. ЛКМ по кнопке `Да`.
15. Проверяет execute payload: `command = test_command`, `page = 2_widget_demo`, `widget = func_4`.
16. Проверяет, что confirm modal закрыт.

Клавиатуры нет. ПКМ нет.

#### Тест: `ui modal opens from button and renders modal tabs and widgets`

Действия и проверки:

1. ЛКМ по кнопке `Модальное окно` у `modal_button`.
2. Проверяет, что `.gui-modal` видна.
3. Проверяет заголовок модалки `Имя модального окна`.
4. Проверяет табы модалки:
   - `Первый таб`;
   - `Второй таб`;
   - `Третий таб`.
5. Проверяет, что в первом табе модалки виден widget `str_1`.
6. ЛКМ по табу модалки `Второй таб`.
7. Проверяет, что виден widget `int_1`.
8. ЛКМ по кнопке закрытия в `.modal-header .ui-close-button`.
9. Проверяет, что `.gui-modal` закрыта.

Ввода нет. Клавиатуры нет. ПКМ нет.

### `specs/tables/table-widgets.spec.ts`

Файл содержит тесты простых demo-таблиц и сложной таблицы `big_table`.

Вспомогательная функция `editNativeTableCell(...)` делает:

1. Находит ячейку таблицы по `[data-row="..."][data-col="..."]`.
2. Двойной ЛКМ по ячейке.
3. Ищет внутри ячейки textbox.
4. Вводит значение через `.fill(...)`.
5. Снимает фокус через `.blur()`.
6. Проверяет введённое значение.

ПКМ не используется. `Tab` не используется.

#### Группа: `behavior: demo table widgets`

Перед каждым тестом группы:

1. Открывает `/widget_demo`.
2. ЛКМ по меню `Таблицы`.
3. ЛКМ по табу `Демо-таблицы`.

##### Тест: `renders every demo table and applies table-level YAML flags`

Проверяет наличие таблиц:

- `demo_table_1`;
- `demo_table_2`;
- `demo_table_3`;
- `demo_table_4`;
- `demo_table_5`;
- `demo_table_6`;
- `demo_table_7`.

Проверяет CSS-флаги:

1. `demo_table_1` не имеет `widget-table--editable`.
2. `demo_table_2` имеет `widget-table--editable`.
3. `demo_table_3` имеет `widget-table--no-zebra`.
4. `demo_table_4` имеет `widget-table--no-zebra`.
5. `demo_table_5` не имеет `widget-table--sortable`.
6. `demo_table_6` не имеет `widget-table--sortable`.
7. `demo_table_7` имеет `widget-table--sticky-header`.

Кликов по таблице нет. Ввода нет.

##### Тест: `readonly table displays source rows and supports header sorting`

Действия и проверки:

1. Берёт `demo_table_1`.
2. Проверяет, что в `tbody` 3 строки.
3. Проверяет, что первая строка содержит `Иван`.
4. Проверяет, что во второй ячейке первой строки `25`.
5. ЛКМ по header button `Возраст`.
6. Ещё раз ЛКМ по header button `Возраст`.
7. Проверяет, что первая строка содержит `Петр`.
8. Проверяет, что во второй ячейке первой строки `35`.

Это проверяет сортировку по возрасту до состояния, где максимальный возраст сверху.

Ввода нет. ПКМ нет.

##### Тест: `editable table cells accept text and preserve configured empty rows`

Действия:

1. В `demo_table_2`, строка `0`, колонка `0`:
   - двойной ЛКМ;
   - ввод `Параметр А`;
   - blur.
2. В `demo_table_2`, строка `0`, колонка `1`:
   - двойной ЛКМ;
   - ввод `Значение 1`;
   - blur.
3. В `demo_table_2`, строка `0`, колонка `2`:
   - двойной ЛКМ;
   - ввод `Значение 2`;
   - blur.

Проверяет:

1. `demo_table_4` содержит 3 строки `tbody tr`.
2. `demo_table_6` содержит 3 строки `tbody tr`.

ПКМ нет. `Tab` нет.

##### Тест: `large lazy table renders the first chunk and keeps lazy sentinel instead of 1000 DOM rows`

Проверяет `demo_table_7`.

Действия:

Кликов нет. Ввода нет.

Проверяет:

1. Первая строка содержит `REC-0001`.
2. Строка с индексом `99` содержит `REC-0100`.
3. В `tbody` всего 101 строка: 100 строк данных и lazy sentinel.
4. Есть `.widget-table__lazy-sentinel`.

#### Группа: `behavior: complex table widget`

Перед каждым тестом группы:

1. Открывает `/widget_demo`.
2. ЛКМ по меню `Таблицы`.
3. ЛКМ по табу `Сложная таблица`.

##### Тест: `renders grouped headers, column numbers and embedded table widget columns`

Проверяет `big_table`.

Действия:

Кликов по таблице нет. Ввода нет.

Проверяет:

1. Таблица видна.
2. Таблица имеет `widget-table--editable`.
3. Таблица имеет `widget-table--sticky-header`.
4. Видны заголовки:
   - `Строка 1`;
   - `Узкая строка`;
   - `Числа`;
   - `Целое`;
   - `Float_2 c разделителем`;
   - `Дата и время`;
   - `Дата`;
   - `Время`;
   - `Списки`;
   - `Мультисписок`;
   - `Справочник`;
   - `Адреса`;
   - `ip_mask`.
5. В `thead` видны номера колонок `1`, `8`, `14`.

##### Тест: `complex table cells support native text editing and embedded list actions`

Действия:

1. В `big_table`, строка `0`, колонка `1`:
   - двойной ЛКМ;
   - ввод `строка`;
   - blur.
2. В `big_table`, строка `0`, колонка `3`:
   - двойной ЛКМ;
   - ввод `42`;
   - blur.
3. В `big_table`, строка `0`, колонка `11`:
   - проверяет наличие кнопки `Открыть список`.

Почему `col=1`, а не `col=0`: `col=0` в `big_table` — служебная колонка нумерации строк.

Почему `col=11`: это DOM-колонка со встроенным list-действием после учёта служебной колонки.

ПКМ нет. `Tab` нет. В этом тесте dropdown list внутри ячейки не раскрывается; проверяется, что действие ячейки присутствует.

##### Тест: `full-row keyboard selection keeps focus and Ctrl+Minus deletes the selected row block`

Действия и проверки:

1. В `big_table` дважды добавляет строку ниже через контекстное меню ячейки.
2. Проверяет, что в `tbody` 3 строки.
3. Фокусирует ячейку строки `0`, колонки `1`.
4. Нажимает `Shift+Space`.
5. Проверяет, что фокус остался на исходной ячейке, а не ушёл на край строки.
6. Нажимает `Shift+ArrowDown`, расширяя full-row selection до второй строки.
7. Нажимает `Ctrl+-`.
8. Проверяет, что выделенный блок строк удалён и в `tbody` осталась 1 строка.

ЛКМ используется. ПКМ используется. Ввода нет.

##### Тест: `copies one cell value into every cell of a selected range`

Действия и проверки:

1. В `big_table` добавляет строку ниже через контекстное меню.
2. Вводит `seed` в ячейку строки `0`, колонки `1`.
3. Копирует эту ячейку через `Ctrl/Cmd+C`.
4. Выделяет диапазон от строки `0`, колонки `1` до строки `1`, колонки `2`.
5. Вставляет через `Ctrl/Cmd+V`.
6. Проверяет, что `seed` появился во всех четырёх ячейках выделенного диапазона.

ЛКМ используется. ПКМ используется. Clipboard API в тесте подменён локальным in-page stub, чтобы Firefox runner не зависел от browser permission.

##### Тест: `column number headers open the column context menu and line numbering toggles from any header`

Действия и проверки:

1. ПКМ по номеру первого пользовательского столбца в строке нумерации колонок.
2. Проверяет пункты `Отключить нумерацию строк` и `Открепить заголовки`.
3. ПКМ по заголовку `Строка 1`.
4. Отключает нумерацию строк.
5. Проверяет, что `№` исчез из `thead`.
6. ПКМ по заголовку `Строка 1`.
7. Включает нумерацию строк.
8. Проверяет, что `№` снова виден в `thead`.

ПКМ используется. Ввода нет.

##### Тест: `group rows use the shared column context menu instead of the browser menu`

Действия и проверки:

1. ЛКМ по сортировке `Строка 1`.
2. ПКМ по заголовку `Строка 1`.
3. Выбирает `Группировка`.
4. Проверяет, что видна `.widget-table__group-row`.
5. ПКМ по grouping row.
6. Проверяет общее table context menu с пунктами:
   - `Открепить заголовки`;
   - `Отключить нумерацию строк`;
   - `Перенос по словам`;
   - `Сбросить сортировку`.

ПКМ используется. Ввода нет.

## Support-Файлы

### `support/app.ts`

Общие helpers для UI-тестов.

Важные функции:

- `gotoHome(page)` открывает `/` и проверяет `body[data-page-name="main"]`.
- `gotoWidgetDemo(page)` открывает `/widget_demo` и проверяет `body[data-page-name="2_widget_demo"]`.
- `selectMenu(page, menuName)` делает ЛКМ по `[data-menu-name="..."]`.
- `selectTab(page, tabName)` делает ЛКМ по `[data-tab-name="..."]`.
- `openDemoTab(page, menuName, tabName)` открывает `/widget_demo`, потом кликает меню и таб.
- `widget(page, name)` ищет `[data-widget-name="..."]`.
- `widgetInput(page, name)` ищет первый `input` или `textarea` внутри виджета.
- `table(page, name)` ищет `table.widget-table` внутри виджета.
- `tableCell(page, name, row, col)` ищет ячейку по `data-row` и `data-col`.
- `openChoiceDropdown(page, name)` фокусирует input, нажимает `Enter`, возвращает listbox.
- `selectChoiceOption(page, name, optionText)` открывает dropdown и делает ЛКМ по option.
- `fillAndBlur(locator, value)` вводит значение и снимает фокус.

### `support/api.ts`

Helpers для API-запросов Playwright.

Проверяет, что HTTP-ответ успешный, `payload.ok = true`, и возвращает `payload.data`.

### `support/guiModel.ts`

Мини-парсер API-представления `gui`.

Используется для теста consistency:

1. Достаёт имена меню из ключей вида `menu "..."`.
2. Достаёт имена табов из ключей вида `tab "..."`.
3. Собирает имена виджетов из `row`.

UI не трогает.

### `support/expectedAttrs.ts`

Эталонный список attrs и их widget-типов для страницы `2_widget_demo`.

Если в YAML добавлен новый attr или изменён тип существующего, этот файл нужно обновить.

## Конфиг

### `playwright.config.ts`

Настройки Playwright:

- тесты лежат в `specs`;
- браузер по умолчанию Firefox;
- baseURL по умолчанию `https://localhost:8443`;
- `ignoreHTTPSErrors: true`, потому что штатный локальный nginx использует self-signed TLS;
- reporter: `list` и HTML-отчёт в `playwright-report`;
- `workers: 1`, чтобы тесты не мешали друг другу на одной странице/сервере.

Сервер в `playwright.config.ts` не поднимается. Сервером управляют shell-скрипты.
