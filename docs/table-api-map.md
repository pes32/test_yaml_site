# Карта публичного и внутреннего API таблицы

## Публичная поверхность

Внешняя интеграция таблицы в приложение:

- тип виджета `table` регистрируется в `frontend/js/widgets/factory.ts` и резолвит `TableWidget.vue`;
- список имён attrs для prefetch по DSL `table_attrs`: `resolveTableDependencies(fragment)` в `frontend/js/shared/table_attr_dependencies.ts` (ожидается объект с полем `table_attrs` — строка DSL, см. парсер в `table_parse_attrs.ts`).

Внутри каталога `frontend/js/widgets/table/` нет отдельного пакетного `index.ts` или `table_api.ts`: остальной код считается private implementation detail и не должен импортироваться снаружи feature без явного решения о контракте.

## Контракт и слой состояния

- `table_contract.ts` — внутренние типы table runtime: `TableRuntimeState`, `TableRuntimeComputed`, `TableRuntimeMethods`, `TableRuntimeDomSurface`, narrow runtime surfaces, `TableRuntimeVm`, `TableWidgetSetupBindings`, schema/rows/selection/context-menu/cell-widget contracts.
- `table_errors.ts` — recoverable table errors, нормализация; map валидации ячеек (`setTableValidationError`, `tableValidationKey`).
- `table_store.ts` — `createTableStore`: начальное table-specific store state.
- `table_state_core.ts` — core snapshot, `normalizeTableCoreState`, typed `dispatchTableCommand` для неизменяемого core state.
- `table_runtime_state.ts` — склейка core/store с Vue reactive surface, публичный `dispatchTableCommand` на VM.
- `table_invariants.ts` — проверки/инварианты состояния.
- `table_runtime_commands.ts` — вспомогательные команды/патчи ячеек, синхронизация с runtime.
- `table_row_provider.ts` — provider helpers для `auto` mode: `local-full` vs `remote-paged`, initial window, loaded ranges, request/cache merge.
- `table_page_bridge.ts` — host bridge: `createTablePageBridge` (attrs, список опций, уведомления, recoverable errors). См. также блок [DOM And Page Integration](#dom-and-page-integration).

## `*_model.ts`: аудит (slice vs тонкий helper)

Цель — не плодить файлы без самостоятельной модели. Ниже: **классификация** (по объёму, роли и импортёрам), ориентир для рефакторинга.

| Файл | ~строк | Классификация | Основные экспорты | Ключевые импортёры |
|------|--------|----------------|-------------------|-------------------|
| `table_errors.ts` | 82 | **Slice** | `createTableRuntimeError`, `normalizeTableRuntimeError`, `setTableValidationError`, `tableValidationKey` | bridge, runtimes (ранее отдельный `table_validation_model.ts`) |
| `table_column_navigation.ts` | 61 | **Slice** | `firstUserColumnIndex`, `columnLetter`, `columnLettersForRuntimeColumns` | menu, selection, computed (ранее `table_column_headers_model.ts`) |
| `table_sort_model.ts` | 67 | **Slice** (core→runtime sort, порядок id) | `coreSortToRuntimeSort`, `buildOrderedRowIds` | `table_runtime_state`, `table_data_runtime`, `table_view_model` |
| `table_history_model.ts` | 72 | **Slice** | `appendHistoryEntry`, `clone*`/`snapshotsEqual` | `table_history_runtime` |
| `table_lazy_load_model.ts` | 77 | **Legacy helper slice** | `appendRowsDedup`, `normalizeLazyChunkSize`, `splitLazyInitialRows`, `takeLazyChunk` | core append compatibility; local rows are no longer lazy-rendered |
| `table_virtual_model.ts` | 160 | **Slice** (virtual window math) | `buildVirtualWindow`, `virtualOffsetForRow`, measured-height helpers | `table_virtual_runtime`, tests |
| `table_row_provider.ts` | ~170 | **Slice** (row provider/cache) | `createRemoteProviderState`, `mergeRemoteWindow`, `rowsFromRemoteProviderState`, `LOCAL_FULL_MAX_ROWS` | `table_data_runtime`, tests |
| `table_format_rule_index.ts` | ~130 | **Pure slice** (remote format rules by `sourceIndex`) | `buildRemoteFormatRuleBuckets`, `getCachedRemoteFormatRuleBuckets` | `table_formatting_runtime`, tests |
| `table_context_menu_model.ts` | 87 | **Slice** (снимок меню; реэкспорт `rowIdAtDisplayIndex` из view) | `buildContextMenuSnapshot`, `isContextMenuSnapshotCurrent` | `table_menu_runtime`, `table_row_runtime` |
| `table_toolbar_model.ts` | 118 | **Slice** (тулбар + константы) | `createDefaultTableToolbarState`, константы цветов/типов, `tableToolbarIconSrc`, … | `useTableRuntime`, `table_runtime_computed`, `table_formatting_runtime`, `TableToolbar.vue` |
| `table_view_model.ts` | 119 | **Центральный derived слой** (display rows, индексы; тянет grouping + sort) | `buildTableViewModel`, `emptyTableViewModel`, `rowIdAtDisplayIndex`, … | многие runtimes |
| `table_editing_model.ts` | 160 | **Slice** | `createEditingSession`, `resolveEditingBoundary`, … | `table_editing_runtime`, `table_keyboard`, `table_state_core` |
| `table_grouping_model.ts` | 161 | **Slice** | `buildGroupedDisplayRows`, `buildFlatDisplayRows`, … | `table_view_model` |
| `table_selection_model.ts` | 292 | **Крупный slice** (display↔core, rect, identity) | `displayCellToCore`, `buildCoreSelectionFromDisplay`, … | runtimes, `table_selection`, … |
| `table_width_model.ts` | 328 | **Крупный slice** (ширины, auto-fit) | `captureInitialColumnWidths`, `autoFitColumnWidth`, … | `table_width_runtime`, `table_view_runtime`, `table_parse_attrs` |

**`table_internal.ts`:** необязательный **внутренний** barrel с явными re-export (без `export *`) — только внутри `frontend/js/widgets/table/`. **Потребители slice по умолчанию импортируют символ из файла-источника** (`./table_selection_model.ts` и т.п.); barrel допустим, где уже сгруппированы реэкспорты и это уменьшает шум или дублирования импортов, но не является обязательным слоем между каждой парой модулей. Снаружи feature не импортировать.

## Разбор и чистая логика

- `table_parse_attrs.ts` — canonical parser `table_attrs`, schema/header rows и shared attr helpers.
- `table_selectors.ts` — typed pure derived cell/table helpers для display actions, cell options и defaults.
- `table_clipboard.ts` — TSV serialization/deserialization и clipboard data helpers.
- `table_format.ts` — value formatting.
- `table_sort.ts` — sort helpers.
- `table_grouping.ts` — typed grouping/display rows helpers.
- `table_utils.ts` — низкоуровневые row/column helpers.

## Модули runtime

**Orchestration:** `table_runtime_registry.ts` (`createTableRuntime`, карта `tableRuntimeMethods`), `useTableRuntime.ts` — сборка слоёв и bindings к `TableWidget.vue`.

**Data:** `table_data_runtime.ts` (мутации данных, provider init, remote row queries, grouping view; `tableData` полный только в `local-full`), `table_row_runtime.ts` (строки, identity), `table_row_provider.ts` (remote cache/window helpers).

**View:** `table_view_runtime.ts`, `table_virtual_runtime.ts`, `table_width_runtime.ts`, `table_widget_helpers.ts`, `table_formatting_runtime.ts` (виртуальное окно, scroll/focus API, ширины, геометрия DOM, стили ячеек в runtime).

**Editing:** `table_editing_runtime.ts`, `table_cell_runtime.ts` (сессия редактирования, значение/редактор ячейки).

**Selection:** `table_selection.ts`, `table_interactions.ts`, `table_keyboard.ts`, `table_jump.ts`, `table_clipboard_runtime.ts` (выделение, указатель, навигация с клавиатры, прыжки, буфер обмена).

**Menu:** `table_menu_runtime.ts` (снимок контекстного меню, пункты, действия).

**History:** `table_history_runtime.ts` (undo/redo).

**Embedded:** `table_embedded_widgets.ts` (резолв встроенных cell-виджетов по типу).

## Модель и производные срезы

Полный аудит и классификация `*_model.ts` — см. раздел **«`*_model.ts`: аудит»** выше.

## Импорты встроенных виджетов

Table cell editors резолвятся через общий `WidgetDefinitionRegistry` с embedded allowlist (`str`, `int`, `float`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`) и хелпер `tableEmbeddedWidgetComponent` в `table_embedded_widgets.ts`. `TableWidget.vue` не импортирует standalone widget components напрямую; новые table-cell capabilities проходят через typed widget exposes и общий lifecycle contract.

## DOM и интеграция со страницей

- `table_dom.ts` — DOM helper boundary.
- `table_measurement.ts` — table/header measurement helpers.
- `table_scroll.ts` — scroll helpers.
- `table_sticky_header.ts` — sticky-header synchronization.
- **Host bridge** — один раз: [`table_page_bridge.ts` в Contract And State Layer](#contract-and-state-layer) (`createTablePageBridge`).
- `table_notifications.ts` — user-facing table notifications.
- `table_debug.ts` — debug-only table helpers.
- `table_platform.ts` — platform-specific ветвления (например macOS).
- runtime method groups типизируются через `TableRuntimeMethodSubset` в `table_contract.ts`.

## Ограниченная поверхность

Конкретные запреты:

- **Не импортировать table-модули из `.js`.** Runtime и виджет — только `.ts` / `.vue`; смешивание с legacy `.js` в графе таблицы не допускается.
- **Не импортировать `table_internal.ts` (и прочие внутренние куски каталога) снаружи `frontend/js/widgets/table/`.** Снаружи feature — только явно оговорённые точки (`table_contract`, bridge, shared deps и т.д.; см. [Public surface](#public-surface)).
- **Не считать registration names API.** Имена ключей в `tableRuntimeMethods`, имён виджетов/attrs в registry, строковые id слоёв — это wiring сборки, а не стабильный публичный контракт без отдельного описания в `table_contract` / bridge.
