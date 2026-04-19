# API Contracts

## Envelope

Все HTTP API проекта используют единый transport envelope:

```json
{
  "ok": true,
  "snapshot_version": "57399dded03ccbdb",
  "snapshot_created_at": "2026-03-27T12:34:56+00:00",
  "data": {},
  "diagnostics": []
}
```

Ошибка:

```json
{
  "ok": false,
  "snapshot_version": "57399dded03ccbdb",
  "snapshot_created_at": "2026-03-27T12:34:56+00:00",
  "error": {
    "code": "page_not_found",
    "message": "Страница не найдена"
  },
  "diagnostics": []
}
```

Transport shape знает только `frontend/js/runtime/api_client.ts`. UI-слой работает с нормализованными domain-структурами.

## HTML bootstrap

`templates/page.html` встраивает bootstrap в:

```html
<script id="page-data" type="application/json">...</script>
```

Внутри лежит тот же envelope-формат, что и у `GET /api/page/<name>`.

## `GET /api/page/<name>`

`data`:

```json
{
  "page": {
    "name": "main",
    "url": "/",
    "title": "Main",
    "gui": {},
    "guiMenuKeys": [],
    "modalGuiIds": []
  },
  "attrs": {}
}
```

Frontend normalizes это в `PageState`:

- `page`
- `attrs`
- `diagnostics`
- `snapshotVersion`

## `GET /api/attrs?page=<name>&names=a,b`

`data`:

```json
{
  "page": "main",
  "attrs": {},
  "resolved_names": ["a"],
  "missing_names": ["b"]
}
```

Frontend normalizes это в `AttrsState`:

- `page`
- `attrs`
- `resolvedNames`
- `missingNames`
- `diagnostics`
- `snapshotVersion`

## `GET /api/pages`

`data`:

```json
{
  "pages": [
    {
      "name": "main",
      "title": "Main",
      "url": "/"
    }
  ]
}
```

Этот endpoint не участвует в backend normalization и не меняет snapshot shape.
Сейчас frontend использует его как lazy runtime-input для label-resolution у
`split_button.url`, когда нужно заменить внутренний URL на title опубликованной страницы.

## `GET /api/modal-gui?page=<name>&id=<modal_id>`

`data`:

```json
{
  "page": "main",
  "modal": {
    "id": "save",
    "name": "save",
    "title": "Сохранение",
    "icon": "save",
    "tabs": [],
    "content": [],
    "buttons": ["CLOSE"],
    "widgetNames": ["field_1"],
    "source": "file",
    "sourceFile": "pages/main/modal_save.yaml"
  },
  "attrs": {},
  "resolved_names": ["field_1"],
  "missing_names": [],
  "dependencies": {
    "widget_names": ["field_1"]
  }
}
```

Frontend normalizes это в `ModalState`.

## `POST /api/execute`

Request:

```json
{
  "command": "save",
  "params": {},
  "page": "main",
  "widget": "save_button",
  "output_attrs": ["name"]
}
```

`output_attrs` здесь относится только к transport/API-запросу и не является YAML-ключом в attrs-конфиге.

Success `data`:

```json
{
  "command": "save",
  "params": {},
  "page": "main",
  "widget": "save_button",
  "message": "Команда 'save' выполнена",
  "data": null
}
```

Frontend normalizes это в `ExecuteResult`.

Важно:

- `output_attrs` остаётся transport-only полем execute request;
- `split_button` не вводит отдельный transport format и для command-items использует тот же execute pipeline, что и обычный `button`.
- frontend action runtime расположен в TypeScript modules (`action_runtime.ts` и соседние `action_*.ts` files), transport shape `POST /api/execute` общий для `button` и `split_button`.

## Debug API

Debug routes используют тот же envelope:

- `GET /api/debug/structure`
- `GET /api/debug/logs`
- `GET /api/debug/pages`
- `GET /api/debug/snapshot`
- `POST /api/debug/sql`

`POST /api/debug/sql` принимает JSON вида:

```json
{
  "query": "SELECT * FROM some_table LIMIT 20"
}
```

Ограничения debug SQL:

- разрешён только один `SELECT`;
- запрос должен читать пользовательские таблицы;
- SQL-комментарии и дополнительные команды запрещены;
- системные схемы `pg_catalog`, `information_schema` и relation names `pg_*` запрещены;
- запрос выполняется в read-only транзакции;
- результат ограничивается серверным `max_rows`.

Их raw transport тоже проходит через `frontend/js/runtime/api_client.ts`.
Нормализованные frontend response shapes экспортируются из
`frontend/js/runtime/api_contract.ts`, поэтому `page.ts` и `debug.ts` не держат
локальные ad hoc transport-типы рядом с runtime-кодом.

## Contract Files

Актуальные contract files находятся рядом с владельцами runtime:

- `backend/contracts.py` — backend-side Pydantic contracts for pages, attrs, modals, debug payloads, diagnostics and API envelope data.
- `frontend/js/runtime/api_contract.ts` — normalized frontend response/request contracts для page/debug/API transport.
- `frontend/js/runtime/page_contract.ts` — frontend page/runtime domain boundary.
- `frontend/js/runtime/widget_contract.ts` — stateful widget value/list normalization helpers.
- `frontend/js/runtime/action_types.ts` и `frontend/js/runtime/action_runtime.ts` — internal action item/execution contracts для `button` и `split_button`.
- `frontend/js/widgets/table/table_contract.ts` — internal table runtime/schema/state/service contracts.
- `frontend/js/runtime/voc_contract.ts` — voc widget source/value contract.

Это не публичный SDK. Сейчас contracts служат для согласования backend transport, frontend stores и feature modules внутри проекта.

## Frontend error normalization

В UI ошибка не ходит как raw `fetch`/HTTP object.

Единый runtime contract живёт в `frontend/js/runtime/error_model.ts` и нормализует ошибки в:

- `kind`
- `scope`
- `recoverable`
- `message`
- `code`
- `status`
- `diagnostics`
- `snapshotVersion`
- `details`

`api_client.ts` знает только envelope и transport status, а page/debug runtime работают через этот frontend error shape.
