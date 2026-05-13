# Changelog

[Russian version](CHANGELOG.md)

## v.0.5 л.

Date: `05.2026`

- **Table v3:**
  - Virtual scrolling and sequential window loading for database-backed tables
  - Minor table-editor improvements
- **Auth and roles:**
  - `admin` — database and system administration
  - `user` — no access to `/user_settings`
- **Database integration:**
  - Default connection from `database/db_settings.yaml`
  - Connection settings in the UI
  - DB bootstrap script: `database/init_db.sql`
  - Create tables and columns from the UI
  - Column configuration from the UI

## v.0.375 л.

Date: `05.2026`

- **Table v2.** Editor support for tables.

## v.0.25 л.

Date: `04.2026`

- Migrated key frontend areas to Vue SFCs and TypeScript modules.
- Extensive refactoring.

## v.0.2 л.

Date: `03.2026`

- Clickable mockup without integrated DB persistence in the main YAML flow.
- MD3-inspired visual language.
- Added `voc`, `img`, `split_button`, and `table` widgets.
- Improved the remaining widgets and runtime layers.
- Surfaced part of the YAML materials in the UI for review.
- Added author-specific demo content.
- Introduced explicit versioning.

## v.0.1

Date: `08.2025`

- First implementation of the idea.
- Initial YAML sketches and assembly layer from earlier projects.
