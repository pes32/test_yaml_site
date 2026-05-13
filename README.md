# Yamls - YAML System

[English version](README_en.md)

# Вкратце от автора

Запущено на: yamls.ru

- Это кликабельный макет системы на ямлах. Ямлы как описание атрибутов и интерфейса выбраны мной в силу простоты описания кем угодно. Мы (я и моя прошлая команда) пришли к ним после разработки бесчётного количества учётных систем. Сейчас в системе готовы самые популярные виджеты ввода, которых хватит в большинстве задач.
- Рекомендую "потыкать" все виджеты руками, многие из них получились хорошо, особенно таблица (а вот text/textarea не очень)
- Текущая система гипертрофирована и сделана на ямлах целиком. Это не повод так делать всегда, но задуматься можно.
- В планах реализация базы данных. Вообще база уже прикручена, но пока не работает. Основная проблема: как её прикрутить? Если следовать текущей логике, то описание функций и бизнес-логики следует выносить в postgres, как наиболее простому языку, а вызов сделать в текущих атрибутах ямлов. Не уверен, что это хорошая идея, а пилить свой полноценный бэк - бессмыслено, это зря потраченное время.
- Может быть, когда-нибудь прикручу диаграммы и какие-нибудь интеграции. Или ещё какие-то виджеты и функционал. Пока не знаю.
- Судоку добавлен for fun (он у меня уже был готов на питоне), его можно безболезнено выкинуть из системы. 
- Общий бюджет написания системы: не более 100$. По времени - где-то месяц. 
- Дальше идёт нейросетевой текст. Хотите ли вы его читать - дело ваше. Я предупредил.

## О системе

Yamls - YAML System — это YAML-driven UI-движок для кликабельных порталов и интерфейсных прототипов: страницы описываются YAML-файлами, backend собирает из них snapshot, а frontend рендерит готовый интерфейс через Vite bundle. Текущая отмеченная версия — `v.0.5 л.` (см. [CHANGELOG.md](CHANGELOG.md)); по сути это развивающийся кликабельный макет с нарастающей серверной функциональностью.

В отличие от типичного form builder или admin generator, здесь первичен не database schema и не визуальный редактор, а декларативное описание страниц, атрибутов, меню, модалок и действий в YAML. Backend отвечает за сборку и валидацию snapshot-конфига, а frontend runtime исполняет согласованный контракт.

Frontend runtime сейчас формализован вокруг трёх основных границ:

- `page_store` хранит только snapshot-derived state;
- `page_session_store` хранит только committed page/session state;
- widget tree работает через `WidgetDefinitionRegistry`, lifecycle handles и host runtime bridge, а не через прямой доступ к `$root`.

## Что это даёт

- Описание UI через YAML вместо ручной верстки каждой страницы.
- Backend snapshot pipeline с валидацией и диагностикой конфигурации.
- Frontend runtime с виджетами `str`, `text`, `int`, `float`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`, `img`, `button`, `split_button`, `table`.
- Авторизацию, `/user_settings` (в т.ч. настройка подключения к PostgreSQL, работа со схемой БД и резервные копии для роли admin) и admin SQL-блок для системных операций.
- Production-like локальный запуск, приближенный к серверной схеме `public nginx -> waitress on 127.0.0.1`.

## Где демо, а где личные материалы автора

- Движок и основные примеры лежат в [pages/2_widget_demo](pages/2_widget_demo) и в документации из [docs/yaml-dsl.md](docs/yaml-dsl.md).
- Архитектурные детали описаны в [docs/runtime-architecture.md](docs/runtime-architecture.md), [docs/server-runtime.md](docs/server-runtime.md), [docs/widget-registry-contract.md](docs/widget-registry-contract.md), [docs/api-contracts.md](docs/api-contracts.md), [docs/api-contracts-ddl.md](docs/api-contracts-ddl.md), [docs/table-subsystem.md](docs/table-subsystem.md), [docs/table-state-invariants.md](docs/table-state-invariants.md), [docs/table-api-map.md](docs/table-api-map.md), [docs/table-testing-matrix.md](docs/table-testing-matrix.md), [docs/table-performance-notes.md](docs/table-performance-notes.md) и [docs/table-runtime-notes.md](docs/table-runtime-notes.md).
- Страница `about_author` и hardcoded Postgres-раздел нужны как демонстрационные и авторские материалы. Это не “ядро движка” и не обязательная часть будущей продуктовой сборки.

## Структура репозитория

- `backend/` — Flask backend, snapshot builder, validation, API, auth/admin services.
- `pages/` — YAML-страницы и атрибуты.
- `frontend/` — стили (`frontend/css`), канонический TS/Vue runtime и виджеты (`frontend/js`), Vue-оболочки страниц (`frontend/apps`), собранный bundle (`frontend/dist`).
- `tooling/vite/` — frontend toolchain и typecheck/build; **npm-зависимости фронта только здесь** ([`tooling/vite/package.json`](tooling/vite/package.json)).
- корневой [`package.json`](package.json) — только **прокси-скрипты** (`vite:*`) без своих зависимостей; подробнее — [ROADMAP.md](ROADMAP.md) (раздел «Сборка frontend / npm»).
- `templates/` — HTML-шаблоны, иконки и связанные статические материалы.
- `scripts/`, `settings/`, `nginx/`, `run/`, `logs/`, `ssl/` — локальный server/runtime запуск и generated runtime files.
- `docs/` — архитектурная и эксплуатационная документация.

## Быстрый старт

### Требования

- `python3` 3.8+
- `node` и `npm`
- `nginx` в `PATH` для `./start.sh`
- `openssl` для локального self-signed сертификата

### Первый запуск

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
npm --prefix tooling/vite ci
```

Альтернатива без `cd`: после установки зависимостей в `tooling/vite` команды сборки можно вызывать из **корня** репозитория — `npm run vite:typecheck`, `npm run vite:typecheck:table`, `npm run vite:build`, `npm run vite:preflight`, `npm run vite:dev` (см. корневой `package.json`; они проксируют в `tooling/vite`).

Если при `pip install -r requirements.txt` видите ошибки вида `No matching distribution found for waitress==3.0.0` или `Werkzeug==3.0.6`, почти всегда это означает, что окружение создано на слишком старом Python. Для этого репозитория используйте `Python 3.8+`.

Если нужны локальные переопределения env-переменных, создайте вручную `settings/production.env`. Базовые значения лежат в `settings/production.defaults.env`. Корневой env-путь доступен как fallback.

### Production-like локально

```bash
./start.sh
```

После запуска локальный адрес: `https://localhost:8443`.

### Остановка

```bash
./stop.sh
```

### Проверка

Локальные UI-проверки запускаются только через штатные тестовые скрипты:

```bash
tests/run.sh
```

Для отладки с видимым браузером:

```bash
tests/run_headed.sh
```

В проекте нет отдельного Flask dev-server entrypoint. Рабочий локальный контур здесь именно `./start.sh` (`nginx -> waitress -> settings.wsgi:app`) плюс тесты из `tests/`.

## Production и безопасность

- Production-like стек доступен, но проект пока честнее воспринимать как demo/runtime prototype, а не как готовую multi-user платформу.
- Auth/permission-модель покрывает новые системные страницы и admin API; YAML-страницы пока не ограничиваются авторизацией.
- Основная YAML-часть сейчас не делает DB persistence.
- Server/runtime окружение описано в [docs/server-runtime.md](docs/server-runtime.md). Для публичного сервера целевая схема остаётся `public nginx -> waitress on 127.0.0.1`, но конкретную deployment-инструкцию нужно оформлять под фактическую инфраструктуру.

## Ограничения

- Интеграция с БД частичная: есть подключение к PostgreSQL, админский SQL и UI настроек БД (подключение, DDL/схема), но нет завершённого контура ввода и сохранения данных из обычных YAML-форм (`save flow` для attrs).
- `select_attrs` зарезервирован в DSL, но ещё не реализует обещанный механизм заполнения.
- Это не визуальный редактор и не self-service builder для конечных пользователей.
- Публичные контракты движка ещё формируются; для внешних интеграций лучше считать проект evolving.

## Roadmap

Краткая дорожная карта вынесена в [ROADMAP.md](ROADMAP.md). В числе приоритетов после текущего состояния (`v.0.5 л.`):

- связка YAML-атрибутов с БД (`output`/`input` и единый save/update flow) без поломки контрактов;
- формализация источников данных для виджетов и модели ошибок;
- доработки таблицы (диапазон мышью, фильтры, редактирование сущностей в модалке/на отдельной странице);
- дальнейшая стабилизация runtime, автотестов и документации.

## История изменений

История изменений: [CHANGELOG.md](CHANGELOG.md).

## Лицензия

Проект распространяется по лицензии MIT. См. [LICENSE](LICENSE).
