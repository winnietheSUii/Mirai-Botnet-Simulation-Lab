#!/usr/bin/env bash
# Start Loader lab agent on 185.10.20.200 (lab only)
set -euo pipefail
cd "$(dirname "$0")"

export LAB_TOKEN="${LAB_TOKEN:-lab-only}"
export AGENT_HOST="${AGENT_HOST:-0.0.0.0}"
export AGENT_PORT="${AGENT_PORT:-9090}"
export HTTP_ROOT="${HTTP_ROOT:-/opt/http-server}"
export HTTP_PORT="${HTTP_PORT:-80}"
export LOADER_DIR="${LOADER_DIR:-$(cd .. && pwd)}"
export LOADER_BIN="${LOADER_BIN:-$LOADER_DIR/loader.dbg}"

if [[ ! -f .venv/bin/activate ]]; then
  rm -rf .venv
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -U pip
  pip install -r requirements.txt
else
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

echo "[lab-agent] :${AGENT_PORT}  HTTP_ROOT=${HTTP_ROOT}  LOADER_BIN=${LOADER_BIN}"
exec python3 agent.py
