# Tech Debt

Актуальный остаточный техдолг после frontend-refactor.

## Frontend

- `frontend/js/page.js`
  Корневой runtime страницы уже стал тоньше после выноса view orchestration в `page_view_runtime.js`, но page shell всё ещё держит bootstrap, notifications, draft commit, attrs loading и execute-path в одном месте.

- `frontend/js/widgets/factory.ts`
  Widget registry уже поддерживает async-loading, но контракт всё ещё остаётся мягким `type -> component` маппингом без capability metadata и формального lifecycle-интерфейса.

- `frontend/js/runtime/modal_runtime_service.ts`
  Controller boundary уже вынесен из `page.js`, но state модалок по-прежнему живёт внутри page app, а не в отдельном dedicated modal store module.

- `frontend/js/widgets/table/`
  Table уже переведена на SFC как UI-root, но table-runtime остаётся самой сложной feature-подсистемой проекта: много interaction-кода, keyboard/selection/editing logic и локальных runtime-модулей.

## Typing

- `frontend/js/runtime/page*.js`, `frontend/js/widgets/*_shared.js`, `frontend/js/widgets/table/*.js`
  `error_model` и `modal_runtime_service` уже переведены на TypeScript, но большая часть runtime/shared/table-helper слоя всё ещё остаётся на `.js`.

## Testing

- browser smoke для `page` / `debug` / `list` / `voc` / `datetime` / `table`
  Автоматизированного browser smoke/e2e-контура в репозитории всё ещё нет, поэтому UI-проверка после крупных runtime-изменений остаётся в основном ручной.
