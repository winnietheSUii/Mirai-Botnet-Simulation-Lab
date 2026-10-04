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
// Real city coordinates (not country centroids), deliberately NOT
// reusing any STATIC_NODES coordinate (C2 48.80,2.35 / Loader
// 48.85,2.50 / victims incl. NYC 40.71,-74.01 / Shanghai
// 31.23,121.47) -- an earlier pass collided with those exactly,
// which looked like bots firing from on top of the target itself.
// Jitter is wide so 1200 bots actually fan out and read as a real
// swarm instead of clumping into ~20 single blobs.
const REGIONS = [
  {lat:34.05,lon:-118.24,c:"USA"},{lat:41.88,lon:-87.63,c:"USA"},{lat:29.76,lon:-95.37,c:"USA"},{lat:47.61,lon:-122.33,c:"USA"},{lat:33.75,lon:-84.39,c:"USA"},
  {lat:19.43,lon:-99.13,c:"Mexico"},{lat:20.66,lon:-103.35,c:"Mexico"},
  {lat:-23.55,lon:-46.63,c:"Brazil"},{lat:-22.91,lon:-43.17,c:"Brazil"},{lat:-15.79,lon:-47.88,c:"Brazil"},
  {lat:-34.60,lon:-58.38,c:"Argentina"},
  {lat:52.52,lon:13.40,c:"Germany"},{lat:48.14,lon:11.58,c:"Germany"},{lat:50.11,lon:8.68,c:"Germany"},
  {lat:45.76,lon:4.84,c:"France"},{lat:43.30,lon:5.37,c:"France"},
  {lat:40.42,lon:-3.70,c:"Spain"},{lat:41.39,lon:2.17,c:"Spain"},
  {lat:51.51,lon:-0.13,c:"United Kingdom"},{lat:53.48,lon:-2.24,c:"United Kingdom"},
  {lat:52.23,lon:21.01,c:"Poland"},
  {lat:41.90,lon:12.50,c:"Italy"},{lat:45.46,lon:9.19,c:"Italy"},
  {lat:55.75,lon:37.62,c:"Russia"},{lat:55.03,lon:82.92,c:"Russia"},
  {lat:24.71,lon:46.68,c:"Middle East"},{lat:25.20,lon:55.27,c:"Middle East"},
  {lat:19.08,lon:72.88,c:"India"},{lat:28.61,lon:77.23,c:"India"},{lat:12.97,lon:77.59,c:"India"},
  {lat:39.90,lon:116.41,c:"China"},{lat:22.54,lon:114.06,c:"China"},{lat:23.13,lon:113.26,c:"China"},
  {lat:35.68,lon:139.69,c:"Japan"},{lat:34.69,lon:135.50,c:"Japan"},
  {lat:37.57,lon:126.98,c:"South Korea"},
  {lat:13.75,lon:100.50,c:"Thailand"},
  {lat:-6.21,lon:106.85,c:"Indonesia"},
  {lat:-33.87,lon:151.21,c:"Australia"},{lat:-37.81,lon:144.96,c:"Australia"},
  {lat:6.52,lon:3.38,c:"Central Africa"},{lat:-1.29,lon:36.82,c:"Central Africa"},
];
for(let i=1; i<=2000; i++){
  // Plain i % length -- NOT i*7 % length. REGIONS.length is 42
  // (divisible by 7), so *7 only ever lands on 6 distinct indices
  // (42/gcd(7,42)=6) no matter how many bots get generated. That
  // was the actual cause of "100 bots, only 6 visible clusters".
  const r = REGIONS[i % REGIONS.length];
  const s = Math.sin(i) * 10000;
  const rand1 = s - Math.floor(s);
  const s2 = Math.cos(i) * 10000;
  const rand2 = s2 - Math.floor(s2);
  ALL_BOTS.push({
    id:"bot"+i, type:"bot", label:"BOT-"+i,
    ip: "10." + Math.floor(rand1*255) + "." + Math.floor(rand2*255) + "." + (i%255),
    lat: r.lat + (rand1-.5)*0.5,
    lon: r.lon + (rand2-.5)*0.7,
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
let hideLoaderNode = false; // hides the yellow LOADER dot on the map
let projNodes = [];
let arcs = [];
let impacts = [];

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
  attacker: { fill:"#ffe033", glow:"#ffe03380", r:7  },
  bot:      { fill:"#00ff41", glow:"#00ff4140", r:2.4  },
  victim:   { fill:"#ff2222", glow:"#ff222280", r:7  },
};

/* ---- DRAW MAP -------------------------------------------- */
const MAP_LABELS = [
  ["NORTH AMERICA", 45, -100], ["SOUTH AMERICA", -15, -60],
  ["EUROPE", 50, 15], ["ASIA", 42, 90],
  ["AFRICA", 5, 20], ["AUSTRALIA", -25, 135],
];

/* ---- "Earth at night" texture -----------------------------
   Procedural city-light speckle, not a downloaded image (this
   lab is offline -- a fetched basemap would just 404 at deploy
   time). Real photos of Earth at night aren't uniform speckle --
   light clusters around a handful of metro "hubs" per landmass,
   with sparse glow between them, and the lights themselves
   flicker faintly like a real distant skyline. Positions (and
   their hub pull) are computed once per resize; brightness is
   animated fresh each frame.
   ----------------------------------------------------------- */
let cityLights = [];

function pointInPolyXY(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (((a.y > y) !== (b.y > y)) &&
        (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
  }
  return inside;
}

function buildMapTexture() {
  if (!W || !H) return;
  cityLights = [];
  for (const poly of WORLD_POLYS) {
    const projected = poly.pts.map(([lat,lon]) => project(lat,lon,W,H));
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for (const p of projected) { if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; }
    const area = Math.max(0, (maxX-minX)) * Math.max(0, (maxY-minY));
    if (area < 40) continue;

    // A handful of "metro hubs" per landmass -- lights cluster
    // around these instead of scattering uniformly.
    const hubCount = Math.min(5, Math.max(1, Math.floor(area/9000)));
    const hubs = [];
    let hubTries = 0;
    while (hubs.length < hubCount && hubTries < hubCount*20) {
      hubTries++;
      const hx = minX + Math.random()*(maxX-minX);
      const hy = minY + Math.random()*(maxY-minY);
      if (pointInPolyXY(hx,hy,projected)) hubs.push({x:hx,y:hy});
    }
    if (!hubs.length) continue;

    const target = Math.min(220, Math.max(14, Math.floor(area/420)));
    let placed = 0, tries = 0;
    while (placed < target && tries < target*10) {
      tries++;
      const hub = hubs[Math.floor(Math.random()*hubs.length)];
      const spread = 14 + Math.random()*34;
      const angle = Math.random()*Math.PI*2;
      const x = hub.x + Math.cos(angle)*spread*Math.random();
      const y = hub.y + Math.sin(angle)*spread*Math.random();
      if (!pointInPolyXY(x,y,projected)) continue;
      placed++;
      cityLights.push({
        x, y,
        r: Math.random()*0.8+0.3,
        base: 0.14 + Math.random()*0.22,
        amp: 0.08 + Math.random()*0.14,
        phase: Math.random()*Math.PI*2,
        speed: 1.4 + Math.random()*1.8,
      });
    }
  }
}

function drawCityLights(now) {
  const t = now / 1000;
  for (const l of cityLights) {
    const flicker = l.base + l.amp * (0.5 + 0.5*Math.sin(t*l.speed + l.phase));
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(160,255,180,${flicker.toFixed(3)})`;
    ctx.fill();
  }
}

function drawMap() {
  const now = Date.now();
  // Black ocean -- unchanged, this was never the complaint.
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,W,H);

  // Faint lat/long graticule, ocean only -- drawn before the
  // continent fill so land paints over it and it never competes
  // with the city-light texture.
  ctx.strokeStyle = "#00ff410d";
  ctx.lineWidth = 0.5;
  for (let lon=-180; lon<=180; lon+=30) {
    const p1 = project(84,lon,W,H), p2 = project(-84,lon,W,H);
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
  }
  for (let lat=-60; lat<=80; lat+=30) {
    const p1 = project(lat,-180,W,H), p2 = project(lat,180,W,H);
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
  }

  // Continent fill -- the original near-black green, kept as-is.
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

  // Real surface detail: clustered, flickering city-light texture.
  drawCityLights(now);

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

  // Region labels -- static, not hover-only.
  ctx.font = "9px 'Share Tech Mono', monospace";
  ctx.fillStyle = "#1f6b2f";
  ctx.textAlign = "center";
  for (const [name, lat, lon] of MAP_LABELS) {
    const {x,y} = project(lat,lon,W,H);
    ctx.fillText(name, x, y);
  }
}

/* ---- BOT GLOW SPRITE --------------------------------------
   Pre-rendered radial-gradient glow, drawn with additive
   ("lighter") blending -- overlapping bots in the same hotspot
   naturally brighten into a density glow instead of a flat
   sprinkle of identical dots. Core marker on top is a small
   constant-size SQUARE pixel (reads as "data point", not a
   circle like the victim/attacker halos -- no visual confusion).
   ----------------------------------------------------------- */
let botSprite = null;
(function buildBotSprite(){
  const size = 14;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size/2,size/2,0, size/2,size/2,size/2);
  grad.addColorStop(0,   "#5bffa0a0");
  grad.addColorStop(.5,  "#00ff4130");
  grad.addColorStop(1,   "#00ff4100");
  g.fillStyle = grad;
  g.beginPath(); g.arc(size/2,size/2,size/2,0,Math.PI*2); g.fill();
  botSprite = c;
})();

/* ---- DRAW NODES ------------------------------------------ */
function drawNodes() {
  projNodes = [];
  const now = Date.now();

  const allBots  = LAB_NODES.filter(n => n.type === "bot");
  const BOT_CAP  = 600;
  // Evenly-sampled spread across the full swarm instead of always
  // re-drawing the same first-N bots -- the map should reflect scale.
  const step       = Math.max(1, Math.ceil(allBots.length / BOT_CAP));
  const sampleBots = allBots.length > BOT_CAP ? allBots.filter((_,i) => i % step === 0) : allBots;
  let visibleNodes = LAB_NODES.length > 80 ? [...LAB_NODES.filter(n=>n.type!=="bot"), ...sampleBots] : LAB_NODES;
  if (hideLoaderNode) visibleNodes = visibleNodes.filter(n => n.id !== "ldr");

  // NOTE: bot glow is drawn with normal (source-over) blending below,
  // per-node -- deliberately NOT additive/"lighter". Additive glow
  // means any two nearby bots visually MERGE into one bright blob no
  // matter how small each sprite is; that was the actual cause of
  // bots reading as "grouped" instead of as separate dots.

  for (const node of visibleNodes) {
    const {x,y} = project(node.lat, node.lon, W, H);
    const s = NODE_STYLE[node.type];

    if (node.type === "bot") {
      /* ------ PIXEL CORE: constant size, real peers brighter ------ */
      const isReal = node.id.startsWith("bot_peer_");
      ctx.drawImage(botSprite, x-7, y-7, 14, 14); // normal blend, no stacking/merging
      const px = isReal ? 3.2 : 2.2;
      ctx.fillStyle = isReal ? "#e8fff0" : "#00ff41";
      ctx.globalAlpha = isReal ? 1 : .88;
      ctx.fillRect(x-px/2, y-px/2, px, px);
      ctx.globalAlpha = 1;

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

      // Rotating targeting reticle (victims only) -- idle HUD feel
      if (node.type === "victim") {
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate((now/4200) % (Math.PI*2));
        ctx.setLineDash([3,5]);
        ctx.strokeStyle = "#ff222295";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0,0,s.r+9,0,Math.PI*2); ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(-(now/2600) % (Math.PI*2));
        ctx.strokeStyle = "#ff222250";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-(s.r+16),0); ctx.lineTo(-(s.r+9),0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s.r+9,0); ctx.lineTo(s.r+16,0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-(s.r+16)); ctx.lineTo(0,-(s.r+9)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,s.r+9); ctx.lineTo(0,s.r+16); ctx.stroke();
        ctx.restore();
      }

      projNodes.push({...node, px:x, py:y, hr:s.r+10});
    }
  }
}

/* ---- ATTACK ARCS ----------------------------------------- */
function bezierPt(p0,p1,p2,t){ return (1-t)*(1-t)*p0 + 2*(1-t)*t*p1 + t*t*p2; }

const METHOD_COLOR = {
  udp:"#ff3333", syn:"#ff8800", ack:"#b84dff", stomp:"#ff4da6",
  dns:"#ffe033", vse:"#22e0ff", greip:"#39ff6a", greeth:"#ff5fa2", udpplain:"#3388ff",
  default:"#ff3333",
};

function drawArcs() {
  const now  = Date.now();
  const live = [];

  for (const arc of arcs) {
    if (arc.startTime > now) { live.push(arc); continue; }
    if (!arc._launched) {
      arc._launched = true;
      impacts.push({ x:arc.fx, y:arc.fy, time:now, color:"#00ff41" }); // launch flash at the bot
    }
    const age = (now - arc.startTime)/1000;
    if (age > arc.duration) {
      // Small hit mark per landed beam -- NOT "big" (that shockwave
      // is reserved for the one-off launch moment; every bot landing
      // getting a 70px ring stacked into a mess during sustained fire).
      impacts.push({ x:arc.tx, y:arc.ty, time:now, color: arc.color || METHOD_COLOR[arc.method] || METHOD_COLOR.default });
      continue;
    }
    live.push(arc);

    const {fx,fy,tx,ty} = arc;
    const dist = Math.hypot(tx-fx,ty-fy);
    // Fixed control point -- same curve every frame, so the beam
    // reads as one smooth flight path, not a shaking line.
    const mx = (fx+tx)/2;
    const my = (fy+ty)/2 - dist*0.32;
    const prog = Math.min(age/arc.duration, 1);
    const ex = bezierPt(fx,mx,tx,prog);
    const ey = bezierPt(fy,my,ty,prog);
    const color = arc.color || METHOD_COLOR[arc.method] || METHOD_COLOR.default;

    ctx.save();
    // Soft outer glow -- barely-there, just a halo
    ctx.strokeStyle = color + "22";
    ctx.lineWidth   = 4;
    ctx.lineCap     = "round";
    ctx.beginPath(); ctx.moveTo(fx,fy);
    ctx.quadraticCurveTo(mx,my,ex,ey);
    ctx.stroke();

    // Flowing dash stream along the (static, non-jittering) curve --
    // only the dash offset animates, so it reads as current flowing
    // through a fixed wire, not a shaking line.
    ctx.strokeStyle = color + "55";
    ctx.lineWidth   = 1.3;
    ctx.setLineDash([2,10]);
    ctx.lineDashOffset = -(now/14) % 12;
    ctx.beginPath(); ctx.moveTo(fx,fy);
    ctx.quadraticCurveTo(mx,my,ex,ey);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dim core along almost the whole length -- the tail should
    // read as faint, not opaque, so it doesn't look like a solid bar.
    const grad = ctx.createLinearGradient(fx,fy,ex,ey);
    grad.addColorStop(0,   color+"00");
    grad.addColorStop(.55, color+"18");
    grad.addColorStop(.92, color+"55");
    grad.addColorStop(1,   color+"ff");
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 1.3;
    ctx.beginPath(); ctx.moveTo(fx,fy);
    ctx.quadraticCurveTo(mx,my,ex,ey);
    ctx.stroke();

    // Short hot segment right behind the head only -- this is the
    // only part of the beam that should look "solid".
    const tailStart = Math.max(0, prog - 0.1);
    const sx = bezierPt(fx,mx,tx,tailStart), sy = bezierPt(fy,my,ty,tailStart);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur  = 9;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.shadowBlur  = 0;

    // Plasma rim -- thin white-hot line straight down the middle of
    // the hot segment. Two-tone (colored core + white rim) reads as
    // "plasma/laser", not a flat single-color line.
    ctx.strokeStyle = "#ffffffcc";
    ctx.lineWidth   = 0.7;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();

    // One trailing tracer, dim
    const tp = prog - 0.22;
    if (tp > 0) {
      const px = bezierPt(fx,mx,tx,tp), py = bezierPt(fy,my,ty,tp);
      ctx.beginPath(); ctx.arc(px,py, 1.2, 0, Math.PI*2);
      ctx.fillStyle = color + "90";
      ctx.fill();
    }

    // Arrowhead tip -- oriented along the curve's real tangent at
    // this instant, so it genuinely points where the beam is flying
    // (not just a dot). Classic "attack vector" visual language.
    const tdx = 2*(1-prog)*(mx-fx) + 2*prog*(tx-mx);
    const tdy = 2*(1-prog)*(my-fy) + 2*prog*(ty-my);
    const ang = Math.atan2(tdy, tdx);
    const headLen = 8, headWidth = 4.2;
    const bxp = ex - Math.cos(ang)*headLen, byp = ey - Math.sin(ang)*headLen;
    const lx = bxp + Math.cos(ang+Math.PI/2)*headWidth, ly = byp + Math.sin(ang+Math.PI/2)*headWidth;
    const rx = bxp + Math.cos(ang-Math.PI/2)*headWidth, ry = byp + Math.sin(ang-Math.PI/2)*headWidth;

    ctx.shadowColor = color;
    ctx.shadowBlur  = 13;
    ctx.beginPath();
    ctx.moveTo(ex,ey);
    ctx.lineTo(lx,ly);
    ctx.lineTo(bxp + Math.cos(ang)*2, byp + Math.sin(ang)*2); // slight notch at the back
    ctx.lineTo(rx,ry);
    ctx.closePath();
    ctx.fillStyle = "#fff8e8";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  arcs = live;
  drawImpacts(now);

  // Faint siege tint -- only noticeable once a real flood is running,
  // never overpowers the map.
  if (live.length > 14) {
    const heat = Math.min(0.06, (live.length-14) * 0.0025);
    ctx.fillStyle = `rgba(255,30,30,${heat})`;
    ctx.fillRect(0,0,W,H);
  }
}

/* ---- IMPACT BURSTS (ring pulse where arcs land) ----------- */
function drawImpacts(now) {
  const live = [];
  for (const im of impacts) {
    const span = im.big ? 0.7 : 0.4;
    const age = (now - im.time)/1000;
    if (age > span) continue;
    live.push(im);
    const p = age/span;
    const maxR = im.big ? 34 : 14;
    ctx.beginPath();
    ctx.arc(im.x, im.y, 3 + p*maxR, 0, Math.PI*2);
    ctx.strokeStyle = im.color + Math.floor((1-p)*200).toString(16).padStart(2,"0");
    ctx.lineWidth = im.big ? 2.2 : 1.6;
    ctx.stroke();
  }
  impacts = live;
}

/* ---- MAIN DRAW LOOP -------------------------------------- */
function drawFrame() {
  ctx.clearRect(0,0,W,H);
  drawMap();      // map only, no rain
  drawArcs();     // attack lines
  drawNodes();    // bots + victims + c2/loader
  drawLockLine(); // dashed link from the open HUD panel to its target
  // NO drawLabels() — labels only via hover tooltip
  requestAnimationFrame(drawFrame);
}

/* ---- Lock-on line: ties the floating targeting HUD to the
   actual node on the map it's pointed at, instead of floating
   disconnected from the thing it describes. ---- */
function drawLockLine() {
  if (!hudTarget || hud.hidden) return;
  const { x:tx, y:ty } = project(hudTarget.lat, hudTarget.lon, W, H);
  const hudBox = hud.getBoundingClientRect();
  const mapBox = canvas.getBoundingClientRect();
  const ax = (hudBox.left + hudBox.right)/2 - mapBox.left;
  const ay = (hudBox.top + hudBox.bottom)/2 - mapBox.top;

  ctx.save();
  ctx.setLineDash([4,4]);
  ctx.lineDashOffset = -(Date.now()/40) % 8;
  ctx.strokeStyle = "#ff222270";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(tx,ty); ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath(); ctx.arc(tx,ty,11,0,Math.PI*2);
  ctx.strokeStyle = "#ff2222a0"; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.restore();
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

/* ---- TARGETING HUD (click a victim node) ------------------ */
const hud        = document.getElementById("targetHud");
const hudFlag     = document.getElementById("hudFlag");
const hudName     = document.getElementById("hudName");
const hudIp       = document.getElementById("hudIp");
const screenFlash = document.getElementById("screenFlash");
let hudTarget   = null;
let hudMethod   = "udp";
let hudDuration = 10;

function flashScreen(){
  screenFlash.classList.remove("fire");
  void screenFlash.offsetWidth; // restart animation
  screenFlash.classList.add("fire");
}

function openHud(node, px, py){
  hudTarget = node;
  hudFlag.textContent  = node.id?.startsWith("v_") ? node.id.slice(2).toUpperCase() : "TGT";
  hudName.textContent  = node.label;
  hudIp.textContent    = node.ip;
  const mapRect = canvas.parentElement.getBoundingClientRect();
  let left = px + 16, top = py - 10;
  if (left + 250 > mapRect.width) left = px - 254;
  if (top + 300 > mapRect.height) top = mapRect.height - 310;
  if (top < 8) top = 8;
  hud.style.left = left + "px";
  hud.style.top  = top + "px";
  hud.hidden = false;
}
function closeHud(){ hud.hidden = true; hudTarget = null; }

canvas.addEventListener("click", e => {
  const r  = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  let hit = null, bestDist = Infinity;
  for (const n of projNodes) {
    if (n.type !== "victim") continue;
    const d = Math.hypot(mx-n.px, my-n.py);
    if (d < n.hr+6 && d < bestDist) { hit=n; bestDist=d; }
  }
  if (hit) openHud(hit, mx, my); else closeHud();
});
document.getElementById("hudClose")?.addEventListener("click", closeHud);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeHud(); });

document.querySelectorAll(".hud-method").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".hud-method").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    hudMethod = btn.dataset.method;
  });
});
document.querySelectorAll(".hud-dur").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".hud-dur").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    hudDuration = parseInt(btn.dataset.dur);
  });
});

document.getElementById("hudLaunch")?.addEventListener("click", async ()=>{
  if (!hudTarget || !hudTarget.victimKey) return;
  const victim = hudTarget.victimKey, method = hudMethod, dur = hudDuration, vnode = hudTarget;

  flashScreen();
  const {x:tx,y:ty} = project(vnode.lat, vnode.lon, W, H);
  impacts.push({ x:tx, y:ty, time:Date.now(), color:"#ffffff", big:true });
  fireArcs(victim, dur, method);

  const row = document.querySelector(`.atk-row[data-victim-key="${victim}"]`);
  if (row) row.classList.add("firing");
  updateVitals(_lastBotTotal);
  const atkSt = document.getElementById("atk-status");
  if (atkSt) atkSt.textContent = "> HUD LAUNCH: "+method.toUpperCase()+" >> "+vnode.ip+" // "+dur+"s";
  closeHud();

  try{
    const r = await fetch(API_BASE+"/api/attack",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({target:victim,method,duration:dur,dport:80,ip:vnode.ip})
    });
    const d = await r.json();
    const ok = d.ok !== false;
    toast(ok?"ATK: "+method.toUpperCase()+" >> "+vnode.label:"ERR: "+d.error, !ok);
    termLog("[ATK] "+method+" "+vnode.ip+" "+dur+"s >> "+(ok?"OK":"ERR: "+d.error), ok?"cmd":"err");
  }catch(e){ toast("FETCH ERR",true); }

  setTimeout(()=>{
    if (row) row.classList.remove("firing");
    if (atkSt) atkSt.textContent = "> STANDBY...";
    updateVitals(_lastBotTotal);
  }, dur*1000+500);
});

/* ---- FIRE ATTACK ARCS ------------------------------------
   Waves of comet-beams launch continuously for the FULL attack
   duration (not just the first slice) so the beam stays visible
   for as long as the attack command is actually running.
   ----------------------------------------------------------- */
// Curated vivid palette -- random hue per launch reads as "beautiful
// fireworks variety"; raw random RGB/HSL risks muddy, ugly colors.
const BURST_PALETTE = ["#ff3333","#ff8800","#b84dff","#ff4da6","#ffe033","#22e0ff","#39ff6a","#ff5fa2"];

// Fixed colour per region -- used only in "zone" beam-colour mode.
const ZONE_COLOR = {
  USA:"#ff3333", Mexico:"#ff3333", Brazil:"#ff8800", Argentina:"#ff8800",
  Germany:"#b84dff", France:"#b84dff", Spain:"#b84dff", "United Kingdom":"#b84dff", Poland:"#b84dff", Italy:"#b84dff",
  Russia:"#ff4da6", "Middle East":"#ff4da6",
  India:"#22e0ff", China:"#22e0ff", Japan:"#22e0ff", "South Korea":"#22e0ff", Thailand:"#22e0ff", Indonesia:"#22e0ff",
  Australia:"#39ff6a",
  "Central Africa":"#ffe033",
};

/* ---- Beam colour mode (RANDOM / UNIFORM / ZONE) -------------
   Selectable from the VIEW dropdown. ---- */
let beamColorMode = "random";
const BEAM_MODES = [["random","Random (per bot)"],["uniform","Uniform (per attack)"],["zone","Zone (per region)"]];

function fireArcs(victimKey, duration, method) {
  const victim = VICTIM_MAP[victimKey];
  if (!victim) return;
  const { x:tx, y:ty } = project(victim.lat, victim.lon, W, H);
  const bots = LAB_NODES.filter(n => n.type === "bot");
  if (!bots.length) return;

  // Swarm is capped at 100 now (SIM_BOT_CAP) -- every bot fires,
  // none sit idle as decoration. Wave gap widened a bit so overlap
  // stays reasonable even with the full roster participating.
  const FLIGHT_S     = 0.85;    // single beam travel time
  const WAVE_GAP_MS  = 420;     // new wave launches every N ms
  const waveBots     = bots;
  const totalMs       = Math.max(duration, 1) * 1000;
  const waveCount      = Math.max(1, Math.round(totalMs / WAVE_GAP_MS));
  const t0 = Date.now();
  // Colour assignment depends on beamColorMode (VIEW menu):
  //  - random:  each bot gets its own random colour (many colours per launch)
  //  - uniform: one random colour for the whole launch
  //  - zone:    colour fixed by the bot's region
  const uniformColor = BURST_PALETTE[Math.floor(Math.random()*BURST_PALETTE.length)];
  const botColors = new Map();
  const colorFor = (bot) => {
    if (beamColorMode === "uniform") return uniformColor;
    if (beamColorMode === "zone") return ZONE_COLOR[bot.country] || METHOD_COLOR.default;
    if (!botColors.has(bot.id)) botColors.set(bot.id, BURST_PALETTE[Math.floor(Math.random()*BURST_PALETTE.length)]);
    return botColors.get(bot.id);
  };

  for (let w = 0; w < waveCount; w++) {
    const waveStart = t0 + w * WAVE_GAP_MS;
    waveBots.forEach((bot, i) => {
      const { x:fx, y:fy } = project(bot.lat, bot.lon, W, H);
      arcs.push({ fx, fy, tx, ty, method, color: colorFor(bot), startTime: waveStart + (i % 8) * 18, duration: FLIGHT_S });
    });
  }
}

/* ---- NODE LIST SIDEBAR ------------------------------------
   1200+ bots as a flat scroll is unreadable and boring. Group
   bots by country into collapsible rows; attacker/victim nodes
   stay individual (few, important). Filter box narrows both.
   ----------------------------------------------------------- */
let nodeFilterText = "";

function flashNode(node) {
  const {x,y} = project(node.lat, node.lon, W, H);
  let n = 0;
  const id = setInterval(() => {
    if (n++ > 6) { clearInterval(id); return; }
    ctx.beginPath();
    ctx.arc(x, y, 10+n*5, 0, Math.PI*2);
    ctx.strokeStyle = NODE_STYLE[node.type].fill + "50";
    ctx.lineWidth = 1.5; ctx.stroke();
  }, 60);
}

function makeNodeRow(node, sub) {
  const div = document.createElement("div");
  div.className = "nl-item" + (sub ? " nl-item-sub" : "");
  div.title = node.ip + " -- " + node.country;
  div.innerHTML =
    "<span class='nl-dot dot-"+node.type+"'></span>"+
    "<span class='nl-name'>"+node.label+"</span>"+
    "<span class='nl-ip'>"+node.ip+"</span>";
  div.addEventListener("click", () => flashNode(node));
  return div;
}

function buildNodeList() {
  const list = document.getElementById("node-list");
  if (!list) return;
  const count = document.getElementById("sb-node-count");
  if (count) count.textContent = LAB_NODES.length;

  const q = nodeFilterText.trim().toLowerCase();
  const matches = (n) => !q || n.ip.toLowerCase().includes(q) || n.country.toLowerCase().includes(q) || n.label.toLowerCase().includes(q);

  list.innerHTML = "";

  // Attacker / victim nodes: always shown individually, they're few and critical
  for (const node of LAB_NODES) {
    if (node.type === "bot") continue;
    if (!matches(node)) continue;
    list.appendChild(makeNodeRow(node));
  }

  // Bots grouped by country -- collapsed by default, auto-expand on search match
  const groups = new Map();
  for (const b of LAB_NODES) {
    if (b.type !== "bot") continue;
    if (!groups.has(b.country)) groups.set(b.country, []);
    groups.get(b.country).push(b);
  }
  const countries = [...groups.keys()].sort((a,b) => groups.get(b).length - groups.get(a).length);

  for (const country of countries) {
    const members = groups.get(country);
    const shown = q ? members.filter(matches) : members;
    if (q && !shown.length && !country.toLowerCase().includes(q)) continue;
    const rows = q ? (shown.length ? shown : members) : members;
    const open = !!q;

    const wrap = document.createElement("div");
    wrap.className = "nl-group" + (open ? " open" : "");
    wrap.innerHTML =
      "<button class='nl-group-head' type='button'>"+
        "<span class='nl-chevron'>"+(open?"&#9662;":"&#9656;")+"</span>"+
        "<span class='nl-dot dot-bot'></span>"+
        "<span class='nl-group-name'>"+country+"</span>"+
        "<span class='nl-group-count'>"+members.length+"</span>"+
      "</button>"+
      "<div class='nl-group-body"+(open?"":" hidden")+"'></div>";

    const body = wrap.querySelector(".nl-group-body");
    rows.slice(0, 600).forEach(b => body.appendChild(makeNodeRow(b, true)));

    wrap.querySelector(".nl-group-head").addEventListener("click", () => {
      const isOpen = wrap.classList.toggle("open");
      body.classList.toggle("hidden", !isOpen);
      wrap.querySelector(".nl-chevron").innerHTML = isOpen ? "&#9662;" : "&#9656;";
    });
    list.appendChild(wrap);
  }
}

document.getElementById("nodeFilter")?.addEventListener("input", (e) => {
  nodeFilterText = e.target.value;
  buildNodeList();
});

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

/* ---- SYS.VITALS -------------------------------------------
   Always-visible rail beside the console tabs. Every number here
   is derived from real polled data (bot_total history, active
   firing rows) -- no invented metrics.
   ----------------------------------------------------------- */
const BOOT_TIME   = Date.now();
let botHistory    = [];
let peakBots      = 0;

function updateUptime(){
  const el = document.getElementById("vitalsUptime");
  if (!el) return;
  const s = Math.floor((Date.now()-BOOT_TIME)/1000);
  const hh = String(Math.floor(s/3600)).padStart(2,"0");
  const mm = String(Math.floor((s%3600)/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  el.textContent = `${hh}:${mm}:${ss}`;
}
setInterval(updateUptime,1000); updateUptime();

function drawSparkline(history){
  const cv = document.getElementById("vitals-spark");
  if (!cv) return;
  const g = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  g.clearRect(0,0,w,h);
  if (history.length < 2) return;
  const max = Math.max(1, ...history);
  g.beginPath();
  history.forEach((v,i) => {
    const x = (i/(history.length-1)) * w;
    const y = h - (v/max) * (h-4) - 2;
    i===0 ? g.moveTo(x,y) : g.lineTo(x,y);
  });
  g.strokeStyle = "#00ff41";
  g.lineWidth = 1.4;
  g.shadowColor = "#00ff41";
  g.shadowBlur = 4;
  g.stroke();
  g.shadowBlur = 0;
  const last = history[history.length-1];
  const lx = w, ly = h - (last/max)*(h-4) - 2;
  g.beginPath(); g.arc(lx-2,ly,2,0,Math.PI*2); g.fillStyle="#eaffea"; g.fill();
}

function updateVitals(botTotal){
  botHistory.push(botTotal);
  if (botHistory.length > 50) botHistory.shift();
  peakBots = Math.max(peakBots, botTotal);
  drawSparkline(botHistory);

  const activeAtk = document.querySelectorAll(".atk-row.firing").length;
  const peakEl = document.getElementById("vitalsPeak");
  if (peakEl) peakEl.textContent = botTotal + " / " + peakBots;
  const activeEl = document.getElementById("vitalsActive");
  if (activeEl) activeEl.textContent = activeAtk;

  const threatEl = document.getElementById("vitalsThreat");
  const fillEl   = document.getElementById("vitalsFill");
  let level = "low", pct = Math.min(100, botTotal/10);
  if (botTotal >= 500) { level = "high"; pct = Math.min(100, 60+botTotal/30); }
  else if (botTotal >= 50) { level = "med"; pct = Math.min(100, 30+botTotal/8); }
  if (activeAtk > 0) { level = "high"; pct = 100; }
  if (threatEl){ threatEl.textContent = level.toUpperCase(); threatEl.className = level==="low"?"":"t-"+level; }
  if (fillEl){ fillEl.style.width = pct+"%"; fillEl.className = "vitals-fill"+(level==="low"?"":" t-"+level); }
}

/* ---- Flash a sidebar value when it actually changes -------- */
function setFlashText(id, value){
  const el = document.getElementById(id);
  if (!el) return;
  const next = String(value);
  if (el.textContent !== next) {
    el.textContent = next;
    el.classList.remove("flash");
    void el.offsetWidth; // restart animation
    el.classList.add("flash");
  }
}

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
let _knownBotIps=new Set(); // track per-IP join/leave events

const SIM_BOT_CAP = 100; // cap the simulated swarm size for a clean, individually-visible map

function applyStatus(data){
  const cncUp = !!data.cnc_up;
  const bots  = Math.min(SIM_BOT_CAP, data.bot_total ?? 0);
  const peers = data.tcp_peers ?? "--";

  const peerIps = data.peer_ips || [];
  const peerSet = new Set(peerIps.map(ip=>ip.replace(/^::ffff:/,'')));

  // Log per-IP JOIN events (new IPs not seen before)
  peerSet.forEach(ip=>{
    if(!_knownBotIps.has(ip)){
      termLog("[BOT] JOIN  "+ip+" (total: "+peerSet.size+")","ok");
      _knownBotIps.add(ip);
    }
  });
  // Log per-IP LEAVE events (IPs that disappeared)
  _knownBotIps.forEach(ip=>{
    if(!peerSet.has(ip)){
      termLog("[BOT] LEAVE "+ip+" (total: "+peerSet.size+")","err");
      _knownBotIps.delete(ip);
    }
  });

  if (peerIps.length > 0 || bots !== _lastBotTotal) {
    LAB_NODES = [...STATIC_NODES];
    
    peerIps.forEach((ip, i) => {
      let hash = 0;
      for(let k=0; k<ip.length; k++) hash = Math.imul(31, hash) + ip.charCodeAt(k) | 0;
      const seed = Math.abs(hash);
      
      
      // Clean IPv4-mapped IPv6 addresses (e.g. ::ffff:110.164.20.213 -> 110.164.20.213)
      let cleanIp = ip.replace(/^::ffff:/, '');
      const firstOctet = parseInt(cleanIp.split('.')[0] || "10");

      let r = REGIONS[seed % REGIONS.length];

      if (firstOctet === 110 || firstOctet === 125) { r = {lat:15, lon:101, c:"Thailand"}; }
      else if (firstOctet === 66) { r = {lat:39, lon:-98, c:"USA"}; }
      else if (firstOctet === 210) { r = {lat:36, lon:128, c:"South Korea"}; }
      else if (firstOctet === 114) { r = {lat:35, lon:104, c:"China"}; }
      else if (firstOctet === 95 || firstOctet === 217) { r = {lat:55, lon:37, c:"Russia"}; }
      else if (firstOctet === 46) { r = {lat:51, lon:10, c:"Germany"}; }
      else if (firstOctet === 177) { r = {lat:-14, lon:-52, c:"Brazil"}; }
      else if (firstOctet === 8) { r = {lat:55, lon:-3, c:"United Kingdom"}; }
      else if (firstOctet === 1) { r = {lat:36, lon:138, c:"Japan"}; }

      const rand1 = ((seed * 9301 + 49297) % 233280) / 233280;
      const rand2 = ((seed * 1103515245 + 12345) % 2147483648) / 2147483648;
      const lat = r.lat + (rand1-.5)*0.5;
      const lon = r.lon + (rand2-.5)*0.7;

      LAB_NODES.push({
        id: "bot_peer_" + i,
        type: "bot",
        label: "BOT-" + (i+1),
        ip: cleanIp,
        lat, lon,
        country: r.c
      });
    });

    const remaining = Math.max(0, bots - peerIps.length);
    if (remaining > 0) {
      LAB_NODES.push(...ALL_BOTS.slice(0, remaining));
    }
    
    _lastBotTotal = bots;
    buildNodeList(); // update sidebar
  }
  _lastBotTotal = bots;

  // Override display with real peer count
  const displayBots = peerIps.length || bots;
  const elCount=document.getElementById("hdr-bot-count");
  if(elCount) elCount.textContent=String(displayBots).padStart(3,"0");
  updateVitals(displayBots);

  const chip=document.getElementById("hdr-cnc-status");
  if(chip){ chip.textContent=cncUp?"[CNC:UP]":"[CNC:DOWN]"; chip.className="hdr-chip "+(cncUp?"chip-up":"chip-down"); }

  const ledCnc=document.getElementById("led-cnc");
  if(ledCnc) ledCnc.className="led"+(cncUp?" on":"");
  setFlashText("sb-cnc-text", cncUp?"UP":"DOWN");
  setFlashText("sb-bot-text", bots);
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
let _lastLogLine=""; // dedup: track last line printed from /api/logs
async function pollLogs(){
  try{
    const r=await fetch(API_BASE+"/api/logs");
    if(!r.ok) return;
    const d=await r.json();
    const lines=(d.logs||[]);
    // Only print lines we haven't shown yet (find the new tail since last poll)
    const lastIdx=lines.lastIndexOf(_lastLogLine);
    const newLines=lastIdx===-1 ? lines.slice(-5) : lines.slice(lastIdx+1);
    newLines.forEach(l=>{
      if(!l) return;
      // Skip repetitive "CNC session ok" noise — only log if bots count changed
      if(l.includes("CNC session ok")) return;
      const cls=l.includes("[ERR]")?"err":l.includes("[CMD]")?"cmd":l.includes("[OK]")?"ok":l.includes("[WARN]")?"err":"sys";
      termLog(l,cls);
    });
    if(lines.length>0) _lastLogLine=lines[lines.length-1];
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
    setFlashText("sb-agent-text", agentOk?"UP":"DOWN");
    const lh=document.getElementById("led-http");
    if(lh) lh.className="led led-blue"+(httpOk?" on":"");
    setFlashText("sb-http-text", httpOk?"UP":"DOWN");
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
    updateVitals(_lastBotTotal);
    const atkSt=document.getElementById("atk-status");
    if(atkSt) atkSt.textContent="> LAUNCHING: "+method.toUpperCase()+" >> "+vnode.ip+" // "+dur+"s";

    flashScreen();
    const {x:tx0,y:ty0} = project(vnode.lat, vnode.lon, W, H);
    impacts.push({ x:tx0, y:ty0, time:Date.now(), color:"#ffffff", big:true });
    fireArcs(victim, dur, method);

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
      updateVitals(_lastBotTotal);
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
const toggleView=(name,btn)=>{document.body.classList.toggle(name);btn?.classList.toggle("active",document.body.classList.contains(name));};
/* ---- VIEW dropdown (declutters the header -- was 6 buttons
   jammed into one row) ---- */
const viewMenuBtn = document.getElementById("btn-view-menu");
const viewMenu    = document.getElementById("viewMenu");
function closeViewMenu(){ viewMenu.hidden = true; viewMenuBtn.setAttribute("aria-expanded","false"); viewMenuBtn.classList.remove("active"); }
viewMenuBtn?.addEventListener("click",(e)=>{
  e.stopPropagation();
  const open = viewMenu.hidden;
  viewMenu.hidden = !open;
  viewMenuBtn.setAttribute("aria-expanded", String(open));
  viewMenuBtn.classList.toggle("active", open);
});
viewMenu?.addEventListener("click",(e)=>{ if (e.target.closest(".vm-item")) closeViewMenu(); });
document.addEventListener("click",(e)=>{ if (!viewMenu.hidden && !e.target.closest(".hdr-controls")) closeViewMenu(); });
document.addEventListener("keydown",(e)=>{ if (e.key === "Escape") closeViewMenu(); });

document.getElementById("btn-toggle-sidebar")?.addEventListener("click",(e)=>{toggleView("sidebar-hidden",e.currentTarget);resize();});
document.getElementById("btn-toggle-console")?.addEventListener("click",(e)=>{toggleView("console-hidden",e.currentTarget);resize();});
document.getElementById("btn-toggle-loader")?.addEventListener("click",(e)=>{
  const hidden = document.body.classList.toggle("loader-hidden");
  e.currentTarget.classList.toggle("active", hidden);
  e.currentTarget.textContent = hidden ? "[SHOW LDR.TAB]" : "[HIDE LDR.TAB]";
  if (hidden && document.querySelector('.tab[data-tab="loader"]')?.classList.contains("active")) {
    document.querySelector('.tab[data-tab="attack"]')?.click();
  }
});
document.getElementById("btn-toggle-loader-node")?.addEventListener("click",(e)=>{
  hideLoaderNode = !hideLoaderNode;
  e.currentTarget.classList.toggle("active", hideLoaderNode);
  e.currentTarget.textContent = hideLoaderNode ? "[SHOW LDR.DOT]" : "[HIDE LDR.DOT]";
});
document.getElementById("btn-beam-color")?.addEventListener("click",(e)=>{
  const idx = BEAM_MODES.findIndex(([k]) => k === beamColorMode);
  beamColorMode = BEAM_MODES[(idx+1) % BEAM_MODES.length][0];
  e.currentTarget.textContent = "Beam colour: " + BEAM_MODES.find(([k]) => k === beamColorMode)[1];
});
document.getElementById("btn-focus-map")?.addEventListener("click",(e)=>{document.body.classList.toggle("focus-map");e.currentTarget.classList.toggle("active",document.body.classList.contains("focus-map"));resize();});

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
window.addEventListener("resize",()=>{resize();buildMapTexture();});
resize();
buildMapTexture();
buildNodeList();
drawFrame();
pollStatus(); pollLogs(); pollOverview();
setInterval(pollStatus,   POLL_MS);
setInterval(pollLogs,     LOG_POLL_MS);
setInterval(pollOverview, 15000);
termLog("[SYS] BOTNET.EXE // MIRAI LAB v2.0 // "+new Date().toLocaleString(),"sys");
termLog("[SYS] MAP: "+LAB_NODES.filter(n=>n.type==="bot").length+" bots | "+LAB_NODES.filter(n=>n.type==="victim").length+" targets","sys");
