#!/usr/bin/env python3
"""Bounded public applications for the US and IR victim nodes.

The service intentionally keeps a small, observable application capacity for
the isolated lab.  It does not create traffic.  A telemetry agent can mark an
already-observed high-ingress condition in a local state file; dynamic routes
then shed work with an honest 503 response instead of pretending to succeed.
"""

from __future__ import annotations

import json
import os
import threading
import time
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT / "apps"
RUNTIME = Path(os.environ.get("VICTIM_RUNTIME_DIR", "/tmp/mirai-victim"))
COUNTRY = os.environ.get("VICTIM_COUNTRY", "us").lower()
HOST = os.environ.get("PUBLIC_BIND", "127.0.0.1")
PORT = int(os.environ.get("PUBLIC_APP_PORT", "8000"))
CAPACITY = max(1, int(os.environ.get("PUBLIC_APP_CAPACITY", "6")))

DATA = {
    "us": {
        "circuits": [
            {"id": "NC-1001", "location": "Riverside DC", "service": "Dedicated Internet", "state": "Operational", "checked": "09:42 UTC"},
            {"id": "NC-2045", "location": "Lakeside Office", "service": "Secure WAN", "state": "Operational", "checked": "09:41 UTC"},
            {"id": "NC-3178", "location": "Maple Branch", "service": "Business Fiber", "state": "Needs review", "checked": "09:38 UTC"},
            {"id": "NC-5520", "location": "Harbor HQ", "service": "Cloud Connect", "state": "Operational", "checked": "09:40 UTC"},
        ]
    },
    "ir": {
        "regions": [
            {"name": "Northern", "state": "Normal supply", "detail": "Delivery windows are operating as scheduled."},
            {"name": "Central", "state": "Planned maintenance", "detail": "One distribution corridor is under planned maintenance."},
            {"name": "Southern", "state": "Normal supply", "detail": "No customer-facing restrictions reported."},
        ],
        "schedules": [
            {"region": "Northern", "date": "2026-10-03", "window": "08:00–12:00", "status": "Confirmed"},
            {"region": "Central", "date": "2026-10-03", "window": "13:00–17:00", "status": "Planned"},
            {"region": "Southern", "date": "2026-10-03", "window": "09:00–15:00", "status": "Confirmed"},
        ],
    },
}


class Capacity:
    def __init__(self, limit: int) -> None:
        self._slots = threading.BoundedSemaphore(limit)
        self._lock = threading.Lock()
        self.active = 0
        self.rejected = 0
        self.completed = 0

    def acquire(self) -> bool:
        if not self._slots.acquire(blocking=False):
            with self._lock:
                self.rejected += 1
            self.persist()
            return False
        with self._lock:
            self.active += 1
        self.persist()
        return True

    def release(self) -> None:
        with self._lock:
            self.active = max(0, self.active - 1)
            self.completed += 1
        self._slots.release()
        self.persist()

    def snapshot(self) -> dict:
        with self._lock:
            return {"capacity": CAPACITY, "active": self.active, "rejected": self.rejected, "completed": self.completed, "updated_at": time.time()}

    def persist(self) -> None:
        RUNTIME.mkdir(parents=True, exist_ok=True)
        target = RUNTIME / f"{COUNTRY}-app.json"
        temp = target.with_suffix(".tmp")
        temp.write_text(json.dumps(self.snapshot()), encoding="utf-8")
        temp.replace(target)


capacity = Capacity(CAPACITY)
capacity.persist()


def load_state() -> str:
    try:
        payload = json.loads((RUNTIME / f"{COUNTRY}-load.json").read_text(encoding="utf-8"))
        return str(payload.get("state", "normal"))
    except (OSError, ValueError, TypeError):
        return "normal"


class PublicHandler(SimpleHTTPRequestHandler):
    server_version = "Northline-Portal/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APPS / COUNTRY), **kwargs)

    def log_message(self, _format, *_args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api(parsed)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.handle_api(parsed)

    def json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def unavailable(self, state: str) -> None:
        self.json(HTTPStatus.SERVICE_UNAVAILABLE, {
            "ok": False,
            "code": "service_busy",
            "message": "This service is temporarily unavailable. Please try again in a few minutes.",
            "load_state": state,
        })

    def guarded(self, work):
        state = load_state()
        if state == "outage" or not capacity.acquire():
            self.unavailable(state)
            return
        try:
            # A small fixed service cost keeps the request lifecycle visible.
            # It is not a traffic generator or a resource-exhaustion routine.
            time.sleep(0.12 if state == "normal" else 0.45)
            work(state)
        finally:
            capacity.release()

    def handle_api(self, parsed) -> None:
        path = parsed.path
        if path == "/api/health":
            self.json(HTTPStatus.OK, {"ok": True, "service": COUNTRY, "load_state": load_state(), "app": capacity.snapshot()})
            return
        if path == "/api/transaction-probe":
            self.guarded(lambda state: self.json(HTTPStatus.OK, {"ok": True, "transaction": "completed", "load_state": state}))
            return
        if COUNTRY == "us":
            self.us_api(path)
        elif COUNTRY == "ir":
            self.ir_api(path, parse_qs(parsed.query))
        else:
            self.json(HTTPStatus.NOT_FOUND, {"ok": False, "message": "No dynamic API for this service."})

    def us_api(self, path: str) -> None:
        if path == "/api/circuits":
            self.guarded(lambda state: self.json(HTTPStatus.OK, {"ok": True, "circuits": DATA["us"]["circuits"], "load_state": state}))
        elif path == "/api/diagnostics":
            self.guarded(lambda state: self.json(HTTPStatus.OK, {"ok": True, "summary": "The circuit is reachable from the Northline edge.", "checked_at": time.strftime("%H:%M:%S UTC"), "load_state": state}))
        elif path == "/api/cases":
            self.guarded(lambda state: self.json(HTTPStatus.CREATED, {"ok": True, "case": "SC-78421", "status": "Open", "message": "Your service case is open and ready for review.", "load_state": state}))
        else:
            self.json(HTTPStatus.NOT_FOUND, {"ok": False, "message": "Unknown Northline endpoint."})

    def ir_api(self, path: str, query: dict) -> None:
        if path == "/api/regions":
            self.guarded(lambda state: self.json(HTTPStatus.OK, {"ok": True, "regions": DATA["ir"]["regions"], "load_state": state}))
        elif path == "/api/schedules":
            region = (query.get("region") or [""])[0]
            rows = [x for x in DATA["ir"]["schedules"] if not region or x["region"].lower() == region.lower()]
            self.guarded(lambda state: self.json(HTTPStatus.OK, {"ok": True, "schedules": rows, "load_state": state}))
        elif path == "/api/subscriptions":
            self.guarded(lambda state: self.json(HTTPStatus.CREATED, {"ok": True, "message": "Your local lab alert subscription is active.", "load_state": state}))
        else:
            self.json(HTTPStatus.NOT_FOUND, {"ok": False, "message": "Unknown Pars endpoint."})


def main() -> None:
    if COUNTRY not in DATA:
        raise SystemExit("public_app supports VICTIM_COUNTRY=us or ir")
    print(f"[public-app] {COUNTRY} on http://{HOST}:{PORT}, capacity={CAPACITY}")
    ThreadingHTTPServer((HOST, PORT), PublicHandler).serve_forever()


if __name__ == "__main__":
    main()
