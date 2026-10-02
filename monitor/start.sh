#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export SOC_BIND="${SOC_BIND:-185.10.20.110}"
export SOC_PORT="${SOC_PORT:-8080}"
exec python3 backend/server.py
