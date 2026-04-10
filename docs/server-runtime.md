# Server Runtime

## Current Runtime Entry Points

Основной локальный production-like запуск:

- `./start.sh`
- `./stop.sh`

Debug-запуск:

- `./start_debug.sh`

Общий shell-код запуска живёт в `scripts/runtime_common.sh`. Flask/Waitress entrypoints лежат в `settings/wsgi.py` и `settings/app.py`.

## Environment Files

Базовые значения:

- `settings/production.defaults.env`
- `settings/debug.defaults.env`

Локальные override-файлы, если нужны:

- `settings/production.env`
- `settings/debug.env`

Старые корневые env-пути поддерживаются как fallback, но новые настройки лучше хранить в `settings/`.

Для debug режима итоговый `YAMLS_NGINX_BIND_HOST` сейчас остаётся `0.0.0.0`. Это сделано осознанно для текущего окружения, хотя для более закрытого локального запуска безопаснее был бы `127.0.0.1`.

## Nginx, TLS And Logs

- `nginx/nginx.conf.template` — шаблон nginx config.
- `run/nginx.conf` — generated config для текущего запуска.
- `ssl/dev.crt` и `ssl/dev.key` — локальный self-signed TLS материал.
- `run/*.log` и `logs/app.log` — runtime logs.
- `frontend/dist` — собранный Vite bundle, который отдаёт nginx/backend flow.

## Backend And Static Runtime Assets

Используемые server/runtime assets, которые не считаются мусором:

- `database/db_settings.yaml` — настройки read-only SQL debug tooling.
- `templates/sql_inspect.app` — авторский PostgreSQL helper/download material.
- `templates/Документация` — авторские/документационные материалы.
- `templates/files` — downloadable/static materials.
- `templates/mems` — авторские demo assets.
- `sudoku` — demo/author feature.

`deploy_yamls.sh` не входит в tracked product workflow и выглядит как локальный deploy helper с реальными host/user данными. Его не нужно удалять автоматически без отдельного решения владельца проекта.

## Production Safety

- Debug routes в production по умолчанию выключены.
- Основной YAML flow пока не предоставляет production-ready DB persistence.
- Полной auth/permission модели пока нет.
- Для публичного сервера целевая схема остаётся `public nginx -> waitress on 127.0.0.1`, но конкретную deployment-инструкцию нужно оформлять отдельно под фактическую инфраструктуру.
