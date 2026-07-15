const API_BASE = 'http://localhost:5000/api';

// Bot coordinates on our map canvas (in percentages matching the HTML style values)
const NODE_COORDINATES = {
    "Thailand": { x: 35, y: 65 },
    "USA": { x: 80, y: 30 },
    "Japan": { x: 55, y: 40 },
    "SG": { x: 40, y: 75 },
    "KR": { x: 48, y: 45 }
};

document.addEventListener("DOMContentLoaded", () => {
    // Initial fetch of bots
    fetchStatus();
    // Poll updates every 5 seconds
    setInterval(fetchStatus, 5000);
});

async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        
        // Update mode indicator
        const sysMode = document.getElementById("sys-mode");
        if (data.mode === "production") {
            sysMode.textContent = "ONLINE (PRODUCTION)";
            sysMode.className = "status-badge online";
        } else {
            sysMode.textContent = "OFFLINE SIMULATION (MOCK)";
            sysMode.className = "status-badge mock";
        }

        // Update Total Bots
        const bots = data.bots || [];
        document.getElementById("total-bots-count").textContent = bots.length;

        // Populate Table
        const tbody = document.getElementById("bot-table-body");
        tbody.innerHTML = "";
        
        bots.forEach(bot => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><code>${bot.ip}</code></td>
                <td>${bot.flag} ${bot.country}</td>
                <td><span class="status-text">${bot.status}</span></td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        logToTerminal(`[ERROR] Failed to fetch bot status from backend: ${error.message}`, "text-red");
    }
}

async function launchAttack(targetIp, targetName) {
    // Determine short target identifier for map coords
    const targetKey = targetIp === "203.0.113.100" ? "SG" : "KR";
    
    // Clear any active attack visual lines first
    clearAttackLines();
    
    logToTerminal(`[C2 COMMAND] Issuing DDoS attack order targeting: ${targetName} (${targetIp})`, "text-yellow");
    logToTerminal(`[C2 COMMAND] Sending payload parameters: Port 80, duration 10s...`, "text-cyan");

    try {
        const response = await fetch(`${API_BASE}/attack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_ip: targetIp,
                target_name: targetName,
                attack_type: "udp",
                duration: 10
            })
        });
        
        const data = await response.json();
        logToTerminal(`[C2 RESPONSE] ${data.message}`, "text-green");
        
        // Visualizes active lines from bot locations to target location
        drawLaserAttacks(targetKey);
        
        // Simulate attack count UI update
        const attackCountEl = document.getElementById("active-attacks-count");
        attackCountEl.textContent = "1";
        
        // Simulating the traffic logs running on Wireshark/Console
        simulateTrafficLogs(targetIp);

        // Turn off attack visualization after 10 seconds
        setTimeout(() => {
            clearAttackLines();
            attackCountEl.textContent = "0";
            logToTerminal(`[SYSTEM] Attack finished targeting ${targetName}. Connection idle.`, "text-green");
        }, 10000);

    } catch (error) {
        logToTerminal(`[ERROR] Command transmission failed: ${error.message}`, "text-red");
    }
}

function drawLaserAttacks(targetKey) {
    const svg = document.getElementById("svg-lines");
    svg.innerHTML = ""; // Clear existing lines

    const targetCoords = NODE_COORDINATES[targetKey];
    if (!targetCoords) return;

    const sourceCountries = ["Thailand", "USA", "Japan"];
    
    sourceCountries.forEach(country => {
        const start = NODE_COORDINATES[country];
        if (!start) return;

        // Create line element
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", `${start.x}%`);
        line.setAttribute("y1", `${start.y}%`);
        line.setAttribute("x2", `${targetCoords.x}%`);
        line.setAttribute("y2", `${targetCoords.y}%`);
        line.setAttribute("stroke", "var(--accent-red)");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-dasharray", "8, 4");
        
        // Create laser animation inside SVG line
        const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
        animate.setAttribute("attributeName", "stroke-dashoffset");
        animate.setAttribute("values", "100;0");
        animate.setAttribute("dur", "2s");
        animate.setAttribute("repeatCount", "indefinite");
        
        line.appendChild(animate);
        svg.appendChild(line);
    });
}

function clearAttackLines() {
    document.getElementById("svg-lines").innerHTML = "";
}

function logToTerminal(message, cssClass = "") {
    const terminal = document.getElementById("terminal-logs");
    const line = document.createElement("div");
    line.className = `log-line ${cssClass}`;
    line.textContent = message;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function simulateTrafficLogs(targetIp) {
    let count = 0;
    const interval = setInterval(() => {
        if (count >= 5) {
            clearInterval(interval);
            return;
        }
        const sources = ["110.164.20.11", "66.249.64.12", "122.211.0.11"];
        const randSource = sources[Math.floor(Math.random() * sources.length)];
        logToTerminal(`[TRAFFIC] UDP Flood Packet: ${randSource} -> ${targetIp}:80 (Size: 1024 Bytes)`, "text-red");
        count++;
    }, 1200);
}
