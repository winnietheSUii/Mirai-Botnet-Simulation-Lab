#!/usr/bin/env python3
"""Management-plane telemetry endpoint for one victim LXC."""

from __future__ import annotations

import json
import os
import threading
import time
from http import HTTPStatus
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

from telemetry import TelemetryCollector

COUNTRY = os.environ.get("VICTIM_COUNTRY", "us").lower()
TARGET_IFACE = os.environ.get("TARGET_IFACE", "eth0")
PUBLIC_PORT = int(os.environ.get("PUBLIC_PORT", "80"))
HOST = os.environ.get("MGMT_BIND", "127.0.0.1")
PORT = int(os.environ.get("MGMT_AGENT_PORT", "9081"))
RUNTIME = Path(os.environ.get("VICTIM_RUNTIME_DIR", "/tmp/mirai-victim"))
DEMO_MODE = os.environ.get("SAFE_DEMO_MODE", "").lower()
collector = TelemetryCollector(
    target_iface=TARGET_IFACE,
    public_port=PUBLIC_PORT,
    public_host=os.environ.get("PUBLIC_HEALTH_HOST", os.environ.get("PUBLIC_BIND", "127.0.0.1")),
)
latest_snapshot: dict = {}
snapshot_lock = threading.Lock()


def read_app_stats() -> dict:
    try:
        return json.loads((RUNTIME / f"{COUNTRY}-app.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"capacity": 0, "active": 0, "rejected": 0, "completed": 0}


def load_state(snapshot: dict) -> str:
    if DEMO_MODE in {"normal", "degraded", "outage"}:
        return DEMO_MODE
    traffic = snapshot["telemetry"]
    if traffic["inbound_mbps"] >= 50 or traffic["inbound_pps"] >= 10000:
        return "outage"
    if traffic["inbound_mbps"] >= 10 or traffic["inbound_pps"] >= 2500:
        return "degraded"
    return "normal"


def snapshot() -> dict:
    payload = collector.get_snapshot()
    state = load_state(payload)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    target = RUNTIME / f"{COUNTRY}-load.json"
    temp = target.with_suffix(".tmp")
    temp.write_text(json.dumps({"state": state}), encoding="utf-8")
    temp.replace(target)
    payload.update({
        "victim": COUNTRY,
        "app": read_app_stats(),
        "load_state": state,
        "demo_mode": DEMO_MODE in {"normal", "degraded", "outage"},
    })
    return payload


def refresh_loop() -> None:
    global latest_snapshot
    while True:
        try:
            payload = snapshot()
            with snapshot_lock:
                latest_snapshot = payload
        except Exception:
            pass
        time.sleep(0.75)


def current_snapshot() -> dict:
    with snapshot_lock:
        if latest_snapshot:
            return latest_snapshot
    return snapshot()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

    def do_GET(self):
        if self.path not in {"/api/metrics", "/api/health"}:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        body = json.dumps({"ok": True, "service": "victim-telemetry"} if self.path.endswith("health") else current_snapshot()).encode()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    threading.Thread(target=refresh_loop, daemon=True, name="telemetry-refresh").start()
    print(f"[telemetry-agent] {COUNTRY} on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
