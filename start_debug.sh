#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

DEFAULT_ENV_FILE="$ROOT_DIR/debug.defaults.env"
if [ -f "$DEFAULT_ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$DEFAULT_ENV_FILE"
    set +a
fi

ENV_FILE="${YAMLS_ENV_FILE:-$ROOT_DIR/debug.env}"
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

export YAMLS_ENV="${YAMLS_ENV:-development}"
export YAMLS_ENABLE_DEBUG_ROUTES="${YAMLS_ENABLE_DEBUG_ROUTES:-1}"
export YAMLS_CONFIG_LIVE_RELOAD="${YAMLS_CONFIG_LIVE_RELOAD:-1}"
export YAMLS_CONFIG_SCAN_INTERVAL="${YAMLS_CONFIG_SCAN_INTERVAL:-0.5}"
export YAMLS_TRUST_PROXY="${YAMLS_TRUST_PROXY:-1}"

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/runtime_common.sh"

start_stack "debug"
