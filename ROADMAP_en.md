# Roadmap

[Русская версия](ROADMAP.md)

## Current state

- The YAML DSL and snapshot assembly already support working interface pages.
- The baseline set of widgets, modals, menus, action runtime, and the table/voc/datetime subsystems already form a clickable mockup.
- A production-like `waitress + nginx` startup flow exists.
- Debug tooling and a read-only PostgreSQL SQL helper are already available.

## Partially done

### DB integration

What exists today:

- `backend/database.py` and debug SQL tooling;
- a PostgreSQL landing page and related materials;
- signs of the planned flow in the DSL, including `select_attrs`.

What is still missing:

- a full bind/save flow between YAML forms and a database;
- data sources for YAML widgets as a finished public contract;
- a completed validation/error model for DB-backed actions;
- a production-ready story for multi-user data entry.

The honest reading of the current status is: DB work has started and has useful pieces already, but it is still roadmap work rather than a finished feature.

### Frontend/table quality gate

What is already done:

- the legacy table runtime has been replaced with explicit TS modules;
- `TableWidget.vue` runs through `useTableRuntime.ts`;
- `typecheck` and `typecheck:table` are green mandatory frontend gates;
- Vite build remains part of the required frontend gate;
- stale wrappers, broken scripts, and outdated docs are removed during cleanup passes.

What is still open:

- reduce the explicit `useTableRuntime.ts` controller boundary only together with tests for the affected interactions;
- keep browser/E2E table smoke coverage as a regression gate.

### Frontend widget refactor

Status after the full TS pass:

- migrated: `str`, `text`, `int`, `float`, `button`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `img`, `list`, `voc`, `split_button`;
- migrated with a controller boundary: `table`;
- legacy JS removed from `frontend/js`: action runtime, datetime helpers, IP helpers, voc helpers, page/bootstrap glue, API/attrs/modal flows, and diagnostics;
- shared common components use typed `<script setup lang="ts">`.

Remaining quality steps:

- narrow types at DOM/event boundaries;
- extend Playwright smoke coverage for regressions;
- keep JS adapter modules out of the widget layer.

### Ideas Merged From Old Drafts

Old root-level drafts were condensed here to avoid keeping several competing plans in the repository root.

- Table ideas that remain on the roadmap: fill/drag values, paste into selected range, filters/views, and highlighting fresh changes.
- Test automation should keep expanding the real browser smoke/E2E runner for new regression cases.
- DB integration needs a separate bind/save/update flow design.

## Next

- Finish the data-source model for YAML widgets.
- Add a careful save/update flow without breaking current contracts.
- Formalize `select_attrs` or replace it with a clearer mechanism.
- Continue stabilizing the frontend runtime and the documentation set.
- Keep the full TS widget layer free of legacy JS adapters.
- Narrow the table controller boundary and external DOM/event signatures without weakening `typecheck`.
- Add real browser smoke coverage for key flows if the project needs an automated regression gate.
