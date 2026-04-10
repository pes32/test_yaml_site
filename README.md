# Yamls - YAML System

[English version](README_en.md)

# Вкратце от автора

Запущено на: yamls.ru

- Это кликабельный макет системы на ямлах. Ямлы как описание атрибутов и интерфейса выбраны мной в силу простоты описания кем угодно. Мы (я и моя прошлая команда) пришли к ним после разработки бесчётного количества учётных систем. Сейчас в системе готовы самые популярные виджеты ввода, которых хватит в большинстве задач.
- Рекомендую "потыкать" все виджеты руками, многие из них получились хорошо, особенно таблица (а вот text/textarea не очень).
- Текущая система гипертрофирована и сделана на ямлах целиком. Это не повод так делать всегда, но задуматься можно.
- В планах реализация базы данных. Вообще база уже прикручена, но пока не работает. Основная проблема: как её прикрутить? Если следовать текущей логике, то описание функций и бизнес-логики следует выносить в postgres, как наиболее простому языку, а вызов сделать в текущих атрибутах ямлов. Не уверен, что это хорошая идея, а пилить свой полноценный бэк - бессмыслено, это зря потраченное время.
- Может быть, когда-нибудь прикручу диаграммы и какие-нибудь интеграции. Или ещё какие-то виджеты и функционал. Пока не знаю.
- Судоку добавлен for fun (он у меня уже был готов на питоне), его можно безболезнено выкинуть из системы. 
- Общий бюджет написания системы: не более 100$ (скорее всего, где-то 40-60$). По времени - где-то месяц. 
- Дальше идёт нейросетевой текст. Хотите ли вы его читать - дело ваше. Я предупредил.

## О системе

Yamls - YAML System — это YAML-driven UI-движок для кликабельных порталов и интерфейсных прототипов: страницы описываются YAML-файлами, backend собирает из них snapshot, а frontend рендерит готовый интерфейс через Vite bundle. Текущая версия проекта — рабочий кликабельный макет.

В отличие от типичного form builder или admin generator, здесь первичен не database schema и не визуальный редактор, а декларативное описание страниц, атрибутов, меню, модалок и действий в YAML. Backend отвечает за сборку и валидацию snapshot-конфига, а frontend runtime уже исполняет согласованный контракт.

Frontend runtime сейчас формализован вокруг трёх основных границ:

- `page_store` хранит только snapshot-derived state;
- `page_session_store` хранит только committed page/session state;
- widget tree работает через `WidgetDefinitionRegistry`, lifecycle handles и host runtime bridge, а не через прямой доступ к `$root`.

## Что это даёт

- Описание UI через YAML вместо ручной верстки каждой страницы.
- Backend snapshot pipeline с валидацией и диагностикой конфигурации.
- Frontend runtime с виджетами `str`, `text`, `int`, `float`, `date`, `time`, `datetime`, `ip`, `ip_mask`, `list`, `voc`, `img`, `button`, `split_button`, `table`.
- Встроенную debug-панель и отдельный read-only SQL debug tooling.
- Production-like локальный запуск, приближенный к серверной схеме `public nginx -> waitress on 127.0.0.1`.

## Где демо, а где личные материалы автора

- Движок и основные примеры лежат в [pages/2_widget_demo](pages/2_widget_demo) и в документации из [docs/yaml-dsl.md](docs/yaml-dsl.md).
- Архитектурные детали описаны в [docs/runtime-architecture.md](docs/runtime-architecture.md), [docs/widget-registry-contract.md](docs/widget-registry-contract.md), [docs/api-contracts.md](docs/api-contracts.md) и [docs/table-subsystem.md](docs/table-subsystem.md).
- Страница `about_author` и hardcoded Postgres-раздел нужны как демонстрационные и авторские материалы. Это не “ядро движка” и не обязательная часть будущей продуктовой сборки.

## Структура репозитория

- `backend/` — Flask backend, snapshot builder, validation, API, debug tooling.
- `pages/` — YAML-страницы и атрибуты.
- `frontend/` — стили, виджеты, runtime и собранный bundle.
- `tooling/vite/` — frontend toolchain и typecheck/build.
- `templates/` — HTML-шаблоны, иконки и связанные статические материалы.
- `deploy/` — примеры deployment-конфигурации, включая `systemd`.
- `docs/` — архитектурная и эксплуатационная документация.

## Быстрый старт

### Требования

- `python3` 3.8+
- `node` и `npm`
- `nginx` в `PATH` для `./start.sh` и `./start_debug.sh`
- `openssl` для локального self-signed сертификата

### Первый запуск

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
npm --prefix tooling/vite ci
```

Если при `pip install -r requirements.txt` видите ошибки вида `No matching distribution found for waitress==3.0.0` или `Werkzeug==3.0.6`, почти всегда это означает, что окружение создано на слишком старом Python. Для этого репозитория используйте `Python 3.8+`.

Если нужны локальные переопределения env-переменных, создайте вручную `settings/production.env` и/или `settings/debug.env`. Базовые значения теперь лежат в `settings/production.defaults.env` и `settings/debug.defaults.env`. Старые корневые пути тоже поддерживаются как fallback.

### Debug-режим

```bash
./start_debug.sh
```

### Production-like локально

```bash
./start.sh
```

### Остановка

```bash
./stop.sh
```

## Полезные команды

Проверка YAML-конфигурации:

```bash
python3 -m backend.tools.validate_config
python3 -m backend.tools.validate_config --json
```

Typecheck frontend:

```bash
npm --prefix tooling/vite run typecheck
```

Сборка frontend:

```bash
npm --prefix tooling/vite run build
```

## Production и безопасность

- Production-like стек уже есть, но проект пока честнее воспринимать как demo/runtime prototype, а не как готовую multi-user платформу.
- Debug routes в production по умолчанию выключены.
- Полноценной auth/permission-модели пока нет.
- Основная YAML-часть сейчас не делает DB persistence.
- Для реального Linux-сервера используйте схему `public nginx -> waitress on 127.0.0.1`, описанную в [docs/deploy-linux.md](docs/deploy-linux.md).

## Ограничения

- DB integration частичная: есть PostgreSQL tooling и debug SQL, но нет завершенного data-entry контура для YAML-форм.
- `select_attrs` зарезервирован в DSL, но ещё не реализует обещанный механизм заполнения.
- Это не визуальный редактор и не self-service builder для конечных пользователей.
- Публичные контракты движка ещё формируются; для внешних интеграций лучше считать проект evolving.

## Roadmap

Краткая дорожная карта вынесена в [ROADMAP.md](ROADMAP.md). Главное направление после `v.0.2 л.`:

- аккуратная DB-интеграция без ломки YAML-контрактов;
- формализация data sources и save flow;
- дальнейшая стабилизация runtime и документации;
- постепенное расширение demo-примеров.

## Для участников

- Правила для вкладов: [CONTRIBUTING.md](CONTRIBUTING.md)
- История изменений: [CHANGELOG.md](CHANGELOG.md)

## Лицензия

Проект распространяется по лицензии MIT. См. [LICENSE](LICENSE).
