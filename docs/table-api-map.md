# Table Public Vs Internal API Map

## Public API

Внешняя точка входа table feature:

- `frontend/js/widgets/table/index.ts`
- `frontend/js/widgets/table/table_api.ts`

Публичные exports:

- `TableWidget`
- `createStore(options)`
- `resolveDependencies(tableAttrConfig)`
- `getListOptions(attrsByName, sourceName)`

Весь остальной table-код считается private implementation detail и не должен импортироваться снаружи feature без отдельного решения о контракте.

## Contract And State Layer

- `table_contract.ts` — внутренние типы table runtime, schema, rows, selection, services и VM-boundary.
- `table_errors.ts` — recoverable table errors.
- `table_store.ts` — создание table-specific runtime store.
- `table_runtime_state.ts` — начальные slices runtime state.
- `table_runtime_services.ts` — helpers для host services.
- `table_editing_state.ts` — state активного cell editor.
- `table_context_menu_state.ts` — state context menu.
- `table_lazy_load_state.ts` — lazy-loading state.
- `table_measurement_state.ts` — sticky/header measurement state.

## Parsing And Pure Logic

- `table_parse_attrs.ts` — canonical parser `table_attrs` и shared attr helpers.
- `table_schema_parse.ts` — разбор schema/header rows из table attrs.
- `table_selectors.ts` — pure derived cell/table helpers.
- `table_clipboard.ts` — TSV serialization/deserialization и clipboard data helpers.
- `table_format.ts` — value formatting.
- `table_sort.ts` — sort helpers.
- `table_grouping.ts` — grouping/display rows helpers.
- `table_utils.ts` — низкоуровневые row/column helpers.

## Runtime Modules

- `createTableRuntime.ts` — orchestration entrypoint, который собирает runtime controller.
- `useTableRuntime.ts` — Composition API bridge для `TableWidget.vue`.
- `table_cell_runtime.ts` — embedded cell value/editor flow.
- `table_clipboard_runtime.ts` — browser clipboard integration.
- `table_context_menu.ts` — context menu behavior.
- `table_data_runtime.ts` — table data mutation/load helpers.
- `table_data_view_runtime.ts` — display model and lazy/grouping data view.
- `table_editing_runtime.ts` — edit start/commit/cancel flow.
- `table_interactions.ts` — pointer/selection interaction helpers.
- `table_jump.ts` — row/cell jump helpers.
- `table_keyboard.ts` — keyboard navigation.
- `table_menu_runtime.ts` — menu action wiring.
- `table_row_runtime.ts` — row identity and row-level runtime helpers.
- `table_selection.ts` — selection model and normalization.
- `table_view_runtime.ts` — visual/runtime view orchestration.
- `table_widget_helpers.ts` — DOM/geometry helpers used by the table widget.

## DOM And Page Integration

- `table_dom.ts` — DOM helper boundary.
- `table_measurement.ts` — table/header measurement helpers.
- `table_scroll.ts` — scroll helpers.
- `table_sticky_header.ts` — sticky-header synchronization.
- `table_page_bridge.ts` — page/runtime bridge helpers.
- `table_notifications.ts` — user-facing table notifications.
- `table_debug.ts` — debug-only table helpers.
- `table_method_helpers.ts` — controller method binding helpers.

## Removed Legacy Surface

В актуальном frontend graph больше нет table `.js` modules и нет временных wrappers around schema/header/selection identity. Удалённые имена не являются контрактом и не должны возвращаться без новой причины.
