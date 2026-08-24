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

## 4. Bot Tracking Data Flow & Stability

```
Bot payload runs on victim
      │  TCP connect port 23 (magic bytes 0x00 0x00 0x00 <ver>)
      ▼
Go CNC initialHandler() → identifies as Bot → Bot.Handle()
      │  [FIXED] Uses io.ReadFull() to prevent TCP fragmentation drops
      │  stored in ClientList RAM: clients[uid] = &Bot{conn}
      ▼
GET http://185.10.20.100:9090/bots   
      │  Go iterates clients map, extracts conn.RemoteAddr() per bot
      │  Normalises ::ffff:x.x.x.x → plain IPv4 via .To4()
      ▼
Flask Background Thread (app.py) 
      │  Polls GET /bots and Telnet status every 8s
      │  [NEW] Keeps `_status_cache` fresh for instant API responses (0s delay)
      ▼
Python cnc_client.py 
      │  [NEW] Implements 60-second Grace Period Cache (`bot_grace_sec`)
      │  Remembers recently seen IPs to prevent map flickering during natural bot reconnects
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
| `/api/status` | GET | `cnc_up`, `bot_total`, `peer_ips`, `logs` (Instant from Cache) |
| `/api/attack` | POST | Launch DDoS: `{target, method, duration, dport}` |
| `/api/geo` | GET | Static node coords for the map |
| `/api/logs` | GET | Last 120 CNC log lines |
| `/api/command` | POST | Free-form CNC command passthrough |

## 6. File Structure
- `mirai/cnc/main.go` — CNC entry, starts Telnet (:23), TCP API (:101), HTTP Bot API (:9090)
- `mirai/cnc/clientList.go` — In-memory bot registry; `GetIPs()` feeds the HTTP endpoint
- `mirai/cnc/bot.go` — Bot session; uses `io.ReadFull()` to prevent fragmentation disconnects
- `dashboard/version2/backend/app.py` — Flask routes + 8s Background Poller Thread
- `dashboard/version2/backend/cnc_client.py` — 60s Grace Period Cache for `get_bot_ips()`
- `dashboard/version2/frontend/app.js` — Canvas render loop, IP hash, JOIN/LEAVE per-IP log events
- `dashboard/version2/frontend/style.css` — CRT hacker theme
- `dashboard/version2/frontend/index.html` — Map canvas + attack grid
- `scripts/lab-c2.sh` — Master control script for building and running all lab services in screen

## 7. Lab Operations (Using lab-c2.sh)
The environment is managed entirely via the `lab-c2.sh` script to ensure clean process management across screen sessions.

```bash
# 1. Rebuild Go CNC (Run this after any Go code changes)
~/lab-c2.sh rebuild

# 2. Start all services (CNC + Dashboard)
~/lab-c2.sh start

# 3. Check health & ports
~/lab-c2.sh status

# 4. Stop all services
~/lab-c2.sh stop
```
