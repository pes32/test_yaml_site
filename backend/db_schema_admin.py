"""Интроспекция и DDL для вкладки «Схема БД» (админ)."""
from __future__ import annotations

import re
from typing import Any

IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

FK_REF_ACTIONS = frozenset({"NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"})
PG16_DATA_TYPE_NAMES = frozenset(
    {
        "aclitem",
        "bigint",
        "bigserial",
        "bit",
        "bit varying",
        "boolean",
        "box",
        "bytea",
        "character",
        "character varying",
        "cid",
        "cidr",
        "circle",
        "date",
        "daterange",
        "datemultirange",
        "decimal",
        "double precision",
        "float",
        "inet",
        "int4multirange",
        "int4range",
        "int8multirange",
        "int8range",
        "integer",
        "interval",
        "json",
        "jsonb",
        "line",
        "lseg",
        "macaddr",
        "macaddr8",
        "money",
        "name",
        "numeric",
        "nummultirange",
        "numrange",
        "oid",
        "path",
        "point",
        "polygon",
        "real",
        "regclass",
        "regcollation",
        "regconfig",
        "regdictionary",
        "regnamespace",
        "regoper",
        "regoperator",
        "regproc",
        "regprocedure",
        "regrole",
        "regtype",
        "serial",
        "smallint",
        "smallserial",
        "text",
        "tid",
        "time with time zone",
        "time without time zone",
        "timestamp with time zone",
        "timestamp without time zone",
        "tsmultirange",
        "tsquery",
        "tsrange",
        "tstzmultirange",
        "tstzrange",
        "tsvector",
        "uuid",
        "xid",
        "xid8",
        "xml",
    }
)


class DbSchemaError(RuntimeError):
    """Некорректные параметры DDL или интроспекции."""


def quote_ident_pg(ident: str) -> str:
    if not IDENT_RE.match(ident or ""):
        raise DbSchemaError(f"Недопустимый идентификатор: {ident!r}")
    return '"' + ident.replace('"', '""') + '"'


def qualify_table(schema: str, table: str) -> str:
    return f"{quote_ident_pg(schema)}.{quote_ident_pg(table)}"


def qualify_column(schema: str, table: str, column: str) -> str:
    return f"{qualify_table(schema, table)}.{quote_ident_pg(column)}"


def validate_constraint_name(name: str) -> str:
    n = str(name or "").strip()
    if not IDENT_RE.match(n):
        raise DbSchemaError(f"Недопустимое имя ограничения: {name!r}")
    return n


def normalize_fk_action(raw: str | None, default: str = "NO ACTION") -> str:
    if raw is None or str(raw).strip() == "":
        return default
    key = " ".join(str(raw).strip().upper().split())
    if key == "NO_ACTION":
        key = "NO ACTION"
    if key == "SET_NULL":
        key = "SET NULL"
    if key == "SET_DEFAULT":
        key = "SET DEFAULT"
    if key not in FK_REF_ACTIONS:
        raise DbSchemaError(f"Недопустимое правило FK: {raw!r}")
    return key


def validate_column_list(columns: list[str], *, label: str) -> list[str]:
    out: list[str] = []
    for col in columns:
        c = str(col or "").strip()
        if not IDENT_RE.match(c):
            raise DbSchemaError(f"Недопустимое имя столбца в {label}: {col!r}")
        out.append(c)
    if not out:
        raise DbSchemaError(f"Список столбцов пуст ({label})")
    return out


LIST_PRIMARY_KEY_SQL = """
SELECT tc.constraint_name, kcu.column_name, kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.table_schema
 AND tc.table_name = kcu.table_name
 AND tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = %s AND tc.table_name = %s
ORDER BY kcu.ordinal_position
"""


LIST_FOREIGN_KEY_SQL = """
SELECT
    tc.constraint_name,
    kcu.ordinal_position,
    kcu.column_name AS column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.table_schema
 AND tc.table_name = kcu.table_name
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage ccu
  ON ccu.constraint_schema = rc.unique_constraint_schema
 AND ccu.constraint_name = rc.unique_constraint_name
 AND ccu.ordinal_position = kcu.ordinal_position
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = %s AND tc.table_name = %s
ORDER BY tc.constraint_name, kcu.ordinal_position
"""

LIST_COLUMN_UNIQUES_SQL = """
SELECT constraint_name, constraint_type, array_agg(column_name::text ORDER BY ordinal_position) AS columns
FROM (
    SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
     AND tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      AND tc.table_schema = %s AND tc.table_name = %s
) uq
GROUP BY constraint_name, constraint_type
ORDER BY constraint_name
"""


def fetch_primary_key(cursor, schema: str, table: str) -> dict[str, Any] | None:
    cursor.execute(LIST_PRIMARY_KEY_SQL, (schema, table))
    rows = cursor.fetchall()
    if not rows:
        return None
    cols = [d[0] for d in cursor.description]
    items = [dict(zip(cols, row)) for row in rows]
    name = str(items[0].get("constraint_name") or "")
    columns = [str(it.get("column_name") or "") for it in items]
    return {"constraint_name": name, "columns": columns}


def fetch_foreign_keys(cursor, schema: str, table: str) -> list[dict[str, Any]]:
    cursor.execute(LIST_FOREIGN_KEY_SQL, (schema, table))
    rows = cursor.fetchall()
    if not rows:
        return []
    cols = [d[0] for d in cursor.description]
    raw_items = [dict(zip(cols, row)) for row in rows]
    grouped: dict[str, dict[str, Any]] = {}
    for it in raw_items:
        cname = str(it.get("constraint_name") or "")
        if cname not in grouped:
            grouped[cname] = {
                "constraint_name": cname,
                "columns": [],
                "foreign_schema": str(it.get("foreign_table_schema") or ""),
                "foreign_table": str(it.get("foreign_table_name") or ""),
                "foreign_columns": [],
                "update_rule": str(it.get("update_rule") or "NO ACTION"),
                "delete_rule": str(it.get("delete_rule") or "NO ACTION"),
            }
        grouped[cname]["columns"].append(str(it.get("column_name") or ""))
        grouped[cname]["foreign_columns"].append(str(it.get("foreign_column_name") or ""))
    return list(grouped.values())


def fetch_table_constraints_bundle(cursor, schema: str, table: str) -> dict[str, Any]:
    return {
        "primary_key": fetch_primary_key(cursor, schema, table),
        "foreign_keys": fetch_foreign_keys(cursor, schema, table),
    }


LIST_TABLES_SQL = """
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
  AND table_schema NOT LIKE 'pg_toast%%'
ORDER BY table_schema, table_name
"""


LIST_COLUMNS_SQL = """
SELECT
    column_name,
    column_default,
    is_nullable,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    datetime_precision,
    interval_type,
    interval_precision,
    udt_name,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = %s AND table_name = %s
ORDER BY ordinal_position
"""


def fetch_single_column_unique_map(cursor, schema: str, table: str) -> dict[str, dict[str, str]]:
    cursor.execute(LIST_COLUMN_UNIQUES_SQL, (schema, table))
    rows = cursor.fetchall()
    cols = [d[0] for d in cursor.description]
    result: dict[str, dict[str, str]] = {}
    for row in rows:
        item = dict(zip(cols, row))
        unique_cols = [str(col or "") for col in (item.get("columns") or [])]
        if len(unique_cols) == 1 and unique_cols[0]:
            column_name = unique_cols[0]
            constraint_type = str(item.get("constraint_type") or "")
            current = result.get(column_name)
            if current and current.get("constraint_type") == "PRIMARY KEY":
                continue
            result[column_name] = {
                "constraint_name": str(item.get("constraint_name") or ""),
                "constraint_type": constraint_type,
            }
    return result


def fetch_tree_tables(cursor) -> list[dict[str, Any]]:
    cursor.execute(LIST_TABLES_SQL)
    rows = cursor.fetchall()
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in rows]


def fetch_columns(cursor, schema: str, table: str) -> list[dict[str, Any]]:
    cursor.execute(LIST_COLUMNS_SQL, (schema, table))
    rows = cursor.fetchall()
    cols = [d[0] for d in cursor.description]
    items = [dict(zip(cols, row)) for row in rows]
    unique_by_column = fetch_single_column_unique_map(cursor, schema, table)
    for item in items:
        column_name = str(item.get("column_name") or "")
        unique_constraint = unique_by_column.get(column_name) or {}
        item["is_unique"] = "YES" if unique_constraint else "NO"
        item["unique_constraint_name"] = unique_constraint.get("constraint_name", "")
        item["unique_constraint_type"] = unique_constraint.get("constraint_type", "")
    return items


def _sql_literal_default(raw: str | None) -> str | None:
    if raw is None or raw == "":
        return None
    text = str(raw).strip()
    if not text:
        return None
    # Expression default like nextval(...) passed through as-is (trusted admin).
    if "(" in text or text.upper() in {"NULL", "CURRENT_TIMESTAMP", "NOW()", "CURRENT_DATE", "CURRENT_TIME"}:
        return text
    escaped = text.replace("'", "''")
    return f"'{escaped}'"


def build_type_sql(
    *,
    data_type: str,
    char_len: int | None,
    num_prec: int | None,
    num_scale: int | None,
    datetime_precision: int | None = None,
    interval_type: str | None = None,
    interval_precision: int | None = None,
) -> str:
    dt = str(data_type or "").strip().lower()
    if dt in {"character varying", "varchar"}:
        if char_len is not None and int(char_len) > 0:
            return f"VARCHAR({int(char_len)})"
        return "VARCHAR"
    if dt in {"character", "char"}:
        if char_len is not None and int(char_len) > 0:
            return f"CHAR({int(char_len)})"
        return "CHAR"
    if dt in {"bit", "bit varying"}:
        if char_len is not None and int(char_len) > 0:
            base = "BIT VARYING" if dt == "bit varying" else "BIT"
            return f"{base}({int(char_len)})"
        return "BIT VARYING" if dt == "bit varying" else "BIT"
    if dt in {"numeric", "decimal"}:
        if num_prec is not None and int(num_prec) > 0:
            if num_scale is not None and int(num_scale) >= 0:
                return f"NUMERIC({int(num_prec)},{int(num_scale)})"
            return f"NUMERIC({int(num_prec)})"
        return "NUMERIC"
    if dt == "float":
        if num_prec is not None and int(num_prec) > 0:
            precision = int(num_prec)
            if precision < 1 or precision > 53:
                raise DbSchemaError("Для float precision должен быть в диапазоне 1..53")
            return f"FLOAT({precision})"
        return "FLOAT"
    if dt in {"timestamp without time zone", "timestamp with time zone", "time without time zone", "time with time zone"}:
        base_name, zone_sql = {
            "timestamp without time zone": ("TIMESTAMP", "WITHOUT TIME ZONE"),
            "timestamp with time zone": ("TIMESTAMP", "WITH TIME ZONE"),
            "time without time zone": ("TIME", "WITHOUT TIME ZONE"),
            "time with time zone": ("TIME", "WITH TIME ZONE"),
        }[dt]
        if datetime_precision is not None:
            precision = int(datetime_precision)
            if precision < 0 or precision > 6:
                raise DbSchemaError("datetime_precision должен быть в диапазоне 0..6")
            return f"{base_name}({precision}) {zone_sql}"
        return f"{base_name} {zone_sql}"
    if dt == "interval":
        allowed_fields = {
            "",
            "YEAR",
            "MONTH",
            "DAY",
            "HOUR",
            "MINUTE",
            "SECOND",
            "YEAR TO MONTH",
            "DAY TO HOUR",
            "DAY TO MINUTE",
            "DAY TO SECOND",
            "HOUR TO MINUTE",
            "HOUR TO SECOND",
            "MINUTE TO SECOND",
        }
        fields = " ".join(str(interval_type or "").strip().upper().split())
        if fields not in allowed_fields:
            raise DbSchemaError("Недопустимое значение interval_type")
        precision_sql = ""
        if interval_precision is not None:
            precision = int(interval_precision)
            if precision < 0 or precision > 6:
                raise DbSchemaError("interval_precision должен быть в диапазоне 0..6")
            precision_sql = f"({precision})"
        if fields:
            return f"INTERVAL {fields}{precision_sql}"
        return f"INTERVAL{precision_sql}" if precision_sql else "INTERVAL"
    if dt not in PG16_DATA_TYPE_NAMES:
        raise DbSchemaError(f"Тип {data_type!r} пока не поддержан в DDL-редакторе")
    return dt


def preview_create_table(schema: str, table: str) -> list[str]:
    q = qualify_table(schema, table)
    return [f"CREATE TABLE {q} ()"]


def preview_drop_table(schema: str, table: str, cascade: bool) -> list[str]:
    q = qualify_table(schema, table)
    suf = " CASCADE" if cascade else ""
    return [f"DROP TABLE {q}{suf}"]


def preview_add_column(
    schema: str,
    table: str,
    column: str,
    *,
    data_type: str,
    char_len: int | None,
    num_prec: int | None,
    num_scale: int | None,
    datetime_precision: int | None,
    interval_type: str | None,
    interval_precision: int | None,
    is_nullable: str,
    column_default: str | None,
) -> list[str]:
    qt = qualify_table(schema, table)
    qc = quote_ident_pg(column)
    typ = build_type_sql(
        data_type=data_type,
        char_len=char_len,
        num_prec=num_prec,
        num_scale=num_scale,
        datetime_precision=datetime_precision,
        interval_type=interval_type,
        interval_precision=interval_precision,
    )
    parts = typ
    default_sql = _sql_literal_default(column_default)
    if default_sql is not None:
        parts += f" DEFAULT {default_sql}"
    if str(is_nullable).upper() == "NO":
        parts += " NOT NULL"
    return [f"ALTER TABLE {qt} ADD COLUMN {qc} {parts}"]


def preview_drop_column(schema: str, table: str, column: str, cascade: bool) -> list[str]:
    qt = qualify_table(schema, table)
    qc = quote_ident_pg(column)
    suf = " CASCADE" if cascade else ""
    return [f"ALTER TABLE {qt} DROP COLUMN {qc}{suf}"]


def preview_alter_column(
    schema: str,
    table: str,
    column: str,
    *,
    new_name: str | None,
    data_type: str | None,
    char_len: int | None,
    num_prec: int | None,
    num_scale: int | None,
    datetime_precision: int | None,
    interval_type: str | None,
    interval_precision: int | None,
    is_nullable: str | None,
    column_default: str | None,
    drop_default: bool,
    previous_is_nullable: str | None,
    is_unique: str | None,
    previous_unique_constraint: str | None,
) -> list[str]:
    qt = qualify_table(schema, table)
    qc = quote_ident_pg(column)
    current_column_name = column
    stmts: list[str] = []

    if new_name and new_name != column:
        if not IDENT_RE.match(new_name):
            raise DbSchemaError("Недопустимое новое имя столбца")
        stmts.append(f"ALTER TABLE {qt} RENAME COLUMN {qc} TO {quote_ident_pg(new_name)}")
        qc = quote_ident_pg(new_name)
        current_column_name = new_name

    if data_type:
        typ = build_type_sql(
            data_type=data_type,
            char_len=char_len,
            num_prec=num_prec,
            num_scale=num_scale,
            datetime_precision=datetime_precision,
            interval_type=interval_type,
            interval_precision=interval_precision,
        )
        stmts.append(f"ALTER TABLE {qt} ALTER COLUMN {qc} TYPE {typ} USING {qc}::text::{typ}")

    if drop_default:
        stmts.append(f"ALTER TABLE {qt} ALTER COLUMN {qc} DROP DEFAULT")

    if column_default is not None and not drop_default:
        lit = _sql_literal_default(str(column_default))
        if lit is not None:
            stmts.append(f"ALTER TABLE {qt} ALTER COLUMN {qc} SET DEFAULT {lit}")

    if is_nullable is not None and previous_is_nullable is not None:
        prev = str(previous_is_nullable).upper()
        nxt = str(is_nullable).upper()
        if prev != nxt:
            if nxt == "NO":
                stmts.append(f"ALTER TABLE {qt} ALTER COLUMN {qc} SET NOT NULL")
            elif nxt == "YES":
                stmts.append(f"ALTER TABLE {qt} ALTER COLUMN {qc} DROP NOT NULL")

    if is_unique is not None:
        unique_state = str(is_unique or "").strip().upper()
        if unique_state == "YES":
            cname = validate_constraint_name(f"{table}_{current_column_name}_key")
            stmts.append(f"ALTER TABLE {qt} ADD CONSTRAINT {quote_ident_pg(cname)} UNIQUE ({qc})")
        elif unique_state == "NO":
            cname = validate_constraint_name(str(previous_unique_constraint or "").strip())
            stmts.append(f"ALTER TABLE {qt} DROP CONSTRAINT {quote_ident_pg(cname)}")
        else:
            raise DbSchemaError("is_unique должен быть YES или NO")

    return stmts


def preview_add_primary_key(schema: str, table: str, columns: list[str], constraint_name: str | None) -> list[str]:
    cols = validate_column_list(columns, label="PRIMARY KEY")
    qt = qualify_table(schema, table)
    if constraint_name:
        cname = validate_constraint_name(constraint_name)
    else:
        cname = validate_constraint_name(f"{table}_pkey")
    cols_sql = ", ".join(quote_ident_pg(c) for c in cols)
    return [f"ALTER TABLE {qt} ADD CONSTRAINT {quote_ident_pg(cname)} PRIMARY KEY ({cols_sql})"]


def preview_drop_primary_key(schema: str, table: str, constraint_name: str) -> list[str]:
    qt = qualify_table(schema, table)
    cname = validate_constraint_name(constraint_name)
    return [f"ALTER TABLE {qt} DROP CONSTRAINT {quote_ident_pg(cname)}"]


def preview_add_foreign_key(
    schema: str,
    table: str,
    *,
    constraint_name: str,
    columns: list[str],
    ref_schema: str,
    ref_table: str,
    ref_columns: list[str],
    on_delete: str | None,
    on_update: str | None,
) -> list[str]:
    loc = validate_column_list(columns, label="FOREIGN KEY (локальные)")
    ref_cols = validate_column_list(ref_columns, label="FOREIGN KEY (ссылка)")
    if len(loc) != len(ref_cols):
        raise DbSchemaError("Число локальных и ссылочных столбцов FK должно совпадать")
    rs = str(ref_schema or "").strip()
    rt = str(ref_table or "").strip()
    if not IDENT_RE.match(rs) or not IDENT_RE.match(rt):
        raise DbSchemaError("Недопустимая ссылочная схема или таблица")
    cname = validate_constraint_name(constraint_name)
    od = normalize_fk_action(on_delete, "NO ACTION")
    ou = normalize_fk_action(on_update, "NO ACTION")
    qt = qualify_table(schema, table)
    rtq = qualify_table(rs, rt)
    loc_sql = ", ".join(quote_ident_pg(c) for c in loc)
    ref_sql = ", ".join(quote_ident_pg(c) for c in ref_cols)
    return [
        f"ALTER TABLE {qt} ADD CONSTRAINT {quote_ident_pg(cname)} "
        f"FOREIGN KEY ({loc_sql}) REFERENCES {rtq} ({ref_sql}) ON DELETE {od} ON UPDATE {ou}"
    ]


def preview_drop_foreign_key(schema: str, table: str, constraint_name: str) -> list[str]:
    qt = qualify_table(schema, table)
    cname = validate_constraint_name(constraint_name)
    return [f"ALTER TABLE {qt} DROP CONSTRAINT {quote_ident_pg(cname)}"]


def run_ddl_statements(conn, statements: list[str]) -> None:
    conn.autocommit = False
    try:
        with conn.cursor() as cursor:
            for stmt in statements:
                cursor.execute(stmt)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
