# Table State Invariants

## Source Of Truth

- `tableData` хранит canonical row data.
- `tableSchema` хранит canonical schema и header rows.
- `tableStore.selection` хранит anchor/focus/full-width selection.
- `tableStore.editing` хранит единственную активную editing session.
- `tableStore.grouping` хранит grouping levels и display cache.
- `tableStore.loading` хранит lazy-loading flags и pending rows.
- `tableStore.measurement` хранит sticky-header measurement state.

## Row Identity

- Каждая runtime row обязана иметь стабильный `id`.
- Selection, grouping leaf mapping, edit continuity и lazy-merge не должны опираться на индекс как на единственный identity key.

## Editing

- Активна только одна editing session одновременно.
- `editingCell === null` означает отсутствие активного cell editor.
- Любой transition, который меняет selection/sort/grouping/lazy data, обязан либо завершить edit, либо явно перенести его в согласованное состояние.
- Embedded widget editor обязан публиковать commit через typed widget lifecycle (`commitPendingState`/`commitDraft`) и не должен становиться отдельным source of truth.

## Selection

- `selAnchor` и `selFocus` всегда нормализуются в границах runtime table.
- `selFullWidthRows` означает row-block selection и расширяет rect на все runtime columns.
- Display rebuild не должен оставлять selection вне допустимых границ таблицы.

## Derived State

- `displayRows` является derived state от raw data + sort/grouping.
- `tableInlineStyle`, `sortColumnIndex`, `sortDirection`, `groupingActive`, `tableLazyUiActive` считаются derived state и не должны становиться второй истиной.
