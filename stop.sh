#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${YAMLS_ENV_FILE:-}"
DEFAULT_ENV_FILE=""

if [ -z "$ENV_FILE" ] && [ -f "$ROOT_DIR/settings/production.env" ]; then
    ENV_FILE="$ROOT_DIR/settings/production.env"
elif [ -z "$ENV_FILE" ] && [ -f "$ROOT_DIR/production.env" ]; then
    ENV_FILE="$ROOT_DIR/production.env"
elif [ -z "$ENV_FILE" ] && [ -f "$ROOT_DIR/settings/debug.env" ]; then
    ENV_FILE="$ROOT_DIR/settings/debug.env"
elif [ -z "$ENV_FILE" ] && [ -f "$ROOT_DIR/debug.env" ]; then
    ENV_FILE="$ROOT_DIR/debug.env"
fi

if [ -n "$ENV_FILE" ] && [[ "$(basename "$ENV_FILE")" == *debug* ]]; then
    DEFAULT_ENV_FILE="$ROOT_DIR/settings/debug.defaults.env"
    if [ ! -f "$DEFAULT_ENV_FILE" ]; then
        DEFAULT_ENV_FILE="$ROOT_DIR/debug.defaults.env"
    fi
else
    DEFAULT_ENV_FILE="$ROOT_DIR/settings/production.defaults.env"
    if [ ! -f "$DEFAULT_ENV_FILE" ]; then
        DEFAULT_ENV_FILE="$ROOT_DIR/production.defaults.env"
    fi
fi

if [ -n "$DEFAULT_ENV_FILE" ] && [ -f "$DEFAULT_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$DEFAULT_ENV_FILE"
    set +a
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
