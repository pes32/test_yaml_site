# YAML System

Система для создания интерфейсов через YAML конфигурацию.

## Описание

Система позволяет создавать веб-интерфейсы, описывая их структуру и поведение в YAML файлах. Поддерживаются различные типы виджетов, динамическая валидация, и выполнение команд.

## Структура проекта

```
test_site/
├── app.py                  # Точка входа (Flask), debug без reloader, host=127.0.0.1
├── backend/                # Бэкенд-приложение (Flask)
│   ├── __init__.py         # Создание app, инициализация ConfigService, регистрация маршрутов
│   ├── config.py           # Загрузка YAML страниц и сбор snapshot конфигурации
│   ├── config_service.py   # Live-updating snapshot по mtime
│   ├── logging_setup.py    # Логирование в logs/app.log с ротацией
│   ├── routes_api.py       # /api/* (config, pages, page/<name>, attrs, reload, execute)
│   ├── routes_pages.py     # HTML-страницы приложения
│   ├── routes_debug.py     # /debug и /api/debug/* (structure, modules, logs, routes)
│   └── routes_static.py    # /templates/icons/* и /favicon.ico
├── frontend/               # Фронтенд-ассеты, раздаются по /frontend (url_for('static', ...))
│   ├── css/
│   │   ├── style.css       # Точка входа: @import tokens, base, ui, layout, components/*, widgets, utilities
│   │   ├── tokens.css      # Дизайн-токены
│   │   ├── fonts.css       # Подключение в page.html отдельно
│   │   └── components/     # table.css, modal.css, dropdown.css, datetime.css, …
│   └── js/
│       ├── page.js         # Логика страниц, ленивые загрузки по вкладкам
│       ├── debug.js        # Панель отладки (списки файлов/маршрутов, REST-тестер)
│       ├── gui_parser.js   # Разбор GUI YAML во Vue-компоненты
│       ├── widgets.js      # Рендерер виджетов + ModalManager
│       └── widgets/        # Модульные виджеты
│           ├── button.js
│           ├── confirm_modal.js
│           ├── datetime_widgets.js
│           ├── factory.js
│           ├── float.js
│           ├── img.js
│           ├── int.js
│           ├── ip_widgets.js
│           ├── list.js
│           ├── mixin.js
│           ├── md3_field.js
│           ├── string.js
│           ├── table/      # виджет table (общий namespace TableWidgetCore)
│           │   ├── table_core.js       # window.TableWidgetCore: DEBUG, log, dom.getCellFromEvent, заготовки модулей
│           │   ├── table_jump.js       # Cmd/Ctrl+стрелки по блокам ячеек (как в Excel)
│           │   ├── table_parse_attrs.js # разбор table_attrs → tableColumns, headerRows
│           │   ├── table_utils.js      # clamp, cloneTableData, safeCellValue, …
│           │   ├── table_format.js     # форматирование чисел/отображение ячеек
│           │   ├── table_sort.js       # сравнение ячеек для сортировки
│           │   ├── table_clipboard.js  # TSV serialize/deserialize
│           │   ├── table_context_menu.js
│           │   ├── table_selection.js  # SelectionMethods → methods виджета
│           │   ├── table_keyboard.js   # Keyboard.handleKeydown
│           │   ├── table_widget_helpers.js # WidgetMeasure, WidgetUiCoords
│           │   └── table_widget.js     # компонент Vue; registerTableWidget(factory)
│           └── text.js
├── pages/                  # Страницы системы (YAML), URL = имя папки
│   ├── main/
│   ├── 1_ui_demo/
│   ├── 2_widget_demo/      # демо виджетов (attrs_table.yaml, modal_gui.yaml, …)
│   └── about_author/
├── templates/              # HTML шаблоны
│   ├── debug.html          # Панель отладки
│   ├── page.html           # Шаблон страницы (порядок подключения скриптов, в т.ч. table/*)
│   └── icons/              # SVG иконки для кнопок и UI
├── logs/
│   └── app.log             # Лог приложения с ротацией
├── requirements.txt        # Python зависимости
└── start.sh                # Скрипт запуска (активация venv и python app.py)
```

## Установка и запуск

1. Установите зависимости:
   ```bash
   python3 -m pip install -r requirements.txt
   ```

2. Запустите приложение (через скрипт или напрямую):
   ```bash
   ./start.sh
   # или
   python3 app.py
   ```
   По умолчанию сервер слушает 127.0.0.1:8000, reloader отключён.

3. Откройте в браузере:
   - Главная страница: http://localhost:8000/
   - Панель отладки: http://localhost:8000/debug

## Создание новых страниц

1. Создайте папку в директории `pages/` с именем страницы
2. Добавьте один файл `gui.yaml` с описанием интерфейса страницы
3. Добавьте любое количество `attrs`-фрагментов в той же папке страницы

Правила загрузки:

- На одну страницу должен приходиться ровно один `gui.yaml` или `gui.yml`
- Все остальные `*.yaml` / `*.yml` в папке страницы считаются attrs-фрагментами, **кроме** файлов **`modal_<id>.yaml`** (разметка модальных окон)
- Модалки: файл `pages/<страница>/modal_<id>.yaml`, где `<id>` совпадает с префиксом команды кнопки до ` -ui` (пример: `modal_gui.yaml` → `command: modal_gui -ui`). Подгрузка при открытии: `GET /api/modal-gui`. Формат файла: **один ключ в стиле gui** (`любой_префикс "Заголовок окна":` и далее список), **или корень — список**, **или** `{ name?, icon?, content: [ ... ] }`. В основном `gui.yaml` модалку можно не дублировать (встроенный блок по-прежнему имеет приоритет в кэше, если есть).
- Snapshot конфигурации обновляется автоматически по `mtime` YAML-файлов
- Flask routes не перерегистрируются: URL страниц резолвятся через актуальный snapshot

Если в YAML есть синтаксическая ошибка, она попадает в лог, а приложение продолжает работать на последнем валидном snapshot.

## Ленивые загрузки

- Атрибуты загружаются в контексте текущей страницы и не смешиваются между страницами.
- Страница может дозагружать attrs для активного меню/вкладки и модальных окон, но запрос всегда ограничен текущей страницей.
- Частичная выборка доступна через параметр `names`:
  ```
  GET /api/attrs?page=<имя_страницы>&names=name1,name2,name3
  ```

## Доступные виджеты

Типы по умолчанию регистрируются в [frontend/js/widgets/factory.js](frontend/js/widgets/factory.js). Виджет **table** подключается отдельно вызовом `registerTableWidget(widgetFactory)` из [table_widget.js](frontend/js/widgets/table/table_widget.js) после создания фабрики.

- **str** — строковое поле ввода
- **int** — целочисленное поле с валидацией
- **float** — поле для дробных чисел
- **text** — многострочное текстовое поле
- **list** — выпадающий список (single/multi select)
- **ip** — поле для IP-адреса
- **ip_mask** — поле для IP с маской подсети
- **datetime** — выбор даты и времени
- **date** — только дата
- **time** — только время
- **img** — изображение по URL или пути
- **button** — кнопка (url, command, dialog, icon)
- **table** — таблица данных: редактирование (по умолчанию), `readonly: true`, полосы строк `zebra` (по умолчанию вкл.), сортировка по заголовкам (по умолчанию вкл.; **`sort: false`** отключает), минимальное число строк при загрузке **`row: N`** (пустые строки дополняются при инициализации и `setValue`). Логика разнесена по `widgets/table/*` и объединена в **`window.TableWidgetCore`** (в т.ч. Utils, Jump, Format, Sort, Clipboard, ContextMenu, Keyboard, SelectionMethods, `parseTableAttrs`, `dom`, `WidgetMeasure`, `WidgetUiCoords`). Порядок скриптов в [templates/page.html](templates/page.html): **`table_core.js` → `table_jump.js` → `table_parse_attrs.js` → `table_utils.js` → `table_format.js` → `table_sort.js` → `table_clipboard.js` → `table_context_menu.js` → `table_selection.js` → `table_keyboard.js` → `table_widget_helpers.js` → `table_widget.js`**. Отладочный лог таблицы: в консоли `TableWidgetCore.DEBUG = true`. Пример: [pages/2_widget_demo/attrs_table.yaml](pages/2_widget_demo/attrs_table.yaml).

### Параметры виджета button

Типы кнопок:
- **icon-only** — только иконка: `icon`, `hint` (подсказка), без `label`; `size` задаёт иконку, внешний квадрат без `width` масштабируется пропорционально эталону 24px→40px; явный `width` — размер кнопки (бордер-бокс)
- **icon+text** — иконка и текст: `icon`, `label`
- **text-only** — только текст: `label`

- **label** — текст кнопки (для icon+text и text-only)
- **hint** — подсказка при наведении (для icon-only)
- **sup_text** — дополнительный текст под виджетом
- **command** — команда (в т.ч. `NAME -ui` для модалки)
- **url** — URL для перехода (приоритет над command)
- **dialog** — диалог подтверждения
- **icon** — файл в `templates/icons/` или FontAwesome класс
- **size** — размер иконки в px (по умолчанию 24)
- **width** — для icon-only: явный размер кнопки в px; если не задан, выводится от `size` с теми же пропорциями отступов, что у 24→40
- **output_attrs** — атрибуты для передачи в команде

## API Endpoints

- `GET  /api/config` — полная конфигурация системы
- `GET  /api/pages` — список доступных страниц
- `GET  /api/page/<name>` — конфигурация конкретной страницы
- `GET  /api/attrs?page=<name>` — все attrs указанной страницы
- `GET  /api/attrs?page=<name>&names=a,b,c` — выборка указанных attrs в рамках страницы
- `GET  /api/modal-gui?page=<name>&id=<modal_id>` — ленивая загрузка YAML модалки (`modal_<id>.yaml` в папке страницы)
- `POST /api/execute` — выполнение команд (тело JSON: `{ "command": "...", "params": {...} }`)
- `POST /api/reload` — принудительная проверка YAML и обновление snapshot без мутаций Flask routes
- `GET  /api/debug/structure` — список файлов проекта (yaml/py/js)
- `GET  /api/debug/modules` — список загруженных модулей Python
- `GET  /api/debug/logs` — последние строки лога
- `GET  /api/debug/routes` — список зарегистрированных API-маршрутов

Дополнительно:
- `GET /templates/icons/<name.svg>` — отдача SVG-иконок
- `GET /favicon.ico` — favicon из `frontend/`

## Особенности

- Live-updating snapshot конфигурации по `mtime`
- Постраничный scope attrs
- Ленивые загрузки attrs для меню, вкладок и модалок в пределах одной страницы

## Примечания по разработке

- Логи пишутся в `logs/app.log` с ротацией.
- Статические файлы в каталоге `frontend/`. В шаблонах используется `url_for('static', filename=...)` — Flask отдаёт URL вида `/frontend/...`.
