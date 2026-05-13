# Подсистема таблицы

## Роль

`table` — отдельная frontend feature со своим runtime store, parser-слоем для `table_attrs`, interaction-модулями, embedded cell widgets и обязательным virtual rendering layer для всех таблиц.

Сопутствующие документы:

- [table-state-invariants.md](table-state-invariants.md)
- [table-api-map.md](table-api-map.md)
- [table-testing-matrix.md](table-testing-matrix.md)
- [table-performance-notes.md](table-performance-notes.md)
- [table-runtime-notes.md](table-runtime-notes.md)

## Раскладка модулей

Сейчас все модули лежат **в одном каталоге** `frontend/js/widgets/table/`. Архитектурно это нормально, но для навигации полезно держать в голове **логические кластеры** (ниже — тот же состав файлов, сгруппированный «как по папкам»). Физический рефакторинг в подкаталоги не обязателен; при переносах достаточно сохранить раздел «Барьер public / internal» ниже.

### Карта по кластерам (ориентир)

| Кластер | Назначение | Файлы |
|--------|------------|--------|
| **`state/`** | контракт VM, store, core snapshot, нормализация, инварианты, команды | `table_contract.ts`, `table_store.ts`, `table_state_core.ts`, `table_runtime_state.ts`, `table_invariants.ts`, `table_errors.ts`, `table_setup_keys.ts`, `table_runtime_commands.ts`, `table_internal.ts` |
| **`models/`** | derived slices (`*_model.ts`) и смежные slice-модули | `table_*_model.ts`, `table_column_navigation.ts`, `table_virtual_model.ts` |
| **`runtime/`** | поведение, события, оркестрация | `useTableRuntime.ts`, `table_runtime_registry.ts`, `table_runtime_computed.ts`, `table_runtime_watch.ts`, `table_runtime_lifecycle.ts`, `table_*_runtime.ts`, `table_virtual_runtime.ts`, `table_selection.ts`, `table_interactions.ts`, `table_keyboard.ts`, `table_jump.ts`, `table_widget_helpers.ts` |
| **`pure/`** | парсер attrs, форматирование, clipboard/tsv, селекторы, утилиты без VM | `table_parse_attrs.ts`, `table_selectors.ts`, `table_clipboard.ts`, `table_format.ts`, `table_sort.ts`, `table_grouping.ts`, `table_utils.ts`, `table_choice_value.ts`, `table_cell_meta.ts`, `table_cell_type_coercion.ts`, `table_effective_column.ts` |
| **`integration/`** | DOM-хелперы таблицы **и** связь с host: измерения, скролл, sticky, bridge, уведомления, отладка, platform | `table_dom.ts`, `table_measurement.ts`, `table_scroll.ts`, `table_sticky_header.ts`, `table_page_bridge.ts`, `table_notifications.ts`, `table_debug.ts`, `table_platform.ts` |
| **`embedded/`** | резолв встроенных cell-виджетов | `table_embedded_widgets.ts` (сами редакторы — общий widget layer) |

- **UI root:** `TableWidget.vue`, тулбар/ячейки: `TableToolbar.vue`, `TableToolbarIconButton.vue`, прочие `Table*.vue` рядом.
- **Зависимости attrs вне каталога:** `frontend/js/shared/table_attr_dependencies.ts` (`resolveTableDependencies`).

Отдельных `index.ts` / `table_api.ts` в каталоге таблицы нет — см. [table-api-map.md](table-api-map.md) и раздел «Барьер public / internal» ниже.

### Поверхность модулей и «тонкие прокладки»

Файлы `table_*_model.ts` и `table_*_runtime.ts` со временем разрастаются в тонкие re-export или обёртки. **Объединять модули** (в пределах домена — **selection**, **editing**, **view**, **data**) допустимо **только если** у исходного файла **нет** самостоятельного состояния, собственных инвариантов и выделенных тестов/матрицы регрессии, на которые опираются review. Если есть хотя бы одно из этого — файл остаётся отдельным slice; «мало строк» само по себе не аргумент за слияние. Ориентир по крупным slice — [table-api-map.md](table-api-map.md) (раздел `*_model.ts`: аудит).

## Барьер public / internal

Пакетной точки входа нет: **граница задаётся соглашением и review**, а не `index.ts`.

**Разрешено импортировать снаружи `frontend/js/widgets/table/`:**

- `TableWidget.vue` — только как цель регистрации типа виджета `table` в `frontend/js/widgets/factory.ts` (через `WidgetDefinitionRegistry`).
- DSL prefetch: **`resolveTableDependencies`** из `frontend/js/shared/table_attr_dependencies.ts` (файл **вне** каталога table).

**Запрещено для app/page/прочих feature (без отдельного архитектурного решения и записи в контракте):**

- Любые импорты из `frontend/js/widgets/table/*.ts` и из «внутренних» `Table*.vue`, кроме корневого виджета через factory.
- В частности: **`table_internal.ts`**, **`table_contract.ts`**, **`table_page_bridge.ts`**, runtimes, models, pure-модули каталога — только **внутри** `frontend/js/widgets/table/**` или в слое, который по проекту считается продолжением widget host (такие места должны быть единичными и очевидными в коде).

**Импорты внутри feature:** базовое правило — **прямой** `import` из модуля, где объявлен символ (`./table_view_model.ts`, `./table_selection_model.ts` и т.д.); граф slice-модулей (`table_view_model` → `table_grouping_model` и др.) так и остаётся **напрямую**. [`table_internal.ts`](../frontend/js/widgets/table/table_internal.ts) — **вспомогательный** barrel: им можно пользоваться там, где уже есть явные re-export и это упрощает потребителей, но **не** является обязательным слоем для каждого нового импорта; не вводить barrel «ради единообразия», если достаточно одного прямого импорта. Снаружи `frontend/js/widgets/table/` — `table_internal` и прочие внутренности не импортировать (см. [table-api-map.md](table-api-map.md), [table-runtime-notes.md](table-runtime-notes.md)).

Интеграция с host остаётся через factory, общий widget renderer/bridge и shared `table_attr_dependencies`, а не через произвольные deep-imports из `table/`.

## Контракт контроллера runtime

Актуальный contract:

- `table_contract.ts` разделяет `TableRuntimeState`, `TableRuntimeComputed`, `TableRuntimeMethods`, `TableRuntimeDomSurface`, `TableRuntimeVm` и `TableWidgetSetupBindings`;
- runtime modules depend on narrower internal surfaces and explicit cross-module method contracts; the registry remains an initialization map, not the typing contract for behavior;
- нормализация и typed-команды ядра сосредоточены в `table_state_core.ts` (`normalizeTableCoreState`, `dispatchTableCommand` для core state);
- runtime state содержит обязательные поля loading/grouping/sorting/display/menu/sticky/word-wrap path, а не loose `Record<string, unknown>`;
- virtual runtime обязателен: DOM получает только `visibleDisplayRows` / `visibleCellGrid` плюс spacer rows; данные приходят через `LocalFullRowProvider` или `RemotePagedRowProvider`;
- public YAML mode остаётся `auto`; `local-full`/`remote-paged` — внутренние provider modes;
- каждый helper экспортирует явный module interface;
- runtime registry разделён на computed/watch/lifecycle/method modules;
- `TableWidget.vue` работает через `useTableRuntime()` и explicit runtime layers, а не через разрозненные method-mixins;
- порядок импортов не является частью поведения runtime;
- table modules импортируют друг друга **по умолчанию напрямую**; `table_internal.ts` — опциональный barrel (см. раздел «Барьер public / internal» ниже); host services — через bridge.

Runtime method groups типизируются через `TableRuntimeMethodSubset` и `TableRuntimeMethodContracts` в `table_contract.ts`; repeated controller accessors в `useTableRuntime.ts` заменены proxy-binding helpers для state/props/dom/computed.

Инварианты контекстного меню и встроенных редакторов ячеек — см. раздел «Контекстное меню и встроенные виджеты» ниже.

## Внешний контракт

Что **снаружи** таблица потребляет (данные и сервисы host):

- конфиг виджета;
- attrs map и заранее догруженные list/widget dependencies из page runtime;
- общий widget layer для **embedded** cell editors.

Публичная **поверхность импорта** файлов — только то, что перечислено в разделе «Барьер public / internal» ниже: factory → `TableWidget.vue`, плюс `resolveTableDependencies` из shared. `createTableStore` и остальной каталог `table/` для внешних модулей не API.

Для `remote-paged` таблица делает backend row-query через `/api/table-query`, command updates через `/api/table-command`, а явную материализацию через `/api/table-export`. Transport envelope остаётся в API client/runtime boundary; виджет работает с `TableViewState`, `viewId`, display items, command history и indexed format rules. Ответы окна сопровождаются `view_fingerprint` (вторичный guard поверх `AbortController`/`activeRequestId`), а тяжёлые file+view paths уходят во внешний SQLite cache при row-count > `FILE_VIEW_IN_MEMORY_MAX_ROWS` (см. backend `table_runtime.py`).

**Разделение ответственности:** virtual renderer ограничивает размер DOM; remote query ограничивает объём строковых данных в клиенте. **Пути данных на сервере:** для `provider=db` без группировки окно считается через SQL (`_db_query_window`); для очень большого **файла** без группировки — SQLite spill и выборки по фильтрам/сортам в БД временного файла; для **inline** и файла среднего размера при активных view ops возможна материализация и сортировка в памяти — допустимо только пока суммарный объём строк умеренный (не целевой путь для 1M строк).

## Модель состояния

Table store хранит только table-specific runtime state:

- sorting state;
- grouping state;
- loading state для совместимости старых команд и remote row-query state; локальный lazy-append больше не является render path;
- provider state (`tableRemote`) для `remote-paged`: active view, request guard, loaded ranges, cached display items and indexed format rules;
- virtual state (`start/end`, overscan, spacer heights, measured row heights);
- selection state;
- editing state;
- menu snapshot state;
- sticky state;
- validation state;
- view runtime state.

Runtime preferences включают UI-состояния, которые могут стартовать из YAML, но дальше управляются пользователем в текущей сессии таблицы: sticky header, word wrap и line numbering. `line_numbers` в YAML остаётся default-состоянием, а включение/отключение из context menu не меняет persisted table values.

Page runtime отдаёт таблице входные данные и догружает зависимости, которые таблица объявляет в `table_attrs` (см. `resolveTableDependencies`). Внутренние table details остаются внутри feature.

## Граница pure / UI

Главное правило:

- `TableWidget.vue` отвечает за template, refs, props/emits и подключение runtime controller;
- `table_selectors.ts` и pure helpers отвечают за typed derived data;
- runtime modules отвечают за поведение, browser events и host integration.

Это уменьшает смешение UI-поведения, data-shaping и DOM side effects внутри Vue component.

## Интеграция с page runtime

Если `table_attrs` содержит внешние list/widget refs:

1. `resolveTableDependencies(...)` извлекает список attr names;
2. `attrs_loader.ts` догружает их из `/api/attrs`;
3. `WidgetRenderer.vue` публикует в subtree только допустимые table runtime services через definition-driven bridge;
4. таблица получает нормализованный `attrsByName`, error handlers и notifications через injected/runtime boundary;
5. `TableWidget.vue` не читает global/window state и не обращается к `$root`.

Для table-widget это означает:

- attrs map приходит через host service;
- recoverable app errors поднимаются через общий frontend error model;
- user-facing notifications идут через page-level notification service;
- committed page state таблица напрямую не мутирует.

## Контекстное меню и встроенные виджеты (высокорисковая интеграция)

Два узла с наибольшим риском «тихого» рассогласования состояния и утечки host-coupling. Здесь — инварианты уровня подсистемы (детали данных — ещё [table-state-invariants.md](table-state-invariants.md)).

**Контекстное меню**

- Снимок меню (**snapshot**) валиден только пока совпадает session (`contextMenuSessionId`) и ссылки на строку/колонку (`rowId`, `columnKey`, anchor) указывают на ещё существующие identity в текущем `TableViewModel` / `tableData`. Устаревший snapshot → закрыть меню и не применять действия.
- Действия из меню перед core-командами обязаны **перепроверять** текущее состояние (например `isContextMenuSnapshotCurrent`) — нельзя полагаться только на координаты на момент открытия.
- Не тянуть **page host** из обработчиков меню: только методы VM, bridge-контракт и то, что уже инжектировано в table runtime (см. раздел «Интеграция с page runtime» выше). Нет `$root`, глобалов и произвольных deep-imports app-слоя.

**Встроенные embedded cell-виджеты**

- Редактор ячейки живёт в общем widget contract: **draft** локален виджету; в таблицу попадает только явный **commit** (в т.ч. `commitPendingState` / boundary lifecycle). **Cancel** сбрасывает draft без записи в `tableData`.
- Пока edit активен, переходы, меняющие display/data (sort, grouping, virtual remeasure), обязаны следовать порядку из [table-state-invariants.md](table-state-invariants.md) (завершение edit → rebuild → normalize).
- Host-сервисы и attrs доступны **только** через registry / runtime bridge, как и для остального дерева виджетов; **нет прямого доступа к page host** из cell editor (никаких обходов «в приложение» мимо bridge).
- Committed page state приложения не хранится внутри таблицы; ячейка не является вторым источником истины для всей страницы.

Реализация: `table_menu_runtime.ts`, `table_context_menu_model.ts`, `table_embedded_widgets.ts`, editing path в `table_editing_runtime.ts` / `table_cell_runtime.ts`.

## Ворота качества (quality gates)

Обязательность проверок **разная**; полный перечень команд и чеклисты — в [table-testing-matrix.md](table-testing-matrix.md).

### До merge (блокер для PR)

- Статический контроль и сборка: `type-holes`, `typecheck:table`, `typecheck`, `build`, `python3 -m backend.tools.validate_config --json`.
- **При падении:** чинить в той же ветке; не ослаблять strictness и не оставлять подавления без отдельного согласования.

### До релиза

- Автоматические сценарии уровня приложения: **`tests/run.sh`** (включая Playwright, в т.ч. `tests/specs/tables/table-widgets.spec.ts`, если он входит в принятый для релиза набор).
- **При падении:** восстановить зелёный прогон **или** явно обновить spec/ожидания в PR с описанием смены поведения (не «заглушить» тест молча).

### После крупных изменений в table (ручной smoke)

- Короткий целевой чеклист — раздел **Manual smoke** в [table-testing-matrix.md](table-testing-matrix.md); он покрывает то, что **слабо или не** покрыто Playwright (sticky lifecycle, сложные embedded, визуальные состояния меню/dropdown).
- **При расхождении с ожиданиями:** завести issue или зафиксировать находку в заметке/бэклоге; при необходимости добавить строку в E2E или в unit-backlog в той же матрице.

### Долг по типам и границам

Оставшийся техдолг — в основном на внешних event/widget границах. App-level Vue migration и удаление `widget_shared_contracts.ts` уже не входят в текущий scope миграции table.
