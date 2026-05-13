# API админских DDL (PostgreSQL)

`require_admin`. Реализация: [`backend/routes_db_schema.py`](../backend/routes_db_schema.py), генерация операторов — [`backend/db_schema_admin.py`](../backend/db_schema_admin.py).

Те же transport **success/error envelope**, что и у остальных JSON API (см. [api-contracts.md](api-contracts.md)).

## Read-only интроспекция

- `GET /api/admin/db-schema/tables` → `data.items`
- `GET /api/admin/db-schema/columns?schema=...&table=...` → `data.columns`
- `GET /api/admin/db-schema/constraints?schema=...&table=...` — пакет ограничений таблицы

## `POST /api/admin/db-schema/ddl/preview` и `POST /api/admin/db-schema/ddl/execute`

Одно и то же **JSON-тело**. `preview` только возвращает сгенерированный SQL; `execute` выполняет его в **одной транзакции** (`run_ddl_statements`: `commit` при успехе, `rollback` при ошибке).

**Ответ preview:** `data.statements` — массив SQL-строк; `data.sql` — склейка через `;\n` (завершающий `;` только если список непустой).

**Ответ execute:** `data.ok === true`, `data.statements` — выполненный список операторов.

**Ошибки:** валидация тела или генерации — HTTP 400, код `ddl_validation_error` внутри канонического `error` объекта envelope. Пустой список на execute — `ddl_validation_error`, сообщение «Пустой DDL». Сбой БД при execute — `ddl_execution_failed`.

## Тело запроса (`preview` и `execute`)

Разбор в `_build_statements` в `backend/routes_db_schema.py`:

- Обязательное строковое поле **`operation`** — одно из значений ниже (иначе «Неизвестная операция»).
- Для операций над таблицей почти везде нужны **`schema`** и **`table`** (строки, trim по краям).
- **`columns`** и **`ref_columns`** — массив строк или одна строка с запятыми (`"a, b"` → `["a","b"]`); пустые элементы отбрасываются.
- Числовые поля длины/точности могут быть числом или строкой с целым; `null` и `""` — «не задано».

| `operation`      | Назначение                         | Поля тела (дополнительно к `schema` / `table`, где указано) |
|------------------|-------------------------------------|-------------------------------------------------------------|
| `create_table`   | `CREATE TABLE`                      | —                                                           |
| `drop_table`     | `DROP TABLE`                        | **`cascade`**: boolean → `CASCADE`                         |
| `add_column`     | `ADD COLUMN`                        | **`column`**, **`data_type`**; **`is_nullable`**: по умолчанию `"YES"`; опционально: **`character_maximum_length`**, **`numeric_precision`**, **`numeric_scale`**, **`datetime_precision`**, **`interval_type`**, **`interval_precision`**, **`column_default`** |
| `drop_column`    | `DROP COLUMN`                       | **`column`**; **`cascade`**: boolean                        |
| `alter_column`   | тип / имя / NULL / DEFAULT / UNIQUE | **`column`** — текущее имя; **`patch`**: **`column_name`**, **`data_type`**, те же length/precision поля, **`is_nullable`**, **`is_unique`**, **`column_default`**, **`drop_default`**; на корне: **`previous_is_nullable`**, **`previous_unique_constraint`** для веток валидатора |
| `add_primary_key`| PK                                  | **`columns`**; опционально **`constraint_name`**             |
| `drop_primary_key` | снять PK                         | **`constraint_name`**                                       |
| `add_foreign_key` | FK                                 | **`constraint_name`**, **`columns`**, **`ref_schema`**, **`ref_table`**, **`ref_columns`**; опционально **`on_delete`**, **`on_update`** |
| `drop_foreign_key` | удалить FK                       | **`constraint_name`**                                       |

### Примеры тел

```json
{
  "operation": "create_table",
  "schema": "public",
  "table": "demo"
}
```

```json
{
  "operation": "add_column",
  "schema": "public",
  "table": "demo",
  "column": "created_at",
  "data_type": "timestamptz",
  "is_nullable": "NO",
  "column_default": "now()"
}
```

```json
{
  "operation": "alter_column",
  "schema": "public",
  "table": "demo",
  "column": "title",
  "previous_is_nullable": "YES",
  "patch": {
    "is_nullable": "NO",
    "is_unique": "YES"
  }
}
```

```json
{
  "operation": "add_foreign_key",
  "schema": "public",
  "table": "child",
  "constraint_name": "child_parent_fk",
  "columns": ["parent_id"],
  "ref_schema": "public",
  "ref_table": "parent",
  "ref_columns": ["id"],
  "on_delete": "CASCADE"
}
```
