# YAML System

YAML-driven UI система на Flask + Vue 3, где backend собирает versioned snapshot конфигурации, а frontend работает только через Vite bundle и нормализованные API-контракты.

## Что в проекте сейчас

- backend собирает `AppSnapshot` из YAML-страниц, attrs-фрагментов и модалок;
- HTML страницы отдают bootstrap envelope через `<script id="page-data">`;
- frontend стартует только через Vite entrypoints из `tooling/vite/`;
- UI не зависит от `window.*`-глобалов, ручного порядка `<script>` и legacy payload shape;
- transport-формат API нормализуется в одном месте: `frontend/js/runtime/api_client.js`.

## Быстрый запуск

Установите Python-зависимости:

```bash
python3 -m pip install -r requirements.txt
```

Установите frontend-зависимости:

```bash
npm --prefix tooling/vite install
```

Запустите локальную сборку и Flask:

```bash
./start.sh
```

По умолчанию `start.sh`:

- активирует `.venv`;
- собирает frontend через Vite;
- запускает Flask на `http://127.0.0.1:8000`.

Полезные переменные:

```bash
LOWCODE_SKIP_VITE_BUILD=1 ./start.sh
LOWCODE_FLASK_RELOADER=1 ./start.sh
LOWCODE_FLASK_PORT=8001 ./start.sh
```

## Frontend workflow

Проверка типов:

```bash
npm --prefix tooling/vite run typecheck
```

Production/build bundle:

```bash
npm --prefix tooling/vite run build
```

Flask использует manifest из `frontend/dist/.vite/manifest.json`. Legacy fallback больше нет: если bundle не собран, приложение не должно считаться готовым к запуску.

Для table feature важно, что `frontend/js/widgets/table/index.js` подтягивает side-effect модули, которые регистрируют части внутреннего engine namespace (`Utils`, `Format`, `Sort`, `Grouping` и т.д.). Если такой импорт потерять, исходник может выглядеть корректно, но Vite выкинет модуль из bundle, и поведение тихо деградирует в runtime.

## Валидация конфигурации

Проверить YAML без запуска UI:

```bash
python3 -m backend.tools.validate_config
python3 -m backend.tools.validate_config --json
```

## Архитектура

- `backend/` — snapshot builder, API, debug routes, CLI tools
- `pages/` — исходные YAML-страницы
- `frontend/js/runtime/` — bootstrap parser, API client, flow-модули, stores, error/diagnostics model
- `frontend/js/widgets/` — widget registry и feature-виджеты
- `frontend/js/widgets/table/` — table subsystem без глобальных namespace
- `tooling/vite/` — Vite + TypeScript contracts + entrypoints
- `templates/` — HTML шаблоны, подключающие только Vite bundles
- `docs/` — актуальные архитектурные и контрактные описания

## Документация

- [docs/runtime-architecture.md](docs/runtime-architecture.md) — финальная runtime-архитектура frontend/backend
- [docs/api-contracts.md](docs/api-contracts.md) — transport и domain-контракты API
- [docs/table-subsystem.md](docs/table-subsystem.md) — устройство table feature
- [docs/yaml-dsl.md](docs/yaml-dsl.md) — правила YAML DSL и backend normalization

## Production notes

- выключайте debug routes через `LOWCODE_ENV=production` или `LOWCODE_ENABLE_DEBUG_ROUTES=0`;
- перед выкладкой прогоняйте `python3 -m backend.tools.validate_config`;
- frontend bundle должен собираться заранее командой `npm --prefix tooling/vite run build`;
- для production используйте normal WSGI/server process, а не dev-server Flask.
