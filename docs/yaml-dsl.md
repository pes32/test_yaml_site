# YAML DSL

`pages/<page>/` описывает страницу как набор YAML-документов, из которых backend собирает нормализованный snapshot.

## Файлы страницы

- `gui.yaml` или `gui.yml` — обязательная GUI-структура страницы
- остальные `*.yaml` / `*.yml` — attrs-фрагменты
- `modal_<id>.yaml` — отдельные modal documents

Frontend больше не читает raw YAML напрямую. Все документы сначала проходят backend normalization.

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
- для lazy `/api/attrs`;
- для modal attrs loading;
- для table dependency resolution.

### Attrs schema notes

Backend валидирует:

- допустимый `widget` type;
- разрешённые ключи для этого widget;
- форму значений для `dialog`, `rows`, boolean flags, `source`, `select_attrs`.

### Core field widgets

`str`, `text`, `int`, `float`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `list` и `voc` — stateful widgets с единым draft/commit контрактом во frontend runtime. Их widget-layer реализация переведена на Composition API + TypeScript; YAML-контракт при этом не меняется.

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

- `select_attrs` — допустимый YAML-ключ `button` и `split_button`, который резервирует список имён виджетов для будущего механизма заполнения;
- `select_attrs` пока не реализует само заполнение, но его синтаксис считается корректным;
- `output_attrs` не является YAML-ключом attrs-конфига и относится только к transport request `POST /api/execute`.

## UI-команды

Формат `command: <name> -ui` сохраняется.

`<name>` должен соответствовать:

- встроенной модалке;
- или файлу `modal_<name>.yaml`.

Когда пользователь открывает такую модалку, frontend получает уже нормализованный `/api/modal-gui` response, а не сырой YAML-документ.

## Validation

Проверить конфигурацию можно без запуска UI:

```bash
python3 -m backend.tools.validate_config
python3 -m backend.tools.validate_config --json
```

CLI возвращает snapshot version, page count и diagnostics.
