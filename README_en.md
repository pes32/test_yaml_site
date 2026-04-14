# Yamls - YAML System

[Русская версия](README.md)

# From the author

yamls.ru

- This is a clickable mockup of a system built on YAMLs. I chose YAMLs as the way to describe attributes and the interface because they are simple enough for almost anyone to write. My previous team and I arrived at this approach after building countless line-of-business systems. At this point, the system already includes the most common input widgets, which should cover most typical tasks.
- I recommend clicking through all the widgets by hand. The core fields and table are already quite usable, and the remaining widgets are being moved toward the newer frontend runtime step by step.
- The current system is intentionally exaggerated and implemented entirely in YAML. That does not mean this is always the right way to do things, but it is at least something worth thinking about.
- Database support is planned. In fact, the database layer is already partially wired in, but it does not work yet. The main question is how exactly to integrate it. If I follow the current logic, then functions and business logic should probably be described in PostgreSQL, as the simplest available language for this purpose, and invoked from the current YAML attributes. I am not sure that is a good idea, but building a full custom backend of my own also feels pointless and like wasted time.
- Maybe one day I will add diagrams and some integrations. Or more widgets and other functionality. I do not know yet.
- Sudoku was added just for fun, since I already had it written in Python. It can be removed from the system without any pain.
- The total budget for building this system was no more than $100, and probably closer to $40-60. In terms of time, it took about a month.
- I was not aiming to build a multilingual product, and I did not expect an audience outside the Russian-speaking segment. Sorry, but you will have to use a translator on the demo pages. I hope the widgets turned out expressive enough for their purpose to be understood even without translation.
- What follows after this is AI-generated text. Whether you want to read it is up to you. You have been warned.

## About

Yamls - YAML System is a YAML-driven UI engine for clickable portals and interface prototypes: pages are described with YAML files, the backend compiles them into a snapshot, and the frontend renders the final interface through a Vite bundle. The current release is a working clickable mockup, not a finished low-code platform.

Unlike a typical form builder or admin generator, this project is driven by declarative page and widget definitions rather than a database schema or a visual editor. The backend owns snapshot assembly and validation, while the frontend runtime executes that contract.

## Project status

- Public project name: `Yamls - YAML System`.
- Current release: `v.0.2 л.`.
- Current scope: clickable mockup without built-in DB integration in the main YAML flow.
- Already solid: snapshot build pipeline, YAML DSL, core widget runtime, production-like startup with `waitress + nginx`.
- Still roadmap: DB-backed forms, persistence, full data sources for YAML widgets, completed `select_attrs`.

## Why use it

- Describe UI screens in YAML instead of hand-coding every page.
- Validate and compile configuration into a backend snapshot.
- Render a UI runtime with widgets such as `str`, `text`, `int`, `float`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`, `img`, `button`, `split_button`, and `table`.
- Use built-in debug tooling and read-only SQL diagnostics.
- Run the stack locally in a topology close to production: `public nginx -> waitress on 127.0.0.1`.

## Demo vs author-specific territory

- Engine-focused examples live in [pages/2_widget_demo](pages/2_widget_demo) and in [docs/yaml-dsl.md](docs/yaml-dsl.md).
- Architecture and contracts are documented in [docs/runtime-architecture.md](docs/runtime-architecture.md), [docs/server-runtime.md](docs/server-runtime.md), [docs/api-contracts.md](docs/api-contracts.md), and [docs/table-subsystem.md](docs/table-subsystem.md).
- The `about_author` page and the hardcoded Postgres section are demo/author materials, not the core engine API.

## Repository layout

- `backend/` — Flask backend, snapshot builder, validation, API, debug tooling.
- `pages/` — YAML pages and attribute definitions.
- `frontend/` — styles, widgets, runtime, and built bundle.
- `tooling/vite/` — frontend toolchain, build, and typecheck.
- `templates/` — HTML templates, icons, and related static assets.
- `scripts/`, `settings/`, `nginx/`, `run/`, `logs/`, `ssl/` — local server/runtime startup and generated runtime files.
- `docs/` — architecture and operations documentation.

## Quick start

### Requirements

- `python3` 3.8+
- `node` and `npm`
- `nginx` in `PATH` for `./start.sh` and `./start_debug.sh`
- `openssl` for the local self-signed certificate

### First run

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
npm --prefix tooling/vite ci
```

If `pip install -r requirements.txt` fails with errors such as `No matching distribution found for waitress==3.0.0` or `Werkzeug==3.0.6`, the virtualenv was most likely created with an older Python. Use `Python 3.8+` for this repository.

If you need local overrides, create `settings/production.env` and/or `settings/debug.env`. Default values now live in `settings/production.defaults.env` and `settings/debug.defaults.env`. The legacy root-level paths are still accepted as a fallback.

### Debug mode

```bash
./start_debug.sh
```

### Local production-like mode

```bash
./start.sh
```

### Stop

```bash
./stop.sh
```

## Useful commands

Validate YAML configuration:

```bash
python3 -m backend.tools.validate_config
python3 -m backend.tools.validate_config --json
```

Frontend typecheck:

```bash
npm --prefix tooling/vite run typecheck
npm --prefix tooling/vite run typecheck:table
```

Frontend build:

```bash
npm --prefix tooling/vite run build
```

## Production and safety

- The stack already supports a production-like topology, but the project is still best presented as a demo/runtime prototype rather than a finished multi-user platform.
- Debug routes are disabled by default in production mode.
- There is no complete auth/permission model yet.
- The main YAML flow does not provide DB persistence yet.
- The current server/runtime environment is documented in [docs/server-runtime.md](docs/server-runtime.md). For a public server, the target topology is still `public nginx -> waitress on 127.0.0.1`, but deployment instructions should be written for the actual infrastructure.

## Current limitations

- DB integration is partial: PostgreSQL tooling and debug SQL exist, but YAML forms do not yet have a completed data-entry/save pipeline.
- `select_attrs` is reserved in the DSL, but the promised fill/selection mechanism is not implemented yet.
- This is not a visual editor or a self-service builder for non-technical end users.
- Public contracts are still evolving, so external integrations should treat the project as actively changing.

## Roadmap

See [ROADMAP_en.md](ROADMAP_en.md). The main direction after `v.0.2 л.` is:

- introduce DB integration without breaking YAML contracts;
- formalize data sources and save flow;
- continue runtime stabilization and documentation cleanup;
- expand demo coverage gradually.

## Changelog

Changelog: [CHANGELOG_en.md](CHANGELOG_en.md).

## License

This project is released under the MIT License. See [LICENSE](LICENSE).
