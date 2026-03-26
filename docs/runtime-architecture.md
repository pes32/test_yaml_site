# Runtime Architecture

## Overview

Система теперь разделена на четыре слоя:

1. backend собирает versioned snapshot из YAML;
2. transport layer отдаёт только envelope-контракты;
3. frontend runtime нормализует transport в page/session/error state;
4. widget/features рендерят UI уже без знания raw backend payload shape.

`legacy`-загрузчиков, browser globals для page runtime и ручной цепочки `<script>` больше нет.

## Dependency rules

Разрешённый граф зависимостей:

`entry -> app/runtime -> features -> shared`

Правила:

- `tooling/vite/src/entry/*.ts` не содержат бизнес-логики;
- runtime знает transport и store boundaries;
- feature-модули не импортируют entrypoints;
- widget tree не разбирает raw envelope;
- widget не мутирует page state напрямую;
- table получает только attrs/services через явный inject/import;
- diagnostics и runtime errors проходят через единый frontend contract.

## Frontend layers

### Vite entrypoints

- `tooling/vite/src/entry/page.ts`
- `tooling/vite/src/entry/debug.ts`

Они только поднимают bundle и CSS.

### Composition roots

- `frontend/js/page.js`
- `frontend/js/debug.js`

Их роль:

- создать Vue app;
- связать stores, async flow и shared UI;
- зарегистрировать feedback components;
- отдать feature-дереву только нужные provide/inject service hooks.

### Runtime services

`frontend/js/runtime/` теперь разбит по ответственности:

- `bootstrap.js` — чтение HTML bootstrap;
- `api_client.js` — transport normalization и HTTP boundary;
- `page_bootstrap_flow.js` — начальная загрузка page config;
- `attrs_loader.js` — догрузка attrs и table dependencies;
- `modal_flow.js` — догрузка modal definitions;
- `modal_runtime_service.js` — modal session/runtime orchestration;
- `execute_flow.js` — submit/execute path;
- `page_selectors.js` — derived/read-only helpers для page runtime;
- `error_model.js` — единый frontend error contract;
- `diagnostics.js` — нормализация и presentation helpers для diagnostics.

### Stores

Runtime state теперь разделён намеренно.

`frontend/js/runtime/page_store.js` хранит только snapshot-derived state:

- `pageName`
- `snapshotVersion`
- `diagnostics`
- `pageConfig`
- `attrsByName`

`frontend/js/runtime/page_session_store.js` хранит session/runtime state страницы:

- `widgetValues`
- `loadedAttrNames`
- `loadedModalIds`
- `parsedGui`

`page.js` держит отдельно UI/session state:

- активное меню и вкладку;
- collapsed sections;
- scroll restoration;
- modal runtime controller/state wiring;
- snackbar;
- lifecycle флаги hash-listener.

И отдельно async/error state:

- page loading;
- blocking page error;
- recoverable runtime errors.

### Feedback layer

Визуальный feedback теперь оформлен явно:

- `frontend/js/widgets/feedback.js`
- `frontend/css/components/feedback.css`

Что показывает frontend:

- diagnostics panel из snapshot/backend;
- error panels для recoverable и blocking runtime errors;
- snackbar для user-facing async notifications.

Console logging остаётся, но UI больше не теряет ошибки и diagnostics внутри store “про запас”.

## Error model

`frontend/js/runtime/error_model.js` нормализует ошибки в единый shape:

- `kind`
- `scope`
- `recoverable`
- `message`
- `code`
- `status`
- `diagnostics`
- `snapshotVersion`
- `details`

Scopes сейчас используются как минимум для:

- `page`
- `attrs`
- `modal`
- `execute`
- `debug`

Это гарантирует, что runtime не смешивает HTTP errors, domain failures и UI presentation ad hoc-строками.

## Diagnostics flow

Diagnostics живут по следующей цепочке:

1. backend кладёт diagnostics в snapshot/envelope;
2. `api_client.js` и store helpers сохраняют их в runtime state;
3. `diagnostics.js` приводит их к frontend-friendly виду;
4. `feedback.js` рендерит diagnostics panel;
5. runtime services дополнительно логируют diagnostics в console для debug-mode.

## Page flow

Нормальный page startup:

1. `page.js` читает bootstrap из `<script id="page-data">`;
2. при отсутствии bootstrap вызывает `page_bootstrap_flow.loadPageConfig`;
3. `page_store.js` принимает snapshot-derived state;
4. `page_session_store.js` и `page_selectors.js` строят runtime/session view;
5. `attrs_loader.js` догружает attrs только для активного view и table dependencies;
6. template рендерит diagnostics, error panels и widget tree.

## Modal flow

Modal path теперь такой:

1. widget инициирует `command: "<modal> -ui"`;
2. `page.js` делегирует open/close/tab/collapse в `modal_runtime_service.js`;
3. `modal_flow.js` получает `/api/modal-gui`, мержит attrs в `page_store.js` и обновляет `page_session_store.js`;
4. `widgets/modal_manager.js` только рендерит modal runtime state и больше не знает про backend/loading path;
5. ошибки modal path нормализуются через `error_model.js`, а не уходят в silent console-only failures.

## Debug flow

`frontend/js/debug.js` использует тот же runtime подход:

- API calls идут только через `api_client.js`;
- debug ошибки проходят через `error_model.js`;
- diagnostics из snapshot/debug routes показываются в diagnostics panel.

## Table boundary

Table остаётся отдельной feature-подсистемой, но важная граница теперь формализована:

- `table_widget.js` отвечает за Vue/UI orchestration;
- `table_selectors.js` держит pure derived helpers для cell display, defaults и attr lookup;
- `table_api.js` остаётся внешним feature API;
- остальной `table_*` слой обслуживает sorting/grouping/selection/keyboard/sticky/clipboard.

Детали вынесены в `docs/table-subsystem.md`.

## Typed boundaries

Канонические transport/domain reference типы лежат в:

- `tooling/vite/src/contracts/api.ts`
- `tooling/vite/src/contracts/table.ts`

Их задача — фиксировать границы между backend envelope, runtime store и feature contracts. Внутренний runtime пока остаётся на `.js`, но границы между подсистемами уже нормализованы и документированы.
