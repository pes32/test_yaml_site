# Runtime Architecture

## Overview

Frontend runtime теперь разделён на несколько явных границ:

1. backend собирает versioned snapshot из YAML;
2. transport layer отдаёт только нормализованный envelope;
3. page runtime раскладывает payload по stores и orchestration services;
4. widget tree рендерится через `WidgetDefinitionRegistry` и не знает про raw backend shape.

`frontend/js/page.js` после рефакторинга остаётся thin host/facade для `PageApp.vue`: он поднимает stores, lifecycle hooks и делегирует runtime flows, но не содержит widget-specific branching и не раздаёт детям прямой доступ к page-owned state.

## Ownership State

### Snapshot-derived state

`frontend/js/runtime/page_store.js` владеет только snapshot-derived state:

- `pageName`
- `snapshotVersion`
- `diagnostics`
- `pageConfig`
- `attrsByName`

Менять этот store могут только bootstrap/attrs/modal merge flows.

### Session/page state

`frontend/js/runtime/page_session_store.js` хранит только долгоживущий committed state страницы:

- `widgetValues`
- `loadedAttrNames`
- `loadedModalIds`
- `parsedGui`

`widgetValues` остаётся единственным источником истины для committed значений page/modal widgets. Локальный draft живёт только внутри самого виджета и не переживает unmount/remount без коммита.

### Draft boundary runtime

`frontend/js/runtime/page_draft_runtime.ts` владеет:

- `activeLifecycleHandle`
- `boundaryToken`
- `pendingBoundaryPromise`

Этот runtime не знает ни про layout страницы, ни про modal cache, ни про committed widget values. Его задача одна: сериализовать boundary actions и вызвать `commitPendingState()` у активного lifecycle handle.

### Modal UI state

`frontend/js/runtime/modal_runtime_store.ts` хранит только ephemeral modal UI state:

- `activeModalId`
- `modalConfig`
- `status`
- `activeTabIndex`
- `collapsedSections`
- `scrollTopByView`
- `restoreTargetViewId`
- `error`
- `requestToken`

Кэш modal definitions и список уже загруженных modal ids по-прежнему живут в `page_session_store.js`.

### Notifications

`frontend/js/runtime/page_notification_store.ts` владеет только snackbar state и timer bookkeeping:

- `snackbar`
- `snackbarHideTimerId`
- `snackbarSeq`

Никто, кроме actions этого store, не пишет туда напрямую.

## Widget Registry Contract

Базовый frontend render/runtime contract теперь идёт через `frontend/js/widgets/factory.ts`, который стал `WidgetDefinitionRegistry`.

Каждое определение виджета фиксирует:

- `type`
- `resolveComponent()`
- `prefetch()`
- `capabilities`
- `createLifecycleHandle()`

`WidgetCapabilities` формализованы так:

- `stateful`
- `draftCommit`
- `emitsInput`
- `emitsExecute`
- `runtimeFeatures`

Поддерживаемые `runtimeFeatures`:

- `confirmModal`
- `modalControl`
- `notifications`
- `errorHandling`
- `attrsAccess`

Правила:

- только `WidgetRenderer` читает `emitsInput` и `emitsExecute`;
- только draft runtime и `WidgetRenderer` работают с lifecycle handle;
- только runtime bridge публикует host services в widget subtree;
- branching по `widget.type` вне registry/contract layer больше не должен разрастаться по runtime call-sites.

Полный contract описан в [docs/widget-registry-contract.md](widget-registry-contract.md).

## Widget Lifecycle

Lifecycle handle теперь строгий и instance-scoped:

- `bind(instance)`
- `unbind()`
- `commitPendingState(context)`
- `dispose()`

Семантика:

- `bind()` вызывает только `WidgetRenderer` после mount/rebind;
- `unbind()` вызывает только `WidgetRenderer` при unmount или смене child instance;
- `dispose()` финализирует handle, вызывает `unbind()` и очищает ресурсы;
- `commitPendingState()` всегда async и всегда возвращает `LifecycleCommitResult`.

`LifecycleCommitResult` фиксирован:

- `{ status: 'noop' | 'committed' }`
- `{ status: 'blocked', severity: 'recoverable' | 'fatal', error }`

Unknown widget fallback теперь разрешён только как render-time unknown path: компонент рендерится через `StringWidget`, но definition остаётся с пустыми capabilities, no-op lifecycle и единообразным warning один раз на тип/сессию.

## Runtime Bridge

Host services больше не инжектятся напрямую из `page.js` в произвольный subtree.

Новая схема такая:

1. `page.js` публикует один internal host-services object;
2. `WidgetRenderer.vue` строит runtime bridge из текущего `WidgetDefinition`;
3. bridge прокидывает вниз только допустимые для этого definition services;
4. если definition требует service, которого host не дал, runtime пишет жёсткий warning.

Стабильными injection names остаются:

- `getConfirmModal`
- `openUiModal`
- `closeUiModal`
- `showAppNotification`
- `reportAppError`
- `handleRecoverableAppError`
- `getWidgetAttrsByName`
- `getWidgetRuntimeValueByName`
- `getAllAttrsMap`
- `getModalRuntimeState`
- `getModalRuntimeController`

Для draft runtime финальным API стали:

- `setActiveWidgetLifecycle`
- `clearActiveWidgetLifecycle`

## Boundary Commit Order

Любой boundary action теперь идёт через `draftRuntime.runBoundaryAction(kind, action)`.

Порядок фиксирован:

1. запрос boundary action;
2. single-flight lock;
3. `commitPendingState()` активного lifecycle handle;
4. если commit дал `noop` или `committed`, выполняется action;
5. если commit дал `blocked/recoverable`, action отменяется и идёт recoverable UI path;
6. если commit дал `blocked/fatal`, action отменяется и включается host-level fatal path.

Пока pending commit или boundary action не завершён, повторный trigger не создаёт вторую операцию и получает текущий pending promise.

Сейчас через этот путь идут:

- page navigation (`menu/tab/hash`)
- `execute`
- modal close

## Modal Anti-Race Policy

Modal open path использует `requestToken`.

Правила:

- только последний token имеет право писать `status`, `modalConfig`, `error` и `restoreTargetViewId`;
- `closeModal`, page unmount и reset modal store инвалидируют текущий token;
- поздние async results после invalidate игнорируются;
- modal/page prefetch могут прогревать только loader/cache state и не меняют active UI state.

`frontend/js/runtime/modal_runtime_service.ts` отвечает за orchestration open path, а `frontend/js/widgets/common/ModalManager.vue` только читает modal state и вызывает controller/actions.

## Page Flow

Нормальный startup теперь выглядит так:

1. `page.js` читает embed bootstrap или вызывает `page_bootstrap_flow.loadPageConfig`;
2. `page_store.js` принимает snapshot-derived state;
3. `page_session_store.js` инициализирует committed widget values и parsed GUI;
4. `page_view_runtime.js` настраивает active menu/tab/hash/scroll path;
5. `attrs_loader.js` догружает attrs только для нужных widgets и зависимостей таблицы;
6. `WidgetRenderer.vue` резолвит `WidgetDefinition`, bridge и lifecycle handle;
7. `PageApp.vue` рендерит только selectors-derived view + feedback layers.

## Error And Feedback Model

`frontend/js/runtime/error_model.ts` остаётся единым frontend error contract.

UI feedback разделён так:

- blocking page error — host-level fatal path;
- recoverable runtime errors — error model + snackbar;
- diagnostics — snapshot/backend diagnostics;
- widget-local validation — локальная ошибка виджета до boundary/local commit.

## Related Documents

- [docs/widget-registry-contract.md](widget-registry-contract.md)
- [docs/table-subsystem.md](table-subsystem.md)
- [docs/api-contracts.md](api-contracts.md)
- [docs/yaml-dsl.md](yaml-dsl.md)
