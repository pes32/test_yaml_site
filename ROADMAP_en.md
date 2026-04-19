# Roadmap

[Русская версия](ROADMAP.md)

## Current state

- The YAML DSL and snapshot assembly support working interface pages.
- The baseline set of widgets, modals, menus, action runtime, and the table/voc/datetime subsystems form a clickable mockup.
- A production-like `waitress + nginx` startup flow exists.
- Debug tooling includes a read-only PostgreSQL SQL helper.

## Roadmap Areas

### DB integration

What exists today:

- `backend/database.py` and debug SQL tooling;
- a PostgreSQL landing page and related materials;
- a reserved DSL contour for planned flows such as `select_attrs`.

What is still missing:

- a full bind/save flow between YAML forms and a database;
- data sources for YAML widgets as a finished public contract;
- a completed validation/error model for DB-backed actions;
- a production-ready story for multi-user data entry.

DB work is a design area: the repository contains useful supporting pieces, but YAML forms do not have a completed data-entry/save pipeline.

### Frontend/table quality gate

Current state:

- the table runtime uses explicit TS modules;
- `TableWidget.vue` runs through `useTableRuntime.ts`;
- `type-holes`, `typecheck`, `typecheck:table`, Vite build and `tests/run.sh` are mandatory frontend gates.

What is still open:

- reduce the explicit `useTableRuntime.ts` controller boundary only together with tests for the affected interactions;
- keep browser/E2E table smoke coverage as a regression gate.

### Frontend widget refactor

Current frontend status:

- TS/Composition API widgets: `str`, `text`, `int`, `float`, `button`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `img`, `list`, `voc`, `split_button`;
- `table` is a typed controller feature through `useTableRuntime.ts`;
- `frontend/js` contains TypeScript/Vue source for the widget layer, action runtime, datetime/IP/voc helpers, page/bootstrap glue, API/attrs/modal flows, and diagnostics;
- shared common components use typed `<script setup lang="ts">`.

Remaining quality steps:

- narrow types at DOM/event boundaries;
- extend Playwright smoke coverage for regressions;
- keep JS adapter modules out of the widget layer.

### Future Ideas

- Table ideas that remain on the roadmap: fill/drag values, paste into selected range, filters/views, and highlighting fresh changes.
- Test automation should keep expanding the real browser smoke/E2E runner for new regression cases.
- DB integration needs a separate bind/save/update flow design.

## Next

- Finish the data-source model for YAML widgets.
- Add a careful save/update flow without breaking current contracts.
- Formalize `select_attrs` or replace it with a clearer mechanism.
- Continue stabilizing the frontend runtime and the documentation set.
- Keep the TS/Vue frontend source free of JS adapters in widget/runtime layers.
- Narrow the table controller boundary and external DOM/event signatures without weakening `typecheck`.
- Add real browser smoke coverage for key flows if the project needs an automated regression gate.
