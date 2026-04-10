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

## What Must Not Return

- `tableEngine.*Methods`
- `Object.assign(...Methods)` в `TableWidget.vue`
- import-order registration как обязательная часть runtime
- прямой доступ table feature к `$root` вместо bridge/services contract
- table `.js` modules alongside the current `.ts` runtime
- placeholder scripts that point to missing runners

## Remaining Work

- Закрыть strict typing debt в table runtime.
- Сузить `TableWidgetVm`, чтобы убрать loose VM-boundary вокруг Vue instance.
- Завести реальный browser/E2E smoke для table interactions, если проекту нужен автоматический regression gate.
- После typing pass повторно пройти API map и решить, какие helper modules можно сделать ещё уже или объединить.
