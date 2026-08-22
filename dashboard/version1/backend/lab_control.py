#!/usr/bin/env python3
"""
Local lab process helpers on C2 + proxy helpers for Loader agent.
Isolated research lab only (185.10.20.0/24).
"""

from __future__ import annotations

import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any
from urllib import error, request
import json

# Optional dependency — dashboard already ships requests? Use stdlib urllib to avoid new deps.
# urllib is enough.

REPO_ROOT = Path(__file__).resolve().parents[2]
CNC_CANDIDATES = [
    Path(os.environ.get("CNC_BIN", "")),
    REPO_ROOT / "mirai" / "release" / "cnc",
    REPO_ROOT / "mirai" / "debug" / "cnc",
    REPO_ROOT / "mirai" / "cnc" / "cnc",
    Path.home() / "Mirai-Botnet-Simulation-Lab" / "mirai" / "release" / "cnc",
]

LAB_TOKEN = os.environ.get("LAB_TOKEN", "lab-only")
LOADER_AGENT = os.environ.get("LOADER_AGENT_URL", "http://185.10.20.200:9090").rstrip("/")
C2_IP = os.environ.get("LAB_C2_IP", "185.10.20.100")
LOADER_IP = os.environ.get("LAB_LOADER_IP", "185.10.20.200")


def _which_screen() -> str | None:
    from shutil import which

    return which("screen")


def _port_open(port: int) -> bool:
    try:
        out = subprocess.check_output(
            ["ss", "-lntp"],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=3,
        )
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        return False
    return f":{port} " in out or f":{port}\n" in out


def find_cnc_binary() -> Path | None:
    for p in CNC_CANDIDATES:
        if p and p.is_file() and os.access(p, os.X_OK):
            return p
    return None


def cnc_status() -> dict[str, Any]:
    bin_path = find_cnc_binary()
    return {
        "listening_23": _port_open(23),
        "binary": str(bin_path) if bin_path else None,
        "binary_exists": bool(bin_path),
        "screen": _screen_list(),
    }


def _screen_list() -> list[str]:
    screen = _which_screen()
    if not screen:
        return []
    try:
        out = subprocess.check_output(
            [screen, "-ls"],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=3,
        )
    except subprocess.CalledProcessError as exc:
        out = exc.output or ""
    except (subprocess.SubprocessError, OSError):
        return []
    names = []
    for line in out.splitlines():
        line = line.strip()
        if not line or line.startswith("No") or line.startswith("There"):
            continue
        # e.g. 2236.cnc  (Detached)
        parts = line.split("\t")[0].split()
        if parts:
            names.append(parts[0])
    return names


def start_cnc() -> dict[str, Any]:
    if _port_open(23):
        return {"ok": True, "message": "CNC already listening on :23", "cnc": cnc_status()}

    binary = find_cnc_binary()
    if not binary:
        return {
            "ok": False,
            "error": "cnc binary not found (set CNC_BIN or build mirai/release/cnc)",
            "cnc": cnc_status(),
        }

    cwd = str(binary.parent)
    screen = _which_screen()
    log_path = Path("/tmp/lab-cnc.log")

    try:
        if screen:
            # Kill stale named session if present but port free
            subprocess.run(
                [screen, "-S", "cnc", "-X", "quit"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            subprocess.check_call(
                [
                    screen,
                    "-dmS",
                    "cnc",
                    "bash",
                    "-lc",
                    f"cd {cwd} && exec ./{binary.name} >>/tmp/lab-cnc.log 2>&1",
                ]
            )
            how = "screen -dmS cnc"
        else:
            with open(log_path, "ab", buffering=0) as logf:
                subprocess.Popen(
                    [str(binary)],
                    cwd=cwd,
                    stdout=logf,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
            how = "nohup/Popen"
    except (subprocess.SubprocessError, OSError) as exc:
        return {"ok": False, "error": str(exc), "cnc": cnc_status()}

    time.sleep(0.6)
    st = cnc_status()
    return {
        "ok": st["listening_23"],
        "message": f"CNC start attempted via {how}",
        "cnc": st,
        "log": str(log_path),
    }


def stop_cnc() -> dict[str, Any]:
    screen = _which_screen()
    if screen:
        subprocess.run(
            [screen, "-S", "cnc", "-X", "quit"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )

    # Best-effort: free :23 owners named cnc
    try:
        out = subprocess.check_output(["ss", "-lntp"], text=True, timeout=3)
        for line in out.splitlines():
            if ":23 " not in line and not line.rstrip().endswith(":23"):
                continue
            # users:(("cnc",pid=123,fd=...))
            if "pid=" in line:
                for part in line.replace(",", " ").split():
                    if part.startswith("pid="):
                        pid = int(part.split("=")[1].split(")")[0])
                        try:
                            os.kill(pid, signal.SIGTERM)
                        except (ProcessLookupError, PermissionError, OSError):
                            pass
    except (subprocess.SubprocessError, OSError, ValueError):
        pass

    time.sleep(0.4)
    return {"ok": True, "message": "CNC stop attempted", "cnc": cnc_status()}


def loader_request(
    method: str,
    path: str,
    body: dict | None = None,
    timeout: float = 15.0,
) -> dict[str, Any]:
    url = f"{LOADER_AGENT}{path}"
    data = None
    headers = {
        "X-Lab-Token": LAB_TOKEN,
        "Accept": "application/json",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"raw": raw}
            if isinstance(payload, dict):
                payload.setdefault("ok", resp.status < 400)
                payload["_http_status"] = resp.status
            return payload if isinstance(payload, dict) else {"ok": True, "data": payload}
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"error": raw or str(exc)}
        if not isinstance(payload, dict):
            payload = {"error": str(payload)}
        payload["ok"] = False
        payload["_http_status"] = exc.code
        return payload
    except error.URLError as exc:
        return {
            "ok": False,
            "error": f"loader agent unreachable at {LOADER_AGENT}: {exc.reason}",
            "hint": "On Loader: cd loader/lab_agent && ./start.sh (or screen -dmS lab_agent ./start.sh)",
        }
    except OSError as exc:
        return {"ok": False, "error": str(exc)}


def lab_overview() -> dict[str, Any]:
    cnc = cnc_status()
    agent_health = loader_request("GET", "/health", timeout=3.0)
    agent_status = (
        loader_request("GET", "/status", timeout=5.0) if agent_health.get("ok") else None
    )
    return {
        "c2_ip": C2_IP,
        "loader_ip": LOADER_IP,
        "cnc": cnc,
        "loader_agent_url": LOADER_AGENT,
        "loader_agent": agent_health,
        "loader": agent_status,
    }
