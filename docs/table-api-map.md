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

- `table_contract.ts` — внутренние типы table runtime: `TableRuntimeState`, `TableRuntimeComputed`, `TableRuntimeMethods`, `TableRuntimeDomSurface`, narrow runtime surfaces, `TableRuntimeVm`, `TableWidgetSetupBindings`, schema/rows/selection/context-menu/cell-widget contracts.
- `table_errors.ts` — recoverable table errors.
- `table_store.ts` — создание table-specific runtime store.
- `table_runtime_state.ts` — glue для store mirrors и public command entrypoints; exposed component surface имеет `dispatchTableCommand(command, payload)` для table mutations.
- `table_page_bridge.ts` — helpers для host services.

## Parsing And Pure Logic

- `table_parse_attrs.ts` — canonical parser `table_attrs`, schema/header rows и shared attr helpers.
- `table_selectors.ts` — typed pure derived cell/table helpers для display actions, cell options, defaults и lazy flag.
- `table_clipboard.ts` — TSV serialization/deserialization и clipboard data helpers.
- `table_format.ts` — value formatting.
- `table_sort.ts` — sort helpers.
- `table_grouping.ts` — typed grouping/display rows helpers.
- `table_utils.ts` — низкоуровневые row/column helpers.

## Runtime Modules

- `createTableRuntime.ts` — compatibility entrypoint для runtime registry exports.
- `useTableRuntime.ts` — typed Composition API controller для `TableWidget.vue`; собирает explicit runtime layers и возвращает setup bindings по table contract.
- `table_cell_runtime.ts` — embedded cell value/editor flow.
- `table_clipboard_runtime.ts` — browser clipboard integration.
- `table_data_runtime.ts` — table data mutation/load helpers, display model, sort, lazy/grouping data view.
- `table_editing_runtime.ts` — edit start/commit/cancel flow.
- `table_interactions.ts` — pointer/selection interaction helpers.
- `table_jump.ts` — row/cell jump helpers.
- `table_keyboard.ts` — keyboard navigation.
- `table_menu_runtime.ts` — context menu snapshot, item building, menu action wiring.
- `table_row_runtime.ts` — row identity and row-level runtime helpers.
- `table_selection.ts` — selection model and normalization.
- `table_view_runtime.ts` — visual/runtime view orchestration.
- `table_widget_helpers.ts` — DOM/geometry helpers used by the table widget.

## Embedded Widget Imports

Table cell editors резолвятся через общий `WidgetDefinitionRegistry` с embedded allowlist (`str`, `int`, `float`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`). `TableWidget.vue` не импортирует standalone widget components напрямую; новые table-cell capabilities проходят через typed widget exposes и общий lifecycle contract.

## DOM And Page Integration

- `table_dom.ts` — DOM helper boundary.
- `table_measurement.ts` — table/header measurement helpers.
- `table_scroll.ts` — scroll helpers.
- `table_sticky_header.ts` — sticky-header synchronization.
- `table_page_bridge.ts` — page/runtime bridge helpers.
- `table_notifications.ts` — user-facing table notifications.
- `table_debug.ts` — debug-only table helpers.
- runtime method groups типизируются через `TableRuntimeMethodSubset` в `table_contract.ts`.

## Restricted Surface

В table frontend graph не входят `.js` modules, временные wrappers around schema/header/selection identity и side-effect registration names. Эти имена не являются контрактом.
