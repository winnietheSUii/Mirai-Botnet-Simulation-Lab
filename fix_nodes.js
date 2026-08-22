const fs = require('fs');
let content = fs.readFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/frontend/app.js', 'utf8');

// Replace LAB_NODES definition
const newNodesDef = `const STATIC_NODES = [
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

let LAB_NODES = [...STATIC_NODES];`;

content = content.replace(/const LAB_NODES = \[[\s\S]*?VICTIM_MAP\[v\.victimKey\] = v; \}\);/m, newNodesDef);

// Replace applyStatus logic
const oldStatus = `  if (bots > _lastBotTotal) {
    // Bot count went up — log it (no random dots)
    termLog("[BOT] +"+(bots-_lastBotTotal)+" new bots. total="+bots,"ok");
  }
  _lastBotTotal = bots;

  const elCount=document.getElementById("hdr-bot-count");
  if(elCount) elCount.textContent=String(bots).padStart(3,"0");
  const elPeers=document.getElementById("hdr-peers");
  if(elPeers) elPeers.textContent=peers;`;

const newStatus = `  if (bots !== _lastBotTotal) {
    LAB_NODES = [...STATIC_NODES, ...ALL_BOTS.slice(0, bots)];
    buildNodeList(); // update sidebar
    if(bots > _lastBotTotal) termLog("[BOT] +"+(bots-_lastBotTotal)+" new bots. total="+bots,"ok");
  }
  _lastBotTotal = bots;

  const elCount=document.getElementById("hdr-bot-count");
  if(elCount) elCount.textContent=String(bots).padStart(3,"0");`;

content = content.replace(oldStatus, newStatus);

fs.writeFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/frontend/app.js', content);
console.log('Done!');
