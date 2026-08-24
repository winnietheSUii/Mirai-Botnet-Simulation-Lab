# 🛡️ Dual-NIC Victim & Enterprise SOC Monitor - Master Architecture (TODO)

## 📌 1. Overview & Architecture Philosophy
In high-throughput DDoS scenarios (Mirai UDP/SYN Floods), a single network interface (`eth0`) will be completely saturated (100% bandwidth/packet exhaustion). If monitoring services run on the same interface, telemetry fails and admin web consoles become unreachable.

This subsystem implements **Out-of-Band (OOB) Dual-NIC Architecture**:
- **Target Interface (`eth0`):** Binds Public Web Services on Port 80. Sunk by botnet floods during attack.
- **Management Interface (`eth1`):** Binds SOC Telemetry Dashboard on Port 8080. Connected to the isolated Admin VLAN (10 / 99), remaining 100% responsive with 0ms latency.

```
                    ┌─────────────────────────┐
[ Mirai Botnet ] ──▶│ eth0: Public IP :80      │ ──▶ [ Public Web Portal ] (Crashes under flood)
 (UDP/SYN Storm)    │ (Target Subnet VLAN 4x) │
                    ├─────────────────────────┤
                    │ Linux Kernel Telemetry  │ ──▶ (/proc/net/dev & /proc/stat)
                    ├─────────────────────────┤
[ Blue Team /    ──▶│ eth1: Mgmt IP :8080     │ ──▶ [ Enterprise SOC Monitor ] (100% Active)
  Admin Console ]   │ (Admin Subnet VLAN 10)  │     - Live Bandwidth / PPS Charts
                    └─────────────────────────┘     - Attack Vector Analysis & Sunk Bytes
```

---

## 📐 2. Network & Subnet Matrix

| Victim ID | Country / Role | Target VLAN | `eth0` (Public IP) | `eth0` Gateway | Mgmt VLAN | `eth1` (OOB Mgmt IP) | Public Service URL | SOC Monitor URL |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **victim-us** | 🇺🇸 USA (AT&T Enterprise) | `40` | `12.1.2.100/24` | `12.1.2.1` | `10` | `185.10.20.101/24` | `http://12.1.2.100` (`us.mirai.lab`) | `http://185.10.20.101:8080` |
| **victim-cn** | 🇨🇳 China (China Telecom) | `41` | `202.97.0.100/24` | `202.97.0.1` | `10` | `185.10.20.102/24` | `http://202.97.0.100` (`cn.mirai.lab`) | `http://185.10.20.102:8080` |
| **victim-ru** | 🇷🇺 Russia (Rostelecom) | `42` | `217.107.0.100/24` | `217.107.0.1` | `10` | `185.10.20.103/24` | `http://217.107.0.100` (`ru.mirai.lab`) | `http://185.10.20.103:8080` |
| **victim-kp** | 🇰🇵 N.Korea (Star JV News) | `43` | `175.45.176.100/24` | `175.45.176.1` | `10` | `185.10.20.104/24` | `http://175.45.176.100` (`kp.mirai.lab`) | `http://185.10.20.104:8080` |
| **victim-ir** | 🇮🇷 Iran (TCI Petroleum) | `44` | `5.200.0.100/24` | `5.200.0.1` | `10` | `185.10.20.105/24` | `http://5.200.0.100` (`ir.mirai.lab`) | `http://185.10.20.105:8080` |

---

## 🖥️ 3. Proxmox Container (LXC) Specifications

Provision **5 LXCs** (ID `401` to `405`) on ThinkCentre Proxmox host:
- **OS Template:** `ubuntu-22.04-standard` or `debian-12-standard`
- **CPU:** 1 vCPU
- **RAM:** 512 MB RAM (Total 5 victims = 2.5 GB RAM)
- **Disk:** 4 GB rootfs
- **Network Configuration (2 NICs per container):**
  - **`net0` (Public Target):**
    - Bridge: `vmbr1`
    - VLAN Tag: `40` (for US), `41` (CN), `42` (RU), `43` (KP), `44` (IR)
    - IPv4: `x.x.x.100/24`
    - Gateway: `x.x.x.1`
  - **`net1` (Out-of-Band SOC Mgmt):**
    - Bridge: `vmbr1`
    - VLAN Tag: `10`
    - IPv4: `185.10.20.10x/24`
    - Gateway: *(leave empty — no default gateway on net1)*

---

## 📁 4. Project Directory Structure

```
victim/
├── TODO.md                     # Full Specification & Lab Roadmap
├── start.sh                    # Universal One-Command Launcher
├── backend/
│   ├── telemetry.py            # Linux /proc/net/dev & /proc/stat kernel reader
│   └── server.py               # Dual-port stdlib HTTP server (80: Web, 8080: SOC)
├── soc/
│   ├── index.html              # Enterprise SOC Dashboard (Datadog/Cloudflare theme)
│   ├── style.css               # Clean Modern Dark Theme
│   └── soc.js                  # 60fps Real-Time Charts & Live Telemetry Stream
└── services/
    ├── us/                     # 🇺🇸 AT&T Enterprise Cloud Portal
    │   └── index.html
    ├── cn/                     # 🇨🇳 China Telecom Financial Clearing Gateway
    │   └── index.html
    ├── ru/                     # 🇷🇺 Rostelecom Federal Energy & Power Grid
    │   └── index.html
    ├── kp/                     # 🇰🇵 Star JV National Central News Agency
    │   └── index.html
    └── ir/                     # 🇮🇷 TCI National Petroleum & Pipeline SCADA
        └── index.html
```

---

## 🚀 5. Quick Start Guide (On Victim LXC)

### Step 1: Clone / Pull Repository on Victim LXC
```bash
git clone <repo_url> ~/Mirai-Source-Code
cd ~/Mirai-Source-Code/victim
```

### Step 2: Start Victim Node
```bash
# Auto-detects country from IP or specify country code:
./start.sh us      # Runs AT&T US Web (port 80) + SOC (port 8080)
# Or:
./start.sh cn      # China Telecom
./start.sh ru      # Rostelecom Russia
./start.sh kp      # Star JV North Korea
./start.sh ir      # TCI Petroleum Iran
```

### Step 3: Verify During Attack Simulation
- Open Public Web: `http://12.1.2.100` (Fails when flooded)
- Open SOC Dashboard: `http://185.10.20.101:8080` (Shows real-time bandwidth spike to ~100+ Mbps)
