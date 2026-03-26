#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Запуск Flask приложения в debug-режиме..."

# Активируем виртуальное окружение
source .venv/bin/activate

# Проверяем, что виртуальное окружение активировано
if [ -z "$VIRTUAL_ENV" ]; then
    echo "Ошибка: не удалось активировать виртуальное окружение"
    exit 1
fi

echo "Виртуальное окружение активировано: $VIRTUAL_ENV"
export LOWCODE_FLASK_DEBUG="${LOWCODE_FLASK_DEBUG:-1}"
export LOWCODE_FLASK_RELOADER="${LOWCODE_FLASK_RELOADER:-0}"
export LOWCODE_FLASK_HOST="${LOWCODE_FLASK_HOST:-127.0.0.1}"
export LOWCODE_FLASK_PORT="${LOWCODE_FLASK_PORT:-8000}"

if [ "${LOWCODE_SKIP_VITE_BUILD:-0}" != "1" ]; then
    echo "Сборка frontend через Vite..."
    npm --prefix tooling/vite run build
fi

echo "Запуск сервера на http://${LOWCODE_FLASK_HOST}:${LOWCODE_FLASK_PORT}"
echo "Для остановки нажмите Ctrl+C"

# Запускаем приложение
python app.py
