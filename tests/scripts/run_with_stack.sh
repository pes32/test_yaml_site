#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-test}"
if [ "$#" -gt 0 ]; then
  shift
fi

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$TESTS_DIR/.." && pwd)"

cd "$TESTS_DIR"
./scripts/ensure_deps.sh

resolve_start_script() {
  local configured="${YAMLS_TEST_START_SCRIPT:-}"
  if [ -z "$configured" ]; then
    if [ "${YAMLS_TEST_MODE:-debug}" = "prod" ] || [ "${YAMLS_TEST_MODE:-debug}" = "production" ]; then
      configured="./start.sh"
    else
      configured="./start_debug.sh"
    fi
  fi

  if [[ "$configured" = /* ]]; then
    printf '%s\n' "$configured"
  else
    configured="${configured#./}"
    printf '%s/%s\n' "$ROOT_DIR" "$configured"
  fi
}

load_stack_env_for_base_url() {
  local start_script="$1"
  local mode="production"
  local default_env_file=""
  local env_file=""

  if [[ "$(basename "$start_script")" == *debug* ]]; then
    mode="debug"
  fi

  if [ "$mode" = "debug" ]; then
    default_env_file="${YAMLS_DEFAULT_ENV_FILE:-$ROOT_DIR/settings/debug.defaults.env}"
    if [ "$default_env_file" = "$ROOT_DIR/settings/debug.defaults.env" ] && [ ! -f "$default_env_file" ]; then
      default_env_file="$ROOT_DIR/debug.defaults.env"
    fi
    env_file="${YAMLS_ENV_FILE:-$ROOT_DIR/settings/debug.env}"
    if [ "$env_file" = "$ROOT_DIR/settings/debug.env" ] && [ ! -f "$env_file" ] && [ -f "$ROOT_DIR/debug.env" ]; then
      env_file="$ROOT_DIR/debug.env"
    fi
  else
    default_env_file="${YAMLS_DEFAULT_ENV_FILE:-$ROOT_DIR/settings/production.defaults.env}"
    if [ "$default_env_file" = "$ROOT_DIR/settings/production.defaults.env" ] && [ ! -f "$default_env_file" ]; then
      default_env_file="$ROOT_DIR/production.defaults.env"
    fi
    env_file="${YAMLS_ENV_FILE:-$ROOT_DIR/settings/production.env}"
    if [ "$env_file" = "$ROOT_DIR/settings/production.env" ] && [ ! -f "$env_file" ] && [ -f "$ROOT_DIR/production.env" ]; then
      env_file="$ROOT_DIR/production.env"
    fi
  fi

  if [ -f "$default_env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$default_env_file"
    set +a
  fi

  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

run_playwright() {
  unset NO_COLOR
  case "$COMMAND" in
    test)
      npm run test -- "$@"
      ;;
    headed)
      npm run test:headed -- "$@"
      ;;
    *)
      echo "Unknown test command: $COMMAND" >&2
      return 2
      ;;
  esac
}

START_SCRIPT="$(resolve_start_script)"
load_stack_env_for_base_url "$START_SCRIPT"

BASE_URL="${YAMLS_TEST_BASE_URL:-https://localhost:${YAMLS_NGINX_PORT:-8443}}"
export YAMLS_TEST_BASE_URL="$BASE_URL"

STACK_STARTED=0
cleanup() {
  local status="$?"
  if [ "$STACK_STARTED" = "1" ] && [ "${YAMLS_TEST_KEEP_SERVER:-0}" != "1" ]; then
    echo "[tests] stopping Yamls stack after test run"
    (cd "$ROOT_DIR" && ./stop.sh) || true
  fi
  exit "$status"
}
trap cleanup EXIT

if [ "${YAMLS_TEST_SKIP_STACK:-0}" != "1" ]; then
  echo "[tests] stopping existing Yamls stack from start.sh/start_debug.sh, if any"
  (cd "$ROOT_DIR" && ./stop.sh)

  echo "[tests] starting Yamls stack: $START_SCRIPT"
  (cd "$ROOT_DIR" && "$START_SCRIPT")
  STACK_STARTED=1

  echo "[tests] running Playwright against $YAMLS_TEST_BASE_URL"
else
  echo "[tests] YAMLS_TEST_SKIP_STACK=1, using existing server at $YAMLS_TEST_BASE_URL"
fi

run_playwright "$@"
