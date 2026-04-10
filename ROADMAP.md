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

Что пока не закрыто:

- strict `typecheck` и `typecheck:table` всё ещё требуют отдельного typing pass по table runtime;
- `TableWidgetVm` пока остаётся слишком широким VM-boundary;
- browser/E2E smoke для table interactions ещё не заведён.

### Идеи из старых черновиков

Старые root-черновики сжаты сюда, чтобы не держать в корне несколько конкурирующих планов.

- Для таблицы остаются идеи fill/drag values, paste into selected range, фильтры/views и подсветка свежих изменений.
- Для автотестов целевой следующий шаг — не возвращать placeholder script, а завести реальный browser smoke/E2E runner.
- Для DB-интеграции нужен отдельный дизайн bind/save/update flow.

## Дальше

- Завершить data source модель для YAML-виджетов.
- Добавить аккуратный save/update flow без поломки текущих контрактов.
- Формализовать поведение `select_attrs` или заменить его более явным механизмом.
- Продолжить стабилизацию frontend runtime и документации.
- Закрыть strict typing debt в table runtime.
- Завести реальный browser smoke для ключевых flows, если проекту нужен автоматический regression gate.
