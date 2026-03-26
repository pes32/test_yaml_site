# Table Subsystem

## Role

`table` — отдельная frontend feature, а не “просто ещё один widget”.

У таблицы есть:

- собственный runtime store;
- собственный schema/parser для `table_attrs`;
- отдельные interaction-модули;
- отдельный contract для embedded cell widgets;
- свои performance rules для lazy/grouping/sticky flows.

## Module layout

Слой таблицы теперь разделён на более явные зоны:

- `table_api.js` — внешний feature API;
- `table_widget.js` — Vue/UI orchestration;
- `table_selectors.js` — pure helpers и derived cell/table data;
- `table_parse_attrs.js` — разбор `table_attrs` в runtime schema;
- `table_format.js` — format helpers;
- `table_utils.js` — низкоуровневые row/column helpers;
- `table_grouping.js`
- `table_selection.js`
- `table_sort.js`
- `table_context_menu.js`
- `table_keyboard.js`
- `table_clipboard.js`
- `table_sticky.js`
- `table_jump.js`
- `table_widget_helpers.js` — DOM/geometry helpers;
- `table_core.js` — внутренний engine namespace;
- `index.js` — единая точка экспорта feature.

## External contract

Снаружи таблица зависит только от:

- widget config таблицы;
- attrs map из page runtime;
- list/widget dependencies, которые page runtime может догрузить заранее;
- импортированного widget layer для embedded cell editors.

Feature API:

- `resolveDependencies(tableAttrConfig)`
- `getListOptions(attrsByName, sourceName)`
- `createStore(options)`

Таблица не делает backend calls самостоятельно.

## State model

Table store хранит только table-specific runtime:

- sorting state;
- grouping state;
- loading/lazy state;
- runtime preferences.

Page runtime не знает внутренних table деталей. Он отдаёт таблице входные данные и подгружает зависимости, которые таблица объявляет через `resolveDependencies(...)`.

## Pure/UI boundary

Главное правило после рефакторинга:

- `table_widget.js` отвечает за DOM, Vue lifecycle, focus/edit orchestration;
- `table_selectors.js` отвечает за pure derived logic.

В `table_selectors.js` теперь живут, например:

- cell display actions/classes/styles;
- `getColumnAttrConfig(...)`;
- `getColumnTableCellOptions(...)`;
- `normalizeCellWidgetValue(...)`;
- default/blank cell value helpers;
- lazy enable resolution.

Это уменьшает смешение UI-поведения и data-shaping внутри Vue component.

## Rendering model

`table_widget.js`:

- создаёт table runtime store;
- строит columns/schema из `table_attrs`;
- рендерит body/header/group rows;
- делегирует pure data-решения в `table_selectors.js`;
- делегирует feature-поведение в `table_*` interaction modules.

## Integration with page runtime

Если `table_attrs` содержит внешние list/widget refs:

1. `resolveDependencies` извлекает список attr names;
2. `page.js` через `attrs_loader.js` догружает их из `/api/attrs`;
3. таблица получает уже нормализованный `attrsByName` через runtime service;
4. `table_widget.js` использует только этот injected/runtime слой, а не global/window.

## Error handling

Ошибки table-runtime теперь поднимаются в общий app feedback layer:

- пользовательские сбои группировки, пересчёта и clipboard path идут через frontend error model;
- snackbar и error panels формируются page-level runtime, а не `$root`-магией;
- локальные field-validation состояния внутри embedded widgets остаются локальными и не смешиваются с app runtime errors.

## What was removed

Из table flow убраны:

- `window.TableWidgetCore`
- `window.TableSubsystem`
- доступ к `window.pageData`
- обязательная зависимость от `$root.allAttrs`
- знание backend transport/envelope shape

Все связи теперь import-based или inject-based.
