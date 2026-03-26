# YAML DSL

`pages/<page>/` описывает страницу как набор YAML-документов, из которых backend собирает нормализованный snapshot.

## Файлы страницы

- `gui.yaml` или `gui.yml` — обязательная GUI-структура страницы
- остальные `*.yaml` / `*.yml` — attrs-фрагменты
- `modal_<id>.yaml` — отдельные modal documents

Frontend больше не читает raw YAML напрямую. Все документы сначала проходят backend normalization.

## Корневые GUI-элементы

- `menu "Название"` — меню страницы
- `tab "Название"` — вкладка
- `box "Название"` — секция с рамкой
- `collapse "Название"` — сворачиваемая секция
- `row` / `rows` / `widgets` — ряды виджетов
- `button` — кнопка модалки
- любой другой корневой ключ — встроенная модалка

Из `gui.yaml` backend выводит:

- `gui`
- `guiMenuKeys`
- embedded modals
- `modalGuiIds`

## Модалки

Модалка может быть объявлена:

1. встроенно в `gui.yaml`;
2. отдельным файлом `modal_<id>.yaml`.

Приоритет:

- встроенная модалка выше файловой.

Допустимые формы `modal_<id>.yaml`:

- список элементов;
- словарь с одним gui-style ключом и списком;
- объект вида `{ name?, title?, icon?, content: [...] }`;
- объект вида `{ items: [...] }`.

На выходе backend нормализует модалку в `NormalizedModal` с полями:

- `id`
- `name`
- `title`
- `icon`
- `tabs`
- `content`
- `buttons`
- `widgetNames`
- `source`
- `sourceFile`

## Attrs

Attrs-фрагменты мержатся на backend.

Правила:

- дубликаты допустимы;
- дубликаты фиксируются в diagnostics;
- побеждает последний встретившийся ключ.

Нормализованный attrs map потом используется:

- для page bootstrap;
- для lazy `/api/attrs`;
- для modal attrs loading;
- для table dependency resolution.

## UI-команды

Формат `command: <name> -ui` сохраняется.

`<name>` должен соответствовать:

- встроенной модалке;
- или файлу `modal_<name>.yaml`.

Когда пользователь открывает такую модалку, frontend получает уже нормализованный `/api/modal-gui` response, а не сырой YAML-документ.

## Validation

Проверить конфигурацию можно без запуска UI:

```bash
python3 -m backend.tools.validate_config
python3 -m backend.tools.validate_config --json
```

CLI возвращает snapshot version, page count и diagnostics.
