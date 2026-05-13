# Frontend Autotests

Этот каталог содержит отдельный Playwright-контур для проверки браузерного UI.
По умолчанию тестовый запуск работает через штатный production-стек проекта:

1. `tests/run.sh` вызывает `./stop.sh`.
2. Затем вызывает `./start.sh`.
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

С тем же эффектом из **корня репозитория** (прокси в `tooling/vite`, без отдельного `npm install` в корне):

```bash
npm run vite:type-holes
npm run vite:typecheck
npm run vite:typecheck:table
npm run vite:build
npm run vite:preflight
```

Для изменений в widget/table runtime минимальный порядок проверки:

```bash
npm --prefix tooling/vite run type-holes
npm --prefix tooling/vite run typecheck
npm --prefix tooling/vite run typecheck:table
npm --prefix tooling/vite run build
npm --prefix tooling/vite run preflight
tests/run.sh
```

Затем запускается targeted Playwright suite:

- `tests/run.sh specs/widgets/buttons-modals.spec.ts` — `button`, `split_button`, action runtime и модалки.
- `tests/run.sh specs/widgets/date-ip-image-widgets.spec.ts` — `date`, `time`, `datetime`, `ip`, `ip_mask`, `img`.
- `tests/run.sh specs/widgets/choice-voc-widgets.spec.ts` — `list`, `voc`.
- `tests/run.sh specs/tables/table-widgets.spec.ts` — `table` и embedded cell widgets.
- `tests/run.sh specs/admin` — авторизация, управление пользователями и DDL-флоу вкладки «Схема БД».

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
4. Запускает корневой `./start.sh`.
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
2. Поднимает `start.sh`.
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

Сценарии Playwright лежат в [`specs/`](specs/) (`smoke`, `demo`, `widgets`, `tables`). Конкретные шаги и проверки — в исходных `*.spec.ts`.

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
