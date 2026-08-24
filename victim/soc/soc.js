/**
 * Enterprise SOC Dashboard Telemetry Controller
 * High-performance real-time chart rendering & threat state engine.
 */

const HISTORY_LENGTH = 60; // 60 data points (rolling 60s)
const chartData = {
    bandwidth: new Array(HISTORY_LENGTH).fill(0),
    pps: new Array(HISTORY_LENGTH).fill(0)
};

let lastThreatLevel = "NOMINAL";
let canvas, ctx;

// Clock
function updateClock() {
    const now = new Date();
    document.getElementById("liveClock").innerText = now.toUTCString().split(" ")[4] + " UTC";
}
setInterval(updateClock, 1000);
updateClock();

// Chart Initialization
function initCanvas() {
    canvas = document.getElementById("telemetryChart");
    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// Draw 60fps Real-Time Telemetry Waveforms
function drawChart() {
    if (!canvas || !ctx) return;
    
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    
    ctx.clearRect(0, 0, w, h);
    
    // Draw Grid Lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += h / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    
    // Calculate Scale
    const maxBw = Math.max(10, ...chartData.bandwidth) * 1.15;
    const maxPps = Math.max(1000, ...chartData.pps) * 1.15;
    const stepX = w / (HISTORY_LENGTH - 1);
    
    // Draw PPS Wave (Orange)
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < HISTORY_LENGTH; i++) {
        const x = i * stepX;
        const norm = chartData.pps[i] / maxPps;
        const y = h - (norm * (h - 20)) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Draw Bandwidth Fill & Line (Cyan)
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < HISTORY_LENGTH; i++) {
        const x = i * stepX;
        const norm = chartData.bandwidth[i] / maxBw;
        const y = h - (norm * (h - 20)) - 10;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    
    // Line outline
    ctx.beginPath();
    for (let i = 0; i < HISTORY_LENGTH; i++) {
        const x = i * stepX;
        const norm = chartData.bandwidth[i] / maxBw;
        const y = h - (norm * (h - 20)) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

function appendLog(level, msg) {
    const consoleBox = document.getElementById("logConsole");
    const now = new Date().toTimeString().split(" ")[0];
    
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `
        <span class="log-time">[${now}]</span>
        <span class="log-level ${level.toLowerCase()}">[${level}]</span>
        <span class="log-msg">${msg}</span>
    `;
    
    consoleBox.appendChild(entry);
    consoleBox.scrollTop = consoleBox.scrollHeight;
    
    // Limit log elements
    while (consoleBox.children.length > 50) {
        consoleBox.removeChild(consoleBox.firstChild);
    }
}

// Telemetry Poller (Every 500ms)
async function pollMetrics() {
    try {
        const res = await fetch("/api/metrics");
        if (!res.ok) throw new Error("Telemetry API Error");
        const data = await res.json();
        
        // Update Node Info
        if (data.node) {
            document.getElementById("nodeFlag").innerText = data.node.flag || "🌐";
            document.getElementById("nodeName").innerText = data.node.name || "Target Node";
            document.getElementById("nodeIp").innerText = data.node.ip || "127.0.0.1";
        }
        
        const tel = data.telemetry;
        const sys = data.system;
        const health = data.service_health;
        const threat = data.threat;
        
        // Push Chart Data
        chartData.bandwidth.shift();
        chartData.bandwidth.push(tel.inbound_mbps);
        chartData.pps.shift();
        chartData.pps.push(tel.inbound_pps);
        drawChart();
        
        // Update Card 1: Bandwidth
        document.getElementById("valBandwidth").innerText = tel.inbound_mbps.toFixed(2);
        document.getElementById("valPeakBandwidth").innerText = tel.peak_mbps.toFixed(2);
        const bwPct = Math.min(100, Math.max(2, (tel.inbound_mbps / 150) * 100));
        document.getElementById("barBandwidth").style.width = bwPct + "%";
        
        // Update Card 2: PPS
        document.getElementById("valPPS").innerText = tel.inbound_pps.toLocaleString();
        document.getElementById("valPeakPPS").innerText = tel.peak_pps.toLocaleString();
        const ppsPct = Math.min(100, Math.max(2, (tel.inbound_pps / 50000) * 100));
        document.getElementById("barPPS").style.width = ppsPct + "%";
        
        // Update Card 3: Target Health
        const pill = document.getElementById("pillHealth");
        const healthTxt = document.getElementById("valHealthText");
        const healthBar = document.getElementById("healthBar");
        const cardHealth = document.getElementById("cardHealth");
        
        if (health.healthy) {
            pill.className = "status-pill green";
            pill.innerText = `${health.status_code} OK`;
            healthTxt.innerText = "OPERATIONAL";
            healthTxt.style.color = "var(--green-accent)";
            healthBar.style.background = "var(--green-accent)";
            cardHealth.classList.remove("alert-card");
        } else {
            pill.className = "status-pill red";
            pill.innerText = `${health.status_code} DEAD`;
            healthTxt.innerText = "OUTAGE / 504 TIMEOUT";
            healthTxt.style.color = "var(--red-accent)";
            healthBar.style.background = "var(--red-accent)";
            cardHealth.classList.add("alert-card");
        }
        document.getElementById("valLatency").innerText = health.latency_ms;
        
        // Update Card 4: Sunk Volume
        document.getElementById("valTotalSunk").innerText = (tel.total_sunk_mb >= 1024) 
            ? (tel.total_sunk_mb / 1024).toFixed(2) + " GB"
            : tel.total_sunk_mb.toFixed(2) + " MB";
        document.getElementById("valTotalPackets").innerText = tel.total_sunk_packets.toLocaleString();
        
        // Update System Gauges
        document.getElementById("valCpu").innerText = sys.cpu_pct.toFixed(1) + "%";
        document.getElementById("barCpu").style.width = Math.max(4, sys.cpu_pct) + "%";
        
        document.getElementById("valRam").innerText = `${sys.memory.used_mb} / ${sys.memory.total_mb} MB (${sys.memory.pct}%)`;
        document.getElementById("barRam").style.width = Math.max(4, sys.memory.pct) + "%";
        
        // Update Threat Banner & Vector
        const banner = document.getElementById("threatBanner");
        const bannerTxt = document.getElementById("threatText");
        const vectorVal = document.getElementById("valVector");
        
        vectorVal.innerText = threat.vector.replace(/_/g, " ");
        
        if (threat.level === "CRITICAL") {
            banner.className = "threat-banner critical";
            bannerTxt.innerText = "CRITICAL DDoS UNDERWAY // INGRESS SATURATED";
            if (lastThreatLevel !== "CRITICAL") {
                appendLog("CRIT", `HEURISTIC ALERT: High-volume flood detected (${tel.inbound_mbps} Mbps / ${tel.inbound_pps} PPS)`);
                appendLog("CRIT", `Target port 80 backlog overflow - service degraded`);
            }
        } else if (threat.level === "WARNING") {
            banner.className = "threat-banner warning";
            bannerTxt.innerText = "WARNING // ELEVATED TRAFFIC PATTERN DETECTED";
            if (lastThreatLevel === "NOMINAL") {
                appendLog("WARN", `Elevated ingress detected on ${data.interface}: ${tel.inbound_mbps} Mbps`);
            }
        } else {
            banner.className = "threat-banner nominal";
            bannerTxt.innerText = "THREAT LEVEL: NOMINAL // ALL SYSTEMS GO";
            if (lastThreatLevel === "CRITICAL") {
                appendLog("INFO", `Ingress traffic returned to baseline nominal levels.`);
            }
        }
        
        lastThreatLevel = threat.level;
        
    } catch (err) {
        console.warn("Telemetry fetch error:", err);
    }
}

// Initial Boot
window.addEventListener("DOMContentLoaded", () => {
    initCanvas();
    appendLog("INFO", "CloudShield Out-of-Band Telemetry daemon initialized.");
    appendLog("INFO", "Connected to Linux kernel /proc/net/dev telemetry stream.");
    setInterval(pollMetrics, 500);
    pollMetrics();
});
