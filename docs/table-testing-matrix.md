# Table Verification Matrix

## Required Project Checks

Минимальный gate после table/runtime изменений:

- `python3 -m backend.tools.validate_config --json`
- `npm --prefix tooling/vite run build`
- `npm --prefix tooling/vite run typecheck`
- `npm --prefix tooling/vite run typecheck:table`

Отдельной table-only npm-команды сейчас нет: прежний placeholder script ссылался на отсутствующий runner и был удалён из `tooling/vite/package.json`.

## Expected Status Today

- YAML validator должен проходить без diagnostics.
- Vite build должен проходить без circular chunk warning.
- `typecheck` и `typecheck:table` могут оставаться красными только по известному strict typing debt внутри table runtime.
- Failures по удалённым файлам, отсутствующим scripts или stale docs считаются regression и должны исправляться сразу.

## Manual Smoke Scope

Baseline-страница для ручной проверки: [pages/2_widget_demo](../pages/2_widget_demo).

Проверять в UI:

- header sort cycle and reset;
- single-cell, range and row selection;
- keyboard navigation and tab flow;
- edit start/commit/cancel;
- context menu on header and body;
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

## Missing Automation

Browser/E2E smoke suite пока не заведён. Это осознанный roadmap item: когда появится runner, он должен покрыть table interactions через реальный DOM, а не возвращать broken placeholder script.
