# Roadmap

[English version](ROADMAP_en.md)

## Сейчас

- YAML DSL и snapshot-сборка собирают рабочие интерфейсные страницы.
- Базовый набор виджетов, модалки, меню, action runtime и table/voc/datetime подсистемы образуют кликабельный макет.
- Production-like запуск работает через `waitress + nginx`.
- Debug tooling включает read-only SQL helper для PostgreSQL.

## Зоны Roadmap

### DB integration

Текущее состояние:

- есть `backend/database.py` и debug SQL tooling;
- есть PostgreSQL-страница и сопутствующие материалы;
- в DSL зарезервирован контур вроде `select_attrs`.

Ограничения:

- полноценного bind/save flow между YAML-формами и БД;
- источников данных для YAML-виджетов как завершенного публичного контракта;
- завершенной модели валидации/ошибок для DB-backed действий;
- production-ready story для multi-user data entry.

БД находится в зоне проектирования: в репозитории есть рабочие опорные части, но YAML-формы не имеют завершенного data-entry/save контура.

### Frontend/table quality gate

Текущее состояние:

- table runtime использует explicit TS modules;
- `TableWidget.vue` работает через `useTableRuntime.ts`;
- strict `type-holes`, `typecheck`, `typecheck:table`, `build` и `tests/run.sh` входят в обязательный frontend gate.

Отдельный долг качества:

- сужать explicit controller boundary в `useTableRuntime.ts` только вместе с тестами соответствующих interactions;
- поддерживать browser/E2E smoke для table interactions как regression gate.

### Frontend widget refactor

Текущий frontend статус:

- TS/Composition API widgets: `str`, `text`, `int`, `float`, `button`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `img`, `list`, `voc`, `split_button`;
- `table` работает как typed controller feature через `useTableRuntime.ts`;
- `frontend/js` содержит TypeScript/Vue source для widget layer, action runtime, datetime/IP/voc helpers, page/bootstrap glue, API/attrs/modal flows и diagnostics;
- общие Vue-компоненты используют typed `<script setup lang="ts">`.

Отдельные этапы качества:

- сужать типы на внешних DOM/event границах;
- расширять Playwright smoke для regressions;

### Идеи на будущее

- Для таблицы актуальны идеи fill/drag values, paste into selected range, фильтры/views и подсветка свежих изменений.
- Для автотестов целевой следующий шаг — расширять реальный browser smoke/E2E runner под новые regression cases.
- Для DB-интеграции нужен отдельный дизайн bind/save/update flow.

## Дальше

- Завершить data source модель для YAML-виджетов.
- Добавить аккуратный save/update flow без поломки текущих контрактов.
- Формализовать поведение `select_attrs` или заменить его более явным механизмом.
- Продолжить стабилизацию frontend runtime и документации.
- Поддерживать TS/Vue frontend source без JS adapters в widget/runtime слоях.
- Сужать table controller boundary и внешние DOM/event signatures без ослабления `typecheck`.
- Завести реальный browser smoke для ключевых flows, если проекту нужен автоматический regression gate.
