#!/usr/bin/env bash
# ==============================================================================
# Master Launcher for Dual-NIC Victim Node & Enterprise SOC Dashboard
# Usage:
#   ./start.sh [us|cn|ru|kp|ir]
# Example:
#   ./start.sh us      # Runs AT&T US Web (port 80) + SOC (port 8080)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
info() { echo -e "${CYAN}[i]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo ""
echo "================================================================"
echo "  🛡️  VICTIM DUAL-NIC ENTERPRISE NODE & SOC MONITOR"
echo "================================================================"
echo ""

# 1. Determine Country / Node Role
COUNTRY="${1:-${VICTIM_COUNTRY:-}}"

if [[ -z "$COUNTRY" ]]; then
    # Attempt auto-detection from local IP addresses
    IPS="$(ip -4 addr show 2>/dev/null || hostname -I 2>/dev/null || echo "")"
    if echo "$IPS" | grep -q "12.1.2."; then
        COUNTRY="us"
    elif echo "$IPS" | grep -q "202.97.0."; then
        COUNTRY="cn"
    elif echo "$IPS" | grep -q "217.107.0."; then
        COUNTRY="ru"
    elif echo "$IPS" | grep -q "175.45.176."; then
        COUNTRY="kp"
    elif echo "$IPS" | grep -q "5.200.0."; then
        COUNTRY="ir"
    else
        COUNTRY="us" # Default
        warn "No target IP match detected. Defaulting to: us (United States)"
    fi
fi

COUNTRY="$(echo "$COUNTRY" | tr '[:upper:]' '[:lower:]')"

case "$COUNTRY" in
    us) NODE_NAME="United States (AT&T Enterprise Core)"; TARGET_IP="12.1.2.100" ;;
    cn) NODE_NAME="China (China Telecom Banking Gateway)"; TARGET_IP="202.97.0.100" ;;
    ru) NODE_NAME="Russia (Rostelecom Energy SCADA)"; TARGET_IP="217.107.0.100" ;;
    kp) NODE_NAME="North Korea (Star JV Official News)"; TARGET_IP="175.45.176.100" ;;
    ir) NODE_NAME="Iran (TCI Petroleum Pipeline)"; TARGET_IP="5.200.0.100" ;;
    *)
        err "Invalid country '$COUNTRY'. Supported: us, cn, ru, kp, ir"
        ;;
esac

ok "Selected Node: $COUNTRY -> $NODE_NAME"
info "Target Public IP: $TARGET_IP"

# 2. Check Python 3
if ! command -v python3 &>/dev/null; then
    err "Python 3 is required. Run: apt update && apt install -y python3"
fi

# 3. Detect Target Network Interface
TARGET_IFACE="${TARGET_IFACE:-eth0}"
if [[ ! -d "/sys/class/net/$TARGET_IFACE" ]]; then
    # Fallback to first non-lo interface
    FALLBACK_IFACE="$(ip -o link show 2>/dev/null | awk -F': ' '{print $2}' | grep -v 'lo' | head -n 1 || echo "eth0")"
    warn "Interface '$TARGET_IFACE' not found. Using fallback '$FALLBACK_IFACE'"
    TARGET_IFACE="$FALLBACK_IFACE"
fi
ok "Monitoring Kernel Telemetry on interface: $TARGET_IFACE"

# 4. Clean up any existing instances
info "Stopping previous instances on ports 80 / 8080..."
fuser -k 80/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true
sleep 1

# 5. Export and Execute Server
export VICTIM_COUNTRY="$COUNTRY"
export PUBLIC_PORT="${PUBLIC_PORT:-80}"
export MGMT_PORT="${MGMT_PORT:-8080}"
export TARGET_IFACE="$TARGET_IFACE"

echo ""
ok "Starting Dual-Port Services:"
echo "   - Public Service (Port $PUBLIC_PORT): http://0.0.0.0:$PUBLIC_PORT"
echo "   - SOC OOB Monitor (Port $MGMT_PORT): http://0.0.0.0:$MGMT_PORT"
echo ""
info "Press Ctrl+C to terminate."
echo "----------------------------------------------------------------"

exec python3 backend/server.py
