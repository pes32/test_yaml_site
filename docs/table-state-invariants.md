# Table State Invariants

## Source Of Truth

- `tableData` хранит canonical row data.
- `tableSchema` хранит canonical schema и header rows.
- flat runtime state (`selAnchor`, `selFocus`, `selFullWidthRows`) хранит active selection.
- flat runtime state (`editingCell`, `cellValidationErrors`) хранит active editing session.
- `tableStore.grouping` хранит grouping levels и expanded path state.
- `tableStore.loading` хранит lazy-loading flags, pending rows и UI lock.
- `tableStore.sticky` хранит sticky header flag и sticky measurement snapshot.
- `tableStore.view` хранит runtime toggles для word wrap и line numbers.
- `tableStore.validation` хранит mirror commit-validation map.

`tableStore.selection`, `tableStore.editing`, `tableStore.menu`, `tableStore.sticky` и `tableStore.validation`
синхронизируются из flat runtime state после core transitions. Они пока остаются mirror-state,
а не единственным source of truth, пока call-sites читают parallel flat state. Удалять flat fields
или переводить call-sites на store можно только отдельным cleanup после проверки public `createStore()` shape.

## Normalize Pass

- `normalizeTableRuntimeState()` строит core snapshot, прогоняет `normalizeTableCoreState()` и синхронизирует исправленные selection/editing/context/grouping/sort поля обратно в runtime.
- После опасных transitions (`initializeTable`, `setValue`, sort, grouping rebuild, row mutation, paste, lazy append, finish edit, context menu close) runtime обязан пройти normalize-pass или typed core command.
- Open context menu snapshot закрывается, если session mismatch или snapshot ссылается на удалённый rowId/columnKey.
- Row context actions читают `anchorRowId`/`anchorSourceRow`, clipboard actions восстанавливают rect и paste anchor из snapshot identity перед записью.

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
