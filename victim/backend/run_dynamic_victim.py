#!/usr/bin/env python3
"""Development launcher for a dynamic victim and its management agent.

Production should use the supplied two systemd units. This launcher preserves
the familiar `./start.sh us|ir` workflow for a classroom lab.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
env = os.environ.copy()
children = [
    subprocess.Popen([sys.executable, str(HERE / "public_app.py")], env=env),
    subprocess.Popen([sys.executable, str(HERE / "telemetry_agent.py")], env=env),
]


def stop(*_args):
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try:
            child.wait(timeout=3)
        except subprocess.TimeoutExpired:
            child.kill()
    raise SystemExit(0)


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
try:
    while True:
        for child in children:
            if child.poll() is not None:
                raise SystemExit(f"victim child stopped with {child.returncode}")
        time.sleep(1)
finally:
    stop()
