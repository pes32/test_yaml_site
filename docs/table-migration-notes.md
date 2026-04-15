# Table Migration Notes

## Completed In Current Refactor

- `TableWidget.vue` работает через Composition API и `useTableRuntime.ts`.
- Runtime orchestration централизован в `createTableRuntime.ts`.
- Legacy table `.js` modules заменены на `.ts` modules.
- `table_core`, `tableEngine.*Methods`, side-effect registration и `Object.assign(...Methods)` удалены из актуального runtime.
- `table_api.ts` и `index.ts` стали явными public entrypoints.
- Parser/schema flow сведён к `table_parse_attrs.ts` и `table_schema_parse.ts` без временных wrapper modules.
- Sticky/measurement/scroll flow живёт в `table_sticky_header.ts`, `table_measurement.ts`, `table_scroll.ts`.
- Page integration идёт через registry/runtime bridge, а не через `$root` и raw global state.
- Broken table-only npm script удалён, потому что runner отсутствовал.
- Strict typing debt table runtime закрыт: `typecheck` и `typecheck:table` должны быть зелёными.
- `TableWidgetVm` больше не является loose `Record<string, unknown>` boundary; runtime contract разделён на state/computed/methods/dom/setup bindings.
- `table_method_helpers.ts` больше не отравляет `this` broad string-index signature, поэтому state fields не типизируются как runtime methods.
- Pure helpers (`table_selectors.ts`, `table_widget_helpers.ts`, `table_jump.ts`, `table_format.ts`, `table_grouping.ts`) получили явные table-типы.
- Embedded cell widgets теперь приходят из полного TS widget layer: `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`.

## What Must Not Return

- `tableEngine.*Methods`
- `Object.assign(...Methods)` в `TableWidget.vue`
- import-order registration как обязательная часть runtime
- прямой доступ table feature к `$root` вместо bridge/services contract
- table `.js` modules alongside the current `.ts` runtime
- placeholder scripts that point to missing runners
- `@ts-ignore` / `@ts-expect-error` для table runtime typing debt
- broad `Record<string, unknown>` as VM contract

## Remaining Work

- Расширять реальный browser/E2E smoke для новых table interactions.
- Повторно проходить API map и решать, какие helper modules можно сделать ещё уже или объединить.
- Сужать runtime method signatures дальше только вместе с тестами на соответствующие interactions.
