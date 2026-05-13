# Серверный runtime

## Точки входа runtime

Основной локально production-like запуск:

- `./start.sh`
- `./stop.sh`

Общий shell-код: `scripts/runtime_common.sh`. Backend entrypoint: `settings/wsgi.py` (Waitress через `./start.sh`).

## Файлы окружения

**Каноничное расположение** (одно «правильное» место для настроек окружения):

| Файл | Роль |
|------|------|
| `settings/production.defaults.env` | базовые значения по умолчанию |
| `settings/production.env` | локальные переопределения (не в git по смыслу продукта) |

**Deprecated.** Fallback на **корень репозитория** (`production.defaults.env`, `production.env`) по-прежнему обрабатывается в `start.sh` / `stop.sh` для обратной совместимости, но **не используйте это в новых сетапах** — иначе появятся два равноправных места конфигурации и путаница при поддержке. Новые клоны и CI держите только на `settings/*.env`.

Явный override путей возможен через переменные `YAMLS_DEFAULT_ENV_FILE` / `YAMLS_ENV_FILE` (см. `start.sh`).

## Nginx, TLS и логи

- `nginx/nginx.conf.template` — шаблон nginx.
- `run/nginx.conf` — сгенерированный конфиг текущего запуска.
- `ssl/dev.crt`, `ssl/dev.key` — локальный self-signed TLS.
- `run/*.log`, `logs/app.log` — логи.
- `frontend/dist` — собранный Vite bundle для nginx/backend.

## Backend и статические ресурсы

| Asset | Назначение | Статус |
|-------|------------|--------|
| `database/db_settings.yaml` | fallback подключения к PostgreSQL | активный fallback |
| `templates/sql_inspect.app` | материал PG helper / download | авторский |
| `templates/Документация` | документация в шаблонах | авторский |
| `templates/files` | статические / downloadable файлы | активный |
| `templates/mems` | демо-ассеты | демо |
| `sudoku` | демо/авторская фича | демо |

## Безопасность в production

- **YAML-страницы сейчас публичны:** маршруты вида `/page/...` и контент из snapshot **не закрыты** моделью сессии/auth так же, как системные экраны и admin API. Это **архитектурный риск**: любой, кто знает URL, может открыть страницу и дергать связанные snapshot API (`/api/page`, `/api/attrs`, `/api/execute`, …) без проверки пользователя. Для любого развёртывания с чувствительными данными нужно явно решать: сетевой периметр, отдельный ingress без публикации YAML-маршрутов, middleware с auth, или доведение защиты YAML-дерева до паритета с остальным приложением. Пока это не сделано, treat YAML surface как **открытый read/execute к миру**, если приложение доступно извне.

- Основной YAML flow **не** позиционируется как production-ready persistence схемы БД под всё приложение.

- Auth и роли **покрывают** новые системные страницы и admin/user-settings API; **не** полагаются на них для изоляции YAML-контента.

- Целевая схема для публичного сервера: `public nginx → Waitress на 127.0.0.1`; конкретный playbook деплоя — отдельно под вашу инфраструктуру.
