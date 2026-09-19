#!/usr/bin/env bash
set -euo pipefail

WEB_PORT="${WEB_PORT:-5173}"
API_PORT="${API_PORT:-3005}"

kill_port() {
  local port="$1"
  local label="$2"
  local pids

  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    echo "${label} (:${port}) is already free"
    return
  fi

  echo "Stopping ${label} on :${port} (pid ${pids//$'\n'/ })"
  # shellcheck disable=SC2086
  kill ${pids} 2>/dev/null || true
  sleep 0.4

  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "Force killing ${label} on :${port} (pid ${pids//$'\n'/ })"
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
  fi
}

if [[ $# -gt 0 ]]; then
  for port in "$@"; do
    kill_port "${port}" "port ${port}"
  done
else
  kill_port "${WEB_PORT}" "frontend"
  kill_port "${API_PORT}" "backend"
fi
