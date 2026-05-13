# DSL YAML (страницы и attrs)

`pages/<page>/` описывает страницу как набор YAML-документов, из которых backend собирает нормализованный snapshot.

## Файлы страницы

- `gui.yaml` или `gui.yml` — обязательная GUI-структура страницы
- остальные `*.yaml` / `*.yml` — attrs-фрагменты
- `modal_<id>.yaml` — отдельные modal documents

Frontend получает нормализованный snapshot/API payload; raw YAML читает backend.

## Корневые GUI-элементы

- `menu "Название"` — меню страницы
- `tab "Название"` — вкладка
- `box "Название"` — секция с рамкой
- `collapse "Название"` — сворачиваемая секция
- `row` / `rows` / `widgets` — ряды виджетов
- `button` — кнопка модалки
- любой другой корневой ключ — встроенная модалка

Из `gui.yaml` backend выводит:

- `gui`
- `guiMenuKeys`
- embedded modals
- `modalGuiIds`

## Модалки

Модалка может быть объявлена:

1. встроенно в `gui.yaml`;
2. отдельным файлом `modal_<id>.yaml`.

Приоритет:

- встроенная модалка выше файловой.

Допустимые формы `modal_<id>.yaml`:

- список элементов;
- словарь с одним gui-style ключом и списком;
- объект вида `{ name?, title?, icon?, content: [...] }`;
- объект вида `{ items: [...] }`.

На выходе backend нормализует модалку в `NormalizedModal` с полями:

- `id`
- `name`
- `title`
- `icon`
- `tabs`
- `content`
- `buttons`
- `widgetNames`
- `source`
- `sourceFile`

## Attrs

Attrs-фрагменты мержатся на backend.

Правила:

- дубликаты допустимы;
- дубликаты фиксируются в diagnostics;
- побеждает последний встретившийся ключ.
- если `widget` у attrs не указан, для обычного поля по умолчанию используется `str`;
- attrs проходят schema-validation на backend до попадания в snapshot.

Нормализованный attrs map потом используется:

- для page bootstrap;
- для отложенной загрузки attrs через `/api/attrs`;
- для modal attrs loading;
- для table dependency resolution.

### Attrs schema notes

Backend валидирует:

- допустимый `widget` type;
- разрешённые ключи для этого widget;
- форму значений для `dialog`, `rows`, boolean flags, `source`, `select_attrs`.

### Core field widgets

`str`, `text`, `int`, `float`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `list` и `voc` — stateful widgets с единым draft/commit контрактом во frontend runtime. Их widget-layer реализация использует Composition API + TypeScript; YAML-контракт при этом не меняется.

Общее поведение:

- значение хранится и публикуется как строка;
- `default` задаёт начальное значение, если committed value ещё не появлялся;
- `readonly: true` блокирует ввод и убирает поле из tab-order;
- `placeholder` показывается только во время фокуса и при пустом значении;
- `sup_text` показывается как supporting text, пока нет validation error;
- `regex` и `err_text` применяются на live input и commit, кроме readonly режима;
- вне table-cell режима ввод держится как draft и публикуется при blur/commit;
- в table-cell режиме значение публикуется на input, а commit validation синхронизируется с таблицей.

Особенности базовых полей:

- `str` — однострочное текстовое поле;
- `text` — textarea, `rows` задаёт высоту, по умолчанию используется `3`;
- `int` принимает только целое число в строковом формате, пустое значение валидно;
- `float` принимает дробное число в строковом формате, запятая при вводе нормализуется в точку, пустое значение валидно.

DOM-heavy поля `date`, `time`, `datetime`, `ip` и `ip_mask` сохраняют тот же lifecycle surface для page/table runtime: `getValue`, `setValue`, `commitDraft`, `commitPendingState`, а date/time widgets дополнительно открываются через picker methods, которые использует table cell runtime.

### `table`

Таблица в **v3** (см. [CHANGELOG.md](../CHANGELOG.md)): виртуальный скролл, для режима с БД — последовательная подгрузка окон данных; в YAML сохраняются те же основные переключатели, что обобщены ниже.

В **v2** добавлены два YAML-флага:

- `toolbar: true` показывает панель форматирования над таблицей;
- `abc: true` показывает буквенную строку колонок.

Публичный режим данных таблицы — `auto`. YAML не обязан выбирать `local-full` или `remote-paged`: runtime сам выбирает provider.

- inline `value`/`source`/`data` до `LOCAL_FULL_MAX_ROWS` (`1000`) работает как `local-full`;
- большие inline tables получают diagnostic: для Excel-like производительности строки нужно вынести в file/db source;
- file/db/unknown row source обслуживается как `remote-paged`, где sort/group/search и окна строк идут через backend view/query;
- виртуализация — внутренний runtime слой, а не YAML-флаг и не legacy `table_lazy`.

File source задаётся объектом в `source`/`value`/`data`:

```yaml
source:
  kind: file
  path: data/big_table.jsonl
  format: jsonl   # csv | json | jsonl
```

`path` должен оставаться внутри project root. `csv` может указать `header: true`; `jsonl` читает одну JSON-строку на ряд; `json` принимает массив рядов или `{ rows: [...] }`.

DB source также остаётся внутренним remote provider:

```yaml
source:
  kind: db
  query: "select id, code, status from public.big_table"
```

Backend оборачивает query как read-only subquery и применяет `LIMIT/OFFSET`, sort/filter/search/group view state до возврата окна. Для простых таблиц можно указать `table: schema.table` вместо `query`.

### `button` и `split_button`

Публичный YAML-контракт:

- `button` описывает одно действие;
- `split_button` описывает dropdown-only control без primary action;
- backend знает только attrs schema этих виджетов и не резолвит их dropdown-пункты.

Поддерживаемые attrs у `split_button`:

- `label`
- `sup_text`
- `icon`
- `hint`
- `fon`
- `size`
- `width`
- `dialog`
- `url`
- `source`
- `command`
- `select_attrs`

Для `split_button` действия задаются строками в `url`, `source`, `command`.

Пример:

```yaml
demo_split:
  widget: split_button
  label: "Открыть"
  icon: "test.svg"
  url: |
    /form_1_1
    /form_1_2 | Вторая форма
  source: |
    templates/file.pdf | PDF
  command: |
    demo_action | Команда
```

Правила DSL:

- строка `trim`;
- пустые строки игнорируются;
- разделение идёт по первому неэкранированному `|`;
- `\|` трактуется как literal pipe;
- лишний неэкранированный `|` после первого делает строку malformed;
- пустой `target` делает строку malformed.

Порядок действий у `split_button` фиксированный:

- сначала все `url`;
- затем все `source`;
- затем все `command`;
- внутри каждого поля сохраняется порядок строк;
- сортировки после merge нет.

Recovery policy:

- malformed line не ломает widget;
- строка пропускается;
- frontend пишет агрегированный `console.warn` один раз на widget-field;
- user-facing snackbar для malformed DSL не показывается.

Runtime behavior:

- если после parse/filter список действий пуст, toggle disabled и dropdown не открывается;
- если action один, `split_button` всё равно остаётся `split_button`, а не деградирует в `button`;
- `dialog` в v1 оборачивает только `url` и `command`;
- `button` сохраняет существующий button-compatible execution contract;
- `split_button` использует тот же TypeScript action-runtime, но добавляет dropdown UI.

### DB-команды и заполнение виджетов

`button.command` может быть обычной зарегистрированной backend-командой, UI-командой `<modal> -ui` или SQL-командой из YAML. Для SQL публичные page/attrs/execute API отдают только служебный маркер; backend берёт реальный SQL из внутреннего snapshot по `page + widget`, поэтому произвольный SQL из тела запроса не выполняется и YAML-запрос не раскрывается в browser-visible payload.

Форматы SQL-команд:

- `command: test_select_1 -pg` выполняет `SELECT * FROM test_select_1();`;
- `command: |` выполняет raw SQL из block scalar в одной транзакции: при ошибке `rollback`, при успехе `commit`.

`select_attrs` задаёт, куда положить результат SQL:

```yaml
load_fields:
  widget: button
  command: test_select_1 -pg
  select_attrs:
    target_widget: db_column

load_same_names:
  widget: button
  command: |
    SELECT col_1, col_2 FROM test_table LIMIT 1;
  select_attrs: col_1, col_2
```

Для обычных виджетов SQL должен вернуть ровно одну строку. Для `table` результат полностью заменяет строки таблицы; порядок колонок берётся из `table_attrs`. Если в результате SQL нет колонки из `select_attrs` или `table_attrs`, backend возвращает явную ошибку на фронт.

### DB-source для `list` и `voc`

`list` может загрузить варианты из PostgreSQL после первичного рендера страницы или немедленно при фокусе:

```yaml
status_list:
  widget: list
  columns: code
  source: test_voc_1 -pg
```

`columns` у `list` — один DB-столбец, значения которого станут options.

`voc` для DB-source использует block scalar `columns`, где слева DB-поле, справа заголовок в модальном окне:

```yaml
operation_voc:
  widget: voc
  columns: |
    code /Код
    description /Значение
  source: |
    SELECT code, description
    FROM voc_1
    ORDER BY code;
```

Frontend грузит DB-source через `POST /api/widget-source` с dedupe/cache по `snapshot_version + page + widget`. Старый inline `voc` с `columns: ["Код", "Наименование"]` и block-scalar `source` остаётся валидным. Если DB-source не вернул нужный столбец, ошибка показывается пользователю как SQL/runtime ошибка.

### `voc` widget

`voc` — lookup-виджет справочника.

Минимальный пример:

```yaml
operation_code:
  widget: voc
  label: "Код операции"
  columns: ["Код", "Наименование"]
  source: |
    01; Наличие на дату
    10; Инвентаризация
```

Контракт:

- `columns` обязателен и задаёт заголовки колонок;
- `source` поддерживает список строк, список строковых рядов или block-scalar строки `col1; col2; ...`;
- inline dropdown и modal используют один и тот же нормализатор строк, одну и ту же фильтрацию по всем колонкам и один и тот же `source-order` до modal-сортировки;
- каждая строка живёт по `row identity`, но persisted value всегда хранит только первую колонку;
- разные строки могут давать одинаковый persisted value;
- дубликаты строк и первой колонки допустимы;
- `source-order` определяется порядком строк после нормализации `source`, но до UI-сортировки.
- single-select отображает и сохраняет только первую колонку;
- multiselect хранит массив строк первой колонки, допускает повторы и поддерживает ручной ввод через `,`, `tab`, `newline` для вставки из Excel;
- во время редактирования multiselect input показывает текущий draft, а committed value обновляется только подтверждённой валидной частью ввода или после выбора в modal; невалидный хвост в committed state не попадает.

Диагностика:

- пустой или некорректный `columns` — `error`;
- структурно неверная строка `source` — `error`;
- строка `source` с неправильным числом колонок — `error`;
- scalar `source` без разделителей строк или ячеек даёт `warning` и публикуется как пустой набор строк;
- пустые строки в block-scalar `source` пропускаются с `warning`.

Важно:

- `select_attrs` — допустимый YAML-ключ `button` и `split_button`; он заполняет выбранные виджеты результатом SQL-команды;
- `output_attrs` не является YAML-ключом attrs-конфига и относится только к transport request `POST /api/execute`.

## UI-команды

Формат `command: <name> -ui` сохраняется.

`<name>` должен соответствовать:

- встроенной модалке;
- или файлу `modal_<name>.yaml`.

Когда пользователь открывает такую модалку, frontend получает нормализованный `/api/modal-gui` response, а не сырой YAML-документ.

## Validation

Проверить конфигурацию можно без запуска UI:

```bash
python3 -m backend.tools.validate_config
python3 -m backend.tools.validate_config --json
```

CLI возвращает snapshot version, page count и diagnostics.
