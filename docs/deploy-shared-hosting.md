# Deploy на shared-хостинг c Passenger/Flask

Этот сценарий подходит для хостинга, где:

- нет `sudo`, `systemd` и собственного системного `nginx`;
- Python-приложения запускаются через `Passenger` и файл `passenger_wsgi.py`;
- web-root сайта находится в `~/www/...`, а сам проект можно хранить рядом в домашнем каталоге.

Для Yamls это рабочий вариант, потому что у проекта уже есть WSGI-вход [settings/wsgi.py](../settings/wsgi.py), а `frontend/dist` лежит в репозитории и не требует обязательной сборки на сервере.

## Когда этот путь подходит

Используйте его, если ваш хостинг умеет:

- включать `Python` для сайта в панели;
- выбирать версию Python;
- запускать Flask/WSGI через `Passenger`;
- перезапускать приложение через `.restart-app`.

Если хостинг умеет только PHP, этот проект там нормально не взлетит. Тогда нужен VPS/VDS и инструкция из [docs/deploy-linux.md](./deploy-linux.md).

## Схема размещения

Рекомендуемая структура:

```text
~/
  yamls-app/              # полный код проекта
  yamls-venv/             # виртуальное окружение Python
  www/
    example.com/
      passenger_wsgi.py   # WSGI entrypoint для Passenger
```

Идея простая:

- код проекта лежит вне web-root;
- в web-root находится только `passenger_wsgi.py`;
- Passenger импортирует приложение из `settings.wsgi`.

## 1. Проверить возможности хостинга

На сервере выполните:

```bash
cd ~
ls -la /opt/python/*/bin/python
python3 --version
```

Если в панели управления сайта есть переключатели `CGI` и `Python`, а в системе есть `/opt/python/...`, этого обычно достаточно для Flask через Passenger.

## 2. Загрузить проект

Загрузите репозиторий целиком в домашний каталог, не внутрь `www`:

```bash
cd ~
mkdir -p yamls-app
```

Дальше можно:

- залить файлы по SFTP;
- загрузить архив и распаковать;
- или клонировать репозиторий, если на тарифе доступен `git`.

В итоге проект должен лежать в `~/yamls-app`.

## 3. Создать virtualenv

Выберите доступную версию Python 3.x из `/opt/python/...` и создайте окружение:

```bash
/opt/python/python-3.8.0/bin/python -m venv ~/yamls-venv
source ~/yamls-venv/bin/activate
pip install --upgrade pip
pip install -r ~/yamls-app/requirements.txt
```

Примечания:

- точное имя каталога Python у хостера может отличаться, смотрите по `ls -la /opt/python/*/bin/python`;
- для этого проекта достаточно Python 3.8+;
- `node` на сервере не обязателен, если вы загружаете репозиторий уже с готовым `frontend/dist`.

## 4. Подготовить production env

При shared-hosting `start.sh` не используется, поэтому env-файлы сами по себе не загрузятся. Создайте файл:

`~/yamls-app/settings/production.env`

Минимальное содержимое:

```dotenv
YAMLS_ENV=production
YAMLS_ENABLE_DEBUG_ROUTES=0
YAMLS_CONFIG_LIVE_RELOAD=0
YAMLS_TRUST_PROXY=1
```

Если за прокси схемы/host определяются криво, позже можно дополнительно проверять `/healthz`.

## 5. Создать `passenger_wsgi.py`

Скопируйте пример из [deploy/passenger/passenger_wsgi.py.example](../deploy/passenger/passenger_wsgi.py.example) в корень сайта:

```text
~/www/example.com/passenger_wsgi.py
```

В файле проверьте два пути:

- `BASE_DIR` должен указывать на каталог проекта, например `~/yamls-app`;
- `INTERP` должен указывать на Python из virtualenv, например `~/yamls-venv/bin/python`.

Этот шаблон специально:

- добавляет каталог проекта в `sys.path`;
- переводит текущую директорию в корень проекта;
- загружает `settings/production.defaults.env` и `settings/production.env`;
- выставляет безопасные production-defaults;
- экспортирует `application` для Passenger.

## 6. Включить Python для сайта

В панели хостинга для нужного сайта включите:

- `CGI`;
- `Python`;
- нужную версию Python 3.x.

После этого Passenger должен начать искать `passenger_wsgi.py` в корне сайта.

## 7. Перезапуск приложения

После изменений в коде или зависимостях создавайте в web-root пустой файл:

```bash
touch ~/www/example.com/.restart-app
```

Passenger обычно подхватывает это как сигнал на перезапуск и сам удаляет файл.

## 8. Что проверить после запуска

Проверьте:

- открывается главная страница сайта;
- отвечает `https://ваш-домен/healthz`;
- не открываются debug routes в production;
- статические файлы грузятся из `/frontend/...`.

Если нужно проверить через SSH:

```bash
curl -I https://example.com/
curl https://example.com/healthz
```

## Типичные проблемы

### 500 сразу после запуска

Обычно это одно из трёх:

- неверный путь в `INTERP`;
- Python-зависимости не установлены в virtualenv;
- Passenger не видит проект, потому что `BASE_DIR` указывает не туда.

### Сайт открылся, но без стилей/JS

Проверьте, что в проекте реально загружен каталог `frontend/dist`.

### Вылез debug

Значит, не был прочитан `settings/production.env` или используется старый `passenger_wsgi.py` без загрузки env-файлов.

### Нужен системный `nginx`, `systemd`, отдельный порт или фоновые процессы

Это уже не shared-хостинг сценарий. Для него нужен VPS/VDS и схема из [docs/deploy-linux.md](./deploy-linux.md).
