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

Transport shape знает только `frontend/js/runtime/api_client.js`. UI-слой работает уже с нормализованными domain-структурами.

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

Их raw transport тоже проходит через `frontend/js/runtime/api_client.js`.

## Канонические контракты

Typed transport/domain reference лежит в:

- `tooling/vite/src/contracts/api.ts`
- `tooling/vite/src/contracts/table.ts`

Это справочные типы для границ между backend transport, runtime store и feature-модулями.

## Frontend error normalization

После transport normalization ошибка не должна ходить по UI как raw `fetch`/HTTP object.

Единый runtime contract живёт в `frontend/js/runtime/error_model.js` и нормализует ошибки в:

- `kind`
- `scope`
- `recoverable`
- `message`
- `code`
- `status`
- `diagnostics`
- `snapshotVersion`
- `details`

`api_client.js` знает только envelope и transport status, а page/debug runtime уже работают через этот frontend error shape.
