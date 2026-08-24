#!/usr/bin/env python3
"""
Dual-Port HTTP Server for Victim Node.
Port 80   -> Public Country Web Service (AT&T, China Telecom, etc.)
Port 8080 -> Out-of-Band Enterprise SOC Monitoring Dashboard & Telemetry API
Pure Python 3 Standard Library (No pip dependencies needed).
"""

import os
import sys
import json
import time
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from telemetry import TelemetryCollector

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
SOC_DIR = ROOT_DIR / "soc"
SERVICES_DIR = ROOT_DIR / "services"

# Configurations
PUBLIC_PORT = int(os.environ.get("PUBLIC_PORT", "80"))
MGMT_PORT = int(os.environ.get("MGMT_PORT", "8080"))
TARGET_COUNTRY = os.environ.get("VICTIM_COUNTRY", "us").lower()
TARGET_IFACE = os.environ.get("TARGET_IFACE", "eth0")

COUNTRY_INFO = {
    "us": {
        "name": "United States",
        "org": "AT&T Enterprise Cloud & Core Gateway",
        "ip": "12.1.2.100",
        "flag": "🇺🇸",
        "color": "#3b82f6"
    },
    "cn": {
        "name": "China",
        "org": "China Telecom National Banking & Clearing Node",
        "ip": "202.97.0.100",
        "flag": "🇨🇳",
        "color": "#ef4444"
    },
    "ru": {
        "name": "Russia",
        "org": "Rostelecom Federal Energy & SCADA Grid",
        "ip": "217.107.0.100",
        "flag": "🇷🇺",
        "color": "#8b5cf6"
    },
    "kp": {
        "name": "North Korea",
        "org": "Star JV National Information Service",
        "ip": "175.45.176.100",
        "flag": "🇰🇵",
        "color": "#f59e0b"
    },
    "ir": {
        "name": "Iran",
        "org": "TCI National Petroleum Pipeline Dispatch",
        "ip": "5.200.0.100",
        "flag": "🇮🇷",
        "color": "#10b981"
    }
}

# Global Collector Instance
collector = TelemetryCollector(target_iface=TARGET_IFACE, public_port=PUBLIC_PORT)


class PublicServiceHandler(SimpleHTTPRequestHandler):
    """Handles requests on Port 80 (Target Public Site)."""
    def __init__(self, *args, **kwargs):
        service_path = SERVICES_DIR / TARGET_COUNTRY
        if not service_path.exists():
            service_path = SERVICES_DIR / "us"
        super().__init__(*args, directory=str(service_path), **kwargs)

    def log_message(self, format, *args):
        # Suppress flood log spam to keep console clean
        pass


class SOCHandler(SimpleHTTPRequestHandler):
    """Handles requests on Port 8080 (SOC Telemetry Dashboard & REST API)."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SOC_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/metrics" or self.path.startswith("/api/metrics?"):
            data = collector.get_snapshot()
            data["node"] = COUNTRY_INFO.get(TARGET_COUNTRY, COUNTRY_INFO["us"])
            data["node"]["country_code"] = TARGET_COUNTRY.upper()
            
            body = json.dumps(data).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return
            
        elif self.path == "/api/health":
            body = b'{"status":"ok","soc":"active"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            return
            
        # Default static file serving from soc/
        super().do_GET()

    def log_message(self, format, *args):
        # Keep clean
        pass


def run_public_server():
    """Start Port 80 Server."""
    try:
        server = ThreadingHTTPServer(("0.0.0.0", PUBLIC_PORT), PublicServiceHandler)
        print(f"[+] [Public Web] Listening on 0.0.0.0:{PUBLIC_PORT} (Serving services/{TARGET_COUNTRY})")
        server.serve_forever()
    except Exception as e:
        print(f"[!] Public Web Server error on port {PUBLIC_PORT}: {e}", file=sys.stderr)


def run_soc_server():
    """Start Port 8080 Server."""
    try:
        server = ThreadingHTTPServer(("0.0.0.0", MGMT_PORT), SOCHandler)
        print(f"[+] [SOC Dashboard] Listening on 0.0.0.0:{MGMT_PORT} (OOB Management UI)")
        server.serve_forever()
    except Exception as e:
        print(f"[!] SOC Server error on port {MGMT_PORT}: {e}", file=sys.stderr)


def main():
    info = COUNTRY_INFO.get(TARGET_COUNTRY, COUNTRY_INFO["us"])
    print("=" * 60)
    print(f"🛡️  VICTIM NODE TELEMETRY & SERVICE DAEMON")
    print(f"   Node:      {info['flag']} {info['name']} ({info['org']})")
    print(f"   Target IP: {info['ip']} | Interface: {TARGET_IFACE}")
    print(f"   Public:    http://0.0.0.0:{PUBLIC_PORT}")
    print(f"   SOC OOB:   http://0.0.0.0:{MGMT_PORT}")
    print("=" * 60)

    # Thread 1: Public Web Server (Port 80)
    t_public = threading.Thread(target=run_public_server, daemon=True, name="PublicWeb")
    t_public.start()

    # Thread 2: SOC Dashboard Server (Port 8080)
    t_soc = threading.Thread(target=run_soc_server, daemon=True, name="SOCDashboard")
    t_soc.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Stopping victim services gracefully...")
        sys.exit(0)


if __name__ == "__main__":
    main()
