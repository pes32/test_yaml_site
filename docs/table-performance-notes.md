# Заметки о производительности таблицы

## Тяжёлые пути

- rebuilding `TableViewModel` for sort/grouping over the full logical dataset;
- computing the virtual window and measured row heights on scroll/resize;
- **`visibleCellGridStableRows`** (formatter-heavy slice for the DOM window): пересборка только при смене viewport/правил данных, без подписки на editing-cell;
- лёгкий overlay **`visibleCellGrid`** пробрасывает `isEditing` по видимым ячейкам;
- bulk formatting metadata for large selections;
- clipboard paste matrix application;
- sticky-header measurement and overlay sync;
- embedded cell editor mount/unmount inside dense rows.
- remote row-query cache invalidation and stale response handling.

## Правила

- Public mode is `auto`; runtime uses `local-full` for small inline rows and `remote-paged` for file/db/unknown/large datasets.
- `LOCAL_FULL_MAX_ROWS = 1000` (зеркально в `backend/table_runtime.py` и `frontend/js/widgets/table/table_row_provider.ts`): порог inline `local-full` против `remote-paged`; первая порция строк в `/api/page` / attrs никогда не больше этого числа (`_initial_limit`). Потолок одного `/api/table-query` — `MAX_TABLE_QUERY_LIMIT = 5000` (то же на фронте в `table_query_fingerprint.ts`).
- Virtual scroll clamps total scroll geometry with `geometryScale` when logical height превышает ~10M px, сохраняя логический `scrollTop` в runtime state.
- `local-full` may keep all rows in `tableData`; `remote-paged` must keep only visible/cache windows and use `/api/table-query` for sort/group/filter/search windows.
- File-backed remote tables may use CSV, JSON or JSONL/NDJSON row sources. `/api/page` and `/api/attrs` include config + runtime sidecar, not the full file rows.
- Do not reintroduce full `<tr v-for="displayRows">` or local lazy-append as a render fallback.
- Full export: при `table_export_too_large` фронт делает последовательные `export_chunk` и может передать `onProgress` в `exportValueAsync({ onProgress })`.
- `/api/page` and `/api/attrs` must not serialize full remote row payloads; row slicing/querying happens before JSON envelope serialization.
- If row measurement is unavailable, use `estimatedRowHeightPx` and refine later; do not switch into a partial legacy renderer.
- Huge tables use logical scroll geometry. Offset/window math must be estimated-height based and not sum 0..rowIndex for 100k/1M rows.
- Spacer rows must remain inert: one `td[colspan]`, no `data-row`/`data-col`, no selection, keyboard, row ops, hover, context menu or zebra participation.
- Metadata is row-sharded COW (`rowId -> colKey -> CellMeta`). Bulk style patches should operate by row buckets and may share immutable buckets/meta objects; later single-cell changes must copy the touched bucket first.
- Metadata-only history stores shared root + buckets and relies on the existing history limit. Do not add a diff format unless the history limit stops being enough.
- Toolbar state and render-path helpers must avoid walking every selected cell for large selections; prefer column-level checks and early exits.
- Selection/focus для DOM: тяжёлые форматы в `visibleCellGridStableRows`; `visibleCellGrid` только добавляет `isEditing`; class/tabindex/outline по выделению остаются в `cellTdClass` / `cellTabindex` / `cellSelectionOutlineStyle` на уровне шаблона (`TableWidget.vue`).
- Scroll/keyboard repeat/PageDown must coalesce to at most one focus update and one range request per animation frame.
- Remote format rules: `columnRulesByKey`, `directCellOverrides`, `globalRules`; `rowRangeRules` / `cellRangeRules` индексируются по `sourceIndex` через `table_format_rule_index.ts` (диапазоны шире 4096 строк остаются в «wide»-списке с проверкой по границам).
- Remote history is command-based and stores view/rule/selection state, not row snapshots. Undo/redo may requery the current visible window through the provider.
- Remote sync `getValue()` is forbidden; use `getValueAsync()` / `exportValueAsync()` / `submitTableCommands()`.
- Sticky-header measurement should update only on bounded lifecycle/scroll/resize/virtual-measurement triggers.

## Ограничители

- Pure virtual math lives in `table_virtual_model.ts` and has unit coverage for window/spacer/measurement behavior.
- Runtime scroll ownership lives in `table_virtual_runtime.ts`; central calls are `scrollToDisplayRow`, `ensureDisplayRowVisible`, `focusSelectionCell`.
- Remote row provider state lives in `table_row_provider.ts` / `tableRemote`; stale `/api/table-query` responses are ignored by request/view guards.
- Browser-facing side effects stay in runtime/DOM integration modules so `TableWidget.vue` remains a thin UI root.
- The hard performance invariant is bounded DOM and bounded data payload: a 10k/1M-row remote table should keep DOM rows bounded by viewport + overscan + spacer rows and should not ship full rows through attrs/page payloads.

## Ворота (gates)

- Hard gate: `tests/specs/tables/table-widgets.spec.ts` checks that 10k formatted rows keep bounded DOM rows and that top/middle/bottom samples preserve strike/fill/text color through virtual scroll and undo/redo.
- Hard gate: spacer rows are excluded from `tbody tr[data-display-row]` counts and from `td[data-row][data-col]` selectors.
- Hard gate: 1M remote fixture initial payload is bounded and jump/sort/group query returns a window without frontend full-load.
- CI-stable click median/p95 gates may be used for small formatted selections; slowest/p95 logs are diagnostics when browser timing is noisy.

## Открытые риски по производительности

- Grouped `local-full` scenarios still depend on full `TableViewModel` rebuild cost; remote grouping must be a backend view operation that returns mixed group/row display items.
- Auto-width intentionally scans logical rows to measure content and should stay an explicit user action, not an implicit render-path task.
