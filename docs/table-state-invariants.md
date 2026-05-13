# Инварианты состояния таблицы

## Источник истины

**Данные и схема:** `tableSchema` / `tableColumns`, `headerRows` — канон для схемы. Для данных действует provider-модель: `local-full` держит полный `tableData`, `remote-paged` держит только loaded/cache window и `tableRemote` (`TableViewState`, `viewId`, `itemsByDisplayIndex`, `totalRows`).

**Virtual DOM window:** DOM всегда строится из `visibleDisplayRows` / `visibleCellGrid`. Для `local-full` display-модель derived от `tableData`; для `remote-paged` display window derived от backend view/query cache. Runtime не возвращается к полному `<tr v-for="displayRows">`.

**TableStore (уже канон для части поведения):** `tableStore.grouping`, `tableStore.loading`, `tableStore.meta`, `tableStore.history`, `tableStore.widths`, `tableStore.view` — владельцы своих доменов без дублирующих плоских полей на VM.

**Дубль flat ↔ mirror:** сейчас активное выделение, редактирование, карта ошибок валидации ячеек и контекстное меню живут **и** в плоских полях VM (`selAnchor`, `selFocus`, `editingCell`, `cellValidationErrors`, `contextMenu*`), **и** в `tableStore.selection` / `tableStore.editing` / `tableStore.validation` / `tableStore.menu`. Mirror обновляется из flat после переходов (`syncTableStoreMirrors` в `table_runtime_state.ts`). Пока call-sites читают параллельно — оба слоя должны оставаться согласованными; убирать flat или переводить чтение только на store — отдельный cleanup. Плановое направление описано в следующем разделе.

## Цель миграции

| Зона | Целевой единственный SoT | Что остаётся VM surface |
|------|--------------------------|-------------------------|
| Строки, колонки, схема | `LocalFullRowProvider.tableData` или `RemotePagedRowProvider.tableRemote`, плюс `tableSchema` / `tableColumns` | нет дубля |
| Группировка, virtual window, meta, history, ширины | `tableStore.*`/`virtualState` + core-команды | нет дубля для этих доменов |
| Выделение, edit session, validation map, меню | **`tableStore.*` + (по мере миграции) core selection/editing** | Плоские поля VM — либо исчезают, либо остаются **тонкой проекцией** для шаблона и методов, но не второй правдой |
| DOM / lifecycle | — | `_tableFocusWithin`, handles observers, sticky snapshot flags, всё, что не входит в `TableCoreState` |

Итог: **канон данных** — `tableData` и store-слои выше; **канон интерактива** — сначала store/core, flat — временный или строго производный.

## Инварианты

### Идентичность строк

- Каждая data-строка в runtime обязана иметь **стабильный уникальный** `id` (строка). Selection, группировка, virtual restore, история и restore по `rowId` не должны опираться на индекс как на единственный ключ.
- **Где задаётся `id`:** новые id выдаёт `generateTableRowId()` в `table_utils.ts` (`tr_<timestamp>_<seq>`). При нормализации входных строк `normalizeRowToDataRow` / `normalizeTableRows` при отсутствии `id` id **создаётся** (`id = getRowId(row) || generateTableRowId()`).
- **Вставка / append / пустая строка:** `makeEmptyRow()` и дубликат строки через `cloneTableRowDeep()` всегда получают **новый** id. Вставка готовых `TableDataRow` должна приезжать уже с id или пройти нормализацию.
- **Paste:** TSV не содержит id; вставка в существующие строки **сохраняет** их `id` (`applyPasteMatrixToTableState` в `table_clipboard.ts`). Расширение таблицы вниз создаёт строки через `createEmptyRow()` — у них новые id. Внешний буфер не «переносит» identity между книгами.
- **Copy (в буфер ОС):** в TSV уходят только значения ячеек; **идентичность строк clipboard’у не экспортируется**.
- **Legacy-строки без `id`:** при любой нормализации ряда через `normalizeTableRows` / core-путь с нормализацией строк id **должен** быть назначен; до этого код, принимающий сырой внешний массив, обязан пройти `normalizeExternalRowsOrWarn` или эквивалент. Не оставлять в `tableData` долгоживущие строки без id.

### Редактирование

- Активна не больше одной editing session.
- `editingCell === null` означает отсутствие активного cell editor.
- Любой transition, который меняет модель данных / sort / grouping / virtual window, обязан завершить edit **или** привести его к согласованному состоянию до того, как UI будет опираться на новый `TableViewModel`.
- **Приоритет при sort / grouping rebuild / virtual remeasure:** **(1)** зафиксировать или отменить редактирование (`commit` / `cancel` / `exitCellEdit` по политике операции); **(2)** выполнить изменение данных или core-команду (rebuild, merge, смена sort keys); **(3)** выполнить **`normalizeTableRuntimeState()`** (или путь `dispatchTableCoreCommand` → sync), чтобы выделение и editing снова легли на валидные display/core координаты. Не рассчитывать на «случайно оставшийся» draft поверх перестроенного display.
- Embedded cell editor обязан публиковать boundary commit через `commitPendingState` и не становится отдельным source of truth.

### Выделение

- `selAnchor` и `selFocus` после normalize остаются в границах таблицы.
- `selFullWidthRows` — row-block selection; rect трактуется на все runtime columns.
- Display rebuild не оставляет selection вне допустимых границ.
- Render path не пересчитывает selection на каждую ячейку через `getSelRect()` / `selectionIsFullRowBlock()`; шаблон читает заранее подготовленный `selectionRenderState`.

### Виртуальные строки

- `virtualState.enabled` всегда `true`; невозможность измерить строку не включает legacy-render, а использует conservative estimated height до следующего измерения.
- Spacer rows внутри `<tbody>` имеют один `td` с `colspan`, не имеют `data-row`, `data-row-id`, `data-col`, не участвуют в selection, keyboard, row ops, hover, context menu и zebra.
- `scrollToDisplayRow(rowIndex, align)`, `ensureDisplayRowVisible(rowIndex)` и `focusSelectionCell(rowIndex, colIndex)` — центральный контракт для keyboard, undo/redo restore, paste, context menu restore и future jump/search.
- Variable-height rows обновляют measurement cache после word wrap, font-size, embedded editor mount/unmount и column width changes; до измерения используется `estimatedRowHeightPx`.

### Режим row provider

- Публичный YAML mode — `auto`. Runtime выбирает внутренний provider: `local-full` для маленьких inline rows (`LOCAL_FULL_MAX_ROWS = 1000`), `remote-paged` для file/db/unknown/large datasets.
- `local-full`: sync `getValue()` безопасен; sort/group/filter/history могут работать локально.
- `remote-paged`: sync `getValue()` запрещён; frontend хранит только visible/cache windows; sort/group/filter/search меняют `TableViewState` и идут через `/api/table-query`; export/save идут только через async materializing API.
- Ни один interactive path (`click`, `arrow`, `scroll`, `sort`, `group`, column/full-table formatting) не должен загружать весь remote dataset на frontend.
- Каждый table-query привязан к active view/request/snapshot. Поздние ответы старого sort/search/scroll request игнорируются, superseded request отменяется через `AbortController`, если браузер это поддерживает.
- Remote history хранит команды и маленькие snapshots view/rules/selection. В history не попадают remote rows или full dataset snapshots.

### Метаданные

- Cell metadata хранится row-sharded: `rowId -> colKey -> CellMeta`.
- Все изменения metadata проходят только через COW helpers (`patchCellMeta`, bulk row/column patch, `copyRowCellMeta`); прямые мутации root map, row bucket и вложенных `style`/`dataType` запрещены.
- Metadata-only history держит shared root + shared buckets. Это допустимый memory trade-off, ограниченный history limit; отдельный diff-формат не вводится.
- Для `remote-paged` глобальное форматирование хранится декларативно как indexed `TableFormatRule` (`globalRules`, `columnRulesByKey`, range rules, direct overrides). Render visible cells не должен линейно прогонять все rules для каждой ячейки.

### Context menu и clipboard

- Снимок контекстного меню закрывается при mismatch session или если snapshot ссылается на удалённый `rowId` / columnKey.
- Row context actions читают `anchorRowId` / `anchorSourceRow`; clipboard восстанавливает rect и paste anchor из identity snapshot перед записью.

### Производное состояние

- `displayRows` и `TableViewModel` — derived от сырых строк + sort + grouping только в `local-full`.
- `visibleDisplayRows`, `visibleCellGrid`, spacer styles — derived от provider window + `virtualState`; не становятся вторым source of truth.
- `tableInlineStyle`, `sortColumnIndex`, `sortDirection`, `groupingActive`, `tableLazyUiActive` — derived; не дублируют канон и не правятся как «вторая истина».

## Обеспечение (механизмы)

Механизмы, которые **реализуют** инварианты (это не сами инварианты):

- **`normalizeTableRuntimeState()`** (`table_runtime_state.ts` → `normalizeRuntimeTableState`): снимает `tableCoreStateSnapshot()` (уже с `normalizeTableCoreState` внутри), затем **`syncRuntimeFromTableCoreState`** обратно на VM (с опциями skip для узких sync), обновляет mirror в `tableStore`, вызывает **`checkTableInvariants`**.
- **`dispatchTableCoreCommand` / `dispatchRuntimeTableCoreCommand`:** мутация через типизированные `TableCommand` + нормализация core + sync на runtime.
- **`checkTableInvariants` / `warnTableInvariants`:** диагностика нарушений (в т.ч. duplicate row ids); не заменяет исправление state, а сигнализирует о дефекте call-site.

После опасных переходов (`initializeTable`, `setValue`, sort, grouping rebuild, мутации строк, paste, virtual remeasure, завершение edit, закрытие меню) runtime обязан пройти **normalize-pass** или эквивалентный typed core command с полным sync.
