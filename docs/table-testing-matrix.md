# Table Verification Matrix

## Required Project Checks

Минимальный gate после table/runtime изменений:

- `python3 -m backend.tools.validate_config --json`
- `npm --prefix tooling/vite run type-holes`
- `npm --prefix tooling/vite run typecheck:table`
- `npm --prefix tooling/vite run typecheck`
- `npm --prefix tooling/vite run build`
- `tests/run.sh`

`type-holes`, `typecheck` и `typecheck:table` являются обязательным gate для table runtime изменений. Ошибки в этих командах нельзя переводить в suppressions или weakening strictness.

## Expected Status Today

- YAML validator должен проходить без diagnostics.
- Vite build должен проходить без circular chunk warning.
- `type-holes`, `typecheck` и `typecheck:table` должны проходить без diagnostics.
- Failures по удалённым файлам, отсутствующим scripts или stale docs считаются regression и должны исправляться сразу.

## Manual Smoke Scope

Baseline-страница для ручной проверки: [pages/2_widget_demo](../pages/2_widget_demo).

Проверять в UI:

- header sort cycle and reset;
- single-cell, range and row selection;
- Excel-like row block selection: `Shift+Space`, row-range extension, `Ctrl+-`;
- keyboard navigation and tab flow;
- clipboard paste into selected ranges;
- edit start/commit/cancel;
- context menu on header, column-number header, grouping rows and body;
- runtime toggles for sticky header, line numbering and word wrap;
- sticky header mount/update/unmount;
- lazy sentinel path;
- embedded widget cells for `list`, `voc`, `date`, `time`, `datetime`, `ip`, `ip_mask`.

## Pure Logic Watchlist

Эти области должны оставаться детерминированными и пригодными для будущих unit tests:

- selection normalization and row-block behavior;
- TSV serialization/deserialization;
- stable sort fallback by row id;
- grouping display rows and expanded state pruning;
- initial runtime state slices;
- explicit and generated row ids;
- recoverable error normalization.

## Browser/E2E Automation

Browser smoke живёт в `tests/specs/tables/table-widgets.spec.ts` и запускается через общий Playwright runner:

```bash
tests/run.sh specs/tables/table-widgets.spec.ts
```

Этот suite проверяет render flags, сортировку, lazy sentinel, базовое редактирование, embedded widget actions, Excel-like row selection/delete, range paste, column-number context menu, runtime line-number toggle и grouping-row context menu. Новые table interactions должны расширять этот runner, а не возвращать broken placeholder scripts.
