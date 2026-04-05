# Deploy на Linux

Этот документ описывает базовую production-схему для Yamls - YAML System:

`internet -> public nginx :443 -> waitress 127.0.0.1:8080`

Локальный `./start.sh` уже использует близкую топологию, но на сервере лучше разделять системный `nginx` и `systemd`-процесс с `waitress`.

## 1. Что подготовить

- Linux-хост с `python3` 3.8+, `python3-venv`, `nginx`, `node`, `npm`
- доменное имя
- TLS-сертификат
- открытые порты `80/tcp` и `443/tcp`

Пример ниже предполагает путь установки `/opt/yamls-portal`.

## 2. Развернуть приложение

```bash
sudo mkdir -p /opt/yamls-portal
sudo chown "$USER":"$USER" /opt/yamls-portal
git clone <repo-url> /opt/yamls-portal
cd /opt/yamls-portal

python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
npm --prefix tooling/vite ci
npm --prefix tooling/vite run build
python3 -m backend.tools.validate_config --json
```

Если `pip` не находит `waitress==3.0.0` или `Werkzeug==3.0.6`, проверьте версию интерпретатора, которым создано окружение. Для текущих зависимостей и runtime type hints проекта нужен `Python 3.8+`.

## 3. Создать `settings/production.env`

В репозитории уже есть `settings/production.defaults.env`. На сервере обычно достаточно создать рядом свой `/opt/yamls-portal/settings/production.env` только с переопределениями:

```dotenv
YAMLS_ENV=production
YAMLS_ENABLE_DEBUG_ROUTES=0
YAMLS_CONFIG_LIVE_RELOAD=0
YAMLS_TRUST_PROXY=1
YAMLS_TRUSTED_PROXY=127.0.0.1
YAMLS_WAITRESS_HOST=127.0.0.1
YAMLS_WAITRESS_PORT=8080
```

Что почти всегда меняем осознанно:

- `YAMLS_ENV=production`
- `YAMLS_ENABLE_DEBUG_ROUTES=0`
- `YAMLS_CONFIG_LIVE_RELOAD=0`
- `YAMLS_WAITRESS_HOST`
- `YAMLS_WAITRESS_PORT`
- `YAMLS_TRUST_PROXY`
- `YAMLS_TRUSTED_PROXY`

Что обычно можно не трогать:

- `YAMLS_TRUSTED_PROXY_COUNT`
- `YAMLS_TRUSTED_PROXY_HEADERS`
- `YAMLS_HEALTHCHECK_CONNECT_HOST`

Переменные `YAMLS_NGINX_*` и `YAMLS_TLS_*` обязательны в первую очередь для локальных `start.sh`/`start_debug.sh`. Если на сервере используется системный `nginx`, эти значения можно не настраивать.

## 4. Настроить `systemd`

В репозитории уже лежит пример unit-файла:

- [deploy/systemd/yamls-waitress.service.example](../deploy/systemd/yamls-waitress.service.example)

Боевой вариант можно поставить так:

```ini
[Unit]
Description=Yamls portal waitress service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/yamls-portal
EnvironmentFile=/opt/yamls-portal/settings/production.env
ExecStart=/opt/yamls-portal/.venv/bin/waitress-serve --host=127.0.0.1 --port=8080 settings.wsgi:app
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Установка:

```bash
sudo cp deploy/systemd/yamls-waitress.service.example /etc/systemd/system/yamls-waitress.service
sudo systemctl daemon-reload
sudo systemctl enable yamls-waitress
sudo systemctl start yamls-waitress
sudo systemctl status yamls-waitress
```

## 5. Настроить публичный `nginx`

Ниже минимальный пример для схемы `public nginx -> waitress on 127.0.0.1`.

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location /frontend/dist/ {
        alias /opt/yamls-portal/frontend/dist/;
        expires 1h;
        add_header Cache-Control "public";
    }

    location /frontend/ {
        alias /opt/yamls-portal/frontend/;
        expires 5m;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_redirect off;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Port 443;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

После этого:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Домен, TLS и firewall

- Укажите реальный домен в `server_name`.
- Выпустите сертификат через Let’s Encrypt или другой ACME-провайдер.
- Откройте только `80/tcp` и `443/tcp` наружу.
- Не публикуйте порт `8080` вовне: он должен слушать только `127.0.0.1`.

Пример для `ufw`:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 7. Как осознанно включать debug на production-сервере

По умолчанию debug routes должны оставаться выключенными:

```dotenv
YAMLS_ENABLE_DEBUG_ROUTES=0
```

Если debug всё же нужен:

- включайте его только временно;
- ограничивайте доступ VPN, SSH tunnel или внутренним reverse proxy;
- после диагностики сразу возвращайте `YAMLS_ENABLE_DEBUG_ROUTES=0` и перезапускайте сервис.

Не стоит держать debug routes постоянно открытыми на публичном сервере.

## 8. Что проверить после деплоя

```bash
curl -I http://127.0.0.1:8080/healthz
curl -I https://example.com/
```

Также проверьте:

- главная страница открывается;
- bundle отдается из `/frontend/dist/`;
- debug routes недоступны, если вы их не включали;
- `python3 -m backend.tools.validate_config --json` по-прежнему не показывает diagnostics.
