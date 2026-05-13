/**
 * Справочник типов данных PostgreSQL 16 для выбора в DDL/UI и автодополнения.
 * Основан на официальной документации:
 * https://www.postgresql.org/docs/16/datatype.html
 * и смежных разделах (диапазоны, OID-типы).
 *
 * Поле sqlName — каноническая строка для подстановки в CREATE/ALTER … TYPE …
 * (при необходимости добавляйте длину/точность вручную: varchar(255), numeric(12,4) и т.д.).
 */

type Pg16DataTypeCategory =
  | 'Числовые'
  | 'Денежные'
  | 'Символьные'
  | 'Двоичные'
  | 'Логический'
  | 'Дата и время'
  | 'Интервал'
  | 'Геометрические'
  | 'Сеть'
  | 'Битовые строки'
  | 'Полнотекстовый поиск'
  | 'UUID'
  | 'XML'
  | 'JSON'
  | 'Массивы'
  | 'Диапазоны'
  | 'Мультидиапазоны'
  | 'Перечисления и составные типы'
  | 'Домены'
  | 'Идентификаторы объектов (OID)'
  | 'Служебные идентификаторы'
  | 'Журнал и снимки';

type Pg16DataTypeEntry = {
  /** Имя типа в DDL (как правило совпадает с представлением в документации). */
  sqlName: string;
  category: Pg16DataTypeCategory;
  /** Краткое описание по смыслу документации PG16 (RU). */
  descriptionRu: string;
  /** Внутренние или альтернативные имена / замечания. */
  aliasesNote?: string;
};

/**
 * Полный перечень типов из раздела «Data Types» ядра PostgreSQL 16,
 * плюс OID-типы, диапазоны и мультидиапазоны.
 * Псевдотипы (any, trigger…) и типы только для полиморфных функций не включены — они не задаются для столбцов таблиц.
 */
const PG16_DATA_TYPE_ENTRIES: readonly Pg16DataTypeEntry[] = [
  // Числовые — https://www.postgresql.org/docs/16/datatype-numeric.html
  {
    sqlName: 'smallint',
    category: 'Числовые',
    descriptionRu: 'Целое со знаком на 16 бит; диапазон −32768 … +32767.',
    aliasesNote: 'Внутреннее имя int2.'
  },
  {
    sqlName: 'integer',
    category: 'Числовые',
    descriptionRu: 'Целое со знаком на 32 бита; тип по умолчанию для целых.',
    aliasesNote: 'int, int4.'
  },
  {
    sqlName: 'bigint',
    category: 'Числовые',
    descriptionRu: 'Целое со знаком на 64 бита.',
    aliasesNote: 'int8.'
  },
  {
    sqlName: 'decimal',
    category: 'Числовые',
    descriptionRu: 'Число произвольной точности; указывайте decimal(p[, s]) при необходимости.',
    aliasesNote: 'Эквивалент numeric.'
  },
  {
    sqlName: 'numeric',
    category: 'Числовые',
    descriptionRu: 'Число произвольной точности; указывайте numeric(p[, s]) при необходимости.',
    aliasesNote: 'Синоним decimal.'
  },
  {
    sqlName: 'real',
    category: 'Числовые',
    descriptionRu: 'Вещественное с плавающей точкой (6 десятичных цифр точности).',
    aliasesNote: 'float4.'
  },
  {
    sqlName: 'double precision',
    category: 'Числовые',
    descriptionRu: 'Вещественное с плавающей точкой (около 15 десятичных цифр точности).',
    aliasesNote: 'float8.'
  },
  {
    sqlName: 'float',
    category: 'Числовые',
    descriptionRu:
      'Конструкция float(p): при точности 1–24 соответствует real, при 25–53 — double precision; без (p) эквивалентно double precision (по документации PG).',
    aliasesNote: 'Стандартный SQL-синтаксис поверх real/double precision.'
  },
  {
    sqlName: 'smallserial',
    category: 'Числовые',
    descriptionRu: 'Автоинкрементное малое целое (16 бит); создаёт последовательность.',
    aliasesNote: 'serial2.'
  },
  {
    sqlName: 'serial',
    category: 'Числовые',
    descriptionRu: 'Автоинкрементное целое (32 бита); создаёт последовательность.',
    aliasesNote: 'serial4.'
  },
  {
    sqlName: 'bigserial',
    category: 'Числовые',
    descriptionRu: 'Автоинкрементное большое целое (64 бита); создаёт последовательность.',
    aliasesNote: 'serial8.'
  },

  // Денежные
  {
    sqlName: 'money',
    category: 'Денежные',
    descriptionRu: 'Денежная сумма; точность зависит от lc_monetary; дробная часть до 8 знаков после запятой.'
  },

  // Символьные — https://www.postgresql.org/docs/16/datatype-character.html
  {
    sqlName: 'character varying',
    category: 'Символьные',
    descriptionRu: 'Строка переменной длины с опциональным ограничением длины; используйте character varying(n).',
    aliasesNote: 'varchar, varchar(n).'
  },
  {
    sqlName: 'character',
    category: 'Символьные',
    descriptionRu: 'Строка фиксированной длины с дополнением пробелами; используйте character(n).',
    aliasesNote: 'char(n).'
  },
  {
    sqlName: 'text',
    category: 'Символьные',
    descriptionRu: 'Строка переменной длины без объявленного верхнего предела в типе.'
  },

  // Двоичные
  {
    sqlName: 'bytea',
    category: 'Двоичные',
    descriptionRu: 'Двоичные данные («массив байтов»); хранение и экранирование см. документацию.'
  },

  // Логический
  {
    sqlName: 'boolean',
    category: 'Логический',
    descriptionRu: 'Логическое значение true/false/null.',
    aliasesNote: 'bool.'
  },

  // Дата и время — https://www.postgresql.org/docs/16/datatype-datetime.html
  {
    sqlName: 'timestamp without time zone',
    category: 'Дата и время',
    descriptionRu: 'Дата и время без часового пояса; допускается точность timestamp(p) without time zone.',
    aliasesNote: 'timestamp.'
  },
  {
    sqlName: 'timestamp with time zone',
    category: 'Дата и время',
    descriptionRu: 'Дата и время с часовым поясом; допускается точность timestamp(p) with time zone.',
    aliasesNote: 'timestamptz.'
  },
  {
    sqlName: 'date',
    category: 'Дата и время',
    descriptionRu: 'Календарная дата без времени суток.'
  },
  {
    sqlName: 'time without time zone',
    category: 'Дата и время',
    descriptionRu: 'Время суток без даты и без пояса; допускается time(p) without time zone.',
    aliasesNote: 'time.'
  },
  {
    sqlName: 'time with time zone',
    category: 'Дата и время',
    descriptionRu: 'Время суток с учётом смещения от UTC; допускается time(p) with time zone.',
    aliasesNote: 'timetz.'
  },
  {
    sqlName: 'abstime',
    category: 'Дата и время',
    descriptionRu: 'Абсолютное время (устаревший тип каталога); для новых схем использовать timestamp with time zone.',
    aliasesNote: 'Obsolete / legacy.'
  },
  {
    sqlName: 'reltime',
    category: 'Дата и время',
    descriptionRu: 'Относительный интервал в стиле Unix date (устаревший); предпочтителен interval.',
    aliasesNote: 'Obsolete / legacy.'
  },
  {
    sqlName: 'tinterval',
    category: 'Дата и время',
    descriptionRu: 'Пара abstime как временной интервал (устаревший); предпочтителен tstzrange или interval.',
    aliasesNote: 'Obsolete / legacy.'
  },

  // Интервал
  {
    sqlName: 'interval',
    category: 'Интервал',
    descriptionRu: 'Временной интервал; можно ограничить полями interval fields и точностью interval(p).',
    aliasesNote: 'См. interval day to second, interval year to month и др.'
  },

  // Геометрические — https://www.postgresql.org/docs/16/datatype-geometric.html
  {
    sqlName: 'point',
    category: 'Геометрические',
    descriptionRu: 'Точка на плоскости (x, y).'
  },
  {
    sqlName: 'line',
    category: 'Геометрические',
    descriptionRu: 'Бесконечная прямая на плоскости (не замкнутый тип для всех операций — см. док.).'
  },
  {
    sqlName: 'lseg',
    category: 'Геометрические',
    descriptionRu: 'Отрезок прямой между двумя точками.'
  },
  {
    sqlName: 'box',
    category: 'Геометрические',
    descriptionRu: 'Прямоугольник на плоскости (выравнивается по диагонали при хранении).'
  },
  {
    sqlName: 'path',
    category: 'Геометрические',
    descriptionRu: 'Геометрический путь — последовательность точек (открытый или замкнутый).'
  },
  {
    sqlName: 'polygon',
    category: 'Геометрические',
    descriptionRu: 'Замкнутый геометрический путь (многоугольник).'
  },
  {
    sqlName: 'circle',
    category: 'Геометрические',
    descriptionRu: 'Окружность на плоскости (центр и радиус).'
  },

  // Сеть — https://www.postgresql.org/docs/16/datatype-net-types.html
  {
    sqlName: 'cidr',
    category: 'Сеть',
    descriptionRu: 'IPv4 или IPv6 сеть (адрес и маска подсети в одном значении).'
  },
  {
    sqlName: 'inet',
    category: 'Сеть',
    descriptionRu: 'IPv4 или IPv6 адрес хоста или подсети с маской.'
  },
  {
    sqlName: 'macaddr',
    category: 'Сеть',
    descriptionRu: 'MAC-адрес (6 байт).'
  },
  {
    sqlName: 'macaddr8',
    category: 'Сеть',
    descriptionRu: 'MAC-адрес в формате EUI-64 (8 байт).'
  },

  // Битовые строки — https://www.postgresql.org/docs/16/datatype-bit.html
  {
    sqlName: 'bit',
    category: 'Битовые строки',
    descriptionRu: 'Битовая строка фиксированной длины; синтаксис bit(n).'
  },
  {
    sqlName: 'bit varying',
    category: 'Битовые строки',
    descriptionRu: 'Битовая строка переменной длины; синтаксис bit varying(n).',
    aliasesNote: 'varbit.'
  },

  // Полнотекстовый поиск — https://www.postgresql.org/docs/16/datatype-textsearch.html
  {
    sqlName: 'tsvector',
    category: 'Полнотекстовый поиск',
    descriptionRu: 'Отсортированный список различных лексем — «документ» для полнотекстового поиска.'
  },
  {
    sqlName: 'tsquery',
    category: 'Полнотекстовый поиск',
    descriptionRu: 'Значение для поиска лексем — запрос полнотекстового поиска.'
  },

  // UUID — https://www.postgresql.org/docs/16/datatype-uuid.html
  {
    sqlName: 'uuid',
    category: 'UUID',
    descriptionRu: 'Универсальный уникальный идентификатор RFC 4122 и др.'
  },

  // XML — https://www.postgresql.org/docs/16/datatype-xml.html
  {
    sqlName: 'xml',
    category: 'XML',
    descriptionRu: 'XML-данные с проверкой разбираемости при вводе (optional DOCUMENT / CONTENT).'
  },

  // JSON — https://www.postgresql.org/docs/16/datatype-json.html
  {
    sqlName: 'json',
    category: 'JSON',
    descriptionRu: 'Текстовое представление JSON с сохранением пробелов и порядка ключей при парсинге.'
  },
  {
    sqlName: 'jsonb',
    category: 'JSON',
    descriptionRu: 'Бинарное JSON: разобранное представление без лишних пробелов; поддерживает индексацию и операторы.'
  },

  // Массивы — https://www.postgresql.org/docs/16/arrays.html
  {
    sqlName: 'ARRAY',
    category: 'Массивы',
    descriptionRu: 'Массив элементов базового типа; в DDL указывают как базовый_тип[] (например integer[], text[]).',
    aliasesNote: 'Фактическое имя типа — форма element[]; здесь маркер для подсказки.'
  },

  // Диапазоны — https://www.postgresql.org/docs/16/rangetypes.html
  {
    sqlName: 'int4range',
    category: 'Диапазоны',
    descriptionRu: 'Диапазон integer.'
  },
  {
    sqlName: 'int8range',
    category: 'Диапазоны',
    descriptionRu: 'Диапазон bigint.'
  },
  {
    sqlName: 'numrange',
    category: 'Диапазоны',
    descriptionRu: 'Диапазон numeric.'
  },
  {
    sqlName: 'tsrange',
    category: 'Диапазоны',
    descriptionRu: 'Диапазон timestamp without time zone.'
  },
  {
    sqlName: 'tstzrange',
    category: 'Диапазоны',
    descriptionRu: 'Диапазон timestamp with time zone.'
  },
  {
    sqlName: 'daterange',
    category: 'Диапазоны',
    descriptionRu: 'Диапазон date.'
  },

  // Мультидиапазоны — https://www.postgresql.org/docs/16/rangetypes.html#RANGETYPES-MULTIRANGE
  {
    sqlName: 'int4multirange',
    category: 'Мультидиапазоны',
    descriptionRu: 'Упорядоченный набор непересекающихся int4range.'
  },
  {
    sqlName: 'int8multirange',
    category: 'Мультидиапазоны',
    descriptionRu: 'Упорядоченный набор непересекающихся int8range.'
  },
  {
    sqlName: 'nummultirange',
    category: 'Мультидиапазоны',
    descriptionRu: 'Упорядоченный набор непересекающихся numrange.'
  },
  {
    sqlName: 'tsmultirange',
    category: 'Мультидиапазоны',
    descriptionRu: 'Упорядоченный набор непересекающихся tsrange.'
  },
  {
    sqlName: 'tstzmultirange',
    category: 'Мультидиапазоны',
    descriptionRu: 'Упорядоченный набор непересекающихся tstzrange.'
  },
  {
    sqlName: 'datemultirange',
    category: 'Мультидиапазоны',
    descriptionRu: 'Упорядоченный набор непересекающихся daterange.'
  },

  // Перечисления и составные — https://www.postgresql.org/docs/16/datatype-enum.html , composite types
  {
    sqlName: 'ENUM',
    category: 'Перечисления и составные типы',
    descriptionRu: 'Пользовательский перечислимый тип: CREATE TYPE имя AS ENUM (...). В столбце указывают созданное имя типа.',
    aliasesNote: 'Не литерал ENUM — это напоминание о синтаксисе.'
  },
  {
    sqlName: 'COMPOSITE',
    category: 'Перечисления и составные типы',
    descriptionRu: 'Пользовательский составной тип (запись): CREATE TYPE имя AS (...). В столбце указывают имя типа.',
    aliasesNote: 'Строка таблицы сама по себе анонимный составной тип ROW.'
  },

  // Домены — https://www.postgresql.org/docs/16/sql-createdomain.html
  {
    sqlName: 'DOMAIN',
    category: 'Домены',
    descriptionRu: 'Домен над базовым типом с ограничениями: CREATE DOMAIN имя AS базовый_тип [constraints]. В столбце указывают имя домена.'
  },

  // OID-типы — https://www.postgresql.org/docs/16/datatype-oid.html
  {
    sqlName: 'oid',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'Числовой идентификатор объекта в системных каталогах (до 4 байт в классическом представлении).'
  },
  {
    sqlName: 'regproc',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID функции, отображаемый как имя функции без аргументов.'
  },
  {
    sqlName: 'regprocedure',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID функции с текстовым представлением имени и типов аргументов.'
  },
  {
    sqlName: 'regoper',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID оператора (только имя оператора).'
  },
  {
    sqlName: 'regoperator',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID оператора с указанием операндов.'
  },
  {
    sqlName: 'regclass',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID отношения (таблица, индекс и др.), отображаемый как имя со схемой.'
  },
  {
    sqlName: 'regtype',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID типа данных в pg_type, отображаемый как имя типа.'
  },
  {
    sqlName: 'regcollation',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID правила сортировки (collation).'
  },
  {
    sqlName: 'regdictionary',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID словаря полнотекстового поиска.'
  },
  {
    sqlName: 'regnamespace',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID пространства имён (схемы).'
  },
  {
    sqlName: 'regconfig',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID конфигурации полнотекстового поиска.'
  },
  {
    sqlName: 'regrole',
    category: 'Идентификаторы объектов (OID)',
    descriptionRu: 'OID роли (отображается как имя роли).'
  },

  // Служебные идентификаторы часто встречаются в системных столбцах; для пользовательских таблиц редки
  {
    sqlName: 'tid',
    category: 'Служебные идентификаторы',
    descriptionRu: 'Идентификатор физической строки в таблице (block + offset); тип системных столбцов ctid.'
  },
  {
    sqlName: 'xid',
    category: 'Служебные идентификаторы',
    descriptionRu: 'Идентификатор транзакции (32-бит; обёртка с циклическим использованием).',
    aliasesNote: 'xmin/xmax в версиях строк.'
  },
  {
    sqlName: 'xid8',
    category: 'Служебные идентификаторы',
    descriptionRu: 'Расширенный идентификатор транзакции на 64 бита.'
  },
  {
    sqlName: 'cid',
    category: 'Служебные идентификаторы',
    descriptionRu: 'Идентификатор команд внутри транзакции (cmin/cmax).'
  },
  {
    sqlName: 'name',
    category: 'Служебные идентификаторы',
    descriptionRu: 'Внутреннее имя объекта каталога фиксированной длины (до 63 байт для обычных имён идентификаторов); для пользовательских таблиц почти не используется.'
  },
  {
    sqlName: 'aclitem',
    category: 'Служебные идентификаторы',
    descriptionRu: 'Запись ACL в системном каталоге (список привилегий для одной роли на объект); в пользовательских столбцах не применяется.',
    aliasesNote: 'Тип элементов массива aclitem[] в relacl и др.'
  }
];

/** Только имена типов в порядке категории и имени (для проверок и автодополнения). */
export function pg16DataTypeSqlNames(): string[] {
  return [...PG16_DATA_TYPE_ENTRIES]
    .sort((a, b) => {
      const c = a.category.localeCompare(b.category, 'ru');
      return c !== 0 ? c : a.sqlName.localeCompare(b.sqlName, 'en');
    })
    .map((e) => e.sqlName);
}

const UNSUPPORTED_DIRECT_DDL_TYPES = new Set(['ARRAY', 'ENUM', 'COMPOSITE', 'DOMAIN']);

/** Имена типов, которые можно напрямую подставлять в ALTER/CREATE COLUMN без дополнительных параметров объекта. */
export function pg16DdlDataTypeSqlNames(): string[] {
  return pg16DataTypeSqlNames().filter((name) => !UNSUPPORTED_DIRECT_DDL_TYPES.has(name));
}

export function pg16DdlDataTypeVocRows(): string[][] {
  return [...PG16_DATA_TYPE_ENTRIES]
    .filter((entry) => !UNSUPPORTED_DIRECT_DDL_TYPES.has(entry.sqlName))
    .sort((a, b) => {
      const c = a.category.localeCompare(b.category, 'ru');
      return c !== 0 ? c : a.sqlName.localeCompare(b.sqlName, 'en');
    })
    .map((entry) => [
      entry.sqlName,
      entry.category,
      entry.descriptionRu,
      entry.aliasesNote || '',
    ]);
}
