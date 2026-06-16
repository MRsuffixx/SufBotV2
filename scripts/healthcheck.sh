#!/usr/bin/env bash
# Healthcheck for the local dev stack.  Exits 0 if every service that is
# expected to be running is reachable; non-zero otherwise.
set -uo pipefail

BOT_PORT=${BOT_API_PORT:-3001}
WEB_PORT=${WEB_PORT:-3000}
PG_HOST=${PG_HOST:-localhost}
PG_PORT=${POSTGRES_PORT:-5432}

fail=0

check_http() {
  local url=$1
  local label=$2
  if curl --silent --show-error --fail --max-time 5 "$url" >/dev/null; then
    echo "  ✔ $label  $url"
  else
    echo "  ✘ $label  $url"
    fail=1
  fi
}

check_pg() {
  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
      echo "  ✔ postgres $PG_HOST:$PG_PORT"
    else
      echo "  ✘ postgres $PG_HOST:$PG_PORT"
      fail=1
    fi
  else
    # Fall back to a TCP probe using bash.
    if (echo > "/dev/tcp/$PG_HOST/$PG_PORT") >/dev/null 2>&1; then
      echo "  ✔ postgres $PG_HOST:$PG_PORT (tcp)"
    else
      echo "  ✘ postgres $PG_HOST:$PG_PORT"
      fail=1
    fi
  fi
}

echo "Checking local dev stack..."
check_pg
check_http "http://127.0.0.1:${BOT_PORT}/api/bot/stats" "bot internal api"
check_http "http://127.0.0.1:${WEB_PORT}/"                "web dashboard"

if [ "$fail" -ne 0 ]; then
  echo
  echo "One or more services are unhealthy."
  exit 1
fi
echo
echo "All services healthy."
