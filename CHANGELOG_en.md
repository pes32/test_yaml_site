# Changelog

[Русская версия](CHANGELOG.md)

## v.0.25 л.

- Moved key frontend areas to Vue SFC and TypeScript modules.
- Refactored the table runtime: removed legacy table `.js` modules, import-order registration, and temporary wrappers.
- Removed confirmed orphan assets and a broken frontend script.
- Updated runtime, contracts, server startup, and table subsystem documentation.
- Known remaining item: strict `typecheck`/`typecheck:table` for the table runtime still needs a dedicated pass.

## v.0.2 л.

- Clickable mockup without DB-backed persistence.
- MD3-inspired visual style.
- Added `voc`, `img`, `split_button`, and `table` widgets.
- Improved the rest of the widget/runtime layers.
- Exposed part of the YAML materials directly in the UI for review.
- Added author materials.
- Introduced explicit versioning.

## v.0.1

Date: `05.2025`

- Initial implementation of the idea.
- Built the first YAML sketches and the initial assembly layer from earlier projects.
