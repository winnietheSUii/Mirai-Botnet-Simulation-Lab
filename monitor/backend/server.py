#!/usr/bin/env python3
"""External observer and incident UI for the isolated victim lab.

The observer probes the public transaction route from a public VLAN and reads
victim metrics from the management VLAN. This separation avoids a loopback
health check falsely claiming that a public service remains available.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
HOST = os.environ.get("SOC_BIND", "0.0.0.0")
PORT = int(os.environ.get("SOC_PORT", "8080"))
POLL_SECONDS = float(os.environ.get("SOC_POLL_SECONDS", "1"))
NODES = {
    "us": {"label": "Northline Connectivity", "public": os.environ.get("US_PUBLIC_URL", "http://12.1.2.100"), "agent": os.environ.get("US_AGENT_URL", "http://185.10.20.101:9081"), "public_ip": "12.1.2.100", "management_ip": "185.10.20.101"},
    "ir": {"label": "Pars Energy Bulletin", "public": os.environ.get("IR_PUBLIC_URL", "http://5.200.0.100"), "agent": os.environ.get("IR_AGENT_URL", "http://185.10.20.105:9081"), "public_ip": "5.200.0.100", "management_ip": "185.10.20.105"},
}


def get_json(url: str, timeout: float = 3.0) -> tuple[int, dict, float, str | None]:
    start = time.monotonic()
    try:
        with urlopen(Request(url, headers={"User-Agent": "Lab-External-Observer/1.0"}), timeout=timeout) as response:
            return response.status, json.loads(response.read().decode("utf-8")), round((time.monotonic() - start) * 1000, 1), None
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except Exception:
            payload = {}
        return exc.code, payload, round((time.monotonic() - start) * 1000, 1), "http_error"
    except (URLError, TimeoutError, OSError) as exc:
        return 0, {}, round((time.monotonic() - start) * 1000, 1), type(exc).__name__.lower()


class Store:
    def __init__(self):
        self.lock = threading.Lock()
        self.nodes = {key: {"history": deque(maxlen=600), "events": deque(maxlen=60), "latest": None} for key in NODES}

    def poll_node(self, key: str) -> None:
        config = NODES[key]
        status, public_data, latency, error = get_json(config["public"].rstrip("/") + "/api/transaction-probe")
        agent_status, agent_data, agent_latency, agent_error = get_json(config["agent"].rstrip("/") + "/api/metrics")
        now = time.time()
        public_state = "online" if status == 200 and latency < 1200 else "degraded" if status in {200, 503} else "unreachable"
        if status == 503:
            public_state = "unreachable" if public_data.get("load_state") == "outage" else "degraded"
        management_state = "online" if agent_status == 200 else "stale"
        sample = {"timestamp": now, "public": {"state": public_state, "status": status, "latency_ms": latency, "error": error, "message": public_data.get("message")}, "management": {"state": management_state, "latency_ms": agent_latency, "error": agent_error}, "telemetry": agent_data if agent_status == 200 else None}
        with self.lock:
            node = self.nodes[key]
            previous = node["latest"]
            node["latest"] = sample
            node["history"].append(sample)
            if not previous or previous["public"]["state"] != public_state:
                node["events"].appendleft({"timestamp": now, "kind": public_state, "message": self.event_message(config["label"], public_state, latency)})

    @staticmethod
    def event_message(label: str, state: str, latency: float) -> str:
        if state == "online":
            return f"{label} is responding to an external transaction probe."
        if state == "degraded":
            return f"{label} is degraded. The latest public transaction took {latency:.0f} ms or was shed by the service."
        return f"{label} is unreachable from the public probe path."

    def poll_forever(self) -> None:
        while True:
            for key in NODES:
                try:
                    self.poll_node(key)
                except Exception:
                    pass
            time.sleep(POLL_SECONDS)

    def snapshot(self) -> dict:
        with self.lock:
            result = {}
            for key, data in self.nodes.items():
                result[key] = {"meta": NODES[key], "latest": data["latest"], "history": list(data["history"])[-90:], "events": list(data["events"])}
            return {"generated_at": time.time(), "victims": result}


store = Store()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def log_message(self, _format, *_args):
        pass

    def do_GET(self):
        if self.path == "/api/overview":
            body = json.dumps(store.snapshot()).encode()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


if __name__ == "__main__":
    threading.Thread(target=store.poll_forever, daemon=True, name="external-observer").start()
    print(f"[soc-monitor] http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
