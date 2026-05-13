# Заметки по runtime таблицы

## Форма runtime

- `TableWidget.vue` работает через Composition API и `useTableRuntime.ts`.
- Runtime orchestration централизован в `table_runtime_registry.ts` (`createTableRuntime`, `tableRuntimeMethods`) и модул layers подключаются из `useTableRuntime.ts`.
- Table source находится в TypeScript modules.
- Импорты **внутри** `frontend/js/widgets/table/`: **по умолчанию прямой** импорт из файла, где объявлен символ; [`table_internal.ts`](../frontend/js/widgets/table/table_internal.ts) — опциональный barrel для части реэкспортов, не обязательный для новых связей. Из других каталогов — только публичные точки из [table-api-map.md](table-api-map.md).
- Зависимости attrs из DSL: `frontend/js/shared/table_attr_dependencies.ts`; парсер/schema — `table_parse_attrs.ts`.
- Sticky/measurement/scroll flow живёт в `table_sticky_header.ts`, `table_measurement.ts` и `table_scroll.ts`.
- Page integration идёт через registry/runtime bridge.
- Уровни обязательности проверок (merge / релиз / ручной smoke) — [table-subsystem.md](table-subsystem.md) (**Quality gates**) и [table-testing-matrix.md](table-testing-matrix.md).
- `TableWidgetVm` разделён на state/computed/methods/dom/setup bindings.
- Pure helpers (`table_selectors.ts`, `table_widget_helpers.ts`, `table_jump.ts`, `table_format.ts`, `table_grouping.ts`) используют явные table-типы.
- Embedded cell widgets приходят из TS widget layer: `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`.

## Ограниченная поверхность

- `tableEngine.*Methods`
- `Object.assign(...Methods)` в `TableWidget.vue`
- import-order registration как обязательная часть runtime
- прямой доступ table feature к `$root` вместо bridge/services contract
- table `.js` modules alongside the current `.ts` runtime
- placeholder scripts that point to missing runners
- `@ts-ignore` / `@ts-expect-error` для table runtime typing debt
- broad `Record<string, unknown>` as VM contract
- undocumented type-hole allowlist entries

## Открытая работа

- Расширять реальный browser/E2E smoke для новых table interactions.
- Повторно проходить API map и решать, какие helper modules можно сузить или объединить.
- Поддерживать новые cross-module calls через явные method contracts и surface-типы, без возврата к aggregate runtime typing.
