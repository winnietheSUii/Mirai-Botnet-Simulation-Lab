#!/bin/bash
# lab-c2.sh — start/stop/rebuild C2 lab services in screen
# Usage: ./lab-c2.sh {start|stop|status|rebuild}
set -euo pipefail

LAB_DIR=~/Mirai-Botnet-Simulation-Lab
MIRAI_DEBUG="$LAB_DIR/mirai/debug"
MIRAI_SRC="$LAB_DIR/mirai"
DASHBOARD="$LAB_DIR/dashboard/version2"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

usage() {
  echo ""
  echo "Usage: $0 {start|stop|status|rebuild}"
  echo ""
  echo "  rebuild   Re-compile Go CNC (run this after code changes)"
  echo "  start     Start CNC + scanListen + dashboard (screen sessions)"
  echo "  stop      Kill all screen sessions"
  echo "  status    Show running screen sessions + quick health check"
  echo ""
  exit 1
}

[[ $# -eq 1 ]] || usage

case "$1" in

  # ── REBUILD: recompile Go CNC then copy to debug/ ──────────────────────────
  rebuild)
    echo ""
    echo "================================================"
    echo "  Rebuild Go CNC  (no internet needed)"
    echo "================================================"

    # Build
    echo ""
    warn "Building Go CNC..."
    cd "$MIRAI_SRC"
    go build -o cnc_new ./cnc/ || die "go build failed"
    ok "Build OK → $MIRAI_SRC/cnc_new"

    # Copy to debug/
    cp cnc_new "$MIRAI_DEBUG/cnc"
    rm -f cnc_new
    ok "Copied to $MIRAI_DEBUG/cnc"

    # Verify new binary has HTTP port 9090
    echo ""
    warn "Restarting CNC screen session with new binary..."
    screen -S cnc -X quit 2>/dev/null || true
    sleep 1
    screen -dmS cnc bash -lc "cd '$MIRAI_DEBUG' && ./cnc"
    sleep 2

    # Health check
    if nc -z 127.0.0.1 9090 2>/dev/null; then
        ok "Port 9090 (HTTP Bot API) is UP"
        BOT_LIST=$(curl -sf http://127.0.0.1:9090/bots 2>/dev/null || echo "[]")
        ok "GET /bots → $BOT_LIST"
    else
        warn "Port 9090 not yet open — check: screen -r cnc"
    fi

    if nc -z 127.0.0.1 23 2>/dev/null; then
        ok "Port 23 (Telnet/Bot) is UP"
    else
        warn "Port 23 not open — check: screen -r cnc"
    fi

    echo ""
    ok "Rebuild done. Run './lab-c2.sh status' to verify."
    echo ""
    ;;

  # ── START: launch all services ──────────────────────────────────────────────
  start)
    echo ""
    echo "================================================"
    echo "  Starting Lab C2 Services"
    echo "================================================"
    echo ""

    # CNC
    if screen -list 2>/dev/null | grep -q '[.]cnc'; then
      warn "cnc already running (skip)"
    else
      screen -dmS cnc bash -lc "cd '$MIRAI_DEBUG' && ./cnc"
      ok "started: screen cnc"
      sleep 1
    fi

    # scanListen
    if screen -list 2>/dev/null | grep -q '[.]scanlisten'; then
      warn "scanlisten already running (skip)"
    else
      screen -dmS scanlisten bash -lc "cd '$MIRAI_DEBUG' && ./scanListen"
      ok "started: screen scanlisten"
    fi

    # Dashboard v2
    if screen -list 2>/dev/null | grep -q '[.]dashboard'; then
      warn "dashboard already running (skip)"
    else
      screen -dmS dashboard bash -lc "cd '$DASHBOARD' && bash start.sh"
      ok "started: screen dashboard"
      sleep 3
    fi

    echo ""
    # Quick health check after start
    if nc -z 127.0.0.1 23 2>/dev/null;   then ok "Port 23  (CNC Telnet)    UP"; else warn "Port 23  not ready"; fi
    if nc -z 127.0.0.1 9090 2>/dev/null; then ok "Port 9090 (HTTP Bot API) UP"; else warn "Port 9090 not ready — did you run rebuild?"; fi
    if nc -z 127.0.0.1 8080 2>/dev/null; then ok "Port 8080 (Dashboard UI) UP"; else warn "Port 8080 not ready yet"; fi

    echo ""
    screen -ls || true
    ;;

  # ── STOP: kill all sessions ─────────────────────────────────────────────────
  stop)
    echo ""
    screen -S cnc        -X quit 2>/dev/null && ok "stopped: cnc"        || warn "cnc not running"
    screen -S scanlisten -X quit 2>/dev/null && ok "stopped: scanlisten" || warn "scanlisten not running"
    screen -S dashboard  -X quit 2>/dev/null && ok "stopped: dashboard"  || warn "dashboard not running"
    echo ""
    screen -ls || true
    ;;

  # ── STATUS: show sessions + health ─────────────────────────────────────────
  status)
    echo ""
    echo "── Screen Sessions ───────────────────────────"
    screen -ls || true
    echo ""
    echo "── Port Health ───────────────────────────────"
    nc -z 127.0.0.1 23   2>/dev/null && ok "Port 23   (CNC Telnet)    UP" || warn "Port 23   DOWN"
    nc -z 127.0.0.1 9090 2>/dev/null && ok "Port 9090 (HTTP Bot API)  UP" || warn "Port 9090 DOWN — run: ./lab-c2.sh rebuild"
    nc -z 127.0.0.1 8080 2>/dev/null && ok "Port 8080 (Dashboard UI)  UP" || warn "Port 8080 DOWN"
    echo ""
    echo "── Live Bot IPs (from Go API) ────────────────"
    curl -sf http://127.0.0.1:9090/bots 2>/dev/null | python3 -m json.tool 2>/dev/null || warn "HTTP Bot API not responding"
    echo ""
    echo "── Dashboard /api/status ─────────────────────"
    curl -sf http://127.0.0.1:8080/api/status 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  cnc_up={d[\"cnc_up\"]}  bot_total={d[\"bot_total\"]}  peers={d[\"peer_ips\"]}')" \
      2>/dev/null || warn "Dashboard not responding"
    echo ""
    ;;

  *)
    usage
    ;;
esac
