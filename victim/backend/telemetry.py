#!/usr/bin/env python3
"""
Telemetry Collector for Victim Node.
Reads /proc/net/dev, /proc/stat, /proc/meminfo directly from Linux Kernel.
Zero external dependencies (stdlib only).
"""

import time
import os
import urllib.request
import urllib.error

class TelemetryCollector:
    def __init__(self, target_iface: str = "eth0", public_port: int = 80):
        self.target_iface = target_iface
        self.public_port = public_port
        
        self.prev_time = time.time()
        self.prev_rx_bytes = 0
        self.prev_rx_packets = 0
        self.prev_tx_bytes = 0
        self.prev_tx_packets = 0
        
        self.prev_cpu_idle = 0
        self.prev_cpu_total = 0
        
        self.total_sunk_bytes = 0
        self.total_sunk_packets = 0
        
        self.peak_mbps = 0.0
        self.peak_pps = 0
        
        # Initial probe
        self._init_network()
        self._init_cpu()

    def _get_active_iface(self) -> str:
        """Find target interface or fallback to primary non-loopback."""
        if os.path.exists(f"/sys/class/net/{self.target_iface}"):
            return self.target_iface
        
        # Fallback inspection of /proc/net/dev
        try:
            with open("/proc/net/dev", "r") as f:
                for line in f.readlines()[2:]:
                    name = line.split(":")[0].strip()
                    if name != "lo" and not name.startswith("docker"):
                        return name
        except Exception:
            pass
        return "eth0"

    def _init_network(self):
        iface = self._get_active_iface()
        rx_b, rx_p, tx_b, tx_p = self._read_net_dev(iface)
        self.prev_rx_bytes = rx_b
        self.prev_rx_packets = rx_p
        self.prev_tx_bytes = tx_b
        self.prev_tx_packets = tx_p
        self.prev_time = time.time()

    def _read_net_dev(self, iface: str):
        """Read rx_bytes, rx_packets, tx_bytes, tx_packets from /proc/net/dev."""
        try:
            with open("/proc/net/dev", "r") as f:
                for line in f:
                    if iface in line:
                        parts = line.split(":", 1)[1].split()
                        # Format: rx_bytes, rx_packets, ..., tx_bytes, tx_packets
                        rx_bytes = int(parts[0])
                        rx_packets = int(parts[1])
                        tx_bytes = int(parts[8])
                        tx_packets = int(parts[9])
                        return rx_bytes, rx_packets, tx_bytes, tx_packets
        except Exception:
            pass
        return 0, 0, 0, 0

    def _init_cpu(self):
        try:
            with open("/proc/stat", "r") as f:
                line = f.readline()
                fields = [float(x) for x in line.split()[1:]]
                self.prev_cpu_idle = fields[3]
                self.prev_cpu_total = sum(fields)
        except Exception:
            pass

    def _read_cpu_pct(self) -> float:
        try:
            with open("/proc/stat", "r") as f:
                line = f.readline()
                fields = [float(x) for x in line.split()[1:]]
                idle = fields[3]
                total = sum(fields)
                
                diff_idle = idle - self.prev_cpu_idle
                diff_total = total - self.prev_cpu_total
                
                self.prev_cpu_idle = idle
                self.prev_cpu_total = total
                
                if diff_total > 0:
                    cpu_pct = 100.0 * (1.0 - (diff_idle / diff_total))
                    return max(0.0, min(100.0, round(cpu_pct, 1)))
        except Exception:
            pass
        return 0.0

    def _read_mem(self) -> dict:
        total_kb = 0
        avail_kb = 0
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        total_kb = int(line.split()[1])
                    elif line.startswith("MemAvailable:"):
                        avail_kb = int(line.split()[1])
            used_kb = total_kb - avail_kb
            pct = round((used_kb / total_kb) * 100, 1) if total_kb > 0 else 0
            return {
                "used_mb": round(used_kb / 1024, 1),
                "total_mb": round(total_kb / 1024, 1),
                "pct": pct
            }
        except Exception:
            return {"used_mb": 0, "total_mb": 512, "pct": 0}

    def _check_web_health(self) -> dict:
        """Probe local web server on public port to test responsiveness under flood."""
        url = f"http://127.0.0.1:{self.public_port}/"
        t0 = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SOC-HealthProbe/1.0"})
            with urllib.request.urlopen(req, timeout=1.2) as resp:
                latency_ms = round((time.time() - t0) * 1000, 1)
                return {
                    "status_code": resp.status,
                    "status_text": "200 OK",
                    "latency_ms": latency_ms,
                    "healthy": True
                }
        except urllib.error.HTTPError as e:
            latency_ms = round((time.time() - t0) * 1000, 1)
            return {
                "status_code": e.code,
                "status_text": f"HTTP {e.code}",
                "latency_ms": latency_ms,
                "healthy": False
            }
        except Exception as e:
            latency_ms = round((time.time() - t0) * 1000, 1)
            return {
                "status_code": 504,
                "status_text": "GATEWAY TIMEOUT / DEAD",
                "latency_ms": latency_ms,
                "healthy": False
            }

    def get_snapshot(self) -> dict:
        now = time.time()
        dt = max(0.1, now - self.prev_time)
        
        iface = self._get_active_iface()
        rx_b, rx_p, tx_b, tx_p = self._read_net_dev(iface)
        
        # Calculate deltas
        delta_rx_b = max(0, rx_b - self.prev_rx_bytes)
        delta_rx_p = max(0, rx_p - self.prev_rx_packets)
        delta_tx_b = max(0, tx_b - self.prev_tx_bytes)
        delta_tx_p = max(0, tx_p - self.prev_tx_packets)
        
        self.prev_rx_bytes = rx_b
        self.prev_rx_packets = rx_p
        self.prev_tx_bytes = tx_b
        self.prev_tx_packets = tx_p
        self.prev_time = now
        
        # Rates
        rx_bytes_sec = delta_rx_b / dt
        rx_mbps = round((rx_bytes_sec * 8) / 1_000_000, 2)
        rx_pps = int(delta_rx_p / dt)
        
        tx_bytes_sec = delta_tx_b / dt
        tx_mbps = round((tx_bytes_sec * 8) / 1_000_000, 2)
        tx_pps = int(delta_tx_p / dt)
        
        # Track session peaks and cumulative data
        if rx_mbps > self.peak_mbps:
            self.peak_mbps = rx_mbps
        if rx_pps > self.peak_pps:
            self.peak_pps = rx_pps
            
        self.total_sunk_bytes += delta_rx_b
        self.total_sunk_packets += delta_rx_p
        
        # Health & CPU
        cpu_pct = self._read_cpu_pct()
        mem = self._read_mem()
        web_health = self._check_web_health()
        
        # Attack heuristic status
        if rx_mbps >= 50.0 or rx_pps >= 10000 or (not web_health["healthy"] and rx_pps >= 2000):
            attack_state = "CRITICAL_ATTACK"
            threat_level = "CRITICAL"
            vector = "HIGH_VOLUME_UDP_SYN_FLOOD"
        elif rx_mbps >= 10.0 or rx_pps >= 2500:
            attack_state = "ELEVATED_TRAFFIC"
            threat_level = "WARNING"
            vector = "ANOMALOUS_INGRESS"
        else:
            attack_state = "NORMAL"
            threat_level = "NOMINAL"
            vector = "NONE"
            
        return {
            "timestamp": now,
            "interface": iface,
            "telemetry": {
                "inbound_mbps": rx_mbps,
                "inbound_pps": rx_pps,
                "outbound_mbps": tx_mbps,
                "outbound_pps": tx_pps,
                "peak_mbps": self.peak_mbps,
                "peak_pps": self.peak_pps,
                "total_sunk_mb": round(self.total_sunk_bytes / (1024 * 1024), 2),
                "total_sunk_packets": self.total_sunk_packets,
            },
            "system": {
                "cpu_pct": cpu_pct,
                "memory": mem
            },
            "service_health": web_health,
            "threat": {
                "state": attack_state,
                "level": threat_level,
                "vector": vector
            }
        }
