# Tech Debt

Остаточный техдолг после завершения frontend-refactor.

## Frontend

- `frontend/js/page.js`
  Composition root уже намного чище, но всё ещё крупный. Следующий безопасный шаг — вынести navigation/hash/scroll orchestration в отдельный runtime-module, если страница продолжит расти.

- `frontend/js/widgets/factory.js`
  Widget registry пока остаётся мягким `type -> component` контрактом без capability metadata и формального lifecycle-интерфейса.

- `frontend/js/runtime/modal_runtime_service.js`
  Modal runtime уже выделен в subsystem, но его state пока хранится внутри page app, а не в отдельном dedicated modal store module.

- `frontend/js/runtime/error_model.js`
  Единый error contract уже введён, но не весь код ещё типизирован вокруг него. Сейчас это архитектурная норма, но не максимальная защита от регрессов.

- `frontend/js/widgets/table/`
  Table больше не legacy-остров, но остаётся самой сложной feature-подсистемой проекта. Там ещё есть локальные debug-warnings и большой объём interaction-кода.

## Typing

- `tooling/vite/src/contracts/*.ts`
  Канонические типы границ уже есть, но runtime в основном остаётся на `.js` + JSDoc. Полный TS-переход сознательно не добивался в этом цикле.

## Backend / next stage

- backend compatibility/cleanup можно продолжать уже отдельно от frontend;
- database/data-layer ещё не начат и остаётся следующим большим этапом;
- автоматические тесты по-прежнему не введены и остаются отдельным решением на следующий цикл, когда API/data-model стабилизируются.
