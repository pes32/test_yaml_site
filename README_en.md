# Yamls - YAML System

[Russian version](README.md)

# From the author

Hosted at: yamls.ru

- This is a clickable mockup of a system built on YAML. I chose YAML to describe attributes and the UI because it is simple enough for almost anyone to write. My former team and I arrived at this after building countless business systems. The system already includes the most common input widgets, enough for most tasks.
- I recommend clicking through all the widgets by hand; many turned out well, especially the table (text and textarea less so).
- The current system is deliberately overstuffed and implemented entirely in YAML. That is not a reason to always do it this way, but it is food for thought.
- Database support is on the roadmap. The database is already partially wired in, but it does not really work yet. The main question is how to integrate it. Following the current approach, functions and business logic would move into PostgreSQL as the simplest language, and be invoked from YAML attributes. I am not sure that is a good idea; building a full custom backend would be pointless wasted effort.
- Maybe someday I will add charts and some integrations, or more widgets and features. I do not know yet.
- Sudoku is there for fun (I already had it in Python); it can be removed from the system without regret.
- Overall budget for building the system: no more than $100. Time-wise, about a month.
- What follows is machine-generated text. Whether you want to read it is up to you. I warned you.

## About the project

Yamls - YAML System is a YAML-driven UI engine for clickable portals and interface prototypes: pages are described in YAML files, the backend builds a snapshot from them, and the frontend renders the UI through a Vite bundle. The current tagged release is `v.0.5 л.` (see [CHANGELOG.md](CHANGELOG.md)); in practice this is an evolving clickable mockup with growing server-side capabilities.

Unlike a typical form builder or admin generator, the primary artifact is not a database schema or visual editor but declarative pages, attributes, menus, modals, and actions in YAML. The backend owns snapshot assembly and validation; the frontend runtime executes the resulting contract.

The frontend runtime is structured around three boundaries:

- `page_store` holds snapshot-derived state only;
- `page_session_store` holds committed page/session state only;
- the widget tree goes through `WidgetDefinitionRegistry`, lifecycle handles, and the host runtime bridge—not direct `$root` access.

## What you get

- UI described in YAML instead of hand-coding every page.
- A backend snapshot pipeline with validation and diagnostics.
- A frontend runtime with widgets `str`, `text`, `int`, `float`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`, `img`, `button`, `split_button`, `table`.
- Authentication, `/user_settings` (including PostgreSQL connection settings, DB schema work, and backups for the `admin` role) and an admin SQL area for system operations.
- Production-like local startup close to `public nginx -> waitress on 127.0.0.1`.

## Demo vs author-specific material

- Engine-focused examples live in [pages/2_widget_demo](pages/2_widget_demo) and in [docs/yaml-dsl.md](docs/yaml-dsl.md).
- Architecture is covered in [docs/runtime-architecture.md](docs/runtime-architecture.md), [docs/server-runtime.md](docs/server-runtime.md), [docs/widget-registry-contract.md](docs/widget-registry-contract.md), [docs/api-contracts.md](docs/api-contracts.md), [docs/api-contracts-ddl.md](docs/api-contracts-ddl.md), [docs/table-subsystem.md](docs/table-subsystem.md), [docs/table-state-invariants.md](docs/table-state-invariants.md), [docs/table-api-map.md](docs/table-api-map.md), [docs/table-testing-matrix.md](docs/table-testing-matrix.md), [docs/table-performance-notes.md](docs/table-performance-notes.md), and [docs/table-runtime-notes.md](docs/table-runtime-notes.md).
- The `about_author` page and the hardcoded Postgres section are demo and author material, not a mandatory part of a future product build.

## Repository layout

- `backend/` — Flask backend, snapshot builder, validation, API, auth/admin services.
- `pages/` — YAML pages and attributes.
- `frontend/` — styles (`frontend/css`), canonical TS/Vue runtime and widgets (`frontend/js`), page-level Vue shells (`frontend/apps`), built bundle (`frontend/dist`).
- `tooling/vite/` — frontend toolchain, typecheck, and build; **frontend npm dependencies live only here** ([`tooling/vite/package.json`](tooling/vite/package.json)).
- Root [`package.json`](package.json) — **proxy scripts** `vite:*` only, no package dependencies of its own; details in [ROADMAP_en.md](ROADMAP_en.md) (Frontend build / npm).
- `templates/` — HTML templates, icons, and related static assets.
- `scripts/`, `settings/`, `nginx/`, `run/`, `logs/`, `ssl/` — local server/runtime startup and generated runtime files.
- `docs/` — architecture and operations documentation.

## Quick start

### Requirements

- `python3` 3.8+
- `node` and `npm`
- `nginx` in `PATH` for `./start.sh`
- `openssl` for the local self-signed certificate

### First run

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
npm --prefix tooling/vite ci
```

Without `cd`: after installing dependencies under `tooling/vite`, you can run **`npm run vite:typecheck`**, **`npm run vite:typecheck:table`**, **`npm run vite:build`**, **`npm run vite:preflight`**, **`npm run vite:dev`** from the **repository root** (see root `package.json`; they delegate to `tooling/vite`).

If `pip install -r requirements.txt` fails with `No matching distribution found for waitress==3.0.0` or `Werkzeug==3.0.6`, the virtualenv was almost certainly created with too old a Python. Use **Python 3.8+** for this repository.

For local env overrides, create `settings/production.env`. Defaults are in `settings/production.defaults.env`. A root-level env path is accepted as fallback.

### Production-like locally

```bash
./start.sh
```

After startup, open `https://localhost:8443`.

### Stop

```bash
./stop.sh
```

### Checks

Browser UI checks run through the project’s test scripts:

```bash
tests/run.sh
```

For debugging with a visible browser:

```bash
tests/run_headed.sh
```

There is no separate Flask dev-server entrypoint. The intended local loop is `./start.sh` (`nginx -> waitress -> settings.wsgi:app`) plus tests under `tests/`.

## Production and safety

- A production-like stack exists, but the project is still best treated as a demo/runtime prototype, not a finished multi-user platform.
- Auth/permissions cover new system pages and admin APIs; ordinary YAML pages are not yet gated by permissions.
- The main YAML editing flow still does not implement DB persistence.
- Server/runtime details are in [docs/server-runtime.md](docs/server-runtime.md). For a public deployment the target shape remains `public nginx -> waitress on 127.0.0.1`; write concrete deployment steps for your infrastructure.

## Limitations

- Database integration is partial: PostgreSQL connectivity, admin SQL, and DB settings UI (connection, DDL/schema) exist, but there is no finished enter-and-save path for normal YAML forms (attrs `save flow`).
- `select_attrs` is reserved in the DSL but does not yet implement the promised fill/selection behavior.
- This is not a visual editor or self-service builder for non-technical end users.
- Public engine contracts are still evolving; treat external integrations as against a moving target.

## Roadmap

See [ROADMAP_en.md](ROADMAP_en.md). Priorities after the current state (`v.0.5 л.`) include:

- wiring YAML attributes to the database (`output` / `input` and a unified save/update flow) without breaking contracts;
- formalizing data sources for widgets and the error model;
- table work (mouse range selection, filters, entity editing in a modal or on a separate page);
- further hardening of runtime, automated tests, and documentation.

## Changelog

[CHANGELOG_en.md](CHANGELOG_en.md).

## License

MIT License. See [LICENSE](LICENSE).
