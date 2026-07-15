# 🎛️ Cyber Threat Simulation Dashboard

This directory houses the custom frontend dashboard and backend control logic for the **R@NS0M D-D0S (Mirai Botnet) Lab Demonstration**. It is kept separate from the original Mirai codebase to maintain clean code separation.

## 📂 Directory Structure

```
simulation_dashboard/
├── README.md               # This documentation file
├── backend/
│   ├── app.py              # Flask API (controls C2 telnet & fetches database stats)
│   └── requirements.txt    # Python dependencies (Flask, Flask-CORS, PyMySQL)
└── frontend/
    ├── index.html          # Cyber dashboard layout (Dark/Neon theme)
    ├── style.css           # Modern glassmorphism & threat map styles
    └── app.js              # Live updates, attack triggers, and map animations
```

---

## ⚙️ How it Integrates with Mirai
1. **Bot Count & Status:** The backend connects to the MySQL server used by the Mirai CNC (`mirai` database) to count active bot connections and map their IP ranges to Thailand 🇹🇭, USA 🇺🇸, and Japan 🇯🇵.
2. **Command UI (Red Team):** When you click **"Attack Singapore 🇸🇬"** or **"Attack South Korea 🇰🇷"** on the UI:
   - The frontend sends a POST request to the backend.
   - The backend logs in via Telnet to the Mirai C2 port (running on the C2 server).
   - The backend sends the command (e.g., `udp 203.0.113.100 60 dport=80`) to command the bots.
3. **Live Logs:** Shows real-time simulated logs of brute-forcing and network packets to make the presentation highly engaging.
