# Table Runtime Notes

## Runtime Shape

- `TableWidget.vue` работает через Composition API и `useTableRuntime.ts`.
- Runtime orchestration централизован в `createTableRuntime.ts`.
- Table source находится в TypeScript modules.
- Public entrypoints: `table_api.ts` и `index.ts`.
- Parser/schema flow проходит через `table_parse_attrs.ts`.
- Sticky/measurement/scroll flow живёт в `table_sticky_header.ts`, `table_measurement.ts` и `table_scroll.ts`.
- Page integration идёт через registry/runtime bridge.
- `type-holes`, `typecheck`, `typecheck:table`, `build` и `tests/run.sh` входят в обязательный frontend/runtime gate.
- `TableWidgetVm` разделён на state/computed/methods/dom/setup bindings.
- Pure helpers (`table_selectors.ts`, `table_widget_helpers.ts`, `table_jump.ts`, `table_format.ts`, `table_grouping.ts`) используют явные table-типы.
- Embedded cell widgets приходят из TS widget layer: `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`.

## Restricted Surface

- `tableEngine.*Methods`
- `Object.assign(...Methods)` в `TableWidget.vue`
- import-order registration как обязательная часть runtime
- прямой доступ table feature к `$root` вместо bridge/services contract
- table `.js` modules alongside the current `.ts` runtime
- placeholder scripts that point to missing runners
- `@ts-ignore` / `@ts-expect-error` для table runtime typing debt
- broad `Record<string, unknown>` as VM contract
- undocumented type-hole allowlist entries

## Open Work

- Расширять реальный browser/E2E smoke для новых table interactions.
- Повторно проходить API map и решать, какие helper modules можно сузить или объединить.
- Сужать оставшиеся aggregate runtime method signatures дальше только вместе с тестами на соответствующие interactions.
