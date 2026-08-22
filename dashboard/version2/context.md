# Mirai Bot Tracker v2.0 - Architecture & Feature Overview

This document summarizes the development, features, and technical architecture of the **Mirai Bot Tracker v2.0** dashboard, designed specifically for the isolated Proxmox Research Lab.

## 1. Overview
Version 2.0 transforms the original dashboard into a deterministic, highly-accurate, and scalable C2 monitoring interface. It adopts a retro "CRT hacker" aesthetic (green-on-black). Bot tracking is based on **live IP data pulled directly from the Go CNC's in-memory bot list via HTTP API**, ensuring 100% accuracy, stability, and strict separation between bots and admin sessions.

## 2. Tech Stack
- **Frontend:** HTML5, Vanilla JavaScript, CSS3. Uses `<canvas>` for high-performance rendering of 2,000+ nodes.
- **Backend:** Python 3, Flask (REST API), stdlib `urllib` — no external HTTP deps needed.
- **CNC:** Go — Mirai CNC binary. Exposes Telnet (:23), TCP API (:101), and **HTTP Bot API (:9090)**.

## 3. Key Features
- **Go-native Bot Tracking (replaces `ss`):**
  The Go CNC exposes `GET /bots` on port 9090, returning a JSON array of live bot IPs from `conn.RemoteAddr()`. Strictly bot-only — admins are excluded because `initialHandler()` routes by magic bytes before reaching `Bot.Handle()`. No dashboard self-counting, no flickering.
- **Deterministic Geolocation:**
  Bots are assigned map coordinates via a hash of their IP. Same IP = same pixel always. No random jitter.
- **10-Subnet Lab Alignment:**
  Frontend maps first-octet to country (e.g., `110.x` → Thailand, `66.x` → USA, `95.x` → Russia).
- **One-Click Attack Launchpad:**
  Pre-configured UDP/SYN flood buttons against 5 lab victims, with real-time arc animations on the map.

## 4. Bot Tracking Data Flow

```
Bot payload runs on victim
      │  TCP connect port 23 (magic bytes 0x00 0x00 0x00 <ver>)
      ▼
Go CNC initialHandler() → identifies as Bot → Bot.Handle()
      │  stored in ClientList RAM: clients[uid] = &Bot{conn}
      ▼
GET http://185.10.20.100:9090/bots   ← Python backend polls every 5s
      │  Go iterates clients map, extracts conn.RemoteAddr() per bot
      │  Normalises ::ffff:x.x.x.x → plain IPv4 via .To4()
      │  Returns JSON: ["110.164.20.213", "125.20.30.113", ...]
      ▼
Flask /api/status → { peer_ips: [...], bot_total: N, cnc_up: true }
      ▼
Frontend applyStatus() → hash IP → country bounds → plot green dot
```

## 5. API Reference

### Go CNC HTTP API (port 9090)
| Endpoint | Method | Returns |
|---|---|---|
| `/bots` | GET | `["110.164.20.213", "66.249.64.13"]` — live bot IPs |
| `/count` | GET | `{"count": 4}` — fast bot count |

### Dashboard Flask API (port 8080)
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/status` | GET | `cnc_up`, `bot_total`, `peer_ips`, `logs` |
| `/api/attack` | POST | Launch DDoS: `{target, method, duration, dport}` |
| `/api/geo` | GET | Static node coords for the map |
| `/api/logs` | GET | Last 120 CNC log lines |
| `/api/command` | POST | Free-form CNC command passthrough |

## 6. File Structure
- `mirai/cnc/main.go` — CNC entry, starts Telnet (:23), TCP API (:101), HTTP Bot API (:9090)
- `mirai/cnc/clientList.go` — In-memory bot registry; `GetIPs()` feeds the HTTP endpoint
- `mirai/cnc/bot.go` — Bot session; `Bot.Handle()` keeps TCP alive (180s deadline)
- `dashboard/version2/backend/app.py` — Flask routes
- `dashboard/version2/backend/cnc_client.py` — `get_bot_ips()` → HTTP API; `session()` → Telnet for commands
- `dashboard/version2/frontend/app.js` — Canvas render loop, IP hash → coords, attack buttons
- `dashboard/version2/frontend/style.css` — CRT hacker theme
- `dashboard/version2/frontend/index.html` — Map canvas + attack grid

## 7. Lab Rebuild Steps (after git pull)
```bash
# 1. Rebuild Go CNC (includes new HTTP Bot API on :9090)
cd mirai && go build -o cnc ./cnc/
./cnc &

# 2. Verify HTTP API is alive
curl http://185.10.20.100:9090/bots      # [] when no bots, ["ip",...] when connected
curl http://185.10.20.100:9090/count     # {"count":0}

# 3. Start Dashboard backend
cd dashboard/version2/backend && python app.py

# 4. Open Dashboard in browser
# http://185.10.20.100:8080
```
