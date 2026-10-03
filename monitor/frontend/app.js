const $ = (id) => document.getElementById(id);
let active = "us";
let publicOnly = false;

function text(id, value) { $(id).textContent = value; }
function stateLabel(state) { return ({ online: "ONLINE", degraded: "DEGRADED", unreachable: "UNREACHABLE", stale: "STALE" })[state] || "CHECKING"; }
function shortTime(value) { return value ? new Date(value * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "--:--:--"; }
function fullTime(value) { return value ? new Date(value * 1000).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", year: "numeric", month: "short", day: "numeric", hour12: false }) : "No sample"; }
function nodeId(key) { return `OBS-${key.toUpperCase()}-${String(new Date().getUTCDate()).padStart(2, "0")}`; }

function chart(history) {
  const canvas = $("latencyChart");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const pad = { x: 12, y: 20 }; const innerW = w - pad.x * 2, innerH = h - pad.y * 2;
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(189, 213, 226, .1)";
  for (let i = 0; i < 5; i += 1) { const y = pad.y + innerH * i / 4; ctx.beginPath(); ctx.moveTo(pad.x, y); ctx.lineTo(w - pad.x, y); ctx.stroke(); }
  if (!history.length) return;
  const values = history.map((s) => s.public.state === "unreachable" ? 3000 : Math.min(s.public.latency_ms || 3000, 3000));
  const max = Math.max(1000, ...values) * 1.08;
  const point = (value, i) => ({ x: pad.x + (values.length === 1 ? innerW : innerW * i / (values.length - 1)), y: pad.y + innerH - Math.min(value / max, 1) * innerH });
  const lastState = history.at(-1)?.public.state;
  ctx.beginPath(); values.forEach((value, i) => { const p = point(value, i); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
  ctx.strokeStyle = lastState === "unreachable" ? "#ff4d6d" : lastState === "degraded" ? "#f6ae2d" : "#58e6ff"; ctx.lineWidth = 2; ctx.stroke();
  history.forEach((sample, i) => { if (sample.public.state === "unreachable") { const p = point(values[i], i); ctx.fillStyle = "#ff4d6d"; ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); } });
}

function traceMarkup(trace) {
  const rows = publicOnly ? trace.filter((row) => row.plane === "PUBLIC") : trace;
  if (!rows.length) return "<li>Waiting for observer evidence.</li>";
  return rows.slice(0, 32).map((row) => `<li class="trace-row ${row.result}"><time>${shortTime(row.timestamp)}</time><b class="plane ${row.plane.toLowerCase()}">${row.plane}</b><span class="destination">${row.destination}</span><span class="request">${row.protocol} ${row.target}</span><span class="result">${row.status} · ${stateLabel(row.result)}</span><span class="rtt">${row.latency_ms}ms</span><span class="trace-detail">${row.detail}</span></li>`).join("");
}

function render(node) {
  const sample = node.latest, meta = node.meta;
  text("title", meta.label); text("targetIp", meta.public_ip); text("caseId", nodeId(active));
  if (!sample) return;
  const pub = sample.public, mgmt = sample.management, telemetry = sample.telemetry || {};
  const pubLabel = stateLabel(pub.state), mgmtLabel = stateLabel(mgmt.state);
  text("summary", pub.state === "online" ? "Public transactions are completing. The separate management path is collecting independent evidence." : "Public users are affected. The out-of-band workspace continues to collect telemetry on its separate management route.");
  const publicBox = $("publicVerdict"), managementBox = $("managementVerdict");
  document.body.dataset.publicState = pub.state; document.body.dataset.managementState = mgmt.state;
  publicBox.className = `path-verdict public ${pub.state}`; managementBox.className = `path-verdict management ${mgmt.state}`;
  text("publicStatus", pubLabel); text("publicDetail", pub.state === "online" ? `External transaction completed in ${pub.latency_ms} ms.` : pub.message || "External transaction did not complete.");
  text("managementStatus", mgmtLabel); text("managementDetail", mgmt.state === "online" ? `Telemetry agent answered in ${mgmt.latency_ms} ms.` : "The management route has no current reply.");
  text("publicRouteReadout", pubLabel); text("oobRouteReadout", mgmtLabel); text("freshness", `LAST SAMPLE ${fullTime(sample.timestamp)}`);
  text("alertEyebrow", pub.state === "unreachable" ? "PUBLIC SERVICE FAILURE / EXTERNAL OBSERVER" : "PUBLIC ROUTE STATUS / EXTERNAL OBSERVER"); text("alertHeadline", pub.state === "unreachable" ? "Public service is unavailable" : `Public service is ${pubLabel.toLowerCase()}`); text("alertDetail", pub.state === "unreachable" ? "Customer actions cannot complete. Continue diagnosis from the out-of-band workspace." : "External transactions are being measured from the public route."); text("alertProof", `MANAGEMENT ${mgmtLabel}`); text("impactConclusion", pub.state === "unreachable" && mgmt.state === "online" ? "The incident affects the public route. Management telemetry remains independently reachable for investigation." : "Both paths are being assessed independently before a conclusion is made.");
  text("latestStatus", pub.status ? `${pub.status} · ${pubLabel}` : pubLabel); text("latestLatency", pub.latency_ms ? `${pub.latency_ms} ms` : "TIMEOUT");
  const history = node.history || []; const failed = history.filter((entry) => entry.public.state !== "online").length; const rate = history.length ? Math.round(failed / history.length * 100) : 0;
  text("probeRate", `${history.filter((entry) => entry.public.state === "online").length} / ${history.length}`); text("failureRate", history.length ? `${rate}%` : "—"); text("sampleWindow", history.length ? `${history.length} external probes in the current window.` : "No sample window yet.");
  text("customerImpact", pub.state === "unreachable" ? "Checkout and public actions blocked" : pub.state === "degraded" ? "Customer actions are delayed" : "No current public impact"); text("affectedActions", pub.state === "unreachable" ? "Northline shop checkout, field link check and support case cannot complete." : "The external observer can complete the public transaction."); text("nextStep", pub.state === "unreachable" && mgmt.state === "online" ? "Preserve OOB evidence" : "Continue observation"); text("nextStepDetail", pub.state === "unreachable" && mgmt.state === "online" ? "Use the independent telemetry path to assess ingress and service recovery. Do not rely on the public route." : "Compare public transaction status with the independent management route.");
  const t = telemetry.telemetry || {}, app = telemetry.app || {}, system = telemetry.system || {};
  text("ingress", t.inbound_mbps !== undefined ? `${t.inbound_mbps} Mbps` : "STALE"); text("pps", t.inbound_pps !== undefined ? `${t.inbound_pps.toLocaleString()} pps` : "STALE"); text("workers", app.capacity ? `${app.active} / ${app.capacity}` : "STALE"); text("rejected", app.rejected ?? "STALE"); text("cpu", system.cpu_pct !== undefined ? `${system.cpu_pct}%` : "STALE"); text("memory", system.memory ? `${system.memory.pct}%` : "STALE");
  $("trace").innerHTML = traceMarkup(node.trace || []);
  $("events").innerHTML = (node.events || []).length ? node.events.map((event) => `<li class="${event.kind}"><time>${fullTime(event.timestamp)}</time><span>${event.message}</span></li>`).join("") : "<li>Waiting for a state change.</li>";
  chart(history);
}

async function refresh() {
  try { const response = await fetch("/api/overview", { cache: "no-store" }); if (!response.ok) throw new Error("observer unavailable"); const data = await response.json(); render(data.victims[active]); }
  catch { document.querySelector(".observer").classList.add("offline"); text("summary", "The local observer endpoint is unavailable. No conclusion should be drawn from stale data."); }
}

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => { active = button.dataset.victim; document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button)); refresh(); }));
$("traceFilter").addEventListener("click", (event) => { publicOnly = !publicOnly; event.currentTarget.setAttribute("aria-pressed", String(publicOnly)); event.currentTarget.textContent = publicOnly ? "Public only" : "Public + OOB"; refresh(); });
$("presentation").addEventListener("click", (event) => { const activeMode = document.body.classList.toggle("presentation-mode"); event.currentTarget.setAttribute("aria-pressed", String(activeMode)); event.currentTarget.textContent = activeMode ? "Exit focus" : "Focus display"; });
setInterval(() => { $("clock").textContent = `${new Date().toISOString().slice(11, 19)} UTC`; }, 1000);
window.addEventListener("resize", refresh); refresh(); setInterval(refresh, 1000);
