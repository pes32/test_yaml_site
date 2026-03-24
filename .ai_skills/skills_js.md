---
name: skills-js
description: >-
  Executable spec for YAML System Vue widgets: window globals, factory order,
  emitInput contract, TableWidgetCore rules. Use when editing frontend/js/widgets,
  page.html scripts, or attrs widget YAML in this repo.
---

# Важно!
1) Не писать в файл "воду".
2) Не множить сущее без необходимости.
3) Не добавлять новые стили, если можно использовать старые.
4) Действует правило: непонятно? Спроси!
5) Всегда держи документацию актуальной.

# YAML System — JS Widgets (LLM spec)

## TL;DR — добавить виджет

1. Файл: `frontend/js/widgets/my_widget.js`
2. В конце файла: `window.MyWidget = MyWidget` (имя глобала = имя константы виджета)
3. [templates/page.html](templates/page.html): `<script src=".../my_widget.js">` **строго до** `factory.js`
4. [factory.js](frontend/js/widgets/factory.js): в `DEFAULT_WIDGET_REGISTRY` добавить `['my_type', MyWidget]`
5. В attrs YAML: `my_field: { widget: my_type, ... }`

## Жёсткие правила (обязательно)

- Каждый виджет **ДОЛЖЕН** экспортироваться как **`window.XxxWidget`** (один глобал на компонент).
- Каждый **input-виджет** **ДОЛЖЕН**:
  - иметь `emits: ['input']`;
  - сообщать об изменении **только** через **`this.emitInput(value)`** из `widgetMixin` (формат payload фиксирован).
- **ЗАПРЕЩЕНО**:
  - Vue SFC (`.vue`);
  - `export default` / ES modules для объявления виджета в этом проекте;
  - `Vue.compile` и сборка шаблонов из строк на лету (не используется);
  - подключать новый скрипт виджета **после** `factory.js`;
  - для таблицы: создавать новые **`window.TableWidget*`** (кроме уже существующих `TableWidget`, `registerTableWidget`).
- **props** у виджета **ВСЕГДА**:
  - `widgetConfig: { type: Object, required: true }`
  - `widgetName: { type: String, required: true }`

## Минимальный шаблон (копировать и адаптировать)

```javascript
const MyWidget = {
    props: {
        widgetConfig: { type: Object, required: true },
        widgetName: { type: String, required: true }
    },
    emits: ['input'],
    mixins: [window.widgetMixin],
    data() {
        return { value: '' };
    },
    mounted() {
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        }
    },
    methods: {
        onInput() {
            this.emitInput(this.value);
        }
    },
    template: `
        <input type="text" class="form-control"
               v-model="value"
               @input="onInput"
               :disabled="widgetConfig.readonly">
    `
};

window.MyWidget = MyWidget;
```

**Поля в продуктивном UI:** как правило оборачивать в **`Md3Field`** + те же `mixins`/`emitInput`, по образцу [string.js](frontend/js/widgets/string.js). Шаблон выше — минимальный контракт, не обязательный внешний вид.

## Контракт

### Input-виджет

- `emits: ['input']`
- Тело события **только** такое (формирует `emitInput`):

```json
{ "name": "<widgetName>", "value": "<any>", "config": "<widgetConfig>" }
```

- **Нельзя:** `this.$emit('input', value)` или произвольный объект.

### Button

- `emits: ['execute']` (см. [button.js](frontend/js/widgets/button.js))
- `inject: getConfirmModal` при необходимости диалога

### Опционально

- `setValue(v)`, `getValue()` — если родитель/форма читает значение программно
- Виджет без ввода (например **img**): может не эмитить `input`; `setValue`/`getValue` могут быть пустыми

## YAML → `widgetConfig`

Пример attrs:

```yaml
my_field:
  widget: str
  label: "Name"
  default: "test"
```

В компоненте:

```javascript
widgetConfig.widget === 'str'
widgetConfig.label === 'Name'
widgetConfig.default === 'test'
widgetName === 'my_field'   // ключ из YAML
```

## Жизненный цикл (виджет поля)

| Фаза | Действия |
|------|----------|
| `created` | **Не** полагаться на DOM и на полный контекст страницы |
| `mounted` | Инициализация из `widgetConfig.default`, измерение DOM, подписки |
| `setValue(v)` | Вызов **снаружи** (загрузка/сброс формы) — обновить локальное состояние |
| Изменение значения пользователем | **Только** `this.emitInput(...)` |

## Цепочка рендера (ошибка порядка = виджет мёртв)

Порядок в [page.html](templates/page.html):

1. `mixin.js`
2. `md3_field.js`
3. полевые виджеты (`string`, `int`, …)
4. `table/table_core.js` → … → `table_sort.js` → **`table_clipboard.js`** → **`table_context_menu.js`** → `table_selection.js` → `table_keyboard.js` → `table_widget.js`
5. `button.js`, `img.js`
6. `gui_parser.js`
7. `confirm_modal.js`
8. **`factory.js`** ← регистрация типов
9. **`widgets.js`** ← `WidgetRenderer`
10. `page.js`

## Factory

- Регистрация: `['type_from_yaml', GlobalComponent]`
- Неизвестный `widget` → **StringWidget** + `console.warn`

## Table — отдельно

- Регистрация **не** в `DEFAULT_WIDGET_REGISTRY`, а через **`window.registerTableWidget(widgetFactory)`** после создания фабрики ([table_widget.js](frontend/js/widgets/table/table_widget.js)).
- Параметр **`row`** (целое ≥ 1): минимум отображаемых строк; при нехватке данных добавляются пустые (`makeEmptyRow` / `emptyCellValueForColumn`). Без `row` — редактируемая пустая таблица = одна строка. Удаление строк (меню, Ctrl+минус) не уменьшает таблицу ниже `max(1, row)`.

### `TableWidgetCore`

- Единая точка расширений таблицы: **`window.TableWidgetCore`** с полями `Utils`, `Jump`, `Format`, `Sort`, **`Clipboard`**, **`ContextMenu`**, `Keyboard`, `SelectionMethods`, `parseTableAttrs`, `dom`, …
- **Можно:** добавлять **новое** свойство верхнего уровня, например `TableWidgetCore.Filters = { ... }`, в отдельном скрипте **в цепочке до** `table_widget.js`.
- **Нельзя:** вводить новые **`window.TableWidgetXxx`** глобалы.
- **Нельзя без явной задачи на рефакторинг:** перезаписывать существующие модули (`TableWidgetCore.Utils`, `.Jump`, …) — только добавлять новые ключи или править их **внутри** согласованных файлов пакета `table/`.

### Контекстное меню и буфер

- **`table_clipboard.js`**: `serializeSelectionToTsv`, `deserializeTsvToMatrix` (CRLF, один завершающий `\n`; `\t`/переносы внутри ячейки при serialize → пробел, без «восстановления» при paste).
- **`table_context_menu.js`**: `buildMenuItems`, `normalizeMenuSeparators`, `isApplePlatform`, **`rowMoveDuplicateOpsAllowed`** (единый предикат для меню и хоткеев move/duplicate), порядок пунктов v1: add/delete → move up/down → duplicate above/below → clipboard.
- **`table_utils.js`**: **`cloneTableRowDeep`**, **`safeCellValue`**, `cloneTableData`, …
- **Тело таблицы (ПКМ):** якорь строки = строка клика; снимок `contextMenuContext` + `contextMenuSessionId`; при несовпадении `sessionId` с текущим при action из меню — no-op и **`hideContextMenu()`**; после мутации строк меню закрывается; `readonly` — меню тела не открывается.
- **Заголовок (ПКМ):** только leaf `th` при включённой сортировке; пункты сортировки; v1 — одна колонка.
- **Клавиатура:** `Ctrl/Cmd+C/X/V` в `table_keyboard.js` (до правок выделения); `Ctrl/Cmd±` для строк — с **`metaKey`**; **`handleAltRowMoveDuplicate`** до `getCellFromEvent`: **⌥/Alt+↑↓** — переместить строку (repeat разрешён), **⇧+⌥/Shift+Alt+↑↓** — дубликат строки (**repeat игнорируется**); только при **`_tableFocusWithin`** и предикате (в т.ч. **не** в режиме правки ячейки — как в меню, v1 намеренно); координаты: **`getCellFromEvent` приоритетнее `selFocus`** при расхождении; **`preventDefault`** только после признания жеста «нашим» (не ломать скролл страницы вне таблицы). Путь клавиатуры без снимка — ок для синхронных move/duplicate; при появлении async — выровнять со snapshot.
- После move/duplicate v1: выделение сбрасывается к одной ячейке (**предсказуемость > сохранение multiselect**). Фокус: **`focusSelectionCellWithRetry`** — две попытки в соседних `$nextTick`, иначе warn при `DEBUG`.

Тесты pure-функций: `node frontend/js/widgets/table/table_clipboard.test.js`.

## Миксин и Md3Field

- [mixin.js](frontend/js/widgets/mixin.js): `emitInput`, `validateRegex`, `fieldError`
- [md3_field.js](frontend/js/widgets/md3_field.js): обёртка label/ошибка/width для **str, int, float, text, list** (и IP/datetime по аналогии)

## Отладка (чеклист)

1. В консоли: `typeof window.MyWidget === 'function'` или объект компонента — как объявлено
2. `widgetFactory.getWidgetComponent('my_type')` возвращает не StringWidget
3. Порядок `<script>` в `page.html`: файл виджета **до** `factory.js`
4. Таблица: `TableWidgetCore.DEBUG = true` в консоли

## Анти-примеры

| Неправильно | Правильно |
|-------------|-----------|
| `this.$emit('input', value)` | `this.emitInput(value)` |
| `export default { ... }` | `window.MyWidget = MyWidget` |
| скрипт виджета после `factory.js` | скрипт **до** `factory.js` |
| `window.TableWidgetSort = ...` | `TableWidgetCore.Sort = ...` (или правка `table_sort.js`) |

## Чеклист нового виджета

- [ ] Файл в `frontend/js/widgets/`
- [ ] `window.XxxWidget = ...`
- [ ] Скрипт в `page.html` до `factory.js`
- [ ] Строка в `DEFAULT_WIDGET_REGISTRY` (кроме `table`)
- [ ] Input-виджет: `emitInput`, не сырой `$emit('input', …)`
- [ ] YAML: `widget: <type>`
- [ ] Стили при необходимости: [widgets.css](frontend/css/widgets.css) / `components/*.css`

## Ключевая модель

`YAML attrs` → **`widgetConfig` + `widgetName`** → **`factory.getWidgetComponent(type)`** → компонент → **`emitInput` / `execute`** → родитель ([widgets.js](frontend/js/widgets.js)).

## Ссылки

- Полный порядок скриптов и список типов: [README.md](README.md)
- Рендер: [widgets.js](frontend/js/widgets.js) (`WidgetRenderer`)
- Парсинг GUI: [gui_parser.js](frontend/js/gui_parser.js)
