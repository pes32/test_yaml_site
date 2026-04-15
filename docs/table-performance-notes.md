# Table Performance Notes

## Heavy Paths

- parsing `table_attrs` and reconstructing schema/header rows;
- rebuilding grouped display model;
- composite sort over full dataset;
- clipboard paste matrix application;
- sticky-header measurement and overlay sync;
- keyboard navigation over large lazy tables;
- embedded cell editor mount/unmount inside dense rows.

## Rules

- Не пересчитывать schema/header rows без изменения `table_attrs`.
- Не rebuild'ить display model на каждый keystroke в active editor.
- Sticky-header measurement должен обновляться только по ограниченным lifecycle/scroll/resize triggers.
- Context menu snapshot должен работать с уже посчитанным selection state, а не пересобирать всю таблицу.
- Lazy-loading merge обязан сохранять row ids и не дублировать rows.
- Embedded cell editors не должны становиться источником истины для committed page state.

## Current Guardrails

- Pure logic вынесена в helper modules и может тестироваться вне Vue.
- Sticky-header path локализован в `table_sticky_header.ts`, `table_measurement.ts` и `table_scroll.ts`.
- Keyboard/runtime wiring идёт через `createTableRuntime.ts` и `useTableRuntime.ts`, а не через import-order registration.
- Browser-facing side effects держатся в runtime/DOM integration modules, чтобы `TableWidget.vue` оставался thin UI-root.

## Open Performance Risks

- Пока нет автоматизированного browser benchmark для больших таблиц.
- Strict table typecheck закрыт, generic `Proxy` boundary в `useTableRuntime.ts` заменён явным controller, но часть внешних DOM/event signatures остаётся широкой и должна сужаться только вместе с regression coverage.
- Lazy/grouping/sticky paths требуют targeted Playwright smoke после крупных изменений, даже при зелёных type/build gates.
