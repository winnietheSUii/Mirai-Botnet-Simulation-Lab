const fs = require('fs');
let content = fs.readFileSync('z:/Univ\CyberModule/Mirai-Source-Code/dashboard/version2/frontend/app.js', 'utf8');

const oldStatus = `  if (bots !== _lastBotTotal) {
    LAB_NODES = [...STATIC_NODES, ...ALL_BOTS.slice(0, bots)];
    buildNodeList(); // update sidebar
    if(bots > _lastBotTotal) termLog("[BOT] +"+(bots-_lastBotTotal)+" new bots. total="+bots,"ok");
  }
  _lastBotTotal = bots;`;

const newStatus = `  const peerIps = data.peer_ips || [];

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
    buildNodeList();
  }`;

content = content.replace(oldStatus, newStatus);
fs.writeFileSync('z:/Univ\CyberModule/Mirai-Source-Code/dashboard/version2/frontend/app.js', content);
console.log("Updated applyStatus");
