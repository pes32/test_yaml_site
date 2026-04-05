#!/bin/bash

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
RUN_DIR="$ROOT_DIR/run"
SSL_DIR="$ROOT_DIR/ssl"
VITE_DIR="$ROOT_DIR/tooling/vite"
VITE_NODE_MODULES_DIR="$VITE_DIR/node_modules"
VITE_MANIFEST_PATH="$ROOT_DIR/frontend/dist/.vite/manifest.json"
NGINX_TEMPLATE="$ROOT_DIR/nginx/nginx.conf.template"
NGINX_CONFIG="$RUN_DIR/nginx.conf"
WAITRESS_PID_FILE="$RUN_DIR/waitress.pid"
NGINX_PID_FILE="$RUN_DIR/nginx.pid"
WAITRESS_LOG="$RUN_DIR/waitress.log"
NGINX_LOG="$RUN_DIR/nginx.log"
VITE_BUILD_LOG="$RUN_DIR/vite-build.log"
WAITRESS_HOST="${YAMLS_WAITRESS_HOST:-127.0.0.1}"
WAITRESS_PORT="${YAMLS_WAITRESS_PORT:-8080}"
NGINX_BIND_HOST="${YAMLS_NGINX_BIND_HOST:-127.0.0.1}"
NGINX_PORT="${YAMLS_NGINX_PORT:-8443}"
SERVER_NAME="${YAMLS_SERVER_NAME:-localhost}"
HEALTHCHECK_CONNECT_HOST="${YAMLS_HEALTHCHECK_CONNECT_HOST:-127.0.0.1}"
TLS_CERT_PATH="${YAMLS_TLS_CERT:-$SSL_DIR/dev.crt}"
TLS_KEY_PATH="${YAMLS_TLS_KEY:-$SSL_DIR/dev.key}"
NGINX_MIME_TYPES_PATH="${YAMLS_NGINX_MIME_TYPES:-}"
TRUSTED_PROXY="${YAMLS_TRUSTED_PROXY:-127.0.0.1}"
TRUSTED_PROXY_COUNT="${YAMLS_TRUSTED_PROXY_COUNT:-1}"
TRUSTED_PROXY_HEADERS="${YAMLS_TRUSTED_PROXY_HEADERS:-x-forwarded-host x-forwarded-for x-forwarded-proto x-forwarded-port}"
HEALTHCHECK_ATTEMPTS=30
HEALTHCHECK_INTERVAL="0.5"
LOCAL_SELF_SIGNED_TLS=0


log() {
    printf '[%s] %s\n' "$1" "$2"
}


fail() {
    log "error" "$1" >&2
    return 1
}


show_log_tails() {
    if [ -f "$VITE_BUILD_LOG" ]; then
        log "error" "tail $VITE_BUILD_LOG"
        tail -n 40 "$VITE_BUILD_LOG" || true
    fi
    if [ -f "$WAITRESS_LOG" ]; then
        log "error" "tail $WAITRESS_LOG"
        tail -n 40 "$WAITRESS_LOG" || true
    fi
    if [ -f "$NGINX_LOG" ]; then
        log "error" "tail $NGINX_LOG"
        tail -n 40 "$NGINX_LOG" || true
    fi
}


ensure_runtime_dirs() {
    mkdir -p "$RUN_DIR" "$SSL_DIR"
}


activate_venv() {
    if [ ! -d "$ROOT_DIR/.venv" ]; then
        fail "Не найдено виртуальное окружение: $ROOT_DIR/.venv"
    fi

    # shellcheck disable=SC1091
    source "$ROOT_DIR/.venv/bin/activate"

    if [ -z "${VIRTUAL_ENV:-}" ]; then
        fail "Не удалось активировать виртуальное окружение"
    fi
}


require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        fail "Не найдена обязательная команда: $1"
    fi
}


ensure_pid_is_stale_or_absent() {
    local pid_file="$1"
    if [ ! -f "$pid_file" ]; then
        return 0
    fi

    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
        fail "Процесс уже запущен: PID $pid из $pid_file"
    fi

    rm -f "$pid_file"
}


port_is_busy() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            return 0
        fi
        return 1
    fi

    python3 - "$port" <<'PY'
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    sock.bind(("127.0.0.1", port))
except OSError:
    sys.exit(0)
finally:
    sock.close()
sys.exit(1)
PY
}


ensure_port_free() {
    local port="$1"
    if port_is_busy "$port"; then
        fail "Порт занят: $port"
    fi
}


validate_prebuilt_bundle() {
    python3 - "$VITE_MANIFEST_PATH" "$ROOT_DIR/frontend/dist" <<'PY'
import json
import os
import sys

manifest_path = sys.argv[1]
dist_root = sys.argv[2]

if not os.path.isfile(manifest_path):
    print(f"Не найден manifest: {manifest_path}", file=sys.stderr)
    sys.exit(1)

with open(manifest_path, "r", encoding="utf-8") as handle:
    manifest = json.load(handle)

if not isinstance(manifest, dict) or not manifest:
    print("Manifest пустой или некорректный", file=sys.stderr)
    sys.exit(1)

missing = []
for chunk in manifest.values():
    if not isinstance(chunk, dict):
        continue
    file_name = chunk.get("file")
    if isinstance(file_name, str) and not os.path.isfile(os.path.join(dist_root, file_name)):
        missing.append(file_name)
    for css_name in chunk.get("css") or []:
        if isinstance(css_name, str) and not os.path.isfile(os.path.join(dist_root, css_name)):
            missing.append(css_name)

if missing:
    print("Отсутствуют файлы bundle:", file=sys.stderr)
    for item in missing:
        print(f"  - {item}", file=sys.stderr)
    sys.exit(1)
PY
}


ensure_frontend_dependencies() {
    if [ -d "$VITE_NODE_MODULES_DIR" ]; then
        return 0
    fi

    log "info" "Не найдены frontend зависимости, выполняю npm ci"
    if ! (
        cd "$VITE_DIR"
        npm ci
    ) >>"$VITE_BUILD_LOG" 2>&1; then
        show_log_tails
        fail "Не удалось установить frontend зависимости через npm ci"
    fi
}


build_frontend_bundle() {
    if [ "${YAMLS_SKIP_VITE_BUILD:-0}" = "1" ]; then
        log "info" "YAMLS_SKIP_VITE_BUILD=1, использую существующий Vite bundle"
        validate_prebuilt_bundle || {
            show_log_tails
            fail "Пропуск Vite build допустим только при уже собранном и валидном bundle"
        }
        return 0
    fi

    log "info" "Сборка frontend через Vite"
    if ! (
        cd "$VITE_DIR"
        npm run build
    ) >>"$VITE_BUILD_LOG" 2>&1; then
        show_log_tails
        fail "Сборка frontend через Vite завершилась ошибкой"
    fi

    validate_prebuilt_bundle || {
        show_log_tails
        fail "После Vite build bundle не прошёл валидацию"
    }
}


ensure_tls_cert() {
    local cert="$TLS_CERT_PATH"
    local key="$TLS_KEY_PATH"

    if [ -n "${YAMLS_TLS_CERT:-}" ] || [ -n "${YAMLS_TLS_KEY:-}" ]; then
        if [ ! -f "$cert" ] || [ ! -f "$key" ]; then
            fail "Указанные TLS-файлы не найдены: cert=$cert key=$key"
        fi
        LOCAL_SELF_SIGNED_TLS=0
        return 0
    fi

    if [ -f "$cert" ] && [ -f "$key" ]; then
        LOCAL_SELF_SIGNED_TLS=1
        return 0
    fi

    local tmp_config
    tmp_config="$(mktemp "$RUN_DIR/openssl-localhost.XXXXXX.cnf")"
    cat >"$tmp_config" <<'EOF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
EOF

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$key" \
        -out "$cert" \
        -config "$tmp_config" >/dev/null 2>&1

    rm -f "$tmp_config"
    LOCAL_SELF_SIGNED_TLS=1
}


detect_nginx_mime_types() {
    if [ -n "$NGINX_MIME_TYPES_PATH" ]; then
        if [ ! -f "$NGINX_MIME_TYPES_PATH" ]; then
            fail "Не найден mime.types по пути YAMLS_NGINX_MIME_TYPES=$NGINX_MIME_TYPES_PATH"
        fi
        return 0
    fi

    local candidate=""
    for candidate in \
        "$ROOT_DIR/mime.types" \
        "/etc/nginx/mime.types" \
        "/usr/local/etc/nginx/mime.types" \
        "/opt/homebrew/etc/nginx/mime.types"
    do
        if [ -f "$candidate" ]; then
            NGINX_MIME_TYPES_PATH="$candidate"
            return 0
        fi
    done

    fail "Не удалось найти mime.types для nginx. Укажите путь через YAMLS_NGINX_MIME_TYPES."
}


render_nginx_config() {
    if [ ! -f "$NGINX_TEMPLATE" ]; then
        fail "Не найден шаблон nginx: $NGINX_TEMPLATE"
    fi

    local escaped_root
    escaped_root="${ROOT_DIR//\\/\\\\}"
    escaped_root="${escaped_root//&/\\&}"

    local escaped_cert="${TLS_CERT_PATH//\\/\\\\}"
    escaped_cert="${escaped_cert//&/\\&}"
    local escaped_key="${TLS_KEY_PATH//\\/\\\\}"
    escaped_key="${escaped_key//&/\\&}"
    local escaped_mime_types="${NGINX_MIME_TYPES_PATH//\\/\\\\}"
    escaped_mime_types="${escaped_mime_types//&/\\&}"

    sed \
        -e "s|__PROJECT_ROOT__|$escaped_root|g" \
        -e "s|__NGINX_BIND_HOST__|$NGINX_BIND_HOST|g" \
        -e "s|__NGINX_PORT__|$NGINX_PORT|g" \
        -e "s|__SERVER_NAME__|$SERVER_NAME|g" \
        -e "s|__TLS_CERT__|$escaped_cert|g" \
        -e "s|__TLS_KEY__|$escaped_key|g" \
        -e "s|__NGINX_MIME_TYPES__|$escaped_mime_types|g" \
        -e "s|__WAITRESS_HOST__|$WAITRESS_HOST|g" \
        -e "s|__WAITRESS_PORT__|$WAITRESS_PORT|g" \
        "$NGINX_TEMPLATE" >"$NGINX_CONFIG"
}


validate_nginx_config() {
    nginx -e "$NGINX_LOG" -t -p "$ROOT_DIR" -c "$NGINX_CONFIG" >/dev/null 2>&1 || {
        nginx -e "$NGINX_LOG" -t -p "$ROOT_DIR" -c "$NGINX_CONFIG" || true
        fail "Проверка конфигурации nginx не прошла"
    }
}


truncate_logs() {
    : >"$VITE_BUILD_LOG"
    : >"$WAITRESS_LOG"
    : >"$NGINX_LOG"
}


start_waitress_process() {
    local -a waitress_args
    local wsgi_app="${YAMLS_WSGI_APP:-settings.wsgi:app}"
    waitress_args=(
        "--host=$WAITRESS_HOST"
        "--port=$WAITRESS_PORT"
    )

    if [ "${YAMLS_TRUST_PROXY:-0}" = "1" ]; then
        waitress_args+=(
            "--trusted-proxy=$TRUSTED_PROXY"
            "--trusted-proxy-count=$TRUSTED_PROXY_COUNT"
            "--trusted-proxy-headers=$TRUSTED_PROXY_HEADERS"
            "--clear-untrusted-proxy-headers"
        )
    fi

    (
        cd "$ROOT_DIR"
        nohup env PYTHONPATH="$ROOT_DIR${PYTHONPATH:+:$PYTHONPATH}" \
            waitress-serve "${waitress_args[@]}" "$wsgi_app" \
            >>"$WAITRESS_LOG" 2>&1 </dev/null &
        echo "$!" >"$WAITRESS_PID_FILE"
    )
}


listener_pids_by_command() {
    local port="$1"
    local command_pattern="$2"

    if ! command -v lsof >/dev/null 2>&1; then
        return 0
    fi

    lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fpct 2>/dev/null | \
        awk -v pattern="$command_pattern" '
            /^p/ { pid = substr($0, 2) }
            /^c/ {
                cmd = substr($0, 2)
                if (pid != "" && cmd ~ pattern) {
                    print pid
                }
            }
        '
}


terminate_pid() {
    local pid="$1"
    if [ -z "$pid" ]; then
        return 0
    fi

    if kill -0 "$pid" >/dev/null 2>&1; then
        kill "$pid" >/dev/null 2>&1 || true
        for _ in $(seq 1 20); do
            if ! kill -0 "$pid" >/dev/null 2>&1; then
                return 0
            fi
            sleep 0.2
        done
        kill -9 "$pid" >/dev/null 2>&1 || true
    fi
}


terminate_listening_processes() {
    local port="$1"
    local command_pattern="$2"
    local pid

    while IFS= read -r pid; do
        terminate_pid "$pid"
    done <<EOF
$(listener_pids_by_command "$port" "$command_pattern")
EOF
}


start_nginx_process() {
    nginx -e "$NGINX_LOG" -p "$ROOT_DIR" -c "$NGINX_CONFIG"
}


wait_for_url() {
    local url="$1"
    local insecure="${2:-0}"
    local attempt
    local curl_args=(-fsS "$url")
    if [ "$insecure" = "1" ]; then
        curl_args=(-kfsS "$url")
    fi

    for attempt in $(seq 1 "$HEALTHCHECK_ATTEMPTS"); do
        if curl "${curl_args[@]}" >/dev/null 2>&1; then
            return 0
        fi
        sleep "$HEALTHCHECK_INTERVAL"
    done

    return 1
}


stop_waitress_process() {
    local pid=""
    if [ -f "$WAITRESS_PID_FILE" ]; then
        pid="$(cat "$WAITRESS_PID_FILE" 2>/dev/null || true)"
    fi

    terminate_pid "$pid"
    terminate_listening_processes "$WAITRESS_PORT" "^(waitress|waitress-serve|python|Python)$"

    rm -f "$WAITRESS_PID_FILE"
}


stop_nginx_process() {
    if [ -f "$NGINX_PID_FILE" ]; then
        nginx -e "$NGINX_LOG" -s quit -p "$ROOT_DIR" -c "$NGINX_CONFIG" >/dev/null 2>&1 || true

        local pid
        pid="$(cat "$NGINX_PID_FILE" 2>/dev/null || true)"
        if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
            for _ in $(seq 1 20); do
                if ! kill -0 "$pid" >/dev/null 2>&1; then
                    break
                fi
                sleep 0.2
            done
            if kill -0 "$pid" >/dev/null 2>&1; then
                kill -TERM "$pid" >/dev/null 2>&1 || true
            fi
        fi
    fi

    terminate_listening_processes "$NGINX_PORT" "^nginx$"

    rm -f "$NGINX_PID_FILE"
}


ensure_ports_released() {
    if port_is_busy "$NGINX_PORT"; then
        fail "Порт $NGINX_PORT не освободился"
    fi
    if port_is_busy "$WAITRESS_PORT"; then
        fail "Порт $WAITRESS_PORT не освободился"
    fi
}


start_stack() {
    local mode="$1"

    log "info" "Режим запуска: $mode"
    activate_venv
    require_command waitress-serve
    require_command nginx
    require_command curl
    require_command openssl
    require_command node
    require_command npm
    ensure_runtime_dirs
    ensure_pid_is_stale_or_absent "$WAITRESS_PID_FILE"
    ensure_pid_is_stale_or_absent "$NGINX_PID_FILE"
    truncate_logs
    ensure_port_free "$WAITRESS_PORT"
    ensure_port_free "$NGINX_PORT"
    ensure_frontend_dependencies
    build_frontend_bundle
    ensure_tls_cert
    detect_nginx_mime_types
    render_nginx_config
    validate_nginx_config

    start_waitress_process
    if ! wait_for_url "http://$WAITRESS_HOST:$WAITRESS_PORT/healthz"; then
        show_log_tails
        stop_waitress_process
        fail "Waitress не прошёл readiness-check"
    fi

    start_nginx_process
    if ! curl -kfsS \
        --resolve "$SERVER_NAME:$NGINX_PORT:$HEALTHCHECK_CONNECT_HOST" \
        "https://$SERVER_NAME:$NGINX_PORT/healthz" >/dev/null 2>&1; then
        local attempt
        for attempt in $(seq 1 "$HEALTHCHECK_ATTEMPTS"); do
            if curl -kfsS \
                --resolve "$SERVER_NAME:$NGINX_PORT:$HEALTHCHECK_CONNECT_HOST" \
                "https://$SERVER_NAME:$NGINX_PORT/healthz" >/dev/null 2>&1; then
                break
            fi
            sleep "$HEALTHCHECK_INTERVAL"
        done
    fi

    if ! curl -kfsS \
        --resolve "$SERVER_NAME:$NGINX_PORT:$HEALTHCHECK_CONNECT_HOST" \
        "https://$SERVER_NAME:$NGINX_PORT/healthz" >/dev/null 2>&1; then
        show_log_tails
        stop_nginx_process
        stop_waitress_process
        fail "nginx не прошёл readiness-check"
    fi

    log "info" "waitress pid: $(cat "$WAITRESS_PID_FILE")"
    log "info" "nginx pid: $(cat "$NGINX_PID_FILE")"
    log "info" "vite build log: $VITE_BUILD_LOG"
    log "info" "waitress log: $WAITRESS_LOG"
    log "info" "nginx log: $NGINX_LOG"
}


stop_stack() {
    ensure_runtime_dirs
    stop_nginx_process
    stop_waitress_process
    ensure_ports_released
    log "info" "Стек остановлен"
}
