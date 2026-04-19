# Table State Invariants

## Source Of Truth

- `tableData` хранит canonical row data.
- `tableSchema` хранит canonical schema и header rows.
- flat runtime state (`selAnchor`, `selFocus`, `selFullWidthRows`) хранит active selection.
- flat runtime state (`editingCell`, `cellValidationErrors`) хранит active editing session.
- `tableStore.grouping` хранит grouping levels и display cache.
- `tableStore.loading` хранит lazy-loading flags, pending rows и UI lock.
- `tableStore.preferences` хранит runtime toggles для sticky header, word wrap и line numbers.

`tableStore.selection`, `tableStore.editing`, `tableStore.contextMenu` и `tableStore.measurement`
не считаются runtime source of truth, пока call-sites читают parallel flat state. Удалять эти slices можно только отдельным cleanup после проверки public `createStore()` shape.

## Row Identity

- Каждая runtime row обязана иметь стабильный `id`.
- Selection, grouping leaf mapping, edit continuity и lazy-merge не должны опираться на индекс как на единственный identity key.

## Editing

- Активна только одна editing session одновременно.
- `editingCell === null` означает отсутствие активного cell editor.
- Любой transition, который меняет selection/sort/grouping/lazy data, обязан либо завершить edit, либо явно перенести его в согласованное состояние.
- Embedded widget editor обязан публиковать boundary commit через typed widget lifecycle `commitPendingState` и не должен становиться отдельным source of truth.

## Selection

- `selAnchor` и `selFocus` всегда нормализуются в границах runtime table.
- `selFullWidthRows` означает row-block selection и расширяет rect на все runtime columns.
- Display rebuild не должен оставлять selection вне допустимых границ таблицы.

## Derived State

- `displayRows` является derived state от raw data + sort/grouping.
- `tableInlineStyle`, `sortColumnIndex`, `sortDirection`, `groupingActive`, `tableLazyUiActive` считаются derived state и не должны становиться второй истиной.
