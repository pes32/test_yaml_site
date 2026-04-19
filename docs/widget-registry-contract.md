# Widget Registry Contract

## Purpose

`frontend/js/widgets/factory.ts` является `WidgetDefinitionRegistry`.

Его задача:

- дать единый contract для render path;
- зафиксировать capabilities виджета;
- формализовать lifecycle draft-commit;
- держать ad hoc branching по `widget.type` вне runtime call-sites.

## WidgetDefinition

Каждое definition обязано описывать:

- `type`
- `capabilities`
- `resolveComponent()`
- `prefetch()`
- `createLifecycleHandle()`

`resolveComponent()` должен быть side-effect-free относительно active UI state. Поздний async resolve допускается только как cache warmup и не имеет права менять активное меню, вкладку или модалку.

## WidgetCapabilities

Формат capabilities фиксирован:

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

Семантика:

- `stateful` означает, что widget участвует в runtime value contract и получает committed value из `page_session_store`;
- `draftCommit` означает, что widget может держать локальный draft и получает lifecycle handle;
- `emitsInput` и `emitsExecute` читает только `WidgetRenderer`;
- `runtimeFeatures` читает только widget runtime bridge.

## WidgetRenderer Rules

`frontend/js/widgets/common/WidgetRenderer.vue` является единственной точкой, где:

- выбирается `WidgetDefinition`;
- собирается `resolvedWidgetConfig`;
- навешиваются conditional listeners;
- создаётся и bind/unbind/dispose lifecycle handle;
- публикуется widget runtime bridge.

Только widgets с `capabilities.draftCommit === true` получают активный lifecycle handle и могут участвовать в boundary commit.

## Lifecycle Handle

`WidgetLifecycleHandle` фиксирован так:

- `bind(instance)`
- `unbind()`
- `commitPendingState(context)`
- `dispose()`

Правила:

- `bind()` вызывает только `WidgetRenderer`;
- повторный bind на тот же handle допустим только как controlled rebind;
- `unbind()` и `dispose()` обязаны быть идемпотентными;
- вызов `commitPendingState()` после `unbind()` или `dispose()` должен возвращать `noop`;
- silent swallow ошибок запрещён.

`LifecycleCommitResult` фиксирован так:

- `{ status: 'noop' | 'committed' }`
- `{ status: 'blocked', severity: 'recoverable' | 'fatal', error }`

## Direct Lifecycle

Registry использует только прямой instance-scoped lifecycle:

- если draft-capable виджет реализует `commitPendingState(context)`, используется он;
- если у instance нет `commitPendingState`, handle возвращает `noop`;
- локальный draft state по-прежнему живёт внутри виджета;
- committed state по-прежнему записывается только в `page_session_store`.

`commitDraft(...)`, `isDraftEditing` и field-error probing больше не являются registry-level fallback contract. Виджет может держать такие методы локально, но boundary commit идёт только через `commitPendingState`.

## Runtime Bridge

Host services публикуются в widget subtree только через runtime bridge.

Схема:

1. page host публикует internal services object;
2. `WidgetRenderer` смотрит `runtimeFeatures` текущего definition;
3. bridge публикует вниз только соответствующие injections;
4. если definition требует отсутствующий service, runtime пишет warning.

Стабильные injections:

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

Draft-lifecycle injections:

- `setActiveWidgetLifecycle`
- `clearActiveWidgetLifecycle`

## Unknown Widget Policy

Unknown widget fallback допускается только в render-time unknown path.

Правила:

- неизвестный тип рендерится через `SimpleInputWidget`;
- unknown definition имеет пустые capabilities;
- lifecycle для unknown type всегда no-op;
- runtimeFeatures для unknown type всегда пустые;
- warning логируется единообразно один раз на тип/сессию.

Неизвестный тип не должен наследовать draft/runtime policy от `str` “по смыслу”.

## Restricted Surface

Запрещены:

- tuple registry exports как основной контракт;
- ad hoc branching по `widget.type` вне registry/contract layer;
- legacy draft-controller injections `setActiveDraftWidgetController` / `clearActiveDraftWidgetController`.

Новые runtime-интеграции должны опираться только на `WidgetDefinitionRegistry`, capabilities и lifecycle handle contract.

## Current Status Matrix

- TS/Composition API widgets: `str`, `text`, `int`, `float`, `button`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `img`, `list`, `voc`, `split_button`;
- `table` работает как typed controller feature;
- `frontend/js` содержит TypeScript/Vue source для action runtime, datetime helpers, IP helpers, voc helpers, page/bootstrap glue, API/attrs/modal flows and diagnostics;
- shared common components use typed `<script setup lang="ts">`.
