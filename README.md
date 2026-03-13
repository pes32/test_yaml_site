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
│   ├── routes_debug.py     # /debug и /api/debug/* (structure, modules, logs, routes)
│   └── routes_static.py    # /templates/icons/* и /favicon.ico
├── frontend/               # Фронтенд-ассеты (бывш. static/), раздаются по /frontend
│   ├── css/
│   │   └── style.css       # Стили приложения
│   └── js/
│       ├── page.js         # Логика страниц, ленивые загрузки по вкладкам
│       ├── debug.js        # Панель отладки (списки файлов/маршрутов, REST-тестер)
│       ├── widgets.js      # Рендерер виджетов + ModalManager
│       └── widgets/        # Модульные виджеты
│           ├── button.js
│           ├── datetime_widgets.js
│           ├── factory.js
│           ├── float.js
│           ├── int.js
│           ├── ip_widgets.js
│           ├── list.js
│           ├── string.js
│           ├── table.js
│           └── text.js
├── pages/                  # Страницы системы (YAML)
│   ├── demo/
│   │   ├── attrs.yaml
│   │   ├── attrs_acc.yaml
│   │   └── gui.yaml
│   └── main/
│       ├── attrs.yaml
│       └── gui.yaml
├── templates/              # HTML шаблоны
│   ├── debug.html          # Панель отладки
│   ├── page.html           # Шаблон страницы
│   └── icons/              # SVG иконки для кнопок
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
- Все остальные `*.yaml` / `*.yml` в папке страницы считаются attrs-фрагментами
- Snapshot конфигурации обновляется автоматически по `mtime` YAML-файлов
- Flask routes не перерегистрируются: URL страниц резолвятся через актуальный snapshot

Если в YAML есть синтаксическая ошибка, она попадает в лог, а приложение продолжает работать на последнем валидном snapshot.

## Ленивые загрузки

- Атрибуты загружаются в контексте текущей страницы и не смешиваются между страницами.
- Страница `/demo` может дозагружать attrs для активного меню/вкладки и модальных окон, но запрос всегда ограничен текущей страницей.
- Частичная выборка доступна через параметр `names`:
  ```
  GET /api/attrs?page=demo&names=name1,name2,name3
  ```

## Доступные виджеты

- **str** — строковое поле ввода
- **int** — целочисленное поле с валидацией
- **float** — поле для дробных чисел
- **text** — многострочное текстовое поле
- **list** — выпадающий список (single/multi select)
- **ip** — поле для IP-адреса
- **ip_mask** — поле для IP с маской подсети
- **datetime** — выбор даты и времени
- **table** — таблица данных (есть редактируемый режим)
- **button** — кнопка (url, command, dialog, icon)

### Параметры виджета button

- **description** — текст кнопки
- **info** — подсказка под кнопкой
- **command** — команда для выполнения (в т.ч. `NAME -ui` для открытия модалки)
- **url** — URL для перехода (приоритет над command)
- **dialog** — диалог подтверждения
- **icon** — файл в `templates/icons/` или FontAwesome класс
- **size** — высота кнопки в пикселях
- **readonly** — только для чтения
- **output_attrs** — атрибуты для передачи в команде

## API Endpoints

- `GET  /api/config` — полная конфигурация системы
- `GET  /api/pages` — список доступных страниц
- `GET  /api/page/<name>` — конфигурация конкретной страницы
- `GET  /api/attrs?page=<name>` — все attrs указанной страницы
- `GET  /api/attrs?page=<name>&names=a,b,c` — выборка указанных attrs в рамках страницы
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

- Разделение кода на модули: `backend/*` и `frontend/*`
- Live-updating snapshot конфигурации по `mtime`
- Постраничный scope attrs
- Ленивые загрузки attrs для меню, вкладок и модалок в пределах одной страницы
- Встроенная debug-панель:
  - вкладка API — дерево/списки файлов проекта
  - вкладка REST — список доступных API с кликом для подстановки URL/метода
  - вкладка Log — последние записи лога с путём к файлу

## Примечания по разработке

- Логи пишутся в `logs/app.log` с ротацией.
- Статические файлы теперь в каталоге `frontend/`. В шаблонах используется `url_for('static', filename=...)` — Flask автоматически подставляет URL вида `/frontend/...`.
