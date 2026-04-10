# Table Subsystem

## Role

`table` — отдельная frontend feature со своим runtime store, parser-слоем для `table_attrs`, interaction-модулями, embedded cell widgets и performance rules для lazy/grouping/sticky paths.

Companion docs:

- [table-state-invariants.md](table-state-invariants.md)
- [table-api-map.md](table-api-map.md)
- [table-testing-matrix.md](table-testing-matrix.md)
- [table-performance-notes.md](table-performance-notes.md)
- [table-migration-notes.md](table-migration-notes.md)

## Current Module Layout

Слой таблицы сейчас разделён на такие зоны:

- public entrypoints: `index.ts`, `table_api.ts`;
- UI root: `TableWidget.vue`;
- orchestration: `createTableRuntime.ts`, `useTableRuntime.ts`, `table_method_helpers.ts`;
- contracts/state: `table_contract.ts`, `table_store.ts`, `table_runtime_state.ts`, `table_runtime_services.ts`, `table_errors.ts`;
- local state slices: `table_editing_state.ts`, `table_context_menu_state.ts`, `table_lazy_load_state.ts`, `table_measurement_state.ts`;
- parsing/pure logic: `table_parse_attrs.ts`, `table_schema_parse.ts`, `table_selectors.ts`, `table_clipboard.ts`, `table_format.ts`, `table_sort.ts`, `table_grouping.ts`, `table_utils.ts`;
- runtime behavior: `table_cell_runtime.ts`, `table_clipboard_runtime.ts`, `table_context_menu.ts`, `table_data_runtime.ts`, `table_data_view_runtime.ts`, `table_editing_runtime.ts`, `table_interactions.ts`, `table_jump.ts`, `table_keyboard.ts`, `table_menu_runtime.ts`, `table_row_runtime.ts`, `table_selection.ts`, `table_view_runtime.ts`, `table_widget_helpers.ts`;
- DOM/page integration: `table_dom.ts`, `table_measurement.ts`, `table_scroll.ts`, `table_sticky_header.ts`, `table_page_bridge.ts`, `table_notifications.ts`, `table_debug.ts`.

## Runtime Controller Contract

Legacy-архитектура на `table_core`, `tableEngine.*Methods`, import-order registration и `Object.assign(...Methods)` удалена.

Актуальный contract:

- каждый helper экспортирует явный module interface;
- `createTableRuntime.ts` собирает computed/watch/method groups в одном месте;
- `TableWidget.vue` работает через `useTableRuntime()` и controller, а не через разрозненные method-mixins;
- порядок импортов больше не является частью поведения runtime;
- table modules импортируют друг друга напрямую или получают host services через bridge.

## External Contract

Снаружи таблица зависит только от:

- widget config таблицы;
- attrs map из page runtime;
- list/widget dependencies, которые page runtime догружает заранее;
- общего widget layer для embedded cell editors.

Feature API:

- `resolveDependencies(tableAttrConfig)`
- `getListOptions(attrsByName, sourceName)`
- `createStore(options)`

Таблица не делает backend calls самостоятельно и не знает raw transport envelope.

## State Model

Table store хранит только table-specific runtime state:

- sorting state;
- grouping state;
- loading/lazy state;
- selection state;
- editing state;
- measurement/sticky state;
- runtime preferences.

Page runtime отдаёт таблице входные данные и догружает зависимости, которые таблица объявляет через `resolveDependencies(...)`. Внутренние table details остаются внутри feature.

## Pure/UI Boundary

Главное правило после рефакторинга:

- `TableWidget.vue` отвечает за template, refs, props/emits и подключение runtime controller;
- `table_selectors.ts` и pure helpers отвечают за derived data;
- runtime modules отвечают за поведение, browser events и host integration.

Это уменьшает смешение UI-поведения, data-shaping и DOM side effects внутри Vue component.

## Integration With Page Runtime

Если `table_attrs` содержит внешние list/widget refs:

1. `resolveDependencies(...)` извлекает список attr names;
2. `attrs_loader.js` догружает их из `/api/attrs`;
3. `WidgetRenderer.vue` публикует в subtree только допустимые table runtime services через definition-driven bridge;
4. таблица получает нормализованный `attrsByName`, error handlers и notifications через injected/runtime boundary;
5. `TableWidget.vue` не читает global/window state и не обращается к `$root`.

Для table-widget это означает:

- attrs map приходит через host service;
- recoverable app errors поднимаются через общий frontend error model;
- user-facing notifications идут через page-level notification service;
- committed page state таблица напрямую не мутирует.

## Embedded Widget Boundary

Embedded cell widgets живут внутри table feature, но их runtime boundary совпадает с общим widget contract:

- lifecycle draft-commit остаётся локальным для самого cell widget;
- host services приходят только через registry/runtime bridge;
- committed page state не хранится внутри таблицы;
- table cell editors не получают прямой доступ к page host.

## Known Remaining Debt

Cleanup не закрывает strict typing долг table runtime. `npm --prefix tooling/vite run build` должен проходить, но `typecheck` и `typecheck:table` сейчас всё ещё могут падать на известных table typing gaps.

Самый важный архитектурный остаток: `TableWidgetVm` пока остаётся loose VM-boundary вокруг Vue instance, и его нужно сужать отдельным проходом, не смешивая это с удалением legacy.
