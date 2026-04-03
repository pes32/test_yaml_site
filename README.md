# YAML System

`YAML System` — это UI-система на Flask + Vue 3, где страницы описываются YAML-файлами, backend собирает из них snapshot, а frontend рендерит интерфейс через Vite bundle.

## Важно

Это сознательный breaking change: обратной совместимости по `LOWCODE_*` больше нет.
Используйте только `YAMLS_*`.

## Что здесь находится

- `backend/` — Flask-приложение, API, сборка snapshot, debug routes, CLI-инструменты.
- `pages/` — YAML-страницы, из которых собирается интерфейс.
- `frontend/` — стили, JS-виджеты и собранный bundle.
- `tooling/vite/` — Vite/TypeScript-конфиг и frontend-сборка.
- `templates/` — HTML-шаблоны, иконки и macOS bundle `sql_inspect.app`.
- `deploy/` — примеры deploy-конфигурации, включая `systemd`.
- `docs/` — техническая документация по архитектуре и контрактам.

## Что нужно для запуска

- `python3`
- `node` и `npm`
- `nginx` в `PATH` для `./start.sh` и `./start_debug.sh`
- `openssl` для локального self-signed сертификата

## Первый запуск с нуля

1. Создайте виртуальное окружение:

```bash
python3 -m venv .venv
```

2. Активируйте его:

```bash
source .venv/bin/activate
```

3. Установите Python-зависимости:

```bash
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

4. Установите frontend-зависимости:

```bash
npm --prefix tooling/vite install
```

5. При необходимости создайте env-файлы:

```bash
cp debug.env.example debug.env
cp production.env.example production.env
```

## Как запускать

### Debug-режим

```bash
./start_debug.sh
```

Что делает скрипт:

- читает `debug.env`, если файл есть;
- использует `YAMLS_ENV=development`;
- включает debug routes;
- при необходимости ставит frontend-зависимости;
- собирает Vite bundle;
- поднимает `waitress` и локальный `nginx`.

### Production-like локально

```bash
./start.sh
```

Что делает скрипт:

- читает `production.env`, если файл есть;
- использует `YAMLS_ENV=production`;
- выключает debug routes;
- собирает frontend;
- валидирует `frontend/dist/.vite/manifest.json`;
- запускает `waitress` на `127.0.0.1:8080`;
- запускает локальный `nginx` на `https://localhost:8443`;
- пишет логи в `run/`.

### Остановка

```bash
./stop.sh
```

## Если нужен другой env-файл

```bash
YAMLS_ENV_FILE=/path/to/production.env ./start.sh
YAMLS_ENV_FILE=/path/to/debug.env ./start_debug.sh
YAMLS_ENV_FILE=/path/to/production.env ./stop.sh
```

## Основные `YAMLS_*` переменные

- `YAMLS_ENV` — режим (`development` или `production`).
- `YAMLS_ENABLE_DEBUG_ROUTES` — включает или выключает `/debug` и `/api/debug/*`.
- `YAMLS_CONFIG_LIVE_RELOAD` — live reload YAML-конфигурации.
- `YAMLS_CONFIG_SCAN_INTERVAL` — интервал сканирования YAML-файлов.
- `YAMLS_WAITRESS_HOST`, `YAMLS_WAITRESS_PORT` — где слушает `waitress`.
- `YAMLS_NGINX_BIND_HOST`, `YAMLS_NGINX_PORT` — где слушает локальный `nginx`.
- `YAMLS_SERVER_NAME` — server name для `nginx`.
- `YAMLS_HEALTHCHECK_CONNECT_HOST` — host для healthcheck.
- `YAMLS_TRUST_PROXY`, `YAMLS_TRUSTED_PROXY`, `YAMLS_TRUSTED_PROXY_COUNT`, `YAMLS_TRUSTED_PROXY_HEADERS` — доверие proxy-заголовкам.
- `YAMLS_TLS_CERT`, `YAMLS_TLS_KEY` — свои TLS-сертификаты вместо локальных.
- `YAMLS_NGINX_MIME_TYPES` — путь к `mime.types`, если `nginx` установлен нестандартно.
- `YAMLS_SKIP_VITE_BUILD=1` — пропустить сборку frontend, только если bundle уже собран и валиден.
- `YAMLS_FLASK_HOST`, `YAMLS_FLASK_PORT`, `YAMLS_FLASK_DEBUG`, `YAMLS_FLASK_RELOADER` — прямой запуск через `python3 app.py`.

## Полезные команды

Проверить YAML-конфигурацию без запуска UI:

```bash
python3 -m backend.tools.validate_config
python3 -m backend.tools.validate_config --json
```

Собрать frontend вручную:

```bash
npm --prefix tooling/vite run build
```

Проверить типы frontend:

```bash
npm --prefix tooling/vite run typecheck
```

## Какие маршруты есть

- `/` — основная YAML-страница.
- `/page/<name>` — открытие страницы по имени.
- `/debug` — debug-панель, если включены debug routes.
- `/postgres` — hardcoded страница с кнопкой скачивания PostgreSQL-инструмента.
- `/postgres/download` — скачивание `sql_inspect.app.zip`.

## Где что редактировать

- Хотите менять UI-страницы системы — идите в `pages/`.
- Хотите менять backend-логику — идите в `backend/`.
- Хотите менять шапку, hardcoded страницы или иконки — идите в `templates/`.
- Хотите менять стили или поведение виджетов — идите в `frontend/css/` и `frontend/js/`.
- Хотите менять способ запуска — смотрите `start.sh`, `start_debug.sh`, `stop.sh`, `scripts/runtime_common.sh`.

## PostgreSQL-страница

В шапке есть кнопка Postgres.
Она открывает `/postgres`, где расположена кнопка `Скачать`.
Кнопка отдаёт архив `sql_inspect.app.zip`, внутри которого лежит macOS bundle `sql_inspect.app`.

## Типовые проблемы

### Не найдено `.venv`

Скрипты запуска ожидают виртуальное окружение в корне проекта.
Создайте его через `python3 -m venv .venv` и поставьте зависимости.

### Не найден `nginx`

`./start.sh` и `./start_debug.sh` запускают локальный `nginx`.
Если команда `nginx` не находится, установите `nginx` и проверьте, что он есть в `PATH`.

### Не найден `mime.types`

Если helper не может найти `mime.types`, укажите путь явно:

```bash
YAMLS_NGINX_MIME_TYPES=/opt/homebrew/etc/nginx/mime.types ./start.sh
```

### Firefox ругается на сертификат

Локальный `ssl/dev.crt` self-signed.
Это нормально для локальной разработки.
Если нужен доверенный сертификат, передайте свои `YAMLS_TLS_CERT` и `YAMLS_TLS_KEY`.

### Не собирается frontend

Проверьте, что установлены `node` и `npm`, а затем выполните:

```bash
npm --prefix tooling/vite install
npm --prefix tooling/vite run build
```

### Не работает скачивание `sql_inspect.app`

Проверьте, что каталог `templates/sql_inspect.app/` существует в рабочем дереве.
Маршрут `/postgres/download` архивирует именно этот bundle.

## Дополнительная документация

- [docs/runtime-architecture.md](docs/runtime-architecture.md)
- [docs/api-contracts.md](docs/api-contracts.md)
- [docs/table-subsystem.md](docs/table-subsystem.md)
- [docs/yaml-dsl.md](docs/yaml-dsl.md)

## Пример deploy

Пример `systemd` unit лежит в `deploy/systemd/yamls-waitress.service.example`.
