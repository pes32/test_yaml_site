# Контракт реестра виджетов

## Назначение

`frontend/js/widgets/factory.ts` является `WidgetDefinitionRegistry`.

Его задача:

- дать единый contract для render path;
- зафиксировать capabilities виджета;
- формализовать lifecycle draft-commit;
- держать ad hoc branching по `widget.type` вне runtime call-sites;

## Версионирование контракта

Изменения в lifecycle, capabilities или наборе bridge-инъекций совместимы не всегда. Чтобы старые виджеты/host не ломались **молча**, контракт версионируется.

- **Поле в коде:** `REGISTRY_CONTRACT_VERSION` экспортируется из [`frontend/js/widgets/factory.ts`](../frontend/js/widgets/factory.ts). Host/page runtime может при старте сверять ожидаемую версию с фактической и логировать/фейлить при несовпадении major.
- **Когда bump:**
  - **major:** снятие/переименование capability, `runtimeFeatures`, метода handle, семантики `commitPendingState`, обязательной инъекции;
  - **minor:** новые опциональные feature, новые provide-ключи за флагом feature, расширение `LifecycleCommitResult` обратно совместимо;
  - **patch:** уточнение доков/типов без смены поведения.

Текущее значение в репозитории должно совпадать с описанием в этом документе.

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

### Обязательные флаги (ядро)

Они есть у **каждого** нормализованного definition (unknown — осознанно «все false / пусто»):

| Поле | Назначение | Кто читает |
|------|------------|------------|
| `stateful` | участие в runtime value contract, committed value из `page_session_store` | host / data path |
| `draftCommit` | виджет может держать локальный draft и получает lifecycle handle | `WidgetRenderer`, bridge lifecycle |
| `emitsInput` | подписка на `input` | `WidgetRenderer` |
| `emitsExecute` | подписка на `execute` | `WidgetRenderer` |

Семантика этих полей **стабильная**: менять смысл только с bump **major** версии контракта.

### Optional surface: `runtimeFeatures`

`runtimeFeatures` — **не** общий DI-контейнер: только заранее оговорённые ключи из union `WidgetRuntimeFeature`, каждый ключ включает **фиксированный** набор host-функций (см. `FEATURE_SERVICE_KEYS` в `frontend/js/runtime/widget_runtime_bridge.ts`).

**Стабильные feature** (продакшен-каталог, изменения только через review + версия контракта):

- `confirmModal`
- `modalControl`
- `notifications`
- `errorHandling`
- `attrsAccess`

**Экспериментальные** feature появляются только с явной пометкой в PR и здесь, до «промоушена» в стабильные; без этого запрещено плодить новые строки в `runtimeFeatures` «на будущее».

Семантика разделения:

- `emitsInput` / `emitsExecute` — только `WidgetRenderer`;
- `runtimeFeatures` — только widget runtime bridge и `assertRuntimeFeatureServices`.

## Правила WidgetRenderer

`frontend/js/widgets/common/WidgetRenderer.vue` является единственной точкой, где:

- выбирается `WidgetDefinition`;
- собирается `resolvedWidgetConfig`;
- навешиваются conditional listeners;
- создаётся и bind/unbind/dispose lifecycle handle;
- публикуется widget runtime bridge.

Только widgets с `capabilities.draftCommit === true` получают активный lifecycle handle и могут участвовать в boundary commit.

## Lifecycle handle

`WidgetLifecycleHandle` фиксирован так:

- `bind(instance)`
- `unbind()`
- `commitPendingState(context)`
- `dispose()`

Правила:

- `bind()` и связка `unbind()`→`bind()` вызывает **только** `WidgetRenderer` (см. [Controlled rebind](#controlled-rebind));
- `unbind()` и `dispose()` обязаны быть идемпотентными;
- вызов `commitPendingState()` после `unbind()` или `dispose()` должен возвращать `noop`;
- silent swallow ошибок запрещён.

`LifecycleCommitResult` фиксирован так:

- `{ status: 'noop' | 'committed' }`
- `{ status: 'blocked', severity: 'recoverable' | 'fatal', error }`

## Контролируемый rebind

**Инициатор:** только `WidgetRenderer` (`syncLifecycleBinding`, watchers на ref экземпляра и на смену definition).

**Когда разрешён повторный bind «того же» handle:**

- после обновления Vue-ref виджета при **том же** `WidgetDefinition` — выполняется **`unbind()` затем `bind(instance)`** на существующем handle;
- внешний код **не** вызывает `bind` на handle напрямую.

**Смена `WidgetDefinition` (тип виджета):** это **не** rebind: создаётся **новый** handle, предыдущий проходит `unbind` + `dispose`. Старый handle больше не валиден.

**Что с pending draft:**

- после `unbind` / `dispose` boundary commit через этот handle **не обязан** доставить draft в store;
- `WidgetRenderer` при смене типа виджета **не** вызывает `commitPendingState` автоматически;
- если продуктово нужно сохранить ввод — host/navigation слой обязан инициировать commit **до** смены binding или принять явную потерю черновика. Виджет после `unbind` не должен рассчитывать на отложенный flush через старый handle.

## Прямой lifecycle

Registry использует только прямой instance-scoped lifecycle:

- если draft-capable виджет реализует `commitPendingState(context)`, используется он;
- если у instance нет `commitPendingState`, handle возвращает `noop`;
- локальный draft state по-прежнему живёт внутри виджета;
- committed state по-прежнему записывается только в `page_session_store`.

`commitDraft(...)`, `isDraftEditing` и field-error probing больше не являются registry-level fallback contract. Виджет может держать такие методы локально, но boundary commit идёт только через `commitPendingState`.

## Runtime bridge

Host services публикуются в widget subtree только через runtime bridge.

Схема:

1. page host публикует internal services object;
2. `WidgetRenderer` смотрит `runtimeFeatures` текущего definition;
3. bridge публикует вниз только соответствующие injections;
4. если definition требует отсутствующий service, runtime пишет warning.

### Группы injections

Связка «feature → ключи» — в коде `FEATURE_SERVICE_KEYS`; ниже — сгруппировано для чтения.

**Modal**

- `getConfirmModal` — feature `confirmModal`
- `openUiModal`, `closeUiModal` — `modalControl`

**Modal / runtime state (стек модалок)**

- `getModalRuntimeState`, `getModalRuntimeController` — `modalControl`

**Notifications**

- `showAppNotification` — `notifications`

**Errors**

- `reportAppError`, `handleRecoverableAppError` — `errorHandling`

**Attrs и контекст страницы**

- `getWidgetAttrsByName`, `getWidgetRuntimeValueByName`, `getAllAttrsMap`, `getCurrentPageNameFromRuntime` — `attrsAccess`

**Lifecycle (draft boundary)**

- `setActiveWidgetLifecycle`, `clearActiveWidgetLifecycle` — не `runtimeFeatures`; пробрасываются только если `capabilities.draftCommit === true` (обёртки вызывают host из `WidgetRenderer`).

Дополнительные поля в типе host (например `runBoundaryAction`) не входят в таблицу feature→ключ, пока не станут частью официального bridge-контракта и не будут задокументированы здесь.

## Политика для неизвестных виджетов

Unknown widget fallback допускается только в render-time unknown path.

Правила:

- неизвестный тип рендерится через `SimpleInputWidget`;
- unknown definition имеет пустые capabilities;
- lifecycle для unknown type всегда no-op;
- runtimeFeatures для unknown type всегда пустые;
- warning логируется единообразно один раз на тип/сессию.

Неизвестный тип не должен наследовать draft/runtime policy от `str` “по смыслу”.

## Ограниченная поверхность

Запрещены:

- tuple registry exports как основной контракт;
- ad hoc branching по `widget.type` вне registry/contract layer;
- legacy draft-controller injections `setActiveDraftWidgetController` / `clearActiveDraftWidgetController`.

Новые runtime-интеграции должны опираться только на `WidgetDefinitionRegistry`, capabilities и lifecycle handle contract.

## Матрица текущего статуса

- TS/Composition API widgets: `str`, `text`, `int`, `float`, `button`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `img`, `list`, `voc`, `split_button`;
- `table` работает как typed controller feature;
- `frontend/js` содержит TypeScript/Vue source для action runtime, datetime helpers, IP helpers, voc helpers, page/bootstrap glue, API/attrs/modal flows and diagnostics;
- shared common components use typed `<script setup lang="ts">`.
