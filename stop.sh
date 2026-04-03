#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${YAMLS_ENV_FILE:-}"
if [ -z "$ENV_FILE" ] && [ -f "$ROOT_DIR/production.env" ]; then
    ENV_FILE="$ROOT_DIR/production.env"
elif [ -z "$ENV_FILE" ] && [ -f "$ROOT_DIR/debug.env" ]; then
    ENV_FILE="$ROOT_DIR/debug.env"
fi

if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/runtime_common.sh"

stop_stack
