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

## Дальше

- Завершить data source модель для YAML-виджетов.
- Добавить аккуратный save/update flow без поломки текущих контрактов.
- Формализовать поведение `select_attrs` или заменить его более явным механизмом.
- Продолжить стабилизацию frontend runtime и документации.

