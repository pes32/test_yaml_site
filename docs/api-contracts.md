# Контракты API

Документы: DDL подробно — [api-contracts-ddl.md](api-contracts-ddl.md).

## Envelope

Большинство JSON API используют единый transport envelope (`backend/api_response.py`: `success_payload` / `error_payload`).

**Успех** (пример):

```json
{
  "ok": true,
  "snapshot_version": "57399dded03ccbdb",
  "snapshot_created_at": "2026-03-27T12:34:56+00:00",
  "data": {},
  "diagnostics": []
}
```

**Ошибка** (канонический ответ): код и текст только во вложенном **`error`** (`code`, `message`, `details`). Плоские дубликаты `error_code` / `message` / `details` на корне могут быть временно включены переменной окружения **`YAMLS_LEGACY_ERROR_ENVELOPE_DUPES=1`** (см. `error_payload`).

```json
{
  "ok": false,
  "snapshot_version": "57399dded03ccbdb",
  "snapshot_created_at": "2026-03-27T12:34:56+00:00",
  "error": {
    "code": "page_not_found",
    "message": "Страница не найдена",
    "details": null
  },
  "diagnostics": []
}
```

Клиент: `frontend/js/runtime/api_client_core.ts` — разбор **сначала** из `error.*`, затем fallback на плоские поля (`readApiErrorCode`, `normalizeEnvelopeErrorMessage`). Фасад: `api_client.ts` + сегменты `api_client_*.ts`.

- Snapshot-маршруты (`snapshot_success` / `snapshot_error`): `snapshot_version` и `snapshot_created_at` из `snapshot.meta` (могут быть `null`, если meta пустая).
- Маршруты без snapshot (`/api/auth/*`, часть admin): те же ключи, часто `null`.

## Runtime API

HTML-bootstrap: `templates/page.html`, блок `<script id="page-data" type="application/json">` — тот же envelope, что и `GET /api/page/<name>`.

| Метод | Назначение |
|--------|------------|
| `GET /api/page/<name>` | Полная нормализованная страница: `data.page` (`PagePublicConfigResponse`: `gui`, `parsedGui`, `guiMenuKeys`, `modalGuiIds`, …), `data.attrs`, `data.table_runtime` для remote таблиц. Нормализация на фронте → `PageResponse` / page store (`page`, `attrs`, `tableRuntime`, `diagnostics`, `snapshotVersion`). |
| `GET /api/attrs?page=&names=` | Частичные attrs: `page`, `attrs`, `table_runtime`, `resolved_names`, `missing_names` → `AttrsResponse` (`resolvedNames`, `missingNames`, camelCase + meta). |
| `GET /api/modal-gui?page=&id=` | Модалка + attrs по виджетам модалки: поля как в типичном attrs-ответе плюс `modal`, `dependencies` → `ModalResponse`. |
| `POST /api/table-query` | Remote/paged table view query: тело `{ page, attr, snapshot_version, view }`, где `view` содержит `offset`, `limit`, `sort`, `filters`, `group`, `search`, `expandedGroups`. Ответ: `view_id`, `view_fingerprint`, `total`, `offset`, `limit`, mixed `items`, `has_more`; при ошибках guard (например, группировка на огромном файле) коды `file_view_group_too_large` / ограничения export. |
| `POST /api/table-command` | Command path для remote таблиц: тело `{ page, attr, snapshot_version, view, commands }`. View-команды (`sort`, `filters`, `search`, `group`, `toggle-group`) обновляют backend view и возвращают новое окно; мутации в `commands_applied` помечаются `status: client_only` до подключения персиста. |
| `POST /api/table-export` | Materializing export: тело `{ page, attr, snapshot_version, view }` и опционально **`export_chunk`** `{ offset, limit }` (лимит сервера до 50k строк). Монолит: `{ rows, total }`. Чанк: добавляются `export_chunked`, `export_has_more`, `export_offset`, `export_limit`. Слишком большой монолитный файловый экспорт → `413` / `table_export_too_large`; `exportValueAsync` затем запрашивает чанки. Не используется в click/scroll/sort/render-path. |
| `POST /api/execute` | Тело: `command`, `params`, `page`, `widget`, опционально `output_attrs` (только transport). Для SQL-кнопок browser-visible `command` является служебным маркером; backend берёт реальный SQL из внутреннего snapshot по `page + widget`, возвращает только `updates.values` и `silent_success`. Старые зарегистрированные команды возвращают поля команды + `message`, вложенный `data` → `ExecuteResponse`. |
| `POST /api/widget-source` | Ленивая загрузка DB-source для `list/voc`: тело `{ page, widget, snapshot_version }`; ответ `{ page, widget, patch }`, где patch обновляет `source`, а для `voc` также нормализованные `columns`. |
| `GET /api/config` | `data` — полный snapshot конфигурации (как у config service). |
| `POST /api/reload` | Пересборка snapshot; в `data` сводка (`updated`, `page_count`, `last_error`, `message`, `meta`). |

### `GET /api/pages` — read-model / navigation index

**Статус:** не отдельный источник истины; **проекция** `snapshot.pages` в плоский список `{ name, title, url }` из **того же** snapshot, что и остальные snapshot-маршруты.

- Тот же envelope: **`snapshot_version` / `snapshot_created_at`** совпадают с текущим snapshot.
- **`diagnostics`** в envelope — snapshot-level диагностики сборки (как при дефолтном `snapshot_success`), не принудительно пустой массив.
- `data.pages` — массив кратких записей; фронт нормализует в **`PagesIndexState`** (`frontend/js/runtime/api_contract.ts`): `pages`, `diagnostics`, `snapshotVersion` (`string | null`).
- Типичное использование: lazy **label-resolution** для `split_button.url` (см. `action_labels.ts` → `fetchPages`).

## Auth и user settings

Тот же envelope; без привязанного snapshot поля `snapshot_version` / `snapshot_created_at` часто `null`.

**Auth**

- `GET /api/auth/me`
- `POST /api/auth/login` — тело: `login`, `password`
- `POST /api/auth/logout`

**Пользователь (сессия)**

- `GET /api/user-settings/bootstrap`
- `PUT /api/user-settings/account`
- `POST /api/user-settings/password`

## Admin DB API

Все под `require_admin`, кроме отдельно оговоренных.

**Пользователи и роли:** `GET/POST /api/admin/users`, `GET /api/admin/roles`, `PUT /api/admin/users/<id>`, `POST .../password`, `POST .../toggle-block`.

**Настройки БД:** `GET /api/admin/db-settings`, `GET /api/admin/db-settings/fallback`, `POST .../test`, `POST .../save`, `GET /api/admin/db-backup/schema_only`, `GET /api/admin/db-backup/full`.

**Схема и DDL:** read-only эндпоинты `GET /api/admin/db-schema/tables|columns|constraints`; **`POST .../ddl/preview`** и **`POST .../ddl/execute`** — полное описание тел запросов, таблица `operation`, примеры и транзакция — в [api-contracts-ddl.md](api-contracts-ddl.md).

**Произвольный SQL:** `POST /api/admin/sql`, тело `{ "query": "..." }`, timeout 60s.

## Diagnostics

- **`POST /api/client-diagnostic`** — приём клиентской диагностики; ответ `data: { "ok": true }` (без авторизации).
- В snapshot-envelope поле **`diagnostics`** — структурированные сообщения уровня snapshot/страницы (см. `Diagnostic` в `backend/contracts.py`).

Системные маршруты обрабатываются тем же клиентским слоем; доменные типы — `frontend/js/runtime/api_contract.ts`.

## Contract files

- `backend/contracts.py` — Pydantic: страницы, attrs, modals, diagnostics, snapshot.
- `frontend/js/runtime/api_contract.ts` — нормализованные ответы/запросы transport layer (`PagesIndexState`, `PageResponse`, …).
- `frontend/js/runtime/page_contract.ts` — домен страницы / stores.
- `frontend/js/runtime/widget_contract.ts` — stateful widgets.
- `frontend/js/runtime/action_types.ts`, `action_runtime.ts` — button / split_button.
- `frontend/js/widgets/table/table_contract.ts` — таблица.
- `frontend/js/runtime/voc_contract.ts` — voc.

Это внутренние контракты репозитория, не публичный SDK.

## Frontend error normalization

`frontend/js/runtime/error_model.ts`: единый объект ошибки для UI (`presentation`, `kind`, `scope`, `recoverable`, `message`, `code`, `status`, `diagnostics`, `snapshotVersion`, `details`, `cause`). `FrontendApiError` из `api_client_core.ts` поднимается из transport/envelope и дальше нормализуется через `normalizeFrontendError` / `presentFrontendError`.
