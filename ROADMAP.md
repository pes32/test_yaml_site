# Roadmap

[English version](ROADMAP_en.md)

## Сейчас

- YAML DSL и snapshot-сборка уже позволяют собирать рабочие интерфейсные страницы.
- Базовый набор виджетов, модалок, меню, action runtime и table/voc/datetime подсистем уже собран в кликабельный макет.
- Есть production-like запуск через `waitress + nginx`.
- Есть debug tooling и read-only SQL helper для PostgreSQL.

## Частично готово

### DB integration

Состояние сейчас:

- есть `backend/database.py` и debug SQL tooling;
- есть PostgreSQL-страница и сопутствующие материалы;
- в DSL уже виден будущий контур вроде `select_attrs`.

Чего пока нет:

- полноценного bind/save flow между YAML-формами и БД;
- источников данных для YAML-виджетов как завершенного публичного контракта;
- завершенной модели валидации/ошибок для DB-backed действий;
- production-ready story для multi-user data entry.

Правильное чтение текущего статуса: БД уже исследована и частично интегрирована, но это пока roadmap, а не finished feature.

### Frontend/table quality gate

Что уже закрыто:

- table runtime переведён в explicit TS modules;
- `TableWidget.vue` работает через `useTableRuntime.ts`;
- strict `typecheck` и `typecheck:table` проходят как обязательный frontend gate.

Что остаётся отдельным долгом:

- сужать explicit controller boundary в `useTableRuntime.ts` только вместе с тестами соответствующих interactions;
- поддерживать browser/E2E smoke для table interactions как regression gate.

### Frontend widget refactor

Статус после полного TS-прохода:

- migrated: `str`, `text`, `int`, `float`, `button`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `img`, `list`, `voc`, `split_button`;
- migrated with controller boundary: `table`;
- legacy JS removed from `frontend/js`: action runtime, datetime helpers, IP helpers, voc helpers, page/bootstrap glue, API/attrs/modal flows and diagnostics;
- shared common components use typed `<script setup lang="ts">`.

Что остаётся отдельными этапами качества:

- сужать типы на внешних DOM/event границах;
- расширять Playwright smoke для regressions;

### Идеи из старых черновиков

Старые root-черновики сжаты сюда, чтобы не держать в корне несколько конкурирующих планов.

- Для таблицы остаются идеи fill/drag values, paste into selected range, фильтры/views и подсветка свежих изменений.
- Для автотестов целевой следующий шаг — расширять реальный browser smoke/E2E runner под новые regression cases.
- Для DB-интеграции нужен отдельный дизайн bind/save/update flow.

## Дальше

- Завершить data source модель для YAML-виджетов.
- Добавить аккуратный save/update flow без поломки текущих контрактов.
- Формализовать поведение `select_attrs` или заменить его более явным механизмом.
- Продолжить стабилизацию frontend runtime и документации.
- Поддерживать полный TS widget layer без legacy JS adapters.
- Сужать table controller boundary и внешние DOM/event signatures без ослабления `typecheck`.
- Завести реальный browser smoke для ключевых flows, если проекту нужен автоматический regression gate.
