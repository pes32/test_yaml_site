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
- Vite build remains the primary green frontend gate;
- stale wrappers, broken scripts, and outdated docs are removed during cleanup passes.

What is still open:

- strict `typecheck` and `typecheck:table` still need a dedicated table runtime typing pass;
- `TableWidgetVm` is still too wide as a VM boundary;
- browser/E2E smoke coverage for table interactions does not exist yet.

### Frontend widget refactor

Already migrated to Composition API + TypeScript:

- core fields `str`, `text`, `int`, `float`.

Still planned as separate steps:

- simple but DOM/action-heavy widgets: `button`, `date`, `time`, `datetime`, `ip`, `ip_mask`;
- dropdown/lookup widgets: `list`, `voc`, `split_button`;
- larger subsystems: `img`, `table`.

### Ideas Merged From Old Drafts

Old root-level drafts were condensed here to avoid keeping several competing plans in the repository root.

- Table ideas that remain on the roadmap: fill/drag values, paste into selected range, filters/views, and highlighting fresh changes.
- Test automation should come back as a real browser smoke/E2E runner, not as a placeholder script.
- DB integration needs a separate bind/save/update flow design.

## Next

- Finish the data-source model for YAML widgets.
- Add a careful save/update flow without breaking current contracts.
- Formalize `select_attrs` or replace it with a clearer mechanism.
- Continue stabilizing the frontend runtime and the documentation set.
- Continue the staged Composition API + TypeScript refactor for the remaining widgets.
- Close the strict typing debt in the table runtime.
- Add real browser smoke coverage for key flows if the project needs an automated regression gate.
