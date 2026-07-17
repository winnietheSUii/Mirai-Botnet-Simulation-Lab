#!/usr/bin/env bash
# Start Soft Command Deck on C2 (lab only)
set -euo pipefail
cd "$(dirname "$0")/backend"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -r requirements.txt
else
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

export CNC_HOST="${CNC_HOST:-127.0.0.1}"
export CNC_PORT="${CNC_PORT:-23}"
export CNC_USER="${CNC_USER:-admin}"
export CNC_PASS="${CNC_PASS:-admin}"
export DASH_PORT="${DASH_PORT:-8080}"

echo "[dashboard] CNC ${CNC_HOST}:${CNC_PORT}  UI :${DASH_PORT}"
exec python3 app.py
